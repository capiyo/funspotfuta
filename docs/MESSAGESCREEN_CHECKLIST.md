# MessageScreen parity checklist

Source of truth: `apps/mobile/src/screens/MessageScreen.tsx` on `master` (1,640 lines). Target: `apps/web/src/screens/MessageScreen.tsx`. This inventory is created before the web screen implementation. Every item must be checked against the final web file; line references are to be filled in after each section lands. Do not merge this screen into ChatsScreen.

## State variables
- [x] `activeChannelId` — route channel or default channel selection. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `autoFixture` — fixture chosen when the route does not specify one. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `draft` — message composer content. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `replyTo` — selected message/reply quote. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `optionsFor` — message selected for context actions. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `showAttachMenu` — composer attachment menu visibility. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `voteModalOpen` — voting/pledge modal visibility. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `reviewModalOpen` — aftermatch review visibility. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `matchDetailsOpen` — match details visibility. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `leaderboardOpen` — comrades/leaderboard modal visibility. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `showVoters` — voter panel visibility. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `pendingImage` — selected image pending caption/send. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `caption` — image caption draft. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `viewerUri` — full-screen image viewer URI. — `apps/web/src/screens/MessageScreen.tsx:126–143`
- [x] `showExtraTabs` — remote visibility flag for pledges, bets and sub-fixtures. — `apps/web/src/screens/MessageScreen.tsx:126–143`

## Refs and memoized/derived values
- [x] `listRef` — message list scrolling. — `apps/web/src/screens/MessageScreen.tsx:144–249, 396–400`
- [x] `lastTypingSentRef` — typing indicator throttle timestamp. — `apps/web/src/screens/MessageScreen.tsx:144–249, 396–400`
- [x] `styles` / theme colors / safe-area inset equivalents. — `apps/web/src/screens/MessageScreen.tsx:144–249, 396–400`
- [x] route channel and fixture IDs; fixture cache lookup via `['fixtures']`. — `apps/web/src/screens/MessageScreen.tsx:144–249, 396–400`
- [x] fixture ID fallback, match status flags, vote gate, user vote state. — `apps/web/src/screens/MessageScreen.tsx:144–249, 396–400`
- [x] `modalApi` authenticated adapters for top-up, withdrawal, phone and pledge methods. — `apps/web/src/screens/MessageScreen.tsx:144–249, 396–400`
- [x] `markReadRef` latest mark-read callback for real-unmount cleanup. — `apps/web/src/screens/MessageScreen.tsx:144–249, 396–400`

## Hooks and effects
- [x] `useFanColors`, safe-area/layout equivalent, navigation/route equivalent, auth, toast, query client. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Sync active channel from route channel ID. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Resolve default channel with `getUserChannels(userId, authToken)` if route omitted channel. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Fetch `/visibility/votes_button_show`, validate boolean `value`, ignore results after cleanup. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Resolve route fixture from cached fixtures by `id` or `matchId`. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Fetch `getAllFixtures()` and choose live/half-time/upcoming/soon fixture or first fixture when appropriate. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Initialize `useChannelChat` with channel, fixture, identity, auth, status and seed scores. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Auto-scroll after message-count changes (60 ms delayed). — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Keep latest `markRead` callback in a ref. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Call `markRead` only on actual screen unmount. — `apps/web/src/screens/MessageScreen.tsx:146–280; apps/web/src/lib/api/use-channel-chat.ts:1–400`

## API/services and data dependencies
- [x] `getUserChannels` and `getAllFixtures`. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] `useChannelChat`: messages, history loading, image upload, typing users, send, sendImage, markRead, match status/scores/time/live, vote counts/selection/voters/refetch. — `apps/web/src/screens/MessageScreen.tsx:206–232; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] GET `/visibility/votes_button_show` with JSON headers and optional bearer token. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] `fetchVoters`, `fetchPledges`, `fetchSubFixtures`, `fetchSubFixturePledges`, `fetchBets`, `fetchBalance`. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [ ] Vote modal shims: top-up, withdraw, get/save phone, get user phone, place/match sub-fixture pledge; preserve user/token binding. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400` — REMAINING: screen binds these methods, but dependent web modal implementations do not yet reproduce every native payment/sub-fixture matching interaction
- [x] `castFixtureVote` with query invalidation and vote-count refresh on success. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] `createPledge`, including already-voted state, vote-count refresh when the flow casts a vote, and returned balance/message. — `apps/web/src/screens/MessageScreen.tsx:760–780`
- [x] Clipboard copy operation and success toast. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Image selection and `sendImage(asset, caption)`; preserve image metadata and error messages. — `apps/web/src/screens/MessageScreen.tsx:333–362; apps/web/src/lib/api/use-channel-chat.ts:345–385`
- [x] Typing notification throttled at 1,500 ms and only sent for logged-in user. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Message send preserves reply data in `replyTo`, not duplicated in message text. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Query invalidation for fixtures when navigating back and after successful voting. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`
- [x] Existing API base fallback `https://clash-api-m5mr.onrender.com/api`. — `apps/web/src/screens/MessageScreen.tsx:166–249, 733–799; apps/web/src/lib/api/use-channel-chat.ts:1–400`

## Handlers
- [x] `sendWithReply(text, reply)`. — `apps/web/src/screens/MessageScreen.tsx:281–313`
- [x] `handleSend`: trim, vote-gate check, clear draft, build reply payload for text/image/video, clear reply state, send. — `apps/web/src/screens/MessageScreen.tsx:281–313`
- [x] `handleDraftChange`: update draft and throttle `chat.sendTyping()`. — `apps/web/src/screens/MessageScreen.tsx:314–332`
- [x] `handleImagePick`: close attachment menu, request one photo, handle cancel/missing URI/errors, retain name/type/dimensions. — `apps/web/src/screens/MessageScreen.tsx:333–362`
- [x] `confirmSendImage`: snapshot selected image/caption, clear pending state, call sendImage, toast on failure. — `apps/web/src/screens/MessageScreen.tsx:333–362`
- [x] `openVoteOrReview`: completed/finished opens aftermatch; otherwise voting modal. — `apps/web/src/screens/MessageScreen.tsx:363–395`
- [x] `handleBack`: invalidate fixtures and navigate back. — `apps/web/src/screens/MessageScreen.tsx:363–395`
- [x] `handleCopy`: copy exact text and show “Copied”. — `apps/web/src/screens/MessageScreen.tsx:363–395`
- [x] Reply selection and reply cancellation. — `apps/web/src/screens/MessageScreen.tsx:363–395, 634–799`
- [x] Message context action open/close; reply, copy text, and owner-only delete notice. — `apps/web/src/screens/MessageScreen.tsx:363–395, 634–799`
- [x] Open/close image viewer, caption modal, attachment menu, voters panel, voting modal, aftermatch modal, match details, comrades/leaderboard. — `apps/web/src/screens/MessageScreen.tsx:363–395, 634–799`

## Render branches and user-facing states
- [x] Own screen route with its own header and back control; no ChatsScreen merge. — `apps/web/src/App.tsx:4, 26; apps/web/src/screens/MessageScreen.tsx:111–125`
- [x] Header: back button, conditional match details button, match status/score/teams or “Chat”, leaderboard button. — `apps/web/src/screens/MessageScreen.tsx:405–458, 800–837`
- [x] Match status bar: half-time, full-time, live, upcoming, soon and fallback status; score and elapsed minute. — `apps/web/src/screens/MessageScreen.tsx:800–837`
- [x] Vote strip when fixture and fixture ID exist; no-vote team chips; vote distribution and totals when votes exist. — `apps/web/src/screens/MessageScreen.tsx:459–487, 838–878`
- [x] No active channel branch: “Join or create a channel to start chatting.” — `apps/web/src/screens/MessageScreen.tsx:488–515`
- [x] Main chat layout and keyboard-aware composer equivalent. — `apps/web/src/screens/MessageScreen.tsx:405–799`
- [x] Optional voters panel; “Votes (n)”, “No votes yet”, current user displayed as “You”, home/away label normalization. — `apps/web/src/screens/MessageScreen.tsx:879–909`
- [x] Message list and stable message IDs; auto-scroll at content-size change. — `apps/web/src/screens/MessageScreen.tsx:488–538`
- [x] Empty list while history loads: “Loading messages…”. — `apps/web/src/screens/MessageScreen.tsx:488–538`
- [x] Empty list after load: “No messages yet — say something.” — `apps/web/src/screens/MessageScreen.tsx:488–538`
- [x] Incoming/outgoing/commentary message alignment, username, avatar, reply quote, text, timestamp. — `apps/web/src/screens/MessageScreen.tsx:910–1000`
- [x] Pending message opacity; failed-send background and “Failed to send”. — `apps/web/src/screens/MessageScreen.tsx:910–1000`
- [x] Uploading placeholder; image tap opens viewer; video placeholder branch. — `apps/web/src/screens/MessageScreen.tsx:910–1000`
- [x] Typing branch: one user “is typing…” vs multiple “people are typing…”. — `apps/web/src/screens/MessageScreen.tsx:526–538`
- [x] Reply preview bar, commentary/self/other username wording, media fallback and clear button. — `apps/web/src/screens/MessageScreen.tsx:539–568`
- [x] Vote button and vote-gate branch; locked composer, “Vote before game starts 💬” vs “Vote to chat 💬”. — `apps/web/src/screens/MessageScreen.tsx:569–633`
- [x] Composer disabled/login placeholder, uploading placeholder, live/completed/normal placeholders, send button only for non-empty logged-in draft. — `apps/web/src/screens/MessageScreen.tsx:569–633`
- [x] Attachment menu image and video choices; video choice closes menu and shows “Video coming soon”. — `apps/web/src/screens/MessageScreen.tsx:617–633`
- [x] Image caption dialog, preview, 500-character caption input, cancel/send. — `apps/web/src/screens/MessageScreen.tsx:634–676`
- [x] Full-screen image viewer with backdrop close. — `apps/web/src/screens/MessageScreen.tsx:677–698`
- [x] Message options dialog: Reply; Copy text when text exists; Delete only for current user non-commentary message (existing notice text “Delete coming soon”). — `apps/web/src/screens/MessageScreen.tsx:699–732`
- [x] Vote modal only with fixture, channel and open flag; fixture payload, auth, visibility flags, vote and pledge callbacks, fetchers and authenticated shim methods. — `apps/web/src/screens/MessageScreen.tsx:733–799; apps/web/src/modals/actionModal.tsx:1–187`
- [x] Aftermatch review only with fixture, channel and open flag; same tab visibility flags. — `apps/web/src/screens/MessageScreen.tsx:733–799; apps/web/src/modals/AftermatchModal.tsx:1–52`
- [x] Match details only with fixture and open flag; user/auth props. — `apps/web/src/screens/MessageScreen.tsx:790–799; apps/web/src/modals/match/matchDetailsModals.tsx`
- [x] Comrades/leaderboard modal with visible state and close handler. — `apps/web/src/screens/MessageScreen.tsx:790–799; apps/web/src/modals/ComradesModal.tsx`

## Child components and helpers in the source file
- [x] `formatMinute` — minute/seconds format. — `apps/web/src/screens/MessageScreen.tsx:70–109`
- [x] `isFailed` — failed-message status. — `apps/web/src/screens/MessageScreen.tsx:70–109`
- [x] `MatchStatusBar` — status/score/minute/team label branches. — `apps/web/src/screens/MessageScreen.tsx:800–837`
- [x] `VoteStrip` — zero-vote chips and nonzero vote ratio bar. — `apps/web/src/screens/MessageScreen.tsx:838–878`
- [x] `VotersPanel` — voter list and normalized selection. — `apps/web/src/screens/MessageScreen.tsx:879–909`
- [x] `MessageBubble` — commentary, self/other, reply quote, uploading, image, video, text, pending, failed, timestamp, long press. — `apps/web/src/screens/MessageScreen.tsx:910–1000`
- [x] `timeAgo` — now/minutes/hours/days/date. — `apps/web/src/screens/MessageScreen.tsx:70–109`
- [x] `createStyles` layout roles represented with Tailwind/CSS equivalents, including bottom inset, composer, attachment chips, caption dialog, options and viewer. — `apps/web/src/screens/MessageScreen.tsx:396–633, 634–799, 1001–1040`

## Port sections and verification
- [x] (a) Header and layout. — `apps/web/src/screens/MessageScreen.tsx:405–458`
- [ ] (b) Message list, scrolling, pagination/history loading, scroll-to-bottom behavior. — `apps/web/src/screens/MessageScreen.tsx:488–538; apps/web/src/lib/api/use-channel-chat.ts:80–180` — REMAINING: mobile history fetch requests `limit=100` and has no older-message cursor/pagination API; no endpoint contract was invented
- [x] (c) Composer, sending, optimistic updates and retry on failure (including exact behavior provided by `useChannelChat`). — `apps/web/src/screens/MessageScreen.tsx:281–362, 539–633; apps/web/src/lib/api/use-channel-chat.ts:300–400`
- [x] (d) Media, replies, reactions if supported by the source model, and long-press menu via right-click/hover on web. — `apps/web/src/screens/MessageScreen.tsx:634–732, 910–1000; apps/web/src/lib/api/use-channel-chat.ts:300–380`
- [x] (e) Polling/real-time updates, read state, empty/loading/error states. — `apps/web/src/screens/MessageScreen.tsx:146–280, 488–538; apps/web/src/lib/api/use-channel-chat.ts:130–400`
- [x] Each checklist item above mapped to a web-file line range below. — `Final line map below`
- [x] Web file is at least approximately 1,000 lines and the current commit has passed core/web/mobile typecheck, web lint and Vite build. — `GitHub Actions run 38151862161`

## Final line map

| Section / behavior | Web implementation |
|---|---|
| (a) Header and route | `apps/web/src/App.tsx:4, 26`; `apps/web/src/screens/MessageScreen.tsx:405–458` |
| State, route/fixture resolution, effects | `apps/web/src/screens/MessageScreen.tsx:111–280` |
| (b) Message list, history loading, scroll-to-bottom | `apps/web/src/screens/MessageScreen.tsx:488–538`; `apps/web/src/lib/api/use-channel-chat.ts:80–180` |
| (c) Composer, send/reply/retry, optimistic updates | `apps/web/src/screens/MessageScreen.tsx:281–362, 539–633`; `apps/web/src/lib/api/use-channel-chat.ts:300–400` |
| (d) Image picker/caption/viewer, message actions | `apps/web/src/screens/MessageScreen.tsx:634–732, 910–1000`; `apps/web/src/lib/api/use-channel-chat.ts:345–385` |
| (e) WebSocket, typing, vote state, mark-read, empty/loading | `apps/web/src/screens/MessageScreen.tsx:146–280, 488–538`; `apps/web/src/lib/api/use-channel-chat.ts:130–400` |
| Match vote modal wiring | `apps/web/src/screens/MessageScreen.tsx:733–799`; `apps/web/src/modals/actionModal.tsx:1–187` |
| Aftermatch wiring | `apps/web/src/screens/MessageScreen.tsx:733–799`; `apps/web/src/modals/AftermatchModal.tsx:1–52` |
| Match status, vote strip, voter list | `apps/web/src/screens/MessageScreen.tsx:800–909` |
| Message bubble and dialog behavior | `apps/web/src/screens/MessageScreen.tsx:910–1040` |
| Chat hook dependency | `apps/web/src/lib/api/use-channel-chat.ts:1–400` |

## Remaining items

- [ ] Older-message pagination: the mobile hook requests the latest 100 messages and does not define a cursor/offset contract. Adding pagination without a source/API contract would invent behavior.
- [ ] Full native parity for dependent `actionModal.tsx` and `AftermatchModal.tsx`: web dialogs exist and are wired, but are substantially shorter than the 2,764-line and 913-line mobile files; payment, phone, and sub-fixture pledge/matching flows still need a complete source-by-source port.
- [ ] Browser runtime interaction test: GitHub Actions typecheck/lint/build passed; no browser session was available to exercise live auth, media upload, WebSocket events, and modal flows.
- [ ] Native source itself labels video upload/playback and message deletion as unavailable (“Video coming soon” / “Delete coming soon”); no new endpoints were invented.
