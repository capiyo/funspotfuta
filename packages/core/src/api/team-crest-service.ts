type CachedResolution = { expiresAt: number; value: string | null };
const cache = new Map<string, CachedResolution>();
const inFlight = new Map<string, Promise<string | null>>();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

export function normalizeTeamCrestName(value: string): string {
  let normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const suffixes = [' football club', ' athletic club', ' association football club', ' fc', ' cf', ' sc', ' afc', ' ac', ' fk', ' sk', ' sv', ' ks', ' club', ' football'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (normalized.endsWith(suffix) && normalized.length > suffix.length + 1) {
        normalized = normalized.slice(0, -suffix.length).trim();
        changed = true;
        break;
      }
    }
  }
  return normalized;
}

export async function resolveTeamCrest(
  teamName: string,
  endpoint = 'https://funspot.co.ke/.netlify/functions/team-crest',
  country?: string,
): Promise<string | null> {
  const name = teamName.trim();
  const normalizedName = normalizeTeamCrestName(name);
  const normalizedCountry = normalizeTeamCrestName(country || '');
  if (normalizedName.length < 3) return null;
  const key = normalizedName + '|' + normalizedCountry;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async (): Promise<string | null> => {
    try {
      const base = endpoint.startsWith('/') && typeof window !== 'undefined' ? window.location.origin : undefined;
      const url = base ? new URL(endpoint, base) : new URL(endpoint);
      url.searchParams.set('name', name);
      if (country?.trim()) url.searchParams.set('country', country.trim());
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') return null;
      const logoUrl = (payload as { logoUrl?: unknown }).logoUrl;
      if (typeof logoUrl !== 'string' || !/^https:\/\/media\.api-sports\.io\/football\/teams\/\d+\.png$/.test(logoUrl)) return null;
      cache.set(key, { value: logoUrl, expiresAt: Date.now() + CACHE_TTL });
      return logoUrl;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, request);
  return request;
}
