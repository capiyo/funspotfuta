// Ported from funspot/lib/services/web_soecket.dart — a singleton,
// multi-room WebSocket client. One physical socket, many joined rooms
// (additive join/leave, replayed on reconnect), heartbeat ping/pong,
// exponential-backoff reconnect, and a type -> listener event bus. Same
// message envelope ({type, payload, timestamp}) and same wire endpoint as
// the original so it talks to the same backend unmodified.

type Listener = (payload: Record<string, any>) => void;

const WS_ENDPOINT = 'wss://clash-api-m5mr.onrender.com/ws/channel';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 2000;
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
    const { userId, username, channelId, fixtureId } = params;
    const initialRoomId = this.roomIdFor(channelId, fixtureId);

    if (this.isConnected) {
      this.joinRoom(initialRoomId);
      return;
    }
    if (this.isConnecting) return;

    this.currentUserId = userId;
    this.currentUsername = username;
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
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.rejoinAllRooms();
    this.flushMessageQueue();
    this.startHeartbeat();
    this.connectionStatusListeners.forEach((l) => l(true));
  }

  private handleConnectionFailure(_reason: string) {
    this.isConnecting = false;
    this.isConnected = false;
    this.scheduleReconnect();
  }

  private handleError() {
    // onclose fires after onerror for browser WebSocket; handleDisconnect covers cleanup.
  }

  private handleDisconnect() {
    this.isConnected = false;
    this.isConnecting = false;
    this.stopHeartbeat();
    this.connectionStatusListeners.forEach((l) => l(false));
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = INITIAL_RECONNECT_DELAY_MS * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      if (this.currentUserId && this.currentUsername && this.currentChannelId) {
        this.connect({
          userId: this.currentUserId,
          username: this.currentUsername,
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
      this.sendPing();
      if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = setTimeout(() => {
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

  // -----------------------------------------------------------------------
  // CHAT HELPERS
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.joinedRoomsSet.clear();
  }
}

export const webSocketService = WebSocketService.instance;
