import type { CSSProperties } from 'react';
import { Globe2, Lock, Send, Trophy, User as UserIcon, UserPlus } from 'lucide-react';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import type { ComradeProfile } from './types';

function hexWithAlpha(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return hex;
  const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function initials(name: string): string { return name.length > 0 ? name[0].toUpperCase() : '?'; }

export interface ComradeCardProps {
  comrade: ComradeProfile;
  isAdded: boolean;
  isFull: boolean;
  hasAdminChannels: boolean;
  onProfile: () => void;
  onAction: () => void;
}
export function ComradeCard({ comrade, isAdded, isFull, hasAdminChannels, onProfile, onAction }: ComradeCardProps) {
  const colors = useFanColors();
  const actionLabel = isFull ? 'Full' : hasAdminChannels ? 'Add' : 'Invite';
  const actionColor = isFull ? colors.away : colors.primary;
  const cardStyle: CSSProperties = {
    marginInline: FAN_SPACING.lg, marginBlock: FAN_SPACING.sm, padding: FAN_SPACING.base,
    borderRadius: FAN_RADIUS.lg, border: `0.5px solid ${hexWithAlpha(colors.border, .15)}`,
    background: hexWithAlpha(colors.surface, .5),
  };
  const pill = (color: string): CSSProperties => ({
    display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: 4,
    padding: '6px 14px', borderRadius: 20, border: `0.5px solid ${hexWithAlpha(color, .3)}`,
    background: hexWithAlpha(color, .08), color, fontSize: 11, fontWeight: 600, opacity: 1,
  });
  return <article style={cardStyle}>
    <div className="flex min-w-0 items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border" style={{ background: colors.primaryDim, borderColor: hexWithAlpha(colors.primary, .3) }}>
        <span className="text-lg font-bold" style={{ color: colors.primary }}>{initials(comrade.nickname)}</span>
      </div>
      <div style={{ width: FAN_SPACING.base }} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold" style={{ color: colors.textPrimary }}>{comrade.nickname}</span>
          {isAdded && <span className="rounded-lg px-1.5 py-0.5 text-[8px] font-semibold" style={{ background: colors.primaryDim, color: colors.primary }}>✓ Added</span>}
        </div>
        <div className="mt-0.5 truncate text-[11px]" style={{ color: colors.textSecondary }}>@{comrade.username}</div>
        <div className="mt-0.5 flex min-w-0 items-center text-[10px]" style={{ color: colors.textTertiary }}>
          <Trophy size={10} /><span className="mx-1 truncate">{comrade.clubFan}</span>
          <Globe2 size={10} /><span className="ml-1 truncate">{comrade.countryFan}</span>
        </div>
      </div>
      <div className="ml-2 shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold" style={{ background: colors.surfaceSunken, borderColor: hexWithAlpha(colors.border, .3), color: colors.textSecondary }}>
        {comrade.numberOfBets} votes
      </div>
    </div>
    <div className="mt-2.5 flex justify-end gap-2">
      <button type="button" onClick={onProfile} style={pill(colors.textSecondary)}><UserIcon size={14} />Profile</button>
      {!isAdded && <button type="button" disabled={isFull} onClick={onAction} style={{ ...pill(actionColor), opacity: isFull ? .55 : 1, cursor: isFull ? 'not-allowed' : 'pointer' }}>
        {isFull ? <Lock size={14} /> : hasAdminChannels ? <UserPlus size={14} /> : <Send size={14} />}{actionLabel}
      </button>}
    </div>
  </article>;
}
