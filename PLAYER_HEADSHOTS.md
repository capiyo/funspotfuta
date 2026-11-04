# Player headshots

Funspot uses 365Scores athlete IDs from the existing fixture/lineup scraper.

1. The 365Scores lineup payload supplies each player's `athleteId`.
2. The shared lineup parser preserves that ID as the player's provider identity.
3. Web and mobile build the image URL from the 365Scores athlete ID and load the image from `imagecache.365scores.com`.
4. Resolved URLs are cached locally; missing IDs use the existing shirt-number fallback rather than a guessed name match.

No API-Sports endpoint, API key, or Netlify lookup function is required. The 365Scores image CDN and internal data feeds are not an official commercial API; confirm permission for commercial display and caching before production use.
