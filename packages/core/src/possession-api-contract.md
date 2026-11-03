# Possession API contract

All routes are independent from match winner voting and general match pokes.

Base: `/api/actions/posseions`

## Read market
- `GET /?fixture_id=:fixtureId&channel_id=:channelId`
- Returns `PossessionMarket`: market status, home/away possession values, possession-only vote totals and voter list, possession-only open pokes, current user's selection, and optional settlement result.

## Votes
- `GET /votes?fixture_id=:fixtureId&channel_id=:channelId` returns `{ votes: PossessionVote[] }`.
- `POST /votes`
- JSON: `fixture_id`, `channel_id`, `user_id`, `username`, `selection` (`home` or `away`).
- Returns `PossessionActionResult`.

## Possession pokes
- `GET /poking?fixture_id=:fixtureId&channel_id=:channelId` returns `{ pokes: PossessionPoke[] }`.
- `POST /poking`
- JSON: `fixture_id`, `channel_id`, `user_id`, `username`, `selection` (`home` or `away`), `amount` (positive integer points).
- Returns `PossessionActionResult`.

## Match possession poke
- `POST /poking/match`
- JSON: `fixture_id`, `channel_id`, `poke_id`, `user_id`.
- Returns `PossessionActionResult`.

## Settlement
- `POST /settlement`
- JSON: `fixture_id`, `channel_id`; optional `settlement_key`.
- Server-authorized operation. The client never triggers settlement automatically.
- Returns `PossessionActionResult`.

The canonical TypeScript interfaces are in `src/types/possession.ts`; request functions are in `src/api/possession-service.ts`.
