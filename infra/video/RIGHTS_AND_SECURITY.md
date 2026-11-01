# Video rights and security boundary

- Accept ingest only from explicitly configured, owned or licensed sources.
- A third-party fixture page or outbound "watch" link is not evidence of rights to embed, capture, proxy, record, or redistribute the stream.
- The Camel1 fixture adapter is metadata-only unless a provider contract explicitly authorizes a playback integration.
- Never extract protected stream URLs, bypass authentication, defeat DRM, or circumvent a paywall.
- Do not expose RTMP/SRT ingest credentials, SRS API credentials, Rust internal tokens, or signing keys in browser/mobile bundles or logs.
- Playback grants must be short-lived, fixture-scoped, user-scoped, audience-restricted, and validated server-side.
- Restrict allowed origins and public playback paths; apply request and viewer rate limits.
- SRS admin/API stays on a private network. Do not publish port 1985.
- Disable recording by default. If licensed recording is enabled, define retention, access, deletion, and regional storage rules.
- Log authorization decisions and operational events without logging bearer tokens or raw secrets.