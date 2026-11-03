/** Live match statistics emitted by the backend as the statistics.updated event. */
export interface TeamStatisticsSnapshot {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  corners: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  offsides: number | null;
  passes: number | null;
  passAccuracy: number | null;
}

export interface MatchStatisticsSnapshot {
  home: TeamStatisticsSnapshot;
  away: TeamStatisticsSnapshot;
}

export interface StatisticsUpdatedEvent {
  fixture_id: string;
  channel_id: string;
  minute: number;
  statistics: MatchStatisticsSnapshot;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isTeamStatistics(value: unknown): value is TeamStatisticsSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const stats = value as Record<string, unknown>;
  return [
    'possession',
    'shots',
    'shotsOnTarget',
    'shotsOffTarget',
    'corners',
    'fouls',
    'yellowCards',
    'redCards',
    'offsides',
    'passes',
    'passAccuracy',
  ].every((key) => isNullableNumber(stats[key]));
}

/** Runtime guard for the WebSocket payload; unknown/malformed events are ignored. */
export function isStatisticsUpdatedEvent(value: unknown): value is StatisticsUpdatedEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  if (
    typeof event.fixture_id !== 'string' ||
    typeof event.channel_id !== 'string' ||
    typeof event.minute !== 'number' ||
    !Number.isFinite(event.minute) ||
    typeof event.statistics !== 'object' ||
    event.statistics === null
  ) {
    return false;
  }

  const statistics = event.statistics as Record<string, unknown>;
  return isTeamStatistics(statistics.home) && isTeamStatistics(statistics.away);
}
