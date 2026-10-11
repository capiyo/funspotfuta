# MessageScreen parity checklist

Source of truth: `apps/mobile/src/screens/MessageScreen.tsx` on `master` (1,640 lines). Target: `apps/web/src/screens/MessageScreen.tsx`. This inventory is created before the web screen implementation. Every item must be checked against the final web file; line references are to be filled in after each section lands. Do not merge this screen into ChatsScreen.

## State variables
- [ ] `activeChannelId` — route channel or default channel selection.
- [ ] `autoFixture` — fixture chosen when the route does not specify one.
- [ ] `draft` — message composer content.
- [ ] `replyTo` — selected message/reply quote.
- [ ] `optionsFor` — message selected for context actions.
- [ ] `showAttachMenu` — composer attachment menu visibility.
- [ ] `voteModalOpen` — voting/pledge modal visibility.
- [ ] `reviewModalOpen` — aftermatch review visibility.
- [ ] `matchDetailsOpen` — match details visibility.
- [ ] `leaderboardOpen` — comrades/leaderboard modal visibility.
- [ ] `showVoters` — voter panel visibility.
- [ ] `pendingImage` — selected image pending caption/send.
- [ ] `caption` — image caption draft.
- [ ] `viewerUri` — full-screen image viewer URI.
- [ ] `showExtraTabs` — remote visibility flag for pledges, bets and sub-fixtures.

## Refs and memoized/derived values
- [ ] `listRef` — message list scrolling.
- [ ] `lastTypingSentRef` — typing indicator throttle timestamp.
- [ ] `styles` / theme colors / safe-area inset equivalents.
- [ ] route channel and fixture IDs; fixture cache lookup via `['fixtures']`.
- [ ] fixture ID fallback, match status flags, vote gate, user vote state.
- [ ] `modalApi` authenticated adapters for top-up, withdrawal, phone and pledge methods.
- [ ] `markReadRef` latest mark-read callback for real-unmount cleanup.

## Hooks and effects
- [ ] `useFanColors`, safe-area/layout equivalent, navigation/route equivalent, auth, toast, query client.
- [ ] Sync active channel from route channel ID.
- [ ] Resolve default channel with `getUserChannels(userId, authToken)` if route omitted channel.
- [ ] Fetch `/visibility/votes_button_show`, validate boolean `value`, ignore results after cleanup.
- [ ] Resolve route fixture from cached fixtures by `id` or `matchId`.
- [ ] Fetch `getAllFixtures()` and choose live/half-time/upcoming/soon fixture or first fixture when appropriate.
- [ ] Initialize `useChannelChat` with channel, fixture, identity, auth, status and seed scores.
- [ ] Auto-scroll after message-count changes (60 ms delayed).
- [ ] Keep latest `markRead` callback in a ref.
- [ ] Call `markRead` only on actual screen unmount.

## API/services and data dependencies
- [ ] `getUserChannels` and `getAllFixtures`.
- [ ] `useChannelChat`: messages, history loading, image upload, typing users, send, sendImage, markRead, match status/scores/time/live, vote counts/selection/voters/refetch.
- [ ] GET `/visibility/votes_button_show` with JSON headers and optional bearer token.
- [ ] `fetchVoters`, `fetchPledges`, `fetchSubFixtures`, `fetchSubFixturePledges`, `fetchBets`, `fetchBalance`.
- [ ] Vote modal shims: top-up, withdraw, get/save phone, get user phone, place/match sub-fixture pledge; preserve user/token binding.
- [ ] `castFixtureVote` with query invalidation and vote-count refresh on success.
- [ ] `createPledge`, including already-voted state, vote-count refresh when the flow casts a vote, and returned balance/message.
- [ ] Clipboard copy operation and success toast.
- [ ] Image selection and `sendImage(asset, caption)`; preserve image metadata and error messages.
- [ ] Typing notification throttled at 1,500 ms and only sent for logged-in user.
- [ ] Message send preserves reply data in `replyTo`, not duplicated in message text.
- [ ] Query invalidation for fixtures when navigating back and after successful voting.
- [ ] Existing API base fallback `https://clash-api-m5mr.onrender.com/api`.

## Handlers
- [ ] `sendWithReply(text, reply)`.
- [ ] `handleSend`: trim, vote-gate check, clear draft, build reply payload for text/image/video, clear reply state, send.
- [ ] `handleDraftChange`: update draft and throttle `chat.sendTyping()`.
- [ ] `handleImagePick`: close attachment menu, request one photo, handle cancel/missing URI/errors, retain name/type/dimensions.
- [ ] `confirmSendImage`: snapshot selected image/caption, clear pending state, call sendImage, toast on failure.
- [ ] `openVoteOrReview`: completed/finished opens aftermatch; otherwise voting modal.
- [ ] `handleBack`: invalidate fixtures and navigate back.
- [ ] `handleCopy`: copy exact text and show “Copied”.
- [ ] Reply selection and reply cancellation.
- [ ] Message context action open/close; reply, copy text, and owner-only delete notice.
- [ ] Open/close image viewer, caption modal, attachment menu, voters panel, voting modal, aftermatch modal, match details, comrades/leaderboard.

## Render branches and user-facing states
- [ ] Own screen route with its own header and back control; no ChatsScreen merge.
- [ ] Header: back button, conditional match details button, match status/score/teams or “Chat”, leaderboard button.
- [ ] Match status bar: half-time, full-time, live, upcoming, soon and fallback status; score and elapsed minute.
- [ ] Vote strip when fixture and fixture ID exist; no-vote team chips; vote distribution and totals when votes exist.
- [ ] No active channel branch: “Join or create a channel to start chatting.”
- [ ] Main chat layout and keyboard-aware composer equivalent.
- [ ] Optional voters panel; “Votes (n)”, “No votes yet”, current user displayed as “You”, home/away label normalization.
- [ ] Message list and stable message IDs; auto-scroll at content-size change.
- [ ] Empty list while history loads: “Loading messages…”.
- [ ] Empty list after load: “No messages yet — say something.”
- [ ] Incoming/outgoing/commentary message alignment, username, avatar, reply quote, text, timestamp.
- [ ] Pending message opacity; failed-send background and “Failed to send”.
- [ ] Uploading placeholder; image tap opens viewer; video placeholder branch.
- [ ] Typing branch: one user “is typing…” vs multiple “people are typing…”.
- [ ] Reply preview bar, commentary/self/other username wording, media fallback and clear button.
- [ ] Vote button and vote-gate branch; locked composer, “Vote before game starts 💬” vs “Vote to chat 💬”.
- [ ] Composer disabled/login placeholder, uploading placeholder, live/completed/normal placeholders, send button only for non-empty logged-in draft.
- [ ] Attachment menu image and video choices; video choice closes menu and shows “Video coming soon”.
- [ ] Image caption dialog, preview, 500-character caption input, cancel/send.
- [ ] Full-screen image viewer with backdrop close.
- [ ] Message options dialog: Reply; Copy text when text exists; Delete only for current user non-commentary message (existing notice text “Delete coming soon”).
- [ ] Vote modal only with fixture, channel and open flag; fixture payload, auth, visibility flags, vote and pledge callbacks, fetchers and authenticated shim methods.
- [ ] Aftermatch review only with fixture, channel and open flag; same tab visibility flags.
- [ ] Match details only with fixture and open flag; user/auth props.
- [ ] Comrades/leaderboard modal with visible state and close handler.

## Child components and helpers in the source file
- [ ] `formatMinute` — minute/seconds format.
- [ ] `isFailed` — failed-message status.
- [ ] `MatchStatusBar` — status/score/minute/team label branches.
- [ ] `VoteStrip` — zero-vote chips and nonzero vote ratio bar.
- [ ] `VotersPanel` — voter list and normalized selection.
- [ ] `MessageBubble` — commentary, self/other, reply quote, uploading, image, video, text, pending, failed, timestamp, long press.
- [ ] `timeAgo` — now/minutes/hours/days/date.
- [ ] `createStyles` layout roles represented with Tailwind/CSS equivalents, including bottom inset, composer, attachment chips, caption dialog, options and viewer.

## Port sections and verification
- [ ] (a) Header and layout.
- [ ] (b) Message list, scrolling, pagination/history loading, scroll-to-bottom behavior.
- [ ] (c) Composer, sending, optimistic updates and retry on failure (including exact behavior provided by `useChannelChat`).
- [ ] (d) Media, replies, reactions if supported by the source model, and long-press menu via right-click/hover on web.
- [ ] (e) Polling/real-time updates, read state, empty/loading/error states.
- [ ] Each checklist item above mapped to a web-file line range below.
- [ ] Web file is at least approximately 1,000 lines and all five section commits have passed typecheck, lint and Vite build.

## Final line map
Fill in exact web line numbers as sections land. Items without a line range remain outstanding.
