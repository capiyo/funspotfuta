FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends cmake g++ make && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY CMakeLists.txt .
COPY src ./src
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --parallel

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/build/funspot-video-worker /usr/local/bin/funspot-video-worker
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/funspot-video-worker"]