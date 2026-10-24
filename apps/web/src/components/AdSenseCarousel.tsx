import { useEffect, useRef, useState } from 'react';
import { AdSenseAd } from '@/components/AdSenseAd';

type AdSenseCarouselProps = {
  placement: 'chats' | 'leaderboard';
  slots: readonly string[];
  enabled?: boolean;
  label?: string;
};

/** Responsive, touch-swipeable sponsored carousel shared by messaging and Comrades. */
export default function AdSenseCarousel({
  placement,
  slots,
  enabled = true,
  label = 'Sponsored carousel',
}: AdSenseCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!enabled || slots.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % slots.length;
        viewportRef.current?.children.item(next)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start',
        });
        return next;
      });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [enabled, slots.length]);

  if (
    !enabled
    || !import.meta.env.PROD
    || import.meta.env.VITE_ADSENSE_ENABLED === 'false'
    || !['funspot.co.ke', 'www.funspot.co.ke'].includes(window.location.hostname)
    || slots.length === 0
  ) return null;

  return (
    <section className="w-full min-w-0 py-1" aria-label={label}>
      <div
        ref={viewportRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-2"
        onScroll={(event) => {
          const node = event.currentTarget;
          const slide = node.firstElementChild;
          if (!slide) return;
          const slideWidth = slide.getBoundingClientRect().width + 12;
          if (slideWidth > 0) setActiveIndex(Math.min(slots.length - 1, Math.max(0, Math.round(node.scrollLeft / slideWidth))));
        }}
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {slots.map((slot, index) => (
          <div key={slot} className="w-full min-w-0 shrink-0 snap-start" aria-label={`Advertisement ${index + 1} of ${slots.length}`}>
            <AdSenseAd slotId={slot} placement={placement} />
          </div>
        ))}
      </div>
      {slots.length > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1" aria-label="Carousel pages">
          {slots.map((slot, index) => (
            <button
              key={slot}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                viewportRef.current?.children.item(index)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                  inline: 'start',
                });
              }}
              aria-label={`Show advertisement ${index + 1}`}
              aria-current={activeIndex === index ? 'true' : undefined}
              className="rounded-full"
              style={{
                width: activeIndex === index ? 16 : 5,
                height: 5,
                padding: 0,
                border: 0,
                background: activeIndex === index ? 'var(--home-primary, #16a34a)' : 'var(--home-text-tertiary, #737373)',
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
