# Player headshots

Funspot uses 365Scores athlete IDs from the existing fixture/lineup scraper.

1. The 365Scores lineup payload supplies each player's `athleteId`.
2. The shared lineup parser preserves the player's `athleteId` and `imageVersion` (including nested player/athlete payloads).
3. Web and mobile build the versioned image URL (`.../v{imageVersion}/Athletes/{athleteId}`) and load the image from `imagecache.365scores.com`.
4. Resolved URLs are cached locally under a versioned cache key; the cache namespace is bumped when the URL format changes so stale broken URLs are not reused.
5. If the image fails to load or the provider identity is missing, the UI falls back to the player's shirt number rather than a team crest or a guessed name match.

No API-Sports endpoint, API key, or Netlify lookup function is required. The 365Scores image CDN and internal data feeds are not an official commercial API; confirm permission for commercial display and caching before production use.
