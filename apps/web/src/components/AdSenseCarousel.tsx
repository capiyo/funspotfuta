import { useEffect, useMemo, useRef, useState } from 'react';
import { AdSenseAd } from '@/components/AdSenseAd';
import { TeamCrest } from '@/components/TeamCrest';
import { useFanColors } from '@/theme/use-fan-colors';
import type { Fixture } from '@funspot/core';

type AdSenseCarouselProps = {
  placement: 'chats' | 'leaderboard';
  slots: readonly string[];
  enabled?: boolean;
  label?: string;
  showDots?: boolean;
  flush?: boolean;
  fixture?: Fixture | null;
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
  showDots = false,
  flush = false,
  fixture = null,
}: AdSenseCarouselProps) {
  const colors = useFanColors();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const adsAllowed =
    enabled &&
    import.meta.env.PROD &&
    import.meta.env.VITE_ADSENSE_ENABLED !== 'false' &&
    ['funspot.co.ke', 'www.funspot.co.ke'].includes(window.location.hostname);

  const slides = useMemo<Slide[]>(() => {
    const adSlides: Slide[] = (adsAllowed ? slots : [])
      .map((slot) => ({ type: 'ad', key: `ad-${slot}`, slot }));
    if (placement !== 'chats') return adSlides;

    // Messaging is scoped to the one fixture passed by the active chat route.
    // Never fetch or enumerate the global fixture collection for this carousel.
    const currentFixture: Slide | null = fixture ? {
      type: 'fixture',
      key: `fixture-${fixture.matchId ?? fixture.id}`,
      fixture,
    } : null;
    if (!currentFixture) return adSlides;

    // Alternate the active chat fixture with each ad instead of rendering
    // every ad consecutively after the single fixture slide.
    if (adSlides.length === 0) return [currentFixture];
    const mixed: Slide[] = [];
    for (const ad of adSlides) {
      mixed.push(ad, { ...currentFixture, key: `${currentFixture.key}-after-${ad.key}` });
    }
    return mixed;
  }, [adsAllowed, fixture, placement, slots]);

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
  }, [slides.length, fixture?.matchId, fixture?.id]);

  if (slides.length === 0) return null;

  return (
    <section className="w-full min-w-0" aria-label={label} style={{ background: colors.surface, borderRadius: flush ? 0 : 8, padding: flush ? 0 : 3, marginBottom: 0, overflow: 'hidden' }}>
      <div
        ref={viewportRef}
        className={`no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto ${flush ? 'px-0' : 'px-1'}`}
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
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <span className="min-w-0 truncate text-right text-xs font-semibold">{slide.fixture.homeTeam}</span>
                  <TeamCrest name={slide.fixture.homeTeam} fixture={slide.fixture as unknown as Record<string, unknown>} side="home" size={24} />
                </span>
                <span className="shrink-0 text-[10px] font-semibold" style={{ color: colors.textTertiary }}>VS</span>
                <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5">
                  <TeamCrest name={slide.fixture.awayTeam} fixture={slide.fixture as unknown as Record<string, unknown>} side="away" size={24} />
                  <span className="min-w-0 truncate text-xs font-semibold">{slide.fixture.awayTeam}</span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
