// Ported from funspot/lib/services/web_soecket.dart — a singleton,
// multi-room WebSocket client. One physical socket, many joined rooms
// (additive join/leave, replayed on reconnect), heartbeat ping/pong,
// capped-backoff reconnect that retries indefinitely, and a
// type -> listener event bus. Same message envelope
// ({type, payload, timestamp}) and same wire endpoint as the Dart original
// so it talks to the same backend unmodified.
//
// This revision brings the TS port back in sync with the Dart source after
// it picked up: an indefinite reconnect loop (capped backoff instead of
// giving up after N attempts), explicit detection of a socket that closes
// mid-handshake (before the server's "connected" ack), dedicated
// minute-update helpers, clearAllListeners(), a few extra getters, and a
// dispose() teardown.

type Listener = (payload: Record<string, any>) => void;

const WS_ENDPOINT = 'wss://clash-api-m5mr.onrender.com/ws/channel';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 2000;
const CAPPED_RECONNECT_DELAY_MS = 30000;
const CONNECTION_TIMEOUT_MS = 10000;
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 35000;

class WebSocketService {
  private static _instance: WebSocketService;
  static get instance(): WebSocketService {
    if (!WebSocketService._instance) WebSocketService._instance = new WebSocketService();
    return WebSocketService._instance;
  }

  private socket: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;

  private currentUserId: string | null = null;
  private currentUsername: string | null = null;
  private currentAuthToken: string | null = null;
  private currentChannelId: string | null = null;
  private currentFixtureId: string | null = null;

  private joinedRoomsSet = new Set<string>();
  private messageQueue: { type: string; payload: Record<string, any> }[] = [];
  private listeners = new Map<string, Listener[]>();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private connectionStatusListeners: ((connected: boolean) => void)[] = [];

  onConnectionStatus(cb: (connected: boolean) => void) {
    this.connectionStatusListeners.push(cb);
    return () => {
      this.connectionStatusListeners = this.connectionStatusListeners.filter((l) => l !== cb);
    };
  }

  get joinedRooms(): ReadonlySet<string> {
    return this.joinedRoomsSet;
  }
  isInRoom(roomId: string) {
    return this.joinedRoomsSet.has(roomId);
  }

  private roomIdFor(channelId: string, fixtureId?: string | null) {
    return fixtureId ? `${channelId}_${fixtureId}` : `${channelId}_overall`;
  }

  // -----------------------------------------------------------------------
  // JOIN / LEAVE — additive, multi-room
  // -----------------------------------------------------------------------
  joinRoom(roomId: string) {
    if (this.joinedRoomsSet.has(roomId)) return;
    this.joinedRoomsSet.add(roomId);
    if (!this.isConnected) return; // rejoined automatically on connect
    this.send('room.join', { roomId });
  }

  leaveRoom(roomId: string) {
    if (!this.joinedRoomsSet.delete(roomId)) return;
    if (this.isConnected) this.send('room.leave', { roomId });
  }

  private rejoinAllRooms() {
    if (this.joinedRoomsSet.size === 0) return;
    for (const roomId of this.joinedRoomsSet) {
      this.send('room.join', { roomId });
    }
  }

  // -----------------------------------------------------------------------
  // CONNECT
  // -----------------------------------------------------------------------
  async connect(params: {
    userId: string;
    username: string;
    authToken?: string;
    channelId: string;
    fixtureId?: string | null;
  }) {
    const { userId, username, authToken, channelId, fixtureId } = params;
    const initialRoomId = this.roomIdFor(channelId, fixtureId);

    if (this.isConnected) {
      this.joinRoom(initialRoomId);
      return;
    }
    if (this.isConnecting) return;

    this.currentUserId = userId;
    this.currentUsername = username;
    this.currentAuthToken = authToken ?? null;
    this.currentChannelId = channelId;
    this.currentFixtureId = fixtureId ?? null;
    this.isConnecting = true;
    this.joinedRoomsSet.add(initialRoomId);

    const url =
      `${WS_ENDPOINT}?user_id=${encodeURIComponent(userId)}` +
      `&username=${encodeURIComponent(username)}` +
      `&channel_id=${encodeURIComponent(channelId)}` +
      `&fixture_id=${encodeURIComponent(fixtureId ?? '')}`;

    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.connectionTimeoutTimer = setTimeout(() => {
      if (this.isConnecting && !this.isConnected) this.handleConnectionFailure('Connection timed out');
    }, CONNECTION_TIMEOUT_MS);

    try {
      this.socket = new WebSocket(url);
      this.socket.onopen = () => {
        /* 'connected' event from server confirms; see handleMessage */
      };
      this.socket.onmessage = (ev) => this.handleMessage(ev.data);
      this.socket.onerror = () => this.handleError();
      this.socket.onclose = () => this.handleDisconnect();
    } catch (e) {
      this.handleConnectionFailure(`Connection error: ${e}`);
    }
  }

  private handleConnectionSuccess() {
    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.connectionTimeoutTimer = null;

    if (this.isConnecting || !this.isConnected) {
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
      this.rejoinAllRooms();
      this.startHeartbeat();
      this.connectionStatusListeners.forEach((l) => l(true));
    }
  }

  private handleConnectionFailure(_reason: string) {
    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.connectionTimeoutTimer = null;
    this.stopHeartbeat();

    this.isConnecting = false;
    this.isConnected = false;

    try {
      this.socket?.close();
    } catch {
      /* ignore */
    }
    this.socket = null;

    this.connectionStatusListeners.forEach((l) => l(false));
    this.scheduleReconnect();
  }

  private handleError() {
    // onclose fires after onerror for browser WebSocket; handleDisconnect covers cleanup.
  }

  private handleDisconnect() {
    this.stopHeartbeat();
    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.connectionTimeoutTimer = null;

    if (this.isConnecting) {
      // Socket closed before the server's "connected" ack ever arrived — this
      // used to be silently swallowed because isConnected was still false,
      // leaving the client permanently stuck "connecting" forever.
      this.handleConnectionFailure('Socket closed during handshake');
      return;
    }

    if (this.isConnected) {
      this.isConnected = false;
      // Deliberately do NOT clear joinedRoomsSet here — remember them so
      // rejoinAllRooms() can restore them once the reconnect succeeds.
      this.connectionStatusListeners.forEach((l) => l(false));
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    // Keep retrying indefinitely with a capped backoff instead of giving up
    // after N attempts — during a live match, giving up permanently just
    // because the network blipped a handful of times is worse than a slow
    // retry loop.
    const delay =
      this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS
        ? INITIAL_RECONNECT_DELAY_MS * (this.reconnectAttempts + 1)
        : CAPPED_RECONNECT_DELAY_MS;

    this.reconnectAttempts += 1;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.currentUserId && this.currentUsername && this.currentChannelId) {
        this.connect({
          userId: this.currentUserId,
          username: this.currentUsername,
          authToken: this.currentAuthToken ?? undefined,
          channelId: this.currentChannelId,
          fixtureId: this.currentFixtureId,
        });
      }
    }, delay);
  }

  // -----------------------------------------------------------------------
  // HEARTBEAT
  // -----------------------------------------------------------------------
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return;
      this.sendPing();
      if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = setTimeout(() => {
        if (this.isConnected) this.handleDisconnect();
        this.socket?.close();
      }, HEARTBEAT_TIMEOUT_MS - HEARTBEAT_INTERVAL_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }
  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer);
    this.heartbeatTimer = null;
    this.heartbeatTimeoutTimer = null;
  }
  private cancelHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer);
    this.heartbeatTimeoutTimer = null;
  }

  // -----------------------------------------------------------------------
  // MESSAGE HANDLING
  // -----------------------------------------------------------------------
  private handleMessage(raw: string) {
    try {
      const data = JSON.parse(raw);
      const eventType: string = data.type ?? 'unknown';
      const payload: Record<string, any> = data.payload ?? {};

      if (eventType === 'connected') {
        this.cancelHeartbeatTimeout();
        this.handleConnectionSuccess();
        return;
      }
      if (eventType === 'pong') {
        this.cancelHeartbeatTimeout();
        return;
      }
      if (eventType === 'room.joined' || eventType === 'room.left') return;

      this.listeners.get(eventType)?.forEach((l) => l(payload));
      this.listeners.get('*')?.forEach((l) => l({ type: eventType, ...payload }));
    } catch (e) {
      console.error('WS handleMessage parse error:', e);
    }
  }

  send(type: string, payload: Record<string, any>) {
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    if (this.isConnected && this.socket) {
      try {
        this.socket.send(message);
      } catch {
        this.handleDisconnect();
      }
    } else {
      this.messageQueue.push({ type, payload });
    }
  }

  private flushMessageQueue() {
    if (!this.isConnected) return;
    const queued = [...this.messageQueue];
    this.messageQueue = [];
    queued.forEach((m) => this.send(m.type, m.payload));
  }

  // -----------------------------------------------------------------------
  // EVENT SUBSCRIPTION
  // -----------------------------------------------------------------------
  on(eventType: string, callback: Listener) {
    if (!this.listeners.has(eventType)) this.listeners.set(eventType, []);
    this.listeners.get(eventType)!.push(callback);
  }
  off(eventType: string, callback: Listener) {
    const list = this.listeners.get(eventType);
    if (list) this.listeners.set(eventType, list.filter((l) => l !== callback));
  }
  offAll(eventType: string) {
    this.listeners.delete(eventType);
  }
  clearAllListeners() {
    this.listeners.clear();
  }

  // -----------------------------------------------------------------------
  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeat();
    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.connectionTimeoutTimer = null;
    this.socket?.close();
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.joinedRoomsSet.clear();
    this.connectionStatusListeners.forEach((l) => l(false));
  }

  /** Full teardown — cancels every timer, disconnects, and drops listeners.
   *  Use only when the whole app is done with this service (logout, app
   *  unmount) — not for leaving a single screen, which should instead call
   *  leaveRoom()/leaveChannelFixtureRoom(). */
  dispose() {
    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.connectionTimeoutTimer = null;
    this.reconnectTimer = null;
    this.disconnect();
    this.clearAllListeners();
    this.connectionStatusListeners = [];
  }

  // ── Room helpers (named, channel+fixture) ────────────────────────
  joinChannelFixtureRoom(channelId: string, fixtureId?: string | null) {
    this.joinRoom(this.roomIdFor(channelId, fixtureId));
  }

  leaveChannelFixtureRoom(channelId: string, fixtureId?: string | null) {
    this.leaveRoom(this.roomIdFor(channelId, fixtureId));
  }

  // ── Dedicated minute methods ──────────────────────────────────────
  requestCurrentMinute(params: { fixtureId: string; channelId?: string }) {
    const payload: Record<string, any> = { fixtureId: params.fixtureId };
    if (params.channelId) payload.channelId = params.channelId;

    if (!this.isConnected) {
      this.messageQueue.push({ type: 'get.minute', payload });
      return;
    }
    this.send('get.minute', payload);
  }

  /** Joins that fixture's room additively, alongside whatever else is
   *  already joined, so minute updates start flowing on this connection. */
  subscribeToMinuteUpdates(params: { fixtureId: string; channelId: string }) {
    this.joinChannelFixtureRoom(params.channelId, params.fixtureId);
  }

  /** Leaves just that fixture's room. */
  unsubscribeFromMinuteUpdates(params: { fixtureId: string; channelId: string }) {
    this.leaveChannelFixtureRoom(params.channelId, params.fixtureId);
  }

  /** Manual minute update (testing/admin). */
  sendMinuteUpdate(params: {
    fixtureId: string;
    channelId: string;
    minute: number;
    status: string;
    minuteDisplay: string;
  }) {
    if (!this.isConnected) return;
    this.send('minute.update', {
      fixture_id: params.fixtureId,
      channel_id: params.channelId,
      minute: params.minute,
      minute_display: params.minuteDisplay,
      status: params.status,
    });
  }

  // ── Chat helpers ───────────────────────────────────────────────────
  sendChatMessage(params: {
    message: string;
    selection: string;
    username: string;
    messageId: string;
    channelId: string;
    fixtureId?: string | null;
    replyTo?: Record<string, any> | null;
    imageUrl?: string | null;
    videoUrl?: string | null;
    videoThumbnailUrl?: string | null;
    isImage?: boolean;
    isVideo?: boolean;
    tempId?: string;
  }) {
    const payload: Record<string, any> = {
      message: params.message,
      selection: params.selection,
      username: params.username,
      userId: this.currentUserId,
      messageId: params.messageId,
      replyTo: params.replyTo ?? null,
      imageUrl: params.imageUrl ?? null,
      videoUrl: params.videoUrl ?? null,
      videoThumbnailUrl: params.videoThumbnailUrl ?? null,
      isImage: params.isImage ?? false,
      isVideo: params.isVideo ?? false,
      channelId: params.channelId,
      fixtureId: params.fixtureId ?? null,
      timestamp: new Date().toISOString(),
    };
    if (params.tempId) payload.tempId = params.tempId;

    if (!this.isConnected) {
      this.messageQueue.push({ type: 'chat.message', payload });
      return;
    }
    this.send('chat.message', payload);
  }

  sendTyping(params: { channelId: string; fixtureId?: string; isTyping: boolean; username: string }) {
    if (!this.currentUserId) return;
    const payload: Record<string, any> = {
      isTyping: params.isTyping,
      username: params.username,
      channelId: params.channelId,
      userId: this.currentUserId,
    };
    if (params.fixtureId) payload.fixtureId = params.fixtureId;
    this.send('typing', payload);
  }

  sendPing() {
    this.send('ping', {});
  }

  // ── Reliable chat send ───────────────────────────────────────────
  // Hands the message to the socket if connected. If not, queues it (via
  // this.send's existing messageQueue) and waits — up to 3s — for the
  // socket to come up before giving up. If it times out, tries one
  // reconnect attempt via onReconnectAttempt and waits again briefly.
  async sendChatMessageReliable(params: {
    message: string;
    selection: string;
    username: string;
    messageId: string;
    channelId: string;
    fixtureId?: string | null;
    replyTo?: Record<string, any> | null;
    imageUrl?: string | null;
    videoUrl?: string | null;
    videoThumbnailUrl?: string | null;
    isImage?: boolean;
    isVideo?: boolean;
    tempId?: string;
    onReconnectAttempt?: () => Promise<void> | void;
  }): Promise<boolean> {
    if (this.isConnected) {
      this.sendChatMessage(params);
      return true;
    }

    // Wait a bit for a pending connect to finish.
    const firstWait = await this.waitForConnection(3000);
    if (firstWait) {
      this.sendChatMessage(params);
      return true;
    }

    // Try one reconnect attempt.
    if (params.onReconnectAttempt) {
      try {
        await params.onReconnectAttempt();
      } catch {
        /* ignore */
      }
    }

    const secondWait = await this.waitForConnection(2000);
    if (secondWait) {
      this.sendChatMessage(params);
      return true;
    }

    return false;
  }

  // Resolves true as soon as isConnected flips to true, or false after
  // `timeoutMs`. Cleans up its own listeners.
  private waitForConnection(timeoutMs: number): Promise<boolean> {
    if (this.isConnected) return Promise.resolve(true);

    return new Promise((resolve) => {
      let done = false;

      const unsubscribe = this.onConnectionStatus((connected) => {
        if (!done && connected) {
          done = true;
          unsubscribe();
          clearTimeout(timer);
          resolve(true);
        }
      });

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        unsubscribe();
        resolve(false);
      }, timeoutMs);
    });
  }

  // ── Getters ──────────────────────────────────────────────────────
  getIsConnected() {
    return this.isConnected;
  }
  getCurrentUserId() {
    return this.currentUserId;
  }
  getCurrentChannelId() {
    return this.currentChannelId;
  }
  getCurrentFixtureId() {
    return this.currentFixtureId;
  }
}

export const webSocketService = WebSocketService.instance;