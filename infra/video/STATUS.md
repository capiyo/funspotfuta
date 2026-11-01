# Video platform implementation status

## Landed on this feature branch

- SRS 6 configuration for RTMP ingest, WebRTC playback and HLS fallback.
- Isolated SRS compose deployment; the SRS HTTP API is exposed only to the Docker network and is not published as a host port.
- C++20 FFmpeg launcher that passes arguments directly to exec (no shell), validates the ingest protocol and fixture stream key, and does not log source URLs.
- Zig 0.13 gateway bootstrap package with strict required-environment validation and fixture-ID / URL validation tests.
- Rights and security boundaries documented.

## Not complete / not production enabled

- The Zig program is currently a configuration/bootstrap validator, not yet the long-running HTTP gateway. It must not be exposed as a playback endpoint.
- C++ currently launches FFmpeg in stream-copy/remux mode. Adaptive transcoding ladders, codec compatibility policy, hardware acceleration, worker supervision, and metrics are not implemented.
- No playback authorization route has been added to Axum. The current backend auth implementation has legacy insecure fallback behavior when JWT_SECRET is absent; the video plane must fail closed and must not reuse that fallback.
- No signed-grant enforcement exists at the media edge yet. Returning an unsigned SRS URL to clients is not acceptable.
- No Camel1 media extraction or relay is implemented. Fixture metadata discovery is separate from authorization to distribute a broadcast.
- No frontend player is wired into Match Details.
- No production SRS host, public candidate, TLS, TURN, DNS, firewall or licensed ingest source has been configured.
- No SRS connectivity, device playback, load, failover, or security tests have been run.

## Next engineering gates

1. Define a fail-closed playback grant contract in Axum after reviewing the deployed JWT/session configuration and channel/fixture membership model.
2. Implement Zig as a persistent authenticated control-plane service; keep SRS admin API private.
3. Implement an authenticated edge path for WebRTC signaling and HLS segment access. SRS itself must not be assumed to validate Funspot user grants.
4. Add a MongoDB video-stream registry keyed by canonical fixture ID and enforce rights/status/region fields.
5. Add a source adapter for permitted fixture metadata only; do not infer media rights from a provider watch link.
6. Add the React and React Native Match Details player with WebRTC-first and HLS fallback behavior.
7. Add end-to-end tests with a Funspot-owned or licensed test feed before any production rollout.