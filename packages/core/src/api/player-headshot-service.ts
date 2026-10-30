/**
 * Dynamic football player headshots.
 *
 * The app calls the same-origin Netlify function (or an explicitly configured
 * endpoint). The API-Sports credential stays on the server and is never
 * bundled into either client. The resolver only accepts exact normalized
 * full-name matches and prefers a matching team when provider metadata exists.
 */
import type { SimplifiedPlayer } from '../types/matchDetails';

export interface PlayerHeadshotCacheStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface CachedHeadshot {
  photoUrl: string | null;
  expiresAt: number;
}

const memoryCache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null | undefined>>();
const CACHE_PREFIX = 'funspot:player-headshot:v1:';
const POSITIVE_TTL = 30 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL = 6 * 60 * 60 * 1000;

function normalize(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function directPhoto(player: SimplifiedPlayer): string | null {
  return isHttpsUrl(player.photoUrl) ? player.photoUrl : null;
}

function browserCache(): PlayerHeadshotCacheStore | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  return {
    getItem: async (key) => localStorage.getItem(key),
    setItem: async (key, value) => localStorage.setItem(key, value),
  };
}

async function readCached(
  key: string,
  store?: PlayerHeadshotCacheStore,
): Promise<{ found: boolean; value: string | null }> {
  if (memoryCache.has(key)) return { found: true, value: memoryCache.get(key) ?? null };
  if (!store) return { found: false, value: null };
  try {
    const raw = await store.getItem(CACHE_PREFIX + key);
    if (!raw) return { found: false, value: null };
    const cached = JSON.parse(raw) as CachedHeadshot;
    if (typeof cached.expiresAt !== 'number' || cached.expiresAt <= Date.now()) {
      return { found: false, value: null };
    }
    const value = isHttpsUrl(cached.photoUrl) ? cached.photoUrl : null;
    memoryCache.set(key, value);
    return { found: true, value };
  } catch {
    return { found: false, value: null };
  }
}

async function writeCached(
  key: string,
  photoUrl: string | null,
  store?: PlayerHeadshotCacheStore,
): Promise<void> {
  memoryCache.set(key, photoUrl);
  if (!store) return;
  const entry: CachedHeadshot = {
    photoUrl,
    expiresAt: Date.now() + (photoUrl ? POSITIVE_TTL : NEGATIVE_TTL),
  };
  try { await store.setItem(CACHE_PREFIX + key, JSON.stringify(entry)); } catch { /* cache is optional */ }
}

async function lookupPlayer(
  player: SimplifiedPlayer,
  teamName: string,
  endpoint: string,
  store?: PlayerHeadshotCacheStore,
): Promise<string | null | undefined> {
  const direct = directPhoto(player);
  if (direct) return direct;

  const normalizedName = normalize(player.name);
  if (!normalizedName || normalizedName.startsWith('player ')) return null;

  const cacheKey = `${normalizedName}|${normalize(teamName)}`;
  const cached = await readCached(cacheKey, store);
  if (cached.found) return cached.value;
  const existing = pending.get(cacheKey);
  if (existing) return existing;

  const request = (async (): Promise<string | null | undefined> => {
    try {
      const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : undefined);
      url.searchParams.set('name', player.name);
      url.searchParams.set('team', teamName);
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!response.ok) return undefined;
      const payload = await response.json() as { photoUrl?: unknown };
      return isHttpsUrl(payload.photoUrl) ? payload.photoUrl : null;
    } catch {
      return undefined;
    }
  })();

  pending.set(cacheKey, request);
  const result = await request;
  pending.delete(cacheKey);
  if (result !== undefined) await writeCached(cacheKey, result, store);
  return result ?? null;
}

/** Resolve a lineup batch with bounded concurrency and persistent caching. */
export async function resolvePlayerHeadshots(
  players: Array<{ player: SimplifiedPlayer; teamName: string }>,
  endpoint: string | undefined,
  cacheStore?: PlayerHeadshotCacheStore,
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  const store = cacheStore ?? browserCache();

  for (const { player, teamName } of players) {
    const direct = directPhoto(player);
    if (direct) resolved[playerHeadshotKey(player, teamName)] = direct;
  }
  if (!endpoint?.trim()) return resolved;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, players.length) }, async () => {
    while (cursor < players.length) {
      const current = players[cursor++];
      if (!current) continue;
      const key = playerHeadshotKey(current.player, current.teamName);
      if (resolved[key]) continue;
      const photo = await lookupPlayer(current.player, current.teamName, endpoint, store);
      if (photo) resolved[key] = photo;
    }
  });
  await Promise.all(workers);
  return resolved;
}

export function playerHeadshotKey(player: SimplifiedPlayer, teamName: string): string {
  return `${normalize(teamName)}:${normalize(player.name)}:${player.number}`;
}
