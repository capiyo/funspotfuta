const LIVE_STATUSES = new Set([
  'live',
  'in_play',
  'in-play',
  'in_progress',
  'first_half',
  'second_half',
  'injury_time',
  'half_time',
  'halftime',
  'extra_time',
  'penalties',
]);

const FINISHED_STATUSES = new Set([
  'full_time',
  'full-time',
  'fulltime',
  'finished',
  'completed',
  'ended',
  'ft',
]);

const NON_LIVE_STATUSES = new Set([
  'upcoming',
  'soon',
  'scheduled',
  'not_started',
  'pre_match',
  'pre-match',
  'postponed',
  'cancelled',
  'canceled',
  'abandoned',
  'suspended',
]);

export function isLiveStatus(status: string): boolean {
  return LIVE_STATUSES.has(status.trim().toLowerCase());
}

export function isFinishedStatus(status: string): boolean {
  return FINISHED_STATUSES.has(status.trim().toLowerCase());
}

/**
 * A provider's explicit fixture status outranks a stale boolean live flag.
 * Kickoff time and cached is_live values are not proof that a match has begun.
 */
export function resolveFixtureIsLive(status: string | null | undefined, isLiveFlag?: boolean): boolean {
  const normalized = (status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (isFinishedStatus(normalized) || NON_LIVE_STATUSES.has(normalized)) return false;
  if (isLiveStatus(normalized)) return true;
  return isLiveFlag === true;
}
