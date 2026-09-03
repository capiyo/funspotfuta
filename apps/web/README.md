# Funspot — Next.js Port

This is a **Next.js 14 (App Router, TypeScript, Tailwind)** port of the
[capiyo/funspot](https://github.com/capiyo/funspot) Flutter app — "a war zone
for fans: create channels, vote on matches, earn."

## Reality check on scope

The original Flutter app is **~96,000 lines of Dart across 100 files**,
including a 4,584-line `main.dart` and a 6,643-line `home_page.dart`. That is
not a weekend port. This is a **real, working port** — not a mockup — wired
against the app's actual live backend
(`https://clash-api-m5mr.onrender.com/api`), built up file-by-file. It now
covers the full core loop: auth, voting, channels, whole-match pledges/bets,
per-market prop bets, live chat (text + images), trending markets, M-Pesa
top-ups, match history, leaderboard, comrades/friends, a posts feed,
notification preferences, and an admin dashboard.

## What's ported (real logic hitting the live API, not placeholders)

| Original (Dart)                              | Ported to                              |
|-----------------------------------------------|-----------------------------------------|
| `lib/models/fixture_models.dart` (Fixture, Voter, Bettor, SubFixture, HistoryGame, HistoryService) | `lib/types/fixture.ts`, `lib/api/history-service.ts` |
| `lib/models/{news,pledge,chats,archive,usermodels}.dart` | `lib/types/models.ts` |
| `lib/models/chat_message.dart` (ReplyData + master ChatMessage) | `lib/types/chat-message.ts` |
| `lib/models/post_models.dart` | `lib/types/post.ts` |
| `lib/services/auth_service.dart` (supersedes `app_state.dart`, same state) | `lib/auth/auth-context.tsx` |
| `lib/services/database_service.dart` | `lib/api/database-service.ts` |
| `lib/modals/login_modal.dart` backend calls | `lib/api/auth-service.ts` + `app/login/page.tsx` |
| `lib/services/comrade_service.dart` — **full port** (channels, fixture chat incl. media/reply-capable send, channel voting, comments, comrades graph) | `lib/api/comrade-service.ts` |
| `lib/services/bet_service.dart` — **full port** | `lib/api/bet-service.ts`, `lib/api/sub-fixture-service.ts`, `lib/types/betting.ts` |
| Sub-fixture voting, posts, followers, and chat-image-upload sections of `lib/services/api_services.dart` | `lib/api/sub-fixture-votes-service.ts`, `lib/api/posts-service.ts`, `lib/api/media-service.ts` |
| `lib/services/web_soecket.dart` — multi-room WebSocket client | `lib/api/websocket-service.ts` + `lib/api/use-channel-chat.ts` |
| `lib/services/payment_service.dart` — M-Pesa STK push, balance, transactions, B2C/admin payout | `lib/api/payment-service.ts` |
| `lib/services/toast_helper.dart` | `lib/toast/toast-context.tsx` |
| REST subset of `lib/services/notification_service.dart` (unread summary, mark-read, preferences — not FCM registration) | `lib/api/notification-service.ts` + `app/(app)/notifications/page.tsx` |
| `lib/modals/Funzy/leaderboard.dart` (ComradeWithStats + data layer) | `lib/types/leaderboard.ts` + `app/(app)/leaderboard/page.tsx` |
| Admin-only endpoints from `lib/modals/homepage/admin_dashboard.dart` (channel detail/stats, member removal, payment visibility flag — payout itself reuses `payment-service.ts`) | `lib/api/admin-service.ts` + `app/(app)/admin/[channelId]/page.tsx` |
| `lib/pages/bottom_navigation.dart` | `components/BottomNav.tsx` |
| `lib/widgets/match_card.dart` | `components/MatchCard.tsx` |
| `lib/modals/homepage/channel_creation.dart` (simplified) | `components/ChannelCreationModal.tsx` |
| `lib/screens/home_page.dart` (fixture feed, simplified) | `app/(app)/home/page.tsx` |
| New: fixture detail page (vote + pledge/bet + prop markets + comments + toasts) | `app/(app)/fixture/[matchId]/page.tsx` |
| New: live channel chat UI, now with image sending | `app/(app)/chat/page.tsx` |
| New: trending prop markets UI | `app/(app)/trending/page.tsx` |
| New: wallet UI (M-Pesa top-up, transactions) | `components/WalletCard.tsx` (in `/profile`) |
| New: comrades (friends) UI | `app/(app)/comrades/page.tsx` |
| New: match history UI | `app/(app)/history/page.tsx` |
| New: posts feed UI (create/like/paginate) | `app/(app)/feed/page.tsx` |

All of the above hit the **real production API** — there is no mock data.

## What's intentionally not ported (with reasons)

- **Firebase Phone-Auth OTP** (`firebase_auth_service.dart`) — needs the
  project's live Firebase reCAPTCHA/SMS config in a browser; PIN-based
  login/registration (backend-only) is fully wired instead. Firebase web
  config is in `.env.example` for when this is added.
- **FCM push notification delivery** (`notification_service.dart`'s token
  registration, `local_notification_service.dart`,
  `web_notification_service*.dart`) — the *data* half (unread counts,
  preferences, mark-read) is ported and has a real page; actual push
  delivery would need Web Push + a service worker + the project's FCM
  server key (not public like the web config).
- **Local SQLite caching / offline queue** (`local_database.dart`,
  `comments_db_service.dart`, `upload_queue.dart`, `memory_manager.dart`,
  admin dashboard's `AppCache`) — these existed for spotty mobile
  connectivity offline-first; a browser tab re-fetches instead.
- **Video in chat** (`uploadChatVideoWithThumbnail*` — several are
  explicitly mobile-only background-upload variants in the original) —
  chat image sending is ported; video is not.
- **Admin dashboard's own in-page payments UI** — not duplicated; it calls
  the same `payment-service.ts` functions already used by `/profile`'s
  wallet, so the payout button on `/admin/[channelId]` reuses that.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on `/login` (phone + PIN flow
against the real backend), then `/home` once authenticated. From there:
tap into a fixture for voting/pledges/prop-markets/comments, use the Chat
(text + images) and Trending tabs, check Profile for wallet/comrades/
leaderboard/history/notification-preferences links, try the Feed via the
link on Home, and — if you created a channel — an "⚙ Admin" link appears
next to it on Home.

## Environment

No env vars are required to run — the backend base URL is hardcoded to match
the original app everywhere it appears in the Dart source. See
`.env.example` for the Firebase web config, needed only if Phone-Auth OTP is
added later.
