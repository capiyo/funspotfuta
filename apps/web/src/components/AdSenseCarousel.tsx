import { useEffect, useMemo, useRef, useState } from 'react';
import { AdSenseAd } from '@/components/AdSenseAd';
import { useFanColors } from '@/theme/use-fan-colors';

type AdSenseCarouselProps = {
  placement: 'chats' | 'leaderboard';
  slots: readonly string[];
  enabled?: boolean;
  label?: string;
};

type Slide = { type: 'ad'; key: string; slot: string };

const AD_INTERVAL_MS = 6000;

/** One automatic, swipeable flow that alternates fixtures and sponsored slides. */
export default function AdSenseCarousel({
  placement,
  slots,
  enabled = true,
  label = 'Sponsored carousel',
}: AdSenseCarouselProps) {
  const colors = useFanColors();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const adsAllowed =
    enabled &&
    import.meta.env.PROD &&
    import.meta.env.VITE_ADSENSE_ENABLED !== 'false' &&
    ['funspot.co.ke', 'www.funspot.co.ke'].includes(window.location.hostname);

  const slides = useMemo<Slide[]>(() =>
    (adsAllowed ? slots : []).map((slot) => ({ type: 'ad', key: `ad-${slot}`, slot })),
    [adsAllowed, slots],
  );

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % slides.length;
        viewportRef.current?.children.item(next)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start',
        });
        return next;
      });
    }, AD_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    setActiveIndex(0);
    viewportRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section className="w-full min-w-0" aria-label={label} style={{ background: colors.surface, borderRadius: 8, padding: 3, marginBottom: 3, overflow: 'hidden' }}>
      <div
        ref={viewportRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-1"
        onScroll={(event) => {
          const node = event.currentTarget;
          const first = node.firstElementChild;
          if (!first) return;
          const slideWidth = first.getBoundingClientRect().width + 8;
          if (slideWidth > 0) {
            setActiveIndex(Math.min(slides.length - 1, Math.max(0, Math.round(node.scrollLeft / slideWidth))));
          }
        }}
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.key}
            className="w-full min-w-0 shrink-0 snap-start"
            aria-label={`Advertisement slide ${index + 1}`}
          >
            <AdSenseAd slotId={slide.slot} placement={placement} />
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-2 pt-0.5" aria-label="Carousel pages">
          {slides.map((slide, index) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                viewportRef.current?.children.item(index)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                  inline: 'start',
                });
              }}
              aria-label={`Show carousel slide ${index + 1}`}
              aria-current={activeIndex === index ? 'true' : undefined}
              className="rounded-full"
              style={{
                width: activeIndex === index ? 16 : 5,
                height: 5,
                padding: 0,
                border: 0,
                background: activeIndex === index ? colors.primary : colors.textTertiary,
                opacity: activeIndex === index ? 1 : 0.45,
                transition: 'width 160ms ease',
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
