/**
 * Dynamic football player headshots.
 *
 * Provider: API-Sports / API-Football player profiles.
 * The lineup remains the source of truth for player identity; provider
 * results are accepted only for an exact normalized full-name match.
 * When the provider returns team metadata, it must also match the lineup
 * team. Ambiguous duplicate names are deliberately left without a photo.
 *
 * API key is supplied by the platform app at runtime and must never be
 * committed to source control. Web: VITE_API_SPORTS_KEY.
 * Expo: EXPO_PUBLIC_API_SPORTS_KEY.
 */
import type { SimplifiedPlayer } from '../types/matchDetails';

interface ApiSportsPlayer {
  id?: number | string;
  name?: string;
  photo?: string;
  team?: { name?: string };
}

interface ApiSportsResult {
  player?: ApiSportsPlayer;
  statistics?: Array<{ team?: { name?: string } }>;
}

interface ApiSportsResponse {
  response?: ApiSportsResult[];
  errors?: Record<string, unknown> | string[];
}

const memoryCache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
const CACHE_MISS = null;

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function directPhoto(player: SimplifiedPlayer): string | null {
  return isHttpsUrl(player.photoUrl) ? player.photoUrl : null;
}

async function lookupPlayer(
  player: SimplifiedPlayer,
  teamName: string,
  apiKey: string,
): Promise<string | null> {
  const direct = directPhoto(player);
  if (direct) return direct;

  const normalizedName = normalize(player.name);
  if (!normalizedName || normalizedName.startsWith('player ')) return null;

  const cacheKey = `${normalizedName}|${normalize(teamName)}`;
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey) ?? null;
  const existing = pending.get(cacheKey);
  if (existing) return existing;

  const request = (async (): Promise<string | null> => {
    try {
      const surname = normalizedName.split(' ').at(-1);
      if (!surname || surname.length < 3) return null;

      const url = new URL('https://v3.football.api-sports.io/players/profiles');
      url.searchParams.set('search', surname);
      const response = await fetch(url.toString(), {
        headers: { 'x-apisports-key': apiKey },
      });
      if (!response.ok) return null;

      const payload = (await response.json()) as ApiSportsResponse;
      const candidates = (payload.response ?? [])
        .map((entry) => ({
          player: entry.player ?? {},
          teams: [
            entry.player?.team?.name,
            ...(entry.statistics ?? []).map((stat) => stat.team?.name),
          ].filter((name): name is string => Boolean(name)),
        }))
        .filter(({ player: candidate }) => normalize(candidate.name ?? '') === normalizedName)
        .filter(({ player: candidate }) => isHttpsUrl(candidate.photo));

      if (candidates.length === 0) return null;

      const normalizedTeam = normalize(teamName);
      const teamMatches = candidates.filter(({ teams }) =>
        teams.some((team) => normalize(team) === normalizedTeam),
      );

      // Prefer a verified team match. If the provider doesn't expose team
      // metadata, accept only a single exact-name result; never guess between
      // players who share a name.
      const selected =
        teamMatches.length === 1
          ? teamMatches[0]
          : teamMatches.length > 1
            ? null
            : candidates.length === 1
              ? candidates[0]
              : null;

      return selected?.player.photo ?? null;
    } catch {
      return null;
    }
  })();

  pending.set(cacheKey, request);
  const result = await request;
  pending.delete(cacheKey);
  memoryCache.set(cacheKey, result ?? CACHE_MISS);
  return result;
}

/**
 * Resolves a lineup batch with bounded concurrency. Successful and missing
 * lookups are memoized for the current app session, while image URLs are also
 * cached by the browser / Expo Image disk cache.
 */
export async function resolvePlayerHeadshots(
  players: Array<{ player: SimplifiedPlayer; teamName: string }>,
  apiKey: string | undefined,
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};

  for (const { player, teamName } of players) {
    const direct = directPhoto(player);
    if (direct) resolved[playerHeadshotKey(player, teamName)] = direct;
  }

  if (!apiKey?.trim()) return resolved;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, players.length) }, async () => {
    while (cursor < players.length) {
      const current = players[cursor++];
      if (!current) continue;
      const key = playerHeadshotKey(current.player, current.teamName);
      if (resolved[key]) continue;
      const photo = await lookupPlayer(current.player, current.teamName, apiKey);
      if (photo) resolved[key] = photo;
    }
  });

  await Promise.all(workers);
  return resolved;
}

export function playerHeadshotKey(player: SimplifiedPlayer, teamName: string): string {
  return `${normalize(teamName)}:${normalize(player.name)}:${player.number}`;
}
