/**
 * Player headshots from the 365Scores athlete IDs already present in lineup data.
 * No name-search endpoint or third-party credential is required.
 */
import type { SimplifiedPlayer } from '../types/matchDetails';

export interface PlayerHeadshotCacheStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const CDN = 'https://imagecache.365scores.com/image/upload/f_png,w_160,h_160,c_limit,q_auto:eco,dpr_2,d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/Athletes/';
const memoryCache = new Map<string, string>();
const CACHE_PREFIX = 'funspot:player-headshot:365:v1:';
const TTL = 30 * 24 * 60 * 60 * 1000;

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function athleteUrl(player: SimplifiedPlayer): string | null {
  if (typeof player.photoUrl === 'string' && player.photoUrl.startsWith('https://imagecache.365scores.com/')) return player.photoUrl;
  const id = Number(player.providerId);
  return Number.isSafeInteger(id) && id > 0 ? CDN + id : null;
}

function browserCache(): PlayerHeadshotCacheStore | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  return { getItem: async key => localStorage.getItem(key), setItem: async (key, value) => localStorage.setItem(key, value) };
}

/** Resolve a lineup batch without live name searches; athlete IDs are the identity key. */
export async function resolvePlayerHeadshots(
  players: Array<{ player: SimplifiedPlayer; teamName: string }>,
  _endpoint?: string,
  cacheStore?: PlayerHeadshotCacheStore,
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  const store = cacheStore ?? browserCache();
  await Promise.all(players.map(async ({ player, teamName }) => {
    const key = playerHeadshotKey(player, teamName);
    const direct = athleteUrl(player);
    if (!direct) return;
    const cached = memoryCache.get(key);
    if (cached) { resolved[key] = cached; return; }
    memoryCache.set(key, direct);
    resolved[key] = direct;
    if (store) {
      try { await store.setItem(CACHE_PREFIX + key, JSON.stringify({ photoUrl: direct, expiresAt: Date.now() + TTL })); } catch { /* optional cache */ }
    }
  }));
  return resolved;
}

export function playerHeadshotKey(player: SimplifiedPlayer, teamName: string): string {
  return `${normalize(teamName)}:${normalize(player.name)}:${player.number}`;
}
