import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/queryKeys';
import { webSocketService } from './websocket-service';

export interface FixtureLiveSeed {
  status?: string | null;
  isLive?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  timeElapsed?: number | null;
}

export interface LiveFixtureCommentary {
  id?: string;
  text: string;
  minute: number;
  timestamp?: string;
}

interface CachedLiveCommentary {
  events: LiveFixtureCommentary[];
}

function normalizeCommentary(entry: Record<string, unknown>): LiveFixtureCommentary | null {
  const text = entry.text == null ? '' : String(entry.text).trim();
  if (!text) return null;
  const minute = typeof entry.minute === 'number' ? entry.minute : Number(entry.minute ?? 0) || 0;
  const rawTimestamp = entry.createdAt ?? entry.created_at ?? entry.timestamp;
  const timestamp = rawTimestamp == null ? undefined : String(rawTimestamp);
  const rawId = entry.id ?? entry.eventId ?? entry.event_id;
  const id = rawId == null ? `${timestamp ?? ''}:${minute}:${text}` : String(rawId);
  return { id, text, minute, ...(timestamp ? { timestamp } : {}) };
}

function mergeCommentary(
  previous: readonly LiveFixtureCommentary[],
  incoming: readonly LiveFixtureCommentary[],
): LiveFixtureCommentary[] {
  const unique = new Map<string, LiveFixtureCommentary>();
  for (const entry of [...previous, ...incoming]) {
    const id = entry.id ?? `${entry.timestamp ?? ''}:${entry.minute}:${entry.text}`;
    unique.set(id, entry);
  }
  return [...unique.values()]
    .sort((a, b) => {
      const timeA = Date.parse(a.timestamp ?? '');
      const timeB = Date.parse(b.timestamp ?? '');
      if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeA - timeB;
      return a.minute - b.minute;
    })
    .slice(-100);
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
  const queryClient = useQueryClient();
  const commentaryKey = useMemo(() => queryKeys.liveCommentary(fixtureId ?? 'unselected'), [fixtureId]);
  const [state, setState] = useState<FixtureLiveState>(() => {
    const status = seed?.status ?? 'upcoming';
    return {
      connected: false,
      commentary: queryClient.getQueryData<CachedLiveCommentary>(commentaryKey)?.events.slice(-1)[0] ?? null,
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
      commentary: queryClient.getQueryData<CachedLiveCommentary>(commentaryKey)?.events.slice(-1)[0] ?? null,
      status,
      isLive: seed?.isLive ?? isLiveStatus(status),
      homeScore: seed?.homeScore ?? null,
      awayScore: seed?.awayScore ?? null,
      timeElapsed: seed?.timeElapsed ?? null,
    });
    // Seed only resets when the room identity changes; incoming socket events
    // should not be overwritten by unrelated fixture object refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, fixtureId, commentaryKey, queryClient]);

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
      if (!payloadMatchesFixture(payload, channelId, fixtureId) || !payloadMatchesFixture(data, channelId, fixtureId)) return;
      const entry = normalizeCommentary(data);
      if (!entry) return;
      const cached = queryClient.setQueryData<CachedLiveCommentary>(commentaryKey, (previous) => ({
        events: mergeCommentary(previous?.events ?? [], [entry]),
      }));
      setState((previous) => ({ ...previous, commentary: cached?.events.slice(-1)[0] ?? entry }));
    };

    const onCommentaryBulk = (payload: Record<string, unknown>) => {
      if (!payloadMatchesFixture(payload, channelId, fixtureId)) return;
      const rawEntries = Array.isArray(payload) ? payload : (payload.payload ?? payload.commentary);
      if (!Array.isArray(rawEntries)) return;
      const entries = rawEntries
        .filter((entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === 'object' && payloadMatchesFixture(entry as Record<string, unknown>, channelId, fixtureId),
        )
        .map(normalizeCommentary)
        .filter((entry): entry is LiveFixtureCommentary => entry !== null);
      if (!entries.length) return;
      const cached = queryClient.setQueryData<CachedLiveCommentary>(commentaryKey, (previous) => ({
        events: mergeCommentary(previous?.events ?? [], entries),
      }));
      const latest = cached?.events.slice(-1)[0];
      if (latest) setState((previous) => ({ ...previous, commentary: latest }));
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
  }, [channelId, fixtureId, userId, username, authToken, commentaryKey, queryClient]);

  useEffect(() => {
    if (!channelId || !fixtureId || !userId || !username) return;
    const roomId = `${channelId}_${fixtureId}`;
    webSocketService.acquireRoom(roomId);
    return () => webSocketService.releaseRoom(roomId);
  }, [channelId, fixtureId, userId, username]);

  return state;
}
