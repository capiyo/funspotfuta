# Team crests

Funspot uses one shared crest strategy across React web and React Native.

## Resolution order

1. The bundled catalogue in `apps/web/public/team-crests` and `apps/mobile/assets/team-crests` is used first (180 club crests and 228 national-team crests).
2. A logo already present on the fixture payload is used when there is no bundled match.
3. For a team not found in either source, both apps call the Netlify `team-crest` function. The function queries API-Football's `/teams?search=<name>` endpoint with the server-side `API_SPORTS_KEY`, uses the country when supplied and accepts only a unique exact normalized team-name match, and returns the provider's team image URL.
4. Ambiguous or unknown names deliberately fall back to the neutral initial rather than displaying the wrong club crest.

The shared resolver normalizes accents, punctuation, ampersands and common club suffixes, deduplicates concurrent lookups by normalized team and country, and caches successful name-to-logo resolutions in memory for 30 days. The proxy response is HTTP-cacheable.

## Configuration

Set `API_SPORTS_KEY` in Netlify environment variables. This is the same server-only key used by the player-headshots function; do not expose it as a `VITE_` or `EXPO_PUBLIC_` variable.

Bundled assets remain available if the API key or provider is temporarily unavailable. API-Sports resolution is only needed for names outside the bundled and fixture-provided sources.

## Provider and image rights

API-Football documents the team endpoint and image URL pattern as `https://media.api-sports.io/football/teams/{team_id}.png`. Its documentation says logo/image calls do not count against the daily request quota and recommends caching them to avoid rate limits. API-Sports also notes that team marks may be protected by third-party intellectual-property or trademark rights; Funspot must ensure its use is authorized.

References:
- https://www.api-football.com/documentation_v3
- https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide
