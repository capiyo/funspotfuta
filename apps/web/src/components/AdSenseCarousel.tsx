import { useRef, useState } from 'react';
import { AdSenseAd } from '@/components/AdSenseAd';
import { TeamCrest } from '@/components/TeamCrest';
import { useFanColors } from '@/theme/use-fan-colors';
import type { Fixture } from '@funspot/core';

type AdSenseCarouselProps = {
  placement: 'chats' | 'leaderboard';
  slots?: readonly string[];
  enabled?: boolean;
  label?: string;
  showDots?: boolean;
  flush?: boolean;
  fixture?: Fixture | null;
};

export default function AdSenseCarousel({ placement, slots = ['9051548379', '3164796870', '1372263706'], label, flush = false, fixture = null, showDots = true }: AdSenseCarouselProps) {
  const colors = useFanColors();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  if (placement === 'leaderboard') {
    const adSlots = slots.length > 0 ? slots : ['9051548379', '3164796870', '1372263706'];
    return <section className="w-full min-w-0" aria-label={label ?? 'Leaderboard advertisements'} style={{ background: colors.surface, borderRadius: flush ? 0 : 8, padding: flush ? 0 : 3, overflow: 'hidden' }}>
      <div ref={trackRef} className="w-full min-w-0" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }} onScroll={(event) => {
        const width = event.currentTarget.clientWidth;
        if (width > 0) setActiveIndex(Math.max(0, Math.min(Math.round(event.currentTarget.scrollLeft / width), adSlots.length - 1)));
      }}>
        {adSlots.map((slotId, index) => <div key={`${slotId}-${index}`} style={{ flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start' }}>
          <AdSenseAd slotId={slotId} placement="leaderboard" />
        </div>)}
      </div>
      {showDots && adSlots.length > 1 && <div className="flex items-center justify-center gap-1.5 py-1" aria-label="Advertisement slides">
        {adSlots.map((slotId, index) => <button key={`${slotId}-dot-${index}`} type="button" aria-label={`Show advertisement ${index + 1}`} aria-current={activeIndex === index ? 'true' : undefined} onClick={() => trackRef.current?.scrollTo({ left: (trackRef.current?.clientWidth ?? 0) * index, behavior: 'smooth' })} style={{ width: activeIndex === index ? 14 : 5, height: 5, border: 0, borderRadius: 99, padding: 0, background: activeIndex === index ? colors.primary : colors.textTertiary, opacity: activeIndex === index ? 1 : 0.45, cursor: 'pointer' }} />)}
      </div>}
    </section>;
  }
  if (placement !== 'chats' || !fixture) return null;
  return <section className="w-full min-w-0" aria-label={label} style={{
    background: colors.surface, borderRadius: flush ? 0 : 8, padding: flush ? 0 : 3,
    marginBottom: 0, overflow: 'hidden',
  }}>
    <div className="flex min-h-[68px] w-full items-center justify-center gap-3 px-3 py-2">
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
  </section>;
}
