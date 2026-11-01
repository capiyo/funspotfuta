# Video platform implementation status

## Landed on this feature branch

- SRS 6 configuration for RTMP ingest, WebRTC playback and HLS fallback.
- Isolated SRS compose deployment; the SRS HTTP API is exposed only to the Docker network and is not published as a host port.
- C++20 FFmpeg launcher that reads its input URL from a mounted secret file, validates the protocol and fixture stream key, enforces an exact configured source-host allowlist, and invokes FFmpeg directly without shell interpolation. The URL is still visible in FFmpeg's process arguments while running; this is documented as a production blocker.
- Zig 0.13 gateway bootstrap package with strict required-environment validation and fixture-ID / URL validation tests.
- Rust/Axum issues 60-second user/fixture/stream-scoped playback grants and revalidates them against the live, rights-authorized MongoDB stream record on each media-edge authorization request.
- Nginx playback edge proxies only SRS WebRTC play signaling and HLS media. It validates the bearer grant against the Rust API; HLS token and stream parameters are propagated to segment URLs. SRS admin API remains private.
- Web Match Details requests a playback grant, negotiates SRS WebRTC with a browser RTCPeerConnection, and retains the HLS URL as fallback.
- React Native Match Details requests the same grant and plays the HLS endpoint using the existing Expo AV dependency.
- Compose now includes the Nginx edge; CI validates the edge configuration and web/mobile typechecks are triggered for the feature branch.
- Rights and security boundaries documented.
- Isolated synthetic streaming lab: SRS plus a generated 720p30 H.264/AAC RTMP publisher, with a step-by-step protocol and architecture guide in `LEARNING_LAB.md`.

## Not complete / not production enabled

- The Zig program is currently a configuration/bootstrap validator, not yet the long-running HTTP gateway. It must not be exposed as a playback endpoint.
- C++ currently runs one fixed H.264/AAC transcode profile per worker. It enforces exact source-host allowlisting (no wildcard hosts), but does not pin DNS results or protect against a compromised allowlisted provider. Adaptive bitrate ladders, hardware acceleration, worker supervision/restart policy, source allowlisting beyond protocol validation, and metrics are not implemented.
- Backend PR #3 now includes grant issuance and a grant revalidation endpoint. Its current compile/test workflow still needs to be checked on the latest commit. The legacy login-token generator retains an insecure `JWT_SECRET` fallback if the environment variable is absent; video grant issuance itself fails closed when the secret is missing.
- The media edge enforces the signed grant through the Rust authorization endpoint, but the Nginx configuration still needs a live integration test against the deployed Render API and SRS instance. TLS termination, DNS, and WebRTC UDP reachability remain deployment requirements.
- No Camel1 media extraction or relay is implemented. Fixture metadata discovery is separate from authorization to distribute a broadcast.
- Frontend players are wired into Match Details, but have not yet been built or exercised on real browsers/devices.
- The synthetic lab exercises an FFmpeg-generated publisher into SRS; it does not yet run through the C++ worker or Zig gateway. It is an isolated media-server learning/test path, not an end-to-end Funspot player.
- No production SRS host, public candidate, TLS, TURN, DNS, firewall or licensed ingest source has been configured.
- C++ source passed a local `g++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -fsyntax-only` check during self-review.
- The configured FFmpeg H.264/AAC profile passed a one-second synthetic lavfi encode smoke test.
- Both Compose YAML files parsed successfully with PyYAML; this is not a full Docker Compose validation.
- A GitHub Actions workflow now runs Zig 0.13 build/tests, the strict C++ worker build, an FFmpeg encode smoke test, SRS Compose validation, and the worker Docker image build. These checks are not claimed as passed until the workflow has actually run.
- Docker image build, SRS connectivity, device playback, load, failover, and security tests have not been run.

## Self-review findings

- The deployment guide and CI use the committed `.env.example` and `worker.env.example` templates.
- Removed an SRS healthcheck that assumed `wget` existed in the upstream image without verifying that assumption.
- The C++ worker still passes the source URL to FFmpeg as a CLI argument. Mounted secret-file storage avoids putting it in the worker's own startup arguments, but does not hide it from privileged process inspection once FFmpeg starts. Replace this with an in-process libavformat worker before accepting reusable provider credentials.
- The RTMP and HTTP host bindings remain loopback-only by default. Do not expose RTMP publishing or HLS playback publicly until SRS publish authorization and a grant-enforcing playback edge are implemented.

## Next engineering gates

1. Define a fail-closed playback grant contract in Axum after reviewing the deployed JWT/session configuration and channel/fixture membership model.
2. Implement Zig as a persistent authenticated control-plane service; keep SRS admin API private.
3. Run an end-to-end test of the Nginx edge against Rust grant validation, SRS WebRTC signaling, HLS manifest/segment authorization, and grant expiry.
4. Add a MongoDB video-stream registry keyed by canonical fixture ID and enforce rights/status/region fields.
5. Add a source adapter for permitted fixture metadata only; do not infer media rights from a provider watch link.
6. Build and exercise the integrated React and React Native Match Details player with WebRTC-first and HLS fallback behavior.
7. Add end-to-end tests with a Funspot-owned or licensed test feed before any production rollout.