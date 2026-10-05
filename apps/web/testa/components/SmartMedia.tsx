'use client';

// Web port of _SmartPostImage / _VideoPostWidget from posts_page.dart.
//
// NOTE: this intentionally diverges from the Dart original in one way.
// The Dart version fills the capped box with BoxFit.cover, i.e. it still
// center-crops any media whose natural height/width ratio exceeds the
// cap — that's the literal behavior of `if (height > maxHeight) height
// = maxHeight;` + `fit: BoxFit.cover`. That's the source of the visible
// cropping (see screenshot from Sep 16): the cap gets hit often enough
// on a narrow web column that "occasionally crops a very tall image"
// turns into "crops constantly."
//
// Here we always use object-contain instead, so NOTHING is ever cropped:
//   - height = width / naturalAspectRatio, capped at a max-height
//   - under the cap: container matches the media's real proportions
//     exactly, so contain and cover look identical (no bars)
//   - over the cap: the full image/video is still shown in full,
//     letterboxed (bg-fill bars above/below) instead of sliced
//   - video gets a real <video> element (poster = thumbnail, autoplay
//     muted for browser autoplay policy, tap to pause/resume, "Paused"
//     label when stopped — matching the Dart GestureDetector behavior)

import { useEffect, useRef, useState } from 'react';

const MAX_HEIGHT_VH = 70; // mirrors MediaQuery.height * 0.75 in the Dart version
const PLACEHOLDER_HEIGHT_VH = 42; // ~0.6 of the cap, same ratio as the Dart loading box

export function SmartMedia({
    imageUrl,
    videoUrl,
    videoThumbnailUrl,
}: {
    imageUrl?: string | null;
    videoUrl?: string | null;
    videoThumbnailUrl?: string | null;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [ratio, setRatio] = useState<number | null>(null);
    const [height, setHeight] = useState<number | null>(null);
    const [playing, setPlaying] = useState(true);
    const [errored, setErrored] = useState(false);

    function recomputeHeight(r: number) {
        if (!containerRef.current) return;
        const width = containerRef.current.offsetWidth;
        const maxH = (window.innerHeight * MAX_HEIGHT_VH) / 100;
        setHeight(Math.min(width / r, maxH));
    }

    function handleRatioResolved(naturalW: number, naturalH: number) {
        if (!naturalH) return;
        const r = naturalW / naturalH;
        setRatio(r);
        recomputeHeight(r);
    }

    useEffect(() => {
        function onResize() {
            if (ratio != null) recomputeHeight(ratio);
        }
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ratio]);

    if (!videoUrl && !imageUrl) return null;

    const resolved = height != null;
    // Always contain: never crop. When height isn't capped this is
    // visually identical to cover (container already matches the
    // media's real ratio); when it is capped, this letterboxes instead
    // of slicing off the top/bottom.
    const fitClass = 'object-contain';

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-fan-lg bg-fan-surfaceSunken"
            style={{ height: resolved ? `${height}px` : `${PLACEHOLDER_HEIGHT_VH}vh` }}
        >
            {!resolved && !errored && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
                </div>
            )}

            {videoUrl ? (
                <video
                    ref={videoRef}
                    src={videoUrl}
                    poster={videoThumbnailUrl ?? undefined}
                    autoPlay
                    muted
                    playsInline
                    onLoadedMetadata={(e) => handleRatioResolved(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
                    onError={() => setErrored(true)}
                    onClick={() => {
                        const v = videoRef.current;
                        if (!v) return;
                        if (v.paused) {
                            v.play();
                            setPlaying(true);
                        } else {
                            v.pause();
                            setPlaying(false);
                        }
                    }}
                    className={`h-full w-full cursor-pointer bg-black ${fitClass}`}
                />
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imageUrl!}
                    alt=""
                    onLoad={(e) => handleRatioResolved(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                    onError={() => setErrored(true)}
                    className={`h-full w-full ${fitClass}`}
                />
            )}

            {errored && (
                <div className="absolute inset-0 flex items-center justify-center text-fan-textTertiary">
                    <span className="text-fan-caption">⚠ media failed to load</span>
                </div>
            )}

            {videoUrl && resolved && !playing && (
                <span className="absolute bottom-fan-sm right-fan-sm rounded-fan-md bg-black/50 px-fan-sm py-[2px] text-fan-tag text-white">
                    Paused
                </span>
            )}
        </div>
    );
}