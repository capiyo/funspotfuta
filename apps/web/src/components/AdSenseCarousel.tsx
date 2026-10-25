import { useEffect, useMemo, useRef, useState } from 'react';
import { AdSenseAd } from '@/components/AdSenseAd';
import { useFanColors } from '@/theme/use-fan-colors';
import { getAllFixtures, type Fixture } from '@funspot/core';

type AdSenseCarouselProps = {
  placement: 'chats' | 'leaderboard';
  slots: readonly string[];
  enabled?: boolean;
  label?: string;
  showDots?: boolean;
};

type Slide =
  | { type: 'ad'; key: string; slot: string }
  | { type: 'fixture'; key: string; fixture: Fixture };

const AD_INTERVAL_MS = 6000;

/** One automatic, swipeable flow that alternates fixtures and sponsored slides. */
export default function AdSenseCarousel({
  placement,
  slots,
  enabled = true,
  label = 'Sponsored carousel',
  showDots = true,
}: AdSenseCarouselProps) {
  const colors = useFanColors();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  useEffect(() => {
    if (placement !== 'chats') return;
    let alive = true;
    getAllFixtures()
      .then((items) => { if (alive) setFixtures(items.slice(0, slots.length)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [placement, slots.length]);

  const adsAllowed =
    enabled &&
    import.meta.env.PROD &&
    import.meta.env.VITE_ADSENSE_ENABLED !== 'false' &&
    ['funspot.co.ke', 'www.funspot.co.ke'].includes(window.location.hostname);

  const slides = useMemo<Slide[]>(() => {
    const adSlides: Slide[] = (placement === 'chats' && adsAllowed ? slots : adsAllowed ? slots : [])
      .map((slot) => ({ type: 'ad', key: `ad-${slot}`, slot }));
    if (placement !== 'chats') return adSlides;
    const fixtureSlides: Slide[] = fixtures.map((fixture) => ({
      type: 'fixture',
      key: `fixture-${fixture.matchId ?? fixture.id}`,
      fixture,
    }));
    const mixed: Slide[] = [];
    const count = Math.max(adSlides.length, fixtureSlides.length);
    for (let index = 0; index < count; index += 1) {
      if (adSlides[index]) mixed.push(adSlides[index]);
      if (fixtureSlides[index]) mixed.push(fixtureSlides[index]);
    }
    return mixed;
  }, [adsAllowed, fixtures, placement, slots]);

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
            aria-label={slide.type === 'ad' ? `Advertisement slide ${index + 1}` : `${slide.fixture.homeTeam} versus ${slide.fixture.awayTeam}`}
          >
            {slide.type === 'ad' ? (
              <AdSenseAd slotId={slide.slot} placement={placement} />
            ) : (
              <div
                className="flex min-h-[68px] w-full items-center justify-center gap-3 px-3 py-2"
                style={{ background: colors.surface, color: colors.textPrimary }}
              >
                <span className="min-w-0 flex-1 truncate text-right text-xs font-semibold">{slide.fixture.homeTeam}</span>
                <span className="shrink-0 text-[10px] font-semibold" style={{ color: colors.textTertiary }}>VS</span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{slide.fixture.awayTeam}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {showDots && slides.length > 1 && (
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
