# Team crests

Funspot uses API-Sports / API-Football as the sole source for team crests on web and mobile.

## Resolution

1. Both apps pass the fixture's team name and, when available, country to the Netlify `team-crest` function. Web resolves the function on the current site origin; the native mobile app uses the production `funspot.co.ke` function origin.
2. The function queries API-Football's `/teams?search=<name>` endpoint using the server-side `API_SPORTS_KEY`.
3. It accepts only a unique normalized provider-name match, optionally constrained by exact country. A small allowlist maps common, unambiguous display aliases (for example, `Man Utd` to `Manchester United`) to canonical provider search names. It never selects by fuzzy similarity. Ambiguous or unknown names return no logo; the UI shows a neutral initial rather than a potentially incorrect crest.
4. The returned API-Sports image URL is rendered directly in a circular frame. No crest images are bundled in either app and no third-party fixture-provided logo is used.

The shared resolver normalizes accents, punctuation, ampersands and common club suffixes, deduplicates concurrent lookups, caches successful name-to-logo resolutions in memory for 30 days, and caches confirmed no-match responses for 6 hours. Network/provider failures are not negatively cached. The proxy response is HTTP-cacheable.

## Configuration

Set `API_SPORTS_KEY` in Netlify environment variables. This is the same server-only key used by the player-headshots function; do not expose it as a `VITE_` or `EXPO_PUBLIC_` variable.

If the key is missing or the provider cannot resolve a team, the apps intentionally display a neutral initial. API-Sports is the only crest source.

## Provider and image rights

API-Football documents the team endpoint and image URL pattern as `https://media.api-sports.io/football/teams/{team_id}.png`. Confirm that the subscription and image-use terms cover Funspot's production use.

Reference: https://www.api-football.com/documentation-v3
