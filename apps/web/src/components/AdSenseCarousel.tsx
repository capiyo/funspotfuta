import { useEffect, useMemo, useRef, useState } from 'react';
import { TeamCrest } from '@/components/TeamCrest';
import { useFanColors } from '@/theme/use-fan-colors';
import type { Fixture } from '@funspot/core';

const ADSENSE_CLIENT = 'ca-pub-4829747375056254';
const ADSENSE_SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

type AdSenseCarouselProps = {
  placement: 'chats' | 'leaderboard';
  slots?: readonly string[];
  enabled?: boolean;
  label?: string;
  showDots?: boolean;
  flush?: boolean;
  fixture?: Fixture | null;
};

type CarouselSlide =
  | { type: 'ad'; id: string; slot: string }
  | { type: 'fixture'; id: string; fixture: Fixture };

type AdSenseWindow = Window & {
  adsbygoogle?: Array<Record<string, never>>;
};

function AdSenseSlide({ slot }: { slot: string }) {
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const pushAd = () => {
      if (cancelled || pushedRef.current || !adRef.current) return;
      try {
        const adsWindow = window as AdSenseWindow;
        adsWindow.adsbygoogle = adsWindow.adsbygoogle ?? [];
        adsWindow.adsbygoogle.push({});
        pushedRef.current = true;
      } catch {
        // Ad blockers, consent settings, and unavailable inventory are non-fatal.
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ADSENSE_SCRIPT}?client=${ADSENSE_CLIENT}"]`);
    if (existing?.dataset.loaded === 'true' || (window as AdSenseWindow).adsbygoogle) {
      pushAd();
    } else {
      const script = existing ?? document.createElement('script');
      const onLoad = () => {
        script.dataset.loaded = 'true';
        pushAd();
      };
      script.addEventListener('load', onLoad, { once: true });
      if (!existing) {
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = `${ADSENSE_SCRIPT}?client=${ADSENSE_CLIENT}`;
        document.head.appendChild(script);
      }
      return () => {
        cancelled = true;
        script.removeEventListener('load', onLoad);
      };
    }

    return () => { cancelled = true; };
  }, [slot]);

  return (
    <div className="flex min-h-[68px] w-full items-center justify-center overflow-hidden rounded-lg px-2 py-1">
      <ins
        ref={adRef}
        className="adsbygoogle block min-h-[60px] w-full"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

function FixtureSlide({ fixture, flush }: { fixture: Fixture; flush: boolean }) {
  const colors = useFanColors();
  return (
    <div
      className="flex min-h-[68px] w-full items-center justify-center gap-3 px-3 py-2"
      style={{ background: colors.surface, borderRadius: flush ? 0 : 8 }}
    >
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <span className="min-w-0 truncate text-right text-xs font-semibold" style={{ color: colors.textPrimary }}>{fixture.homeTeam}</span>
        <TeamCrest name={fixture.homeTeam} fixture={fixture as unknown as Record<string, unknown>} side="home" size={24} />
      </span>
      <span className="shrink-0 text-[10px] font-semibold" style={{ color: colors.textTertiary }}>VS</span>
      <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5">
        <TeamCrest name={fixture.awayTeam} fixture={fixture as unknown as Record<string, unknown>} side="away" size={24} />
        <span className="min-w-0 truncate text-xs font-semibold" style={{ color: colors.textPrimary }}>{fixture.awayTeam}</span>
      </span>
    </div>
  );
}

export default function AdSenseCarousel({
  placement,
  slots = [],
  enabled = true,
  label = 'Current fixture and advertisements',
  flush = false,
  fixture = null,
}: AdSenseCarouselProps) {
  const colors = useFanColors();
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = useMemo<CarouselSlide[]>(() => {
    const validSlots = enabled ? [...new Set(slots.filter((slot) => /^\d+$/.test(slot)))] : [];
    const adSlides: CarouselSlide[] = validSlots.map((slot, index) => ({
      type: 'ad',
      id: `ad-${slot}-${index}`,
      slot,
    }));
    if (!fixture) return adSlides;
    if (!adSlides.length) return [{ type: 'fixture', id: `fixture-${fixture.matchId ?? fixture.id}`, fixture }];
    return adSlides.flatMap((ad, index) => [
      ad,
      {
        type: 'fixture' as const,
        id: `fixture-${fixture.matchId ?? fixture.id}-${index}`,
        fixture,
      },
    ]);
  }, [enabled, slots, fixture]);

  useEffect(() => {
    setActiveIndex(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [slides.length, fixture?.matchId, fixture?.id]);

  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setTimeout(() => {
      let direction = directionRef.current;
      if (activeIndex >= slides.length - 1) direction = -1;
      else if (activeIndex <= 0) direction = 1;
      directionRef.current = direction;
      const next = activeIndex + direction;
      const track = trackRef.current;
      track?.scrollTo({ left: next * (track.clientWidth || 0), behavior: 'smooth' });
      setActiveIndex(next);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, slides.length]);

  if (placement !== 'chats' || !slides.length) return null;

  return (
    <section
      className="w-full min-w-0 overflow-hidden"
      aria-label={label}
      aria-roledescription="carousel"
      style={{
        background: colors.surface,
        borderRadius: flush ? 0 : 8,
        padding: flush ? 0 : 3,
        marginBottom: 0,
      }}
    >
      <div
        ref={trackRef}
        className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        style={{ scrollbarWidth: 'none', touchAction: 'pan-x' }}
        onScroll={(event) => {
          const track = event.currentTarget;
          if (!track.clientWidth) return;
          setActiveIndex(Math.max(0, Math.min(Math.round(track.scrollLeft / track.clientWidth), slides.length - 1)));
        }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="w-full min-w-full shrink-0 snap-center">
            {slide.type === 'ad'
              ? <AdSenseSlide slot={slide.slot} />
              : <FixtureSlide fixture={slide.fixture} flush={flush} />}
          </div>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">Slide {activeIndex + 1} of {slides.length}</span>
    </section>
  );
}
