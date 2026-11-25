# Team crests

Funspot uses 365Scores competitor IDs for team crests across web and mobile.

## Resolution

1. The 365Scores league scraper already receives each fixture's `homeCompetitor.id` and `awayCompetitor.id`.
2. The scraper stores those IDs and the corresponding 365Scores image CDN URLs as `homeCompetitorId`, `awayCompetitorId`, `homeTeamImageUrl`, and `awayTeamImageUrl`.
3. The shared fixture parser preserves the IDs and URLs. Both TeamCrest components render the 365Scores crest in the existing circular, themed frame.
4. Missing IDs show the neutral initial fallback; the app never guesses a crest from a similar team name.

The image host is `imagecache.365scores.com`, using the `Competitors/{id}` asset path. No API-Sports lookup, image URL, or credential is used.

## Rights

365Scores' website feeds are internal endpoints rather than a documented commercial API. Confirm permission for commercial display, caching, and redistribution before production use. The CDN URL pattern is not a grant of image rights.
