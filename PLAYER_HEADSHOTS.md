# Dynamic lineup player headshots

Funspot resolves headshots when a fixture lineup is loaded. It does not rely on a bundled player-photo catalogue.

## Flow

1. The lineup parser preserves the provider player ID, team name, and any HTTPS photo URL already present in the lineup payload.
2. Web and mobile send player name + fixture team to the shared Netlify Function at `/.netlify/functions/player-headshots`.
3. The function queries API-Sports / API-Football player profiles using the player's surname.
4. It accepts only an exact normalized full-name match. If API-Sports supplies team metadata, the team must match. If there are duplicate exact-name candidates without a unique team match, it returns no image rather than guessing.
5. Web stores resolved URLs in localStorage; mobile stores them in AsyncStorage. Positive results are cached for 30 days and misses for 6 hours. The image itself uses browser caching / Expo Image disk caching.

## Required production configuration

In the Netlify site environment variables, add:

- `API_SPORTS_KEY`: the API-Sports / API-Football key. This is a server-side secret and must not be prefixed with `VITE_` or `EXPO_PUBLIC_`.

The function is deployed from `netlify/functions/player-headshots.mjs`. No provider key is bundled into the web or mobile applications.

For mobile builds, the default endpoint is `https://funspot.co.ke/.netlify/functions/player-headshots`. Override it with `EXPO_PUBLIC_PLAYER_HEADSHOT_ENDPOINT` only when using a different deployment. Web uses the same-origin function by default and can be overridden with `VITE_PLAYER_HEADSHOT_ENDPOINT`.

If `API_SPORTS_KEY` is not configured in Netlify, the lineup still renders and uses any photo URL included by the lineup provider, but online lookup returns an unavailable response and the UI keeps the shirt-number fallback.

## Provider

API-Sports documents the player profile search endpoint and the player photo URL field. Provider response images remain subject to API-Sports and applicable image rights / subscription terms. See https://www.api-football.com/documentation_v3.
