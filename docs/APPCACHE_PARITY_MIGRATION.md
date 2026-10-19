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

## Status

- [x] Expanded shared persisted-query prefix allowlist to cover the AppCache domains above.
- [ ] Migrate each data domain to canonical shared query keys and cache-backed hooks.
- [ ] Replace component-owned duplicate fetch/state paths in both `apps/mobile` and `apps/web`.
- [ ] Wire comrade lists, comrade voters, counts, chat messages, post comments and history comments.
- [ ] Add profile/account display-data cache-first loading and safe balance/transaction-summary caching.
- [ ] Apply optimistic cache updates and targeted invalidation after each mutation.
- [ ] Verify cold start, offline cached rendering, background refresh and account switching.
- [ ] Run core/mobile/web typecheck, lint and web build; inspect Actions results.
- [ ] Confirm `git diff master -- apps/mobile` is empty only if mobile scope is intentionally excluded. This migration explicitly includes mobile, so mobile changes must instead be reviewed and tested rather than prohibited.
