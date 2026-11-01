# Video platform implementation status

## Landed on this feature branch

- SRS 6 configuration for RTMP ingest, WebRTC playback and HLS fallback.
- Isolated SRS compose deployment; the SRS HTTP API is exposed only to the Docker network and is not published as a host port.
- C++20 FFmpeg launcher that reads its input URL from a mounted secret file, validates the protocol and fixture stream key, and invokes FFmpeg directly without shell interpolation. The URL is still visible in FFmpeg's process arguments while running; this is documented as a production blocker.
- Zig 0.13 gateway bootstrap package with strict required-environment validation and fixture-ID / URL validation tests.
- Rights and security boundaries documented.

## Not complete / not production enabled

- The Zig program is currently a configuration/bootstrap validator, not yet the long-running HTTP gateway. It must not be exposed as a playback endpoint.
- C++ currently runs one fixed H.264/AAC transcode profile per worker. Adaptive bitrate ladders, hardware acceleration, worker supervision/restart policy, source allowlisting beyond protocol validation, and metrics are not implemented.
- No playback authorization route has been added to Axum. The current backend auth implementation has legacy insecure fallback behavior when JWT_SECRET is absent; the video plane must fail closed and must not reuse that fallback.
- No signed-grant enforcement exists at the media edge yet. Returning an unsigned SRS URL to clients is not acceptable.
- No Camel1 media extraction or relay is implemented. Fixture metadata discovery is separate from authorization to distribute a broadcast.
- No frontend player is wired into Match Details.
- No production SRS host, public candidate, TLS, TURN, DNS, firewall or licensed ingest source has been configured.
- C++ source passed a local `g++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -fsyntax-only` check during self-review.
- Zig build/tests could not be executed because Zig is not installed in the available environment.
- Docker Compose parsing, SRS connectivity, device playback, load, failover, and security tests have not been run.

## Self-review findings

- The deployment guide referenced a missing `.env.example`; it has been corrected to use the committed `srs.env.example` and `worker.env.example` templates.
- Removed an SRS healthcheck that assumed `wget` existed in the upstream image without verifying that assumption.
- The C++ worker still passes the source URL to FFmpeg as a CLI argument. Mounted secret-file storage avoids putting it in the worker's own startup arguments, but does not hide it from privileged process inspection once FFmpeg starts. Replace this with an in-process libavformat worker before accepting reusable provider credentials.
- The RTMP and HTTP host bindings remain loopback-only by default. Do not expose RTMP publishing or HLS playback publicly until SRS publish authorization and a grant-enforcing playback edge are implemented.

## Next engineering gates

1. Define a fail-closed playback grant contract in Axum after reviewing the deployed JWT/session configuration and channel/fixture membership model.
2. Implement Zig as a persistent authenticated control-plane service; keep SRS admin API private.
3. Implement an authenticated edge path for WebRTC signaling and HLS segment access. SRS itself must not be assumed to validate Funspot user grants.
4. Add a MongoDB video-stream registry keyed by canonical fixture ID and enforce rights/status/region fields.
5. Add a source adapter for permitted fixture metadata only; do not infer media rights from a provider watch link.
6. Add the React and React Native Match Details player with WebRTC-first and HLS fallback behavior.
7. Add end-to-end tests with a Funspot-owned or licensed test feed before any production rollout.