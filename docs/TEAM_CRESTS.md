# Team crest assets

The production match UI uses 365Scores competitor IDs and the 365Scores image CDN for team crests. The league scraper persists each fixture's home/away competitor IDs and corresponding `homeTeamImageUrl` / `awayTeamImageUrl` fields. The shared web and React Native components render those URLs inside the same circular themed frame.

The legacy bundled football-logo catalogue remains available as static project data, but it is not the live team-crest provider.

365Scores' web feeds are internal endpoints, not a documented commercial API. Confirm permission for commercial display, caching, and redistribution before production use. A publicly reachable image URL does not itself grant image rights.
