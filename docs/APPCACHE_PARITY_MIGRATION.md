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

Only allowlisted, successful query responses are eligible for persistence. Credential-bearing data and credential-bearing query keys are rejected. Financial balances and transaction histories are deliberately excluded and must be fetched from the server. Private profile, chat and notification data may be cached only inside the encrypted platform stores described below.

## Implementation checklist

### Inventory and shared cache foundation

- [x] Read `lib/services/local_database.dart`, `lib/services/memory_manager.dart`, `lib/main.dart`, and fixture-page cache use.
- [x] Record the known Flutter AppCache and LocalDatabase domains in the inventory table above.
- [x] Expand persisted query-key prefixes for AppCache data domains, with a strict allowlist.
- [x] Persist only successful query responses with defined data; preserve Date/undefined values; reject credential-bearing query data and query keys.
- [x] Do not persist mutations. Offline mutations remain in memory only; they are not replayed after a process restart.
- [x] Set query network mode to `offlineFirst`, query `gcTime` to one day, and persistence max age to one day.
- [x] Bound durable cache snapshots to 150 queries and 2 MB; cap message/comment/notification lists at 50 and other high-volume lists.
- [x] Wire React Native NetInfo to TanStack `onlineManager` and keep `AppState` wired to `focusManager`.
- [x] Add AES-GCM encrypted IndexedDB persistence for web using non-extractable origin-scoped Web Crypto keys; prevent concurrent first-run key creation from replacing the winning key.
- [x] Add encrypted MMKV persistence for Android/iOS with a random AES-128 key stored in SecureStore/Keychain/Keystore; fall back to memory-only storage if encryption setup fails.
- [x] Store mobile session credentials in SecureStore with device-only Keychain accessibility; store web session credentials encrypted in IndexedDB rather than localStorage.
- [x] Migrate legacy native MMKV/AsyncStorage and browser localStorage sessions into secure stores before deleting plaintext copies; preserve a compatible old native query snapshot only after opening the encrypted destination.
- [x] Cancel in-flight queries, clear in-memory data and remove durable snapshots on logout/account changes; cancel delayed writes so old snapshots cannot reappear.
- [x] Exclude balances and transaction histories from durable query persistence; always fetch them from the server.
- [x] Keep mutations non-persistent; no unknown action is replayed after restart.
- [x] Add a shared query-key factory with user-scoped keys for profile, comrades, votes, messages, history and activity data.
- [x] Add reusable merge-not-replace and 50-message cache-cap utilities.
- [x] Add shared cache-first hooks for profile and comrades; export them from `@funspot/core`.
- [x] Wire web and mobile profile reads to the shared persisted profile query; transient profile fetch errors no longer become cached `null` results.
- [x] Update the shared profile cache after a successful profile save and balance refresh.
- [ ] Wire the remaining profile edit, balance, saved-phone, and transaction actions through shared query/mutation functions.
- [x] Use the shared query-key factory in the existing fixtures/history hooks and web public-channel hook.
- [x] Move public-channel fetching into a shared core hook; web now delegates to it and both platforms can use the same persisted key.

### Domain wiring — not complete

- [x] Web and mobile ChatsScreen now use the shared core `useFixtures` hook, including cached voter merge and user-scoped vote snapshots.
- [ ] Fixtures: inventory all remaining consumers, validate every API response shape, and remove any other screen-owned fixture query.
- [x] Auth initialization now sequentially warms fixtures → feed → user votes → comrades → profile using shared query options; failures stop the sequence without replacing cached data.
- [ ] Add fixture-by-fixture voter/chat prefetch only where there is an active fixture/channel, then verify request counts and no startup stampede.
- [ ] Votes and user vote state: wire every query/mutation to canonical user-scoped keys and optimistic rollback.
- [ ] Voters/comrade voters: merge partial server results with cached entries and wire all consumers.
- [ ] Chat/messages: wire all consumers and mutations; cap persisted messages at 50 per fixture.
- [x] Core channel-chat hook restores cached messages before network refresh, merges fetched history with cached entries, persists a 50-message snapshot per fixture/channel/user, and revives Date timestamps after JSON persistence.
- [x] Chat message snapshots include image and video attachment URLs, thumbnails, media flags, captions, reply metadata and timestamps in the same encrypted `chatMessages` AppCache entry; media is not stored in a separate unbounded cache.
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
- [x] Web and mobile FeedScreen now use a shared core infinite-feed hook with one canonical persisted `['feed']` query key and background refresh.
- [ ] Move post likes, post creation, comments, followers and other feed interactions to shared core mutation hooks.
- [ ] History/history comments/aftermatch/live events: migrate every consumer and mutation.
- [x] Web and mobile HistoryModal now use a shared paginated history hook with user-scoped cache keys; transient history HTTP errors throw rather than caching an empty list.
- [ ] Wire history comments, aftermatch and live-event consumers/mutations to shared cache-backed hooks.
- [ ] Notifications: migrate every consumer and mutation to shared query keys.
- [x] Add query-cache clearing on logout/account switch in web and mobile; mobile AuthProvider waits for secure storage migration before restoring a session.
- [x] Add automated coverage for credential rejection, financial-data exclusion, buster invalidation, bounded snapshots and cache restore.
- [ ] Verify encrypted IndexedDB/MMKV removal and legacy migration on physical browsers/devices; verify Keychain/Keystore behavior after app reinstall and backup restore.
- [ ] Audit all HTTP usage in apps/web and apps/mobile; ensure components call core hooks rather than HTTP directly.
- [ ] Verify offline launch and the full vote-to-chat UI flow end to end.
- [x] Add Vitest coverage for merge-not-replace, user-scoped keys, the 50-message cap, persistence restore after creating a new QueryClient, Date serialization, buster invalidation, successful-query-only dehydration, credential-free paused mutations, optimistic rollback, query-client logout clearing, and cached vote availability; CI runs `npm run test:core`.
- [ ] Run core/mobile/web typecheck, web lint/build and Android/iOS bundle checks on the final commit; wait for a successful GitHub Actions run.
- [ ] Perform physical-device offline launch, cache eviction, account-switch and logout/relogin tests on Android and iOS; test multi-tab logout and browser storage eviction on web.

Status is intentionally not marked complete: the query-key foundation does not itself migrate all component-owned fetch/state paths. No unverified domain row should be checked off.


## Production cache security and retention

The current production cache design is intentionally different from a generic browser/local key-value cache:

| Platform | Durable query cache | Session credentials | Failure behavior |
| --- | --- | --- | --- |
| Web | AES-GCM encrypted IndexedDB snapshot; non-extractable Web Crypto key stored in IndexedDB | AES-GCM encrypted IndexedDB records | If Web Crypto/IndexedDB is unavailable, do not write plaintext; use in-memory query state |
| Android | Encrypted MMKV | Expo SecureStore backed by Android Keystore | If SecureStore or encrypted MMKV initialization fails, use memory-only cache |
| iOS | Encrypted MMKV | Expo SecureStore backed by iOS Keychain, device-only accessibility | If SecureStore or encrypted MMKV initialization fails, use memory-only cache |

The persisted cache uses buster v10 and a one-day maximum age. The serializer ranks useful query domains, caps the snapshot at 150 queries / 2 MB, and trims large lists. The allowlist rejects credentials recursively, including fields such as access/refresh tokens, passwords, authorization headers, API/access/private keys, cookies and session fields. It also rejects query keys containing credential-bearing objects. Mutations are not dehydrated. Balance and transaction-history queries are not allowlisted.

Encryption at rest protects data if the storage files are inspected outside the running app. It does not protect against script execution inside the authenticated browser origin (for example, an XSS vulnerability), a compromised device, or an authorized app process. Web should move to backend-issued HttpOnly, Secure, SameSite cookies/BFF sessions if the authentication backend is redesigned to support that model. Physical-device and browser lifecycle tests remain required before describing the system as fully production-verified.

The shared cache foundation is implemented, but the domain-wiring checklist above remains intentionally incomplete. A key being allowlisted does not prove every screen uses that key.
