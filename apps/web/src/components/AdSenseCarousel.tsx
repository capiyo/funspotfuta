import { TeamCrest } from '@/components/TeamCrest';
import { AdSenseAd } from '@/components/AdSenseAd';
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

export default function AdSenseCarousel({ placement, slots = [], label = 'Current fixture', flush = false, fixture = null }: AdSenseCarouselProps) {
  const colors = useFanColors();
  if (placement !== 'chats' || !fixture) return null;
  return <section className="grid w-full min-w-0 grid-cols-[0.9fr_1.1fr] items-center gap-1" aria-label={label} style={{
    background: colors.surface, borderRadius: flush ? 0 : 8, padding: flush ? 0 : 3,
    marginBottom: 0, overflow: 'hidden', minHeight: 68,
  }}>
    <div className="flex min-h-[68px] min-w-0 items-center justify-center gap-1 px-1 py-2">
      <span className="min-w-0 truncate text-right text-[10px] font-semibold" style={{ color: colors.textPrimary }}>{fixture.homeTeam}</span>
      <TeamCrest name={fixture.homeTeam} fixture={fixture as unknown as Record<string, unknown>} side="home" size={20} />
      <span className="shrink-0 text-[9px] font-semibold" style={{ color: colors.textTertiary }}>VS</span>
      <TeamCrest name={fixture.awayTeam} fixture={fixture as unknown as Record<string, unknown>} side="away" size={20} />
      <span className="min-w-0 truncate text-[10px] font-semibold" style={{ color: colors.textPrimary }}>{fixture.awayTeam}</span>
    </div>
    <AdSenseAd slotId={slots[0] ?? '3164796870'} placement="chats" />
  </section>;
}
