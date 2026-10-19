# Flutter AppCache parity migration

Branch: `web-port-from-master`

Source of truth reviewed: `capiyo/funspot/lib/main.dart` (`AppCache.saveToDisk` / `loadAllFromDisk`), `lib/services/local_database.dart`, and `lib/services/memory_manager.dart`.

## Flutter AppCache inventory

The Flutter `AppCache` persisted snapshot under `app_cache_data` includes:

| Flutter cache field | Data domain | Monorepo migration target |
| --- | --- | --- |
| `fixtures_cache`, `fixtures_timestamp` | Fixtures and freshness | `['fixtures']` |
| `cached_user_votes` | User vote selections by fixture | `['userVotes', ...]` |
| `cached_channels` | Channel list | `['channels', ...]`, `['userChannels', ...]` |
| `cached_profile` | Profile display data | `['profile', userId]` |
| `channel_fixtures_cache` | Fixture/channel summary, vote counts, last message, unread counts, user vote | `['channelFixtures', ...]` |
| `vote_counts_cache` | Vote counts | `['voteCounts', ...]` |
| `comment_counts_cache` | Comment counts | `['commentCounts', ...]` |
| `like_counts_cache` | Like counts | `['likeCounts', ...]` |
| `pledge_counts_cache` | Pledge counts | `['pledgeCounts', ...]` |
| `bet_counts_cache` | Bet counts | `['betCounts', ...]` |
| `unread_counts_cache` | Unread counts | `['unreadCounts', ...]` |
| `latest_comments_cache` | Latest comment, author and timestamp | `['latestComments', ...]` |
| `cached_messages` | Fixture/channel chat messages | `['messages', ...]` or `['chatMessages', ...]` |
| `cached_comrades` | Comrade records | `['comrades', userId]` |
| `cached_user_comrades` | Current user's comrade IDs | `['userComrades', userId]` |
| `cached_comrade_voters` | Comrades who voted on a fixture | `['comradeVoters', ...]` |
| `per_channel_vote_counts` | Per-channel vote counts | `['perChannelVoteCounts', ...]` |
| `history_games_cache` | History games | `['historyGames', userId]` |
| `aftermatch_data_cache` | After-match data | `['aftermatch', ...]` |
| `live_events_cache` | Live events | `['liveEvents', ...]` |
| `voters_cache` | Voters by fixture | `['voters', ...]` |
| `post_comments_cache` | Comments by post | `['postComments', postId]` |
| Separate history-comments store | Comments attached to history games | `['historyComments', ...]` |

Flutter's `MemoryManager` also trims cached messages to 50 per fixture and prunes non-active fixture summaries and vote counts while in the background. The monorepo needs equivalent bounded-cache behavior rather than allowing every persisted query to grow indefinitely.

The separate `LocalDatabase` keys are `messages_{fixtureId}`, `fixtures`, `fixtures_timestamp`, `votes_{fixtureId}`, `channels`, and `profile`. These overlap some AppCache fields but are a distinct storage path in Flutter.

## Important implementation rule

The persisted-key allowlist only permits matching React Query entries to be written to disk. It does **not** automatically migrate component-owned state or raw `fetch` calls into cache-backed queries. Each screen must read through a shared query key, show cached data immediately when available, update cache after mutations, and refresh in the background. Network calls remain appropriate inside query functions and mutation functions; components should not independently fetch data into local state when the same data is shared.

Account/profile display data and balance/transaction summaries may be cached, but passwords, auth tokens, payment credentials, and other secrets must not be persisted as query data.

## Implementation checklist

### Inventory and shared cache foundation

- [x] Read `lib/services/local_database.dart`, `lib/services/memory_manager.dart`, `lib/main.dart`, and fixture-page cache use.
- [x] Record the known Flutter AppCache and LocalDatabase domains in the inventory table above.
- [x] Expand persisted query-key prefixes for AppCache data domains.
- [x] Persist only successful queries with defined data; bump the persisted-cache buster to `v3`.
- [x] Set query and mutation network mode to `offlineFirst`; keep query `gcTime` aligned with the 7-day persistence max age.
- [x] Wire React Native NetInfo to TanStack `onlineManager` and keep `AppState` wired to `focusManager`.
- [x] Add IndexedDB-backed persistence for web and clear its persisted blob during logout/account switching.
- [x] Resume paused mutations after mobile persistence hydration.
- [x] Add a shared query-key factory with user-scoped keys for profile, comrades, votes, messages, history and activity data.
- [x] Add reusable merge-not-replace and 50-message cache-cap utilities.
- [x] Add shared cache-first hooks for profile and comrades; export them from `@funspot/core`.
- [x] Wire web and mobile profile reads to the shared persisted profile query; transient profile fetch errors no longer become cached `null` results.
- [ ] Wire the remaining profile edit, balance, saved-phone, and transaction actions through shared query/mutation functions.
- [x] Use the shared query-key factory in the existing fixtures/history hooks and web public-channel hook.
- [x] Move public-channel fetching into a shared core hook; web now delegates to it and both platforms can use the same persisted key.

### Domain wiring — not complete

- [ ] Fixtures: inventory all consumers, ensure every web/mobile consumer uses `useFixtures`/shared key, validate API response shapes.
- [ ] Votes and user vote state: wire every query/mutation to canonical user-scoped keys and optimistic rollback.
- [ ] Voters/comrade voters: merge partial server results with cached entries and wire all consumers.
- [ ] Chat/messages: wire all consumers and mutations; cap persisted messages at 50 per fixture.
- [x] Core channel-chat hook restores cached messages before network refresh, merges fetched history with cached entries, persists a 50-message snapshot per fixture/channel/user, and revives Date timestamps after JSON persistence.
- [x] Web MessageScreen now uses the shared core chat hook instead of its duplicate hook implementation.
- [ ] Channels/channel fixtures: move web-specific channel query functions into shared core hooks and wire mobile/web consumers.
- [ ] Counts/latest comments: wire vote, comment, like, pledge, bet and unread counts to all cards and modals.
- [ ] Comrades: migrate every list/search/add/remove/relationship caller to shared hooks and optimistic mutations.
- [x] Web and mobile Comrades modals now render the list from the shared user-scoped persisted comrades query; list loading indicators appear only on a true cache miss.
- [ ] Move comrade search, stats, add/remove operations into shared core hooks.
- [x] Add optimistic add/remove updates with rollback in web and mobile Comrades modals; transient list-fetch failures now throw instead of being cached as empty lists.
- [ ] Profile/account: remove direct component fetches; cache display profile per user; preserve cached profile on transient network failure.
- [ ] Payments: cache only safe display summaries; never cache credentials or auth tokens.
- [ ] Feed/posts/post comments/likes/followers: migrate every consumer and mutation.
- [ ] History/history comments/aftermatch/live events: migrate every consumer and mutation.
- [ ] Notifications: migrate every consumer and mutation to shared query keys.
- [x] Add query-cache clearing on logout/account switch in web and mobile; mobile provider order now makes the shared QueryClient available to AuthProvider.
- [ ] Prove account-switch isolation with automated tests and verify the IndexedDB/MMKV removal path on devices.
- [ ] Audit all HTTP usage in apps/web and apps/mobile; ensure components call core hooks rather than HTTP directly.
- [ ] Add tests for merge, scoping, optimistic rollback, restore, buster, logout, offline launch and vote-to-chat flow.
- [ ] Run core/mobile/web typecheck, web lint/build and tests; wait for a successful GitHub Actions run.

Status is intentionally not marked complete: the query-key foundation does not itself migrate all component-owned fetch/state paths. No unverified domain row should be checked off.
