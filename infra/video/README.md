# Funspot video delivery

This directory contains the independently deployable video plane for Funspot. It is separate from the existing Axum/Rust application API and from the 365Scores fixture polling pipeline.

## Architecture

- **SRS 6** is the media server. It remains the upstream SRS implementation; we configure and operate it rather than reimplementing it.
- **C++** owns native media-worker responsibilities. The first worker reads an authorized ingest URL from a mounted secret file and launches FFmpeg directly (without a shell), normalizing to H.264/AAC for browser delivery. It is not in the per-packet browser request path.
- **Zig** is the intended lightweight video control/gateway runtime for stream lifecycle, fixture-to-stream association, authorization delegation and SRS control-plane calls. Current code only validates startup configuration and identifiers; the persistent HTTP service, lifecycle manager, health and metrics are not implemented yet.
- **Existing Rust/Axum API** remains authoritative for users, sessions, fixture identity, membership and playback authorization. Do not migrate or duplicate that domain into Zig.
- **React / React Native** now render a fixture-scoped Video tab in Match Details. Web negotiates SRS WebRTC first and retains HLS as fallback; Expo AV plays the HLS endpoint on mobile. A selected fixture change tears down the previous browser peer connection and requests a fresh grant.

## Delivery protocol

1. WebRTC is the preferred low-latency browser playback path.
2. HLS is the compatibility/fallback path for clients that cannot use WebRTC.
3. RTMP or SRT are ingest/encoder contribution protocols, not browser playback protocols.
4. Never expose the SRS HTTP API or ingest credentials to clients.

## Fixture model and control flow

Every stream record must be bound to the canonical Funspot fixture ID (not just a team-name pair). Store provider/source identity, provider fixture ID, ingest mode, playback mode, lifecycle state, start/end bounds, region/rights restrictions, and the authorized playback origin. Resolve provider fixtures to canonical Funspot fixtures before publishing a stream.

Playback flow:

1. The authenticated client requests playback for a canonical fixture from the Rust API.
2. Rust checks the user's access and fixture state, then issues a short-lived signed playback grant (or a one-time authorization result).
3. The Nginx media edge validates the signed grant against the Rust `/api/video/authorize` endpoint for WebRTC signaling and each HLS request. SRS itself remains private; Zig's lifecycle/control plane is not yet implemented.
4. The client receives short-lived WebRTC/HLS endpoints; Nginx proxies only `/rtc/v1/play/` and `/live/`, never the SRS admin API. Ingest keys remain server-side.
5. Fixture changes, grant expiry, stream end, and disconnects close or renew the session safely.

The Rust grant contract is `GET /api/video/fixtures/:fixture_id/grant`; the media edge validates it through `GET /api/video/authorize`. Grants are user- and fixture-scoped, expire after 60 seconds, and are rechecked against the live authorized stream registry.

## Deployment

The deployment pins SRS to the stable v6.0-r3 release. SRS supports RTMP/SRT ingest and WebRTC/HLS delivery; the official release notes publish Docker tags for v6.0-r3. See the [SRS release record](https://github.com/ossrs/srs/releases/tag/v6.0-r3).

From this directory, copy `.env.example` to `.env`, set `SRS_PUBLIC_CANDIDATE` to the externally reachable media IP, and set `VIDEO_EDGE_BIND` to the private host interface used by your TLS load balancer. Set backend `VIDEO_PLAYBACK_PUBLIC_ORIGIN` to the public HTTPS origin (for example `https://video.funspot.co.ke`). Run `docker compose -f docker-compose.video.yml up -d srs video-edge`. The edge listens on host port `8088`; terminate TLS at the load balancer/CDN and forward to this port. The default RTMP and SRS HTTP bindings are loopback-only. The WebRTC UDP port 8000 must be reachable by clients. The SRS HTTP API is never published; Nginx exposes only its WebRTC play endpoint internally and the HLS media path.

Put TLS, TURN where required, rate limiting, and origin restrictions at the deployment edge. The wildcard candidate is a development fallback only. The HLS fragment value is a target/minimum slice setting, not a promise of exact end-to-end latency: actual TS duration also depends on the encoder GOP/keyframe interval. Required SRS environment values are documented in `.env.example`. Do not commit production credentials.


### Running one authorized fixture ingest

Start SRS first. Then prepare the source URL as a protected host file outside Git, readable by the worker's unprivileged UID 65532. Copy `worker.env.example` to `worker.env` and set `VIDEO_INGEST_SOURCE_FILE`, `VIDEO_STREAM_KEY`, and the exact comma-separated `VIDEO_ALLOWED_SOURCE_HOSTS` list. The worker rejects source URLs whose hostname is not an exact allowlist entry; wildcard entries are rejected. Run one worker container per authorized fixture:

```sh
docker compose -f docker-compose.video.yml up -d srs
docker compose --env-file worker.env -f docker-compose.worker.yml up -d --build
```

The worker normalizes the incoming feed to H.264/AAC and pushes it to the private SRS RTMP endpoint. Stop/remove the worker when the fixture ends. This is currently a manually managed one-worker-per-stream path; the Zig lifecycle manager is not yet wired to create or retire workers automatically.

**Credential exposure limitation:** the C++ launcher reads the source URL from a mounted secret file, but FFmpeg receives the URL as its `-i` argument. A privileged process inspector on the worker host/container may therefore see it while FFmpeg is running. Do not use long-lived reusable credentials in this prototype. Before production, move ingest into an in-process libavformat integration or an equivalent credential-isolating design.

## Rights and source policy

Only ingest streams that Funspot owns or is licensed/authorized to distribute. A fixture listing or a "watch live" link on a third-party site does not establish embedding, rebroadcasting, scraping, or redistribution rights. The Camel1 adapter may discover fixture metadata and permitted provider embed references; it must not extract protected media URLs, defeat DRM/login/paywalls, or relay a provider's stream without written rights.

## Operational requirements before production

- SRS API/admin endpoints private; no public admin port.
- TLS for all browser-facing playback and control endpoints.
- Short-lived, fixture-scoped, user-scoped playback grants; replay protection and expiry.
- CORS/origin allowlist; rate limits; abuse controls.
- WebRTC UDP port and candidate address verified from outside the deployment network.
- TURN configured for restrictive NAT/mobile networks where necessary.
- HLS fallback tested on supported browsers/devices.
- Stream health, ingest disconnects, viewer counts, startup latency, rebuffering, and worker failures exported to monitoring.
- Explicit retention and bandwidth limits; no unbounded recording by default.
- Load tests and end-to-end tests against a licensed test feed before enabling live fixtures.

## Status

This is the infrastructure foundation and deployment contract, not a claim that live streaming is already connected to production fixtures. The Rust grant/validation endpoints, Nginx authorization-aware media edge, and web/mobile Match Details players are now implemented on the feature branches. The Zig lifecycle manager, in-process libavformat C++ worker, automated fixture registry provisioning, licensed source configuration, and end-to-end deployment verification remain outstanding.

## Learn and run the local pipeline

Start with [LEARNING_LAB.md](./LEARNING_LAB.md) for the end-to-end protocol walkthrough and local synthetic source. The lab uses an FFmpeg-generated 720p test pattern and audio tone; it does not access third-party broadcasts.

Run it with:

```sh
docker compose -f docker-compose.video.yml up -d srs
docker compose -f docker-compose.video.yml -f docker-compose.demo.yml --profile demo up -d test-publisher
```

This proves local publisher-to-SRS ingest and HLS packaging. For an authenticated browser/mobile playback test, the Rust API must have a live `video_streams` registry record with `rights_status: authorized`, the playback edge must be deployed behind HTTPS, and `VIDEO_PLAYBACK_PUBLIC_ORIGIN` must point to it.
