# MessageScreen.tsx parity checklist

Source: `apps/mobile/src/screens/MessageScreen.tsx` on `web-port-from-master` (1,640 lines).
Target: `apps/web/src/screens/MessageScreen.tsx` (1,045 lines at audit time).

**Status: NOT PORTED / NOT VERIFIED.** The line count alone is not proof of parity. Do not mark items complete until the web implementation is inspected and each behavior is matched.

## State and refs
- [ ] `activeChannelId` and route channel selection (mobile lines 169–171) — web line: pending
- [ ] `autoFixture` and fixture selection (172, 224–244) — web line: pending
- [ ] Draft, reply target, and message options state (173–175) — web line: pending
- [ ] Attachment menu, vote/review/match-details/leaderboard modals, voter visibility, extra tabs (176–185) — web line: pending
- [ ] Pending image/caption and full-screen image viewer state (182–184) — web line: pending
- [ ] Message list ref and typing throttle ref (187–188) — web line: pending

## Effects and derived behavior
- [ ] Apply route channel ID (190–192) — web line: pending
- [ ] Select default channel when no channel is active (195–202) — web line: pending
- [ ] Fetch `/visibility/votes_button_show` and update extra-tab visibility (204–218) — web line: pending
- [ ] Derive route fixture from available fixture/channel state (224 onward) — web line: pending
- [ ] Resolve auto fixture from live/all fixtures (234–245) — web line: pending
- [ ] Build modal API/context callbacks (300 onward) — web line: pending
- [ ] Typing/debounce timer cleanup and latest `markRead` callback ref (323–340) — web line: pending

## Handlers, API calls, and interaction flows
- [ ] Send a message, clear draft, and preserve reply semantics (343–379) — web line: pending
- [ ] Draft change / typing updates and throttling (380 onward) — web line: pending
- [ ] Pick an image and initialize pending image/caption (389–415) — web line: pending
- [ ] Confirm/send image and reset pending state (416–430) — web line: pending
- [ ] Route completed fixtures to review and active fixtures to vote (431–434) — web line: pending
- [ ] Back navigation and clipboard copy (435–445) — web line: pending
- [ ] Vote/review gate, match details, leaderboard, voter totals, and voter list interactions (463–528) — web line: pending
- [ ] Message list scrolling/content-size behavior, long-press actions, image opening (538–556) — web line: pending
- [ ] Reply selection/clearing and composer submission (606–715) — web line: pending
- [ ] Attachment menu image flow and close/reset behavior (703–802) — web line: pending
- [ ] Message options: reply, copy, and remaining option actions (823–855) — web line: pending
- [ ] Vote modal callbacks, including vote and pledge API calls (888–934) — web line: pending
- [ ] Review, match-details, and leaderboard modal wiring (965–984) — web line: pending
- [ ] Preserve all embedded match-bar, vote summary, message rendering, and image interactions (1038 onward) — web line: pending

## Validation
- [ ] Compare the entire mobile source against web implementation; verify all handlers, effects, state, API calls, validation and user-facing text.
- [ ] No stubs, TODOs, placeholder handlers, or omitted behaviors.
- [ ] `npm run typecheck:web` passes.
- [ ] `npm run lint:web` passes.
- [ ] `npm run build:web` passes.
- [ ] Commit and push the completed file and this evidence before moving to the next file.
