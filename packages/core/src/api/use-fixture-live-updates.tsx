import { useEffect, useState } from 'react';
import { webSocketService } from './websocket-service';

export interface FixtureLiveSeed {
  status?: string | null;
  isLive?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  timeElapsed?: number | null;
}

export interface LiveFixtureCommentary {
  text: string;
  minute: number;
  timestamp?: string;
}

export interface FixtureLiveState {
  connected: boolean;
  commentary: LiveFixtureCommentary | null;
  status: string;
  isLive: boolean;
  homeScore: number | null;
  awayScore: number | null;
  timeElapsed: number | null;
}

function isLiveStatus(status: string): boolean {
  return ['live', 'in_play', 'in-play', 'injury_time', 'half_time', 'halftime'].includes(status.toLowerCase());
}

function isFinishedStatus(status: string): boolean {
  return ['full_time', 'full-time', 'finished', 'completed', 'ended'].includes(status.toLowerCase());
}

function payloadMatchesFixture(
  payload: Record<string, unknown>,
  channelId: string,
  fixtureId: string,
): boolean {
  const eventFixtureId = payload.fixtureId ?? payload.fixture_id ?? payload.matchId ?? payload.match_id;
  if (eventFixtureId != null && String(eventFixtureId) !== fixtureId) return false;

  const eventChannelId = payload.channelId ?? payload.channel_id;
  if (eventChannelId != null && String(eventChannelId) !== channelId) return false;

  return true;
}

/**
 * Live fixture state shared by the web and React Native cards.
 * It follows Flutter's WebSocketService protocol: one singleton connection,
 * additive channel/fixture rooms, get.minute catch-up after connect, and
 * match.status / match.goal / match.ended / minute.update event handling.
 */
export function useFixtureLiveUpdates(params: {
  channelId: string | null | undefined;
  fixtureId: string | null | undefined;
  userId: string | null | undefined;
  username: string | null | undefined;
  authToken?: string | null;
  seed?: FixtureLiveSeed | null;
}): FixtureLiveState {
  const { channelId, fixtureId, userId, username, authToken, seed } = params;
  const [state, setState] = useState<FixtureLiveState>(() => {
    const status = seed?.status ?? 'upcoming';
    return {
      connected: false,
      commentary: null,
      status,
      isLive: seed?.isLive ?? isLiveStatus(status),
      homeScore: seed?.homeScore ?? null,
      awayScore: seed?.awayScore ?? null,
      timeElapsed: seed?.timeElapsed ?? null,
    };
  });

  useEffect(() => {
    const status = seed?.status ?? 'upcoming';
    setState({
      connected: webSocketService.getIsConnected(),
      commentary: null,
      status,
      isLive: seed?.isLive ?? isLiveStatus(status),
      homeScore: seed?.homeScore ?? null,
      awayScore: seed?.awayScore ?? null,
      timeElapsed: seed?.timeElapsed ?? null,
    });
    // Seed only resets when the room identity changes; incoming socket events
    // should not be overwritten by unrelated fixture object refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, fixtureId]);

  useEffect(() => {
    if (!channelId || !fixtureId || !userId || !username) return;
    let active = true;
    const roomId = `${channelId}_${fixtureId}`;

    const applyStatus = (status: string) => {
      if (isFinishedStatus(status)) {
        setState((previous) => ({ ...previous, status: 'completed', isLive: false }));
      } else if (isLiveStatus(status)) {
        setState((previous) => ({
          ...previous,
          status: status.toLowerCase() === 'half_time' || status.toLowerCase() === 'halftime' ? 'half_time' : 'live',
          isLive: true,
        }));
      } else {
        setState((previous) => ({ ...previous, status, isLive: false }));
      }
    };

    const onStatus = (connected: boolean) => {
      if (active) setState((previous) => ({ ...previous, connected }));
    };

    const onConnected = () => {
      if (!active) return;
      webSocketService.send('get.commentary', { fixtureId });
      webSocketService.send('get.latest.comment', { fixtureId, channelId });
      webSocketService.requestCurrentMinute({ fixtureId, channelId });
    };

    const onCommentaryNew = (payload: Record<string, unknown>) => {
      const data = (payload.payload && typeof payload.payload === 'object'
        ? payload.payload
        : payload) as Record<string, unknown>;
      if (!payloadMatchesFixture(data, channelId, fixtureId)) return;
      const text = data.text == null ? '' : String(data.text);
      if (!text.trim()) return;
      const rawMinute = data.minute;
      const rawTimestamp = data.createdAt ?? data.created_at ?? data.timestamp;
      setState((previous) => ({
        ...previous,
        commentary: {
          text,
          minute: typeof rawMinute === 'number' ? rawMinute : Number(rawMinute ?? 0) || 0,
          ...(rawTimestamp != null ? { timestamp: String(rawTimestamp) } : {}),
        },
      }));
    };

    const onCommentaryBulk = (payload: Record<string, unknown>) => {
      const rawEntries = Array.isArray(payload) ? payload : (payload.payload ?? payload.commentary);
      if (!Array.isArray(rawEntries)) return;
      const entries = rawEntries.filter((entry): entry is Record<string, unknown> =>
        !!entry && typeof entry === 'object' && payloadMatchesFixture(entry as Record<string, unknown>, channelId, fixtureId),
      );
      if (!entries.length) return;
      // Commentary batches can arrive newest-first or oldest-first depending
      // on the endpoint version; choose the newest timestamp when available.
      const sorted = [...entries].sort((a, b) => {
        const timeA = Date.parse(String(a.createdAt ?? a.created_at ?? a.timestamp ?? ''));
        const timeB = Date.parse(String(b.createdAt ?? b.created_at ?? b.timestamp ?? ''));
        if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) return 0;
        return timeA - timeB;
      });
      const latest = sorted[sorted.length - 1];
      if (!latest) return;
      const text = latest.text == null ? '' : String(latest.text);
      if (!text.trim()) return;
      const rawTimestamp = latest.createdAt ?? latest.created_at ?? latest.timestamp;
      setState((previous) => ({
        ...previous,
        commentary: {
          text,
          minute: typeof latest.minute === 'number' ? latest.minute : Number(latest.minute ?? 0) || 0,
          ...(rawTimestamp != null ? { timestamp: String(rawTimestamp) } : {}),
        },
      }));
    };

    const onMatchStatus = (payload: Record<string, unknown>) => {
      if (!payloadMatchesFixture(payload, channelId, fixtureId)) return;
      const status = String(payload.status ?? 'live');
      applyStatus(status);
      const home = payload.home_score ?? payload.homeScore;
      const away = payload.away_score ?? payload.awayScore;
      const elapsed = payload.timeElapsed ?? payload.time_elapsed ?? payload.minute;
      setState((previous) => ({
        ...previous,
        ...(typeof home === 'number' ? { homeScore: home } : {}),
        ...(typeof away === 'number' ? { awayScore: away } : {}),
        ...(typeof elapsed === 'number' ? { timeElapsed: elapsed } : {}),
      }));
    };

    const onMatchGoal = (payload: Record<string, unknown>) => {
      if (!payloadMatchesFixture(payload, channelId, fixtureId)) return;
      const home = payload.home_score ?? payload.homeScore;
      const away = payload.away_score ?? payload.awayScore;
      const elapsed = payload.timeElapsed ?? payload.time_elapsed ?? payload.minute;
      setState((previous) => ({
        ...previous,
        ...(typeof home === 'number' ? { homeScore: home } : {}),
        ...(typeof away === 'number' ? { awayScore: away } : {}),
        ...(typeof elapsed === 'number' ? { timeElapsed: elapsed } : {}),
      }));
    };

    const onMatchEnded = (payload: Record<string, unknown>) => {
      if (!payloadMatchesFixture(payload, channelId, fixtureId)) return;
      setState((previous) => ({ ...previous, status: 'completed', isLive: false }));
    };

    const onMinuteUpdate = (payload: Record<string, unknown>) => {
      if (!payloadMatchesFixture(payload, channelId, fixtureId)) return;
      const elapsed = payload.minute ?? payload.timeElapsed ?? payload.time_elapsed;
      const status = payload.status == null ? null : String(payload.status);
      setState((previous) => ({
        ...previous,
        ...(typeof elapsed === 'number' ? { timeElapsed: elapsed } : {}),
      }));
      if (status) applyStatus(status);
    };

    const unsubscribeStatus = webSocketService.onConnectionStatus(onStatus);
    webSocketService.on('connected', onConnected);
    webSocketService.on('commentary.new', onCommentaryNew);
    webSocketService.on('commentary.bulk', onCommentaryBulk);
    webSocketService.on('match.status', onMatchStatus);
    webSocketService.on('match.goal', onMatchGoal);
    webSocketService.on('match.ended', onMatchEnded);
    webSocketService.on('minute.update', onMinuteUpdate);

    void webSocketService.connect({
      userId,
      username,
      authToken: authToken ?? undefined,
      channelId,
      fixtureId,
    });

    // connect() sends a room.join immediately when the singleton is already
    // connected; request a snapshot now. A fresh connection requests it from
    // onConnected, after the server's acknowledgement.
    if (webSocketService.getIsConnected()) {
      webSocketService.send('get.commentary', { fixtureId });
      webSocketService.send('get.latest.comment', { fixtureId, channelId });
      webSocketService.requestCurrentMinute({ fixtureId, channelId });
    }

    return () => {
      active = false;
      unsubscribeStatus();
      webSocketService.off('connected', onConnected);
      webSocketService.off('commentary.new', onCommentaryNew);
      webSocketService.off('commentary.bulk', onCommentaryBulk);
      webSocketService.off('match.status', onMatchStatus);
      webSocketService.off('match.goal', onMatchGoal);
      webSocketService.off('match.ended', onMatchEnded);
      webSocketService.off('minute.update', onMinuteUpdate);
    };
  }, [channelId, fixtureId, userId, username, authToken]);

  useEffect(() => {
    if (!channelId || !fixtureId || !userId || !username) return;
    const roomId = `${channelId}_${fixtureId}`;
    webSocketService.acquireRoom(roomId);
    return () => webSocketService.releaseRoom(roomId);
  }, [channelId, fixtureId, userId, username]);

  return state;
}
