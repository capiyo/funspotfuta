FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates xz-utils wget && rm -rf /var/lib/apt/lists/*
ARG ZIG_VERSION=0.13.0
RUN wget -q https://ziglang.org/download/${ZIG_VERSION}/zig-linux-x86_64-${ZIG_VERSION}.tar.xz -O /tmp/zig.tar.xz \
    && mkdir -p /opt/zig \
    && tar -xf /tmp/zig.tar.xz -C /opt/zig --strip-components=1 \
    && rm /tmp/zig.tar.xz
ENV PATH="/opt/zig:${PATH}"
WORKDIR /src
COPY build.zig build.zig.zon ./
COPY src ./src
RUN zig build -Doptimize=ReleaseFast

FROM debian:bookworm-slim
COPY --from=build /src/zig-out/bin/funspot-video-gateway /usr/local/bin/funspot-video-gateway
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/funspot-video-gateway"]