import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllFixtures, type Fixture } from '@funspot/core';
import { AdSenseAd } from '@/components/AdSenseAd';

type AdSenseCarouselProps = {
  placement: 'chats' | 'leaderboard';
  slots: readonly string[];
  enabled?: boolean;
  label?: string;
};

type Slide =
  | { type: 'fixture'; key: string; fixture: Fixture }
  | { type: 'ad'; key: string; slot: string };

const AD_INTERVAL_MS = 6000;

/** One automatic, swipeable flow that alternates fixtures and sponsored slides. */
export default function AdSenseCarousel({
  placement,
  slots,
  enabled = true,
  label = 'Sponsored carousel',
}: AdSenseCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  const adsAllowed =
    enabled &&
    import.meta.env.PROD &&
    import.meta.env.VITE_ADSENSE_ENABLED !== 'false' &&
    ['funspot.co.ke', 'www.funspot.co.ke'].includes(window.location.hostname);

  useEffect(() => {
    let alive = true;
    getAllFixtures()
      .then((items) => { if (alive) setFixtures(items); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const slides = useMemo<Slide[]>(() => {
    const availableFixtures = fixtures
      .filter((fixture) => fixture.homeTeam && fixture.awayTeam)
      .slice(0, 4)
      .map((fixture, index) => ({
        type: 'fixture' as const,
        key: `fixture-${fixture.matchId || fixture.id || index}`,
        fixture,
      }));
    const availableAds = (adsAllowed ? slots : []).map((slot) => ({
      type: 'ad' as const,
      key: `ad-${slot}`,
      slot,
    }));
    const mixed: Slide[] = [];
    const count = Math.max(availableFixtures.length, availableAds.length);
    for (let index = 0; index < count; index += 1) {
      if (availableFixtures[index]) mixed.push(availableFixtures[index]);
      if (availableAds[index]) mixed.push(availableAds[index]);
    }
    return mixed;
  }, [fixtures, adsAllowed, slots]);

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
    <section className="w-full min-w-0 py-1" aria-label={label}>
      <div
        ref={viewportRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-2"
        onScroll={(event) => {
          const node = event.currentTarget;
          const first = node.firstElementChild;
          if (!first) return;
          const slideWidth = first.getBoundingClientRect().width + 12;
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
              <div className="flex min-h-[86px] items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--home-surface, #171717)' }}>
                <div className="min-w-0 flex-1 text-center">
                  <p className="truncate text-sm font-semibold">{slide.fixture.homeTeam}</p>
                  <p className="text-[10px] opacity-60">HOME</p>
                </div>
                <div className="shrink-0 text-center">
                  <p className="text-xs font-bold">VS</p>
                  <p className="mt-1 text-[10px] opacity-70">{slide.fixture.status || 'Fixture'}</p>
                </div>
                <div className="min-w-0 flex-1 text-center">
                  <p className="truncate text-sm font-semibold">{slide.fixture.awayTeam}</p>
                  <p className="text-[10px] opacity-60">AWAY</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1" aria-label="Carousel pages">
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
