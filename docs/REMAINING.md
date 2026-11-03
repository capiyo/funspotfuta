# Remaining web parity work

Branch: `web-port-from-master` (draft PR #4)

The following requested files remain incomplete, in the exact requested order. Continue one file at a time, using the matching mobile file as the source of truth. Do not modify `apps/mobile`.

1. `modals/CommentsModal.tsx` — mobile 1,042 lines; web 353 lines
2. `modals/joingroupmodal.tsx` — mobile 793 lines; web 40 lines
3. `modals/ChannelCreation.tsx` — mobile 978 lines; web 86 lines
4. `modals/comradelist/index.tsx` — mobile 1,189 lines; web 328 lines
5. `modals/comradelist/comradeCard.tsx` — mobile 278 lines; web 65 lines
6. `modals/AftermatchModal.tsx` — mobile 912 lines; web 88 lines
7. `modals/match/pitchView.tsx` — mobile 1,118 lines; web 200 lines
8. `modals/match/matchDetailsModals.tsx` — mobile 499 lines; web 97 lines
9. `modals/match/lineupsTab.tsx` — mobile 361 lines; web 72 lines
10. `modals/match/statsTab.tsx` — mobile 235 lines; web 69 lines
11. `modals/NotificationsModal.tsx` — mobile 312 lines; web 116 lines
12. `screens/home/home-context.tsx` — mobile 385 lines; web 219 lines
13. `screens/MessageScreen.tsx` — mobile 1,639 lines; web 1,044 lines. Compare side by side and add every missing mobile handler, effect, state variable, and API call; do not rewrite wholesale.
14. `screens/ChatsScreen.tsx` — mobile 601 lines; web 408 lines. Compare side by side and add every missing mobile handler, effect, state variable, and API call; do not rewrite wholesale.

## Validation status at handoff

The GitHub Actions workflow runs `typecheck:core`, `typecheck:web`, `typecheck:mobile`, `lint:web`, and `build:web`. Runs for the latest changes were still running at handoff. A prior web typecheck reported errors in `addPostModal.tsx`, `ChatsScreen.tsx`, `HomeScreen.tsx`, and `appHeader.tsx`; the duplicate `onScroll` error introduced in `FeedScreen.tsx` was corrected in a follow-up commit. Re-run all checks and fix failures within the allowed scope before continuing.
