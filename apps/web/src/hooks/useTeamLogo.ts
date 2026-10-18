import { useEffect, useState } from 'react';

const STORAGE_KEY = 'funspot.teamLogos.v1';
const FOUND_TTL = 30 * 24 * 60 * 60 * 1000;
const EMPTY_TTL = 7 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL = 2500;
const COOLDOWN = 60_000;

type CacheEntry = { value: string | null; expiresAt: number };
type CacheStore = Record<string, CacheEntry>;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();
let queue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
let blockedUntil = 0;

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

function readStorage(): CacheStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as CacheStore : {};
  } catch {
    return {};
  }
}

function getCached(key: string): string | null | undefined {
  const now = Date.now();
  const memory = cache.get(key);
  if (memory && memory.expiresAt > now) return memory.value;
  if (memory) cache.delete(key);
  try {
    const entry = readStorage()[key];
    if (entry && entry.expiresAt > now) {
      cache.set(key, entry);
      return entry.value;
    }
  } catch { /* storage is optional */ }
  return undefined;
}

function setCached(key: string, value: string | null): void {
  const entry = { value, expiresAt: Date.now() + (value ? FOUND_TTL : EMPTY_TTL) };
  cache.set(key, entry);
  try {
    const stored = readStorage();
    stored[key] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* storage is optional */ }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function enqueueLookup(teamName: string, key: string): Promise<string | null> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = queue.then(async () => {
    const cached = getCached(key);
    if (cached !== undefined) return cached;
    const now = Date.now();
    if (now < blockedUntil) return null;
    const delay = Math.max(0, MIN_INTERVAL - (now - lastRequestAt));
    if (delay) await wait(delay);
    if (Date.now() < blockedUntil) return null;
    lastRequestAt = Date.now();
    try {
      const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName.trim())}`);
      if (response.status === 429 || !response.ok) {
        blockedUntil = Date.now() + COOLDOWN;
        return null;
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') return setNull(key);
      const teams = (payload as { teams?: Array<Record<string, unknown>> | null }).teams;
      const team = Array.isArray(teams) ? teams[0] : undefined;
      const raw = team?.strBadge ?? team?.strTeamBadge ?? team?.strLogo;
      const url = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
      setCached(key, url);
      return url;
    } catch {
      blockedUntil = Date.now() + COOLDOWN;
      return null;
    }
  });
  queue = task.then(() => undefined, () => undefined);
  inFlight.set(key, task);
  void task.finally(() => inFlight.delete(key));
  return task;
}

function setNull(key: string): null {
  setCached(key, null);
  return null;
}

function fixtureLogo(fixture: Record<string, unknown>, side: 'home' | 'away'): string | null {
  const cap = side === 'home' ? 'Home' : 'Away';
  const names = [
    `${side}Logo`, `${side}TeamLogo`, `${side}_logo`, `${side}_team_logo`,
    `${side}Crest`, `${side}TeamCrest`, `${side}_crest`, `${side}_team_crest`,
    `${side}Badge`, `${side}TeamBadge`, `${side}_badge`, `${side}_team_badge`,
    `${side}TeamImage`, `${side}_team_image`, `${cap}TeamLogo`,
  ];
  for (const name of names) {
    const value = fixture[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function useTeamLogo(teamName: string, fixture: Record<string, unknown>, side: 'home' | 'away'): string | null {
  const direct = fixtureLogo(fixture, side);
  const key = normalise(teamName);
  const [url, setUrl] = useState<string | null>(() => direct ?? (key ? getCached(key) ?? null : null));

  useEffect(() => {
    if (direct) {
      setUrl(direct);
      return;
    }
    if (!key) {
      setUrl(null);
      return;
    }
    let active = true;
    const cached = getCached(key);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }
    setUrl(null);
    void enqueueLookup(teamName, key).then((value) => {
      if (active) setUrl(value);
    });
    return () => { active = false; };
  }, [direct, key, teamName]);

  return url;
}
