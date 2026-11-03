# Upstream sync log

Tracks verification of this port against the source Flutter repo,
[capiyo/funspot](https://github.com/capiyo/funspot).

## 2026-09-03 — checked against `fe28d33` (2026-09-02)

**Method:** every Dart file cited as a source anywhere in `packages/core`,
`apps/web`, or `apps/mobile` (27 files, extracted directly from the ported
code's header comments) was diffed against the current upstream commit.

**Files that changed upstream, and why each is a no-op for this port:**

| File | Upstream change | Port impact |
|---|---|---|
| `lib/services/api_services.dart` | Video upload size limit raised 50MB → 100MB (5 call sites) | None — all in video-upload code paths; video-in-chat is intentionally not ported (see main READMEs) |
| `lib/pages/posts_page.dart` | Added a `NativeAdCard` (AdMob) widget + refactored a video-preview widget | None — the only piece of this file ever ported was `_toggleLike()`'s endpoint/body/response handling, which is unchanged: `POST /api/posts/:id/like`, `{user_id, user_name}`, checks `success`/`post.likes_count`. Matches `packages/core/src/api/posts-service.ts`'s `toggleLikePost()` exactly. |
| `lib/screens/home_page.dart` | UI-only changes | None — diff contains zero `Uri.parse`/`http.`/API endpoint changes; this file was only used as loose reference for `apps/web`'s `/home` page and `apps/mobile`'s `HomeScreen`, both original rewrites, not literal ports |

**New files upstream:** `lib/widgets/web_native_ad_card.dart` (AdSense web ad
widget) — monetization UI, not data/API logic, nothing to port.

**Also verified unchanged:** every file in `lib/models/` and
`lib/services/` (the two directories nearly all of `packages/core` is
ported from) — zero additions, zero modifications to any file actually
used as a source.

**Conclusion:** no code changes required. This entry exists so the next
check has a known-good baseline commit to diff from instead of starting
over.

## 2026-09-06 — corrected architecture + color system

Fixed two real mismatches with the actual Flutter source, found by
reviewing `lib/pages/home_page.dart`, `lib/pages/home_page_web.dart`,
`lib/WebView/Hompage/main_content_tabs.dart`, and
`lib/pages/fan_Funzy_design.dart` directly:

**1. Wrong information architecture.** The monorepo had built a generic
5-tab mobile nav (Home/Trending/+/Chat/Profile) and a single-column web
fixture feed with a bottom nav — neither matches the real app:

- **Real web** (`home_page_web.dart`): navbar (channel chips, notifications,
  avatar menu) + a fixed left sidebar (profile/wallet) + **three columns
  shown simultaneously** — Arena (fixtures), Feed (posts), Logs (history) —
  via `MainContentTabs`, which is a plain `Row` of 3 `Expanded` widgets
  with no tab-switching state at all.
- **Real mobile** (`home_page.dart`): a **3-item** bottom nav —
  arena/feed/logs — swiping between exactly those three pages.
  Profile/Comrades/Leaderboard/Admin Dashboard are reached via a header
  menu button (`_showTelegramMenu`), not tabs. Chat opens by tapping a
  channel chip, not a tab.

  Fixed: `apps/web`'s `/home` now renders `WebNavbar` + `WebSidebar` +
  `MainContentColumns` (3 simultaneous columns). `apps/mobile`'s
  `RootNavigator` now has a 3-tab `Arena`/`Feed`/`Logs` navigator
  (`ArenaScreen.tsx` replaces `HomeScreen.tsx`, `LogsScreen.tsx` replaces
  `HistoryScreen.tsx`), with Profile/Comrades/Leaderboard/Admin/
  Notifications reached via a header menu on `ArenaScreen`, matching the
  original. `TrendingScreen`/`HomeScreen` (mobile) and `BottomNav.tsx`
  (web) were deleted as not matching any real screen.

**2. Wrong colors.** The monorepo invented its own palette (green/blue/
purple/amber) that never matched `FanColors` at all — `FanColors.primary`
is navy-slate/light-blue, `draw` is gold, `away`/`live` is red, and the
whole system is light/dark via **OS appearance, not a manual toggle**.

  Fixed: added `packages/core/src/theme.ts` with the exact hex values
  from `FanColors` (both `FAN_COLORS_LIGHT` and `FAN_COLORS_DARK`), plus
  `outcomeColor()` mapping match outcomes to the correct color (this
  replaces the old `winnerColorHex`/`historyResultColorHex`, which baked
  in wrong hardcoded hex — now `winnerOutcome`/`historyResultOutcome`
  return a semantic `'home' | 'away' | 'draw' | 'unknown'` and the UI
  layer maps that to a color via the current theme). `apps/web` now
  derives its Tailwind `fan-*` colors from CSS variables that switch via
  `prefers-color-scheme` (see `globals.css`), matching
  `FanThemeController`'s OS-driven behavior. `apps/mobile` has a new
  `useFanColors()` hook (OS-driven via `Appearance`) that
  `ArenaScreen`, `LogsScreen`, and `MatchCard` now use for fully dynamic
  light/dark colors — matching Google Fonts (DM Sans, Saira Condensed)
  are wired in on both platforms too.

**Known remaining gap:** 11 mobile screens/components still import a
static `colors` object from `apps/mobile/src/theme/index.ts` rather than
the reactive `useFanColors()` hook — `FeedScreen`, `ChatScreen`,
`ComradesScreen`, `LeaderboardScreen`, `NotificationsScreen`,
`AdminScreen`, `FixtureDetailScreen`, `LoginScreen`, `ProfileScreen`,
`WalletCard`, `ChannelCreationModal`. That shim now holds the **correct**
dark-mode hex values (pulled from `FAN_COLORS_DARK`), so these screens
are no longer using the wrong palette — but they render in dark mode
only and won't switch live if the OS theme changes, unlike the three
files already converted. Converting each one follows the exact same
mechanical pattern as `ArenaScreen.tsx`/`MatchCard.tsx`: replace
`import { colors } from '@/theme'` with
`const colors = useFanColors()` inside the component, and change
`const styles = StyleSheet.create({...})` (module-level) into
`function createStyles(colors) { return StyleSheet.create({...}) }`
called as `const styles = createStyles(colors)` inside the component.
