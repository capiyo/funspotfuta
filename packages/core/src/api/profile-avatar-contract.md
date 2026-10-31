# Profile avatar API contract

The web and React Native clients share one account-level profile image. The selected image is uploaded once; every surface reads the persisted `avatar_url` from the profile record.

## Upload

`POST /api/profile/profile/{user_id}/avatar`

- Authenticated with the existing bearer token.
- Multipart form field: `image`.
- Accept JPEG, PNG, and WebP images up to 8 MiB.
- Validate image bytes and ownership server-side; normalize to a square thumbnail and store it in durable object storage/CDN.
- Return JSON with `avatar_url` as an absolute HTTPS URL. Example: `{"avatar_url":"https://cdn.example.com/profile/{user_id}.webp"}`.
- Persist `avatar_url` on the canonical profile and return it from both profile GET routes used by the app.
- Upsert the authenticated user's profile if it does not exist yet; when one exists, update only its avatar field and preserve every other profile field.
- Replacing an image should clean up the previous owned object when safe.

## Read

Both existing profile response shapes (object or one-element array) include optional `avatar_url`. User-list endpoints should also include `avatar_url` when practical; clients can resolve it through the cached profile read when it is omitted. Clients use the same account-level value for votes, pokes, sub-fixtures, possession, feed comments, Feed, Comrades, Messaging, Leaderboards, and Admin Dashboard. If absent, clients use the deterministic default avatar.

The upload endpoint must enforce authenticated ownership and file-content validation; do not trust a client-supplied URL or filename.
