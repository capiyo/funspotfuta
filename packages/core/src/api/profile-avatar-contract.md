# Profile avatar API contract

The web and React Native clients share one account-level profile image. The selected image is uploaded once; every surface reads the persisted `avatar_url` from the profile record.

## Upload

`POST /api/profile/profile/{user_id}/avatar`

- Uses the same unauthenticated multipart request pattern as post-image submission; no Bearer header is sent.
- Required multipart fields: `userId`, `userName`, and `image`.
- The submitted `userId` must match the path ID and an existing account must be present.
- Accept JPEG, PNG, and WebP images up to 8 MiB.
- Validate image bytes server-side and store through the existing Firebase Storage service.
- Return JSON with `avatar_url` as an absolute HTTPS URL.
- Upsert the user's profile if it does not exist yet; when one exists, update only its avatar field and preserve every other profile field.

**Security note:** matching a client-supplied user ID to the path and checking that the account exists does not prove that the caller owns that account. This endpoint follows the requested post-upload flow and does not provide cryptographic user authentication.

## Read

Both existing profile response shapes (object or one-element array) include optional `avatar_url`. User-list endpoints should also include `avatar_url` when practical; clients can resolve it through the cached profile read when it is omitted. Clients use the same account-level value for votes, pokes, sub-fixtures, possession, feed comments, Feed, Comrades, Messaging, Leaderboards, and Admin Dashboard. If absent, clients use the deterministic default avatar.
