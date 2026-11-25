# Web parity stubs — line-count audit

Branch audited: `web-port-from-master` (PR #4). Counts are newline-delimited source lines from the branch's raw files. Same-path web files with fewer than 50% of the mobile file's lines are listed below, largest mobile file first. Line count is a triage signal, not proof by itself; files still require logic/checklist review.

| Mobile source path (relative to `src/`) | Mobile lines | Web lines | Web/mobile |
|---|---:|---:|---:|
| `modals/comradelist/index.tsx` | 1190 | 329 | 27.6% |
| `modals/match/pitchView.tsx` | 1119 | 201 | 18.0% |
| `modals/CommentsModal.tsx` | 1043 | 353 | 33.8% |
| `modals/ChannelCreation.tsx` | 979 | 87 | 8.9% |
| `modals/LoginModal.tsx` | 960 | 129 | 13.4% |
| `modals/AftermatchModal.tsx` | 913 | 89 | 9.7% |
| `modals/addPostModal.tsx` | 834 | 61 | 7.3% |
| `modals/joingroupmodal.tsx` | 794 | 41 | 5.2% |
| `screens/ChatsScreen.tsx` | 602 | 28 | 4.7% |
| `modals/match/matchDetailsModals.tsx` | 500 | 98 | 19.6% |
| `screens/home/appHeader.tsx` | 460 | 29 | 6.3% |
| `modals/match/lineupsTab.tsx` | 362 | 73 | 20.2% |
| `screens/FeedScreen.tsx` | 368 | 125 | 34.0% |
| `modals/NotificationsModal.tsx` | 313 | 117 | 37.4% |
| `modals/comradelist/comradeCard.tsx` | 279 | 66 | 23.7% |
| `components/HistoryCard.tsx` | 253 | 76 | 30.0% |

## Audit limitations

This is the confirmed under-50% set from the large-source files sampled so far, not a claim that the full `apps/mobile/src` inventory has been line-count audited. Finish checking every mobile source file over 150 lines and append any additional under-50% matches before treating Step 1 as complete. Small UI components are excluded from the triage list. No files under `apps/mobile` were changed.
