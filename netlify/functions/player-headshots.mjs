const normalize = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const params = event.queryStringParameters ?? {};
  const name = (params.name ?? '').trim();
  const team = (params.team ?? '').trim();
  if (name.length < 2 || name.length > 100 || team.length > 100) {
    return json(400, { error: 'A valid player name and team are required' });
  }

  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) return json(503, { error: 'Player image provider is not configured' });

  const normalizedName = normalize(name);
  const surnameParts = normalizedName.split(' ');
  const surname = surnameParts[surnameParts.length - 1];
  if (!surname || surname.length < 2) return json(200, { photoUrl: null });

  try {
    const providerUrl = new URL('https://v3.football.api-sports.io/players/profiles');
    providerUrl.searchParams.set('search', surname);
    const providerResponse = await fetch(providerUrl, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!providerResponse.ok) {
      return json(502, { error: 'Player image provider request failed' }, { 'Cache-Control': 'no-store' });
    }

    const payload = await providerResponse.json();
    const candidates = (Array.isArray(payload.response) ? payload.response : [])
      .map((entry) => ({
        player: entry?.player ?? {},
        teams: [
          entry?.player?.team?.name,
          ...(Array.isArray(entry?.statistics) ? entry.statistics.map((stat) => stat?.team?.name) : []),
        ].filter((value) => typeof value === 'string' && value.length > 0),
      }))
      .filter(({ player }) =>
        normalize(player.name) === normalizedName &&
        typeof player.photo === 'string' &&
        player.photo.startsWith('https://')
      );

    const normalizedTeam = normalize(team);
    const teamMatches = candidates.filter(({ teams }) =>
      teams.some((candidateTeam) => normalize(candidateTeam) === normalizedTeam)
    );

    // A provider team match wins. If team metadata is absent, accept only one
    // exact full-name result. Duplicate names are never guessed.
    const selected = teamMatches.length === 1
      ? teamMatches[0]
      : teamMatches.length > 1
        ? null
        : candidates.length === 1
          ? candidates[0]
          : null;

    return json(200, {
      photoUrl: selected?.player.photo ?? null,
      providerPlayerId: selected?.player.id ?? null,
    });
  } catch {
    return json(502, { error: 'Player image lookup failed' }, { 'Cache-Control': 'no-store' });
  }
};
