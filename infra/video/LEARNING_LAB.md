# Funspot video lab: understand the full media path

This lab uses a generated test pattern and tone. It contains no third-party broadcast and is safe to use while learning the media pipeline. It is deliberately separate from production ingestion and does not make the SRS origin public.

## 1. Start a local SRS origin and synthetic publisher

From `infra/video`:

```sh
docker compose -f docker-compose.video.yml up -d srs
docker compose -f docker-compose.video.yml -f docker-compose.demo.yml --profile demo up -d test-publisher
docker compose -f docker-compose.video.yml -f docker-compose.demo.yml logs -f test-publisher
```

The publisher creates a 720p30 moving test pattern and a 1 kHz audio tone, encodes H.264/AAC, and sends FLV over RTMP to SRS. The input is generated locally by FFmpeg's `lavfi`; no source URL or credentials are involved.

The SRS HTTP server is loopback-bound by default. On the same machine, try:

- HLS manifest: `http://127.0.0.1:8080/live/funspot-demo.m3u8`
- HLS segment directory: `http://127.0.0.1:8080/live/`

A browser's native HLS support varies. Safari supports HLS natively; Chromium-based browsers generally need an HLS JavaScript player (such as hls.js) in the application. This local HLS URL is a lab endpoint only, not an authenticated production playback URL.

Stop the publisher and origin:

```sh
docker compose -f docker-compose.video.yml -f docker-compose.demo.yml --profile demo down
docker compose -f docker-compose.video.yml down
```

## 2. What each protocol does

- **RTMP ingest**: encoder/publisher to SRS. It is not the browser playback protocol.
- **WebRTC playback**: low-latency interactive delivery. SRS negotiates it through its RTC HTTP API and UDP media port; production needs a reachable candidate address and often TURN for restrictive networks.
- **HLS playback**: segmented HTTP delivery. It is more compatible with CDNs and mobile networks but normally adds more latency than WebRTC.
- **H.264/AAC**: broadly compatible browser/mobile codecs. GOP/keyframe cadence affects startup and segment boundaries; it must be coordinated with the HLS fragment target.

## 3. Where C++ belongs

The C++ worker is a contribution/ingest process, not a per-viewer server. It validates the configured source host and stream key, then launches the encoder pipeline. In a production-grade version, use FFmpeg libraries directly:

1. `avformat_open_input` demuxes the authorized source.
2. `avcodec_send_packet` / `avcodec_receive_frame` decode packets when transcoding is required.
3. `sws_scale` and `swr_convert` normalize video/audio.
4. Encoder contexts produce H.264/AAC with a controlled GOP and low-latency settings.
5. `av_interleaved_write_frame` muxes FLV and `avio_open2` writes to the private SRS ingest endpoint.
6. Interrupt callbacks, bounded queues, timestamps, signal handling and explicit reconnect/backoff are needed for a long-running worker.

The current worker is still a process launcher around FFmpeg. It is not yet the in-process libavformat design above. Do not put reusable provider credentials in a source URL passed as a process argument.

## 4. Where Zig belongs

Zig should be the small control plane, not the media codec implementation:

- expose health/readiness and fixture stream lifecycle APIs;
- validate canonical fixture IDs and request sizes;
- call the Rust API for user/fixture authorization (Rust remains the source of truth);
- maintain a bounded fixture-to-SRS-stream registry;
- call SRS's private control API for stream lifecycle/health;
- start/stop isolated C++ workers with explicit resource limits;
- enforce timeouts, cancellation, restart budgets and structured logs.

The current Zig executable only validates startup configuration and fixture identifier rules. It is not yet an HTTP gateway, worker supervisor or grant verifier. The control plane must not invent a second user-authentication system or trust a fixture ID supplied by an unauthenticated client.

## 5. Production playback flow

1. The client selects a canonical Funspot fixture.
2. Rust authenticates the user and checks the fixture's authorized stream registry.
3. Rust issues a short-lived, fixture-scoped playback grant.
4. The edge/gateway validates the grant and creates a viewer session.
5. The gateway returns a short-lived WebRTC/HLS playback location; the SRS admin API and ingest credentials remain private.
6. Stream end, fixture switch, grant expiry and revocation terminate access.
7. Web and React Native clients play the authorized session and report startup/rebuffer/error telemetry.

The Rust grant route PR is a draft and has not yet passed a verified compile in this environment. SRS callbacks, grant validation at the edge, Zig HTTP runtime, C++ in-process media worker and the actual web/mobile players remain to be completed. Do not expose the lab's unauthenticated HLS endpoint as a production service.

## 6. Verification checklist

- [ ] SRS container starts and remains healthy.
- [ ] Synthetic publisher connects and SRS creates the live stream.
- [ ] HLS manifest and segments are served locally.
- [ ] WebRTC offer/play exchange works from a remote test client.
- [ ] C++ worker handles source timeout, disconnect, SIGTERM and reconnect without leaking secrets.
- [ ] Zig rejects malformed fixture IDs, unauthorized grants, expired grants and unknown streams.
- [ ] Fixture switch tears down the previous viewer session.
- [ ] Web and React Native playback are verified on real devices over TLS, including TURN fallback.
- [ ] Only streams with documented distribution rights can be registered.
