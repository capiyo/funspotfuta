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

export default function AdSenseCarousel({ placement, label = 'Current fixture', flush = false, fixture = null }: AdSenseCarouselProps) {
  const colors = useFanColors();
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
