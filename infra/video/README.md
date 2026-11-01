# Funspot video delivery

This directory contains the independently deployable video plane for Funspot. It is separate from the existing Axum/Rust application API and from the 365Scores fixture polling pipeline.

## Architecture

- **SRS 6** is the media server. It remains the upstream SRS implementation; we configure and operate it rather than reimplementing it.
- **C++** owns native media-worker responsibilities. The first worker reads an authorized ingest URL from a mounted secret file and launches FFmpeg directly (without a shell), normalizing to H.264/AAC for browser delivery. It is not in the per-packet browser request path.
- **Zig** owns the lightweight video control/gateway service: stream lifecycle, fixture-to-stream association, authorization delegation, SRS control-plane calls, health and metrics.
- **Existing Rust/Axum API** remains authoritative for users, sessions, fixture identity, membership and playback authorization. Do not migrate or duplicate that domain into Zig.
- **React / React Native** render a fixture-scoped player in Match Details. Selecting a different fixture must switch the playback session without navigating away.

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
3. Zig validates/delegates that grant and creates or resolves the fixture's SRS stream mapping.
4. The client receives only the authorized WebRTC/HLS playback details; ingest keys and SRS admin credentials remain server-side.
5. Fixture changes, grant expiry, stream end, and disconnects close or renew the session safely.

The exact Rust route and token claims must be agreed with the current backend source before implementing a production authorization adapter. Do not invent or bypass the existing auth/session contract.

## Deployment

The deployment pins SRS to the stable v6.0-r3 release. SRS supports RTMP/SRT ingest and WebRTC/HLS delivery; the official release notes publish Docker tags for v6.0-r3. See the [SRS release record](https://github.com/ossrs/srs/releases/tag/v6.0-r3).

From this directory, copy `.env.example` to `.env`, set `SRS_PUBLIC_CANDIDATE` to the externally reachable media IP, and run `docker compose -f docker-compose.video.yml up -d srs`. The default RTMP and HTTP bindings are loopback-only; change the bind addresses only when the edge/firewall is configured for the intended ingress. The WebRTC UDP port must be reachable by clients. The SRS HTTP API is exposed only to the Docker network and is not published on the host.

Put TLS, TURN where required, rate limiting, and origin restrictions at the deployment edge. The wildcard candidate is a development fallback only. The HLS fragment value is a target/minimum slice setting, not a promise of exact end-to-end latency: actual TS duration also depends on the encoder GOP/keyframe interval. Required SRS environment values are documented in `.env.example`. Do not commit production credentials.


### Running one authorized fixture ingest

Start SRS first. Then prepare the source URL as a protected host file outside Git, readable by the worker's unprivileged UID 65532. Copy `worker.env.example` to `worker.env` and set `VIDEO_INGEST_SOURCE_FILE` and `VIDEO_STREAM_KEY`. Run one worker container per authorized fixture:

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

This is the infrastructure foundation and deployment contract, not a claim that live streaming is already connected to production fixtures. The Rust authorization adapter, Zig gateway runtime, C++ media worker, scraper metadata adapter, frontend player, licensed source configuration, and end-to-end verification are separate implementation milestones.