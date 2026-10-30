const API_BASE = 'https://v3.football.api-sports.io/teams';
const MEDIA_LOGO = /^https:\/\/media\.api-sports\.io\/football\/teams\/(\d+)\.png$/;

function normalize(value) {
  let normalized = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
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

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const name = String(event.queryStringParameters?.name || '').trim();
  if (name.length < 3 || name.length > 100) return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid team name is required' }) };
  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) return { statusCode: 503, headers: { ...headers, 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Team crest lookup is not configured' }) };

  try {
    const url = new URL(API_BASE);
    url.searchParams.set('search', name);
    const response = await fetch(url, { headers: { 'x-apisports-key': apiKey, Accept: 'application/json' } });
    if (!response.ok) return { statusCode: 502, headers: { ...headers, 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Team provider unavailable' }) };
    const payload = await response.json();
    if (payload.errors && Object.keys(payload.errors).length) return { statusCode: 502, headers: { ...headers, 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Team provider rejected the lookup' }) };

    const wanted = normalize(name);
    const candidates = (Array.isArray(payload.response) ? payload.response : []).filter((item) =>
      item?.team && normalize(item.team.name) === wanted && Number.isInteger(Number(item.team.id))
    );
    if (candidates.length !== 1) {
      return { statusCode: 200, headers, body: JSON.stringify({ logoUrl: null, ambiguous: candidates.length > 1 }) };
    }
    const team = candidates[0].team;
    const logoUrl = typeof team.logo === 'string' && MEDIA_LOGO.test(team.logo)
      ? team.logo
      : `https://media.api-sports.io/football/teams/${Number(team.id)}.png`;
    return { statusCode: 200, headers, body: JSON.stringify({ teamId: Number(team.id), teamName: team.name, logoUrl }) };
  } catch {
    return { statusCode: 502, headers: { ...headers, 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Team crest lookup failed' }) };
  }
};
