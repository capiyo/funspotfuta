import { Users } from 'lucide-react';
import type { FanColorPalette } from '@funspot/core';
import { FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { HIT_SLOP, ICON, PRESSED_OPACITY } from '@/theme/layout';
import { Avatar } from './Avatar';

export interface VoterItem {
  id: string;
  name: string;
  team: string;
  color: string;
}
const EMOJI_RE = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u;
export function splitFanName(raw: string): { icon: string; name: string } {
  const match = raw.match(EMOJI_RE);
  if (!match) return { icon: '', name: raw };
  return { icon: match[1], name: raw.slice(match[0].length).trim() || raw };
}
export function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
const SLOTS = 3;
export function VoterList({ colors, voters, emptyLabel, onPress }: {
  colors: FanColorPalette;
  voters: VoterItem[];
  emptyLabel: string;
  onPress?: () => void;
}) {
  const shown = voters.slice(0, SLOTS);
  return <button type="button" onClick={onPress} className="voter-list" style={{ display: 'flex', alignItems: 'center', gap: FAN_SPACING.md, border: 0, padding: Math.max(HIT_SLOP.top, HIT_SLOP.left), background: 'transparent', textAlign: 'left', opacity: 1 }} onMouseDown={(e) => { if(onPress) e.currentTarget.style.opacity = String(PRESSED_OPACITY); }} onMouseUp={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
    {shown.length === 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: FAN_SPACING.sm }}><Users size={ICON.sm} color={colors.textTertiary} /><span style={fanText('caption', colors, colors.textSecondary)}>{emptyLabel}</span></span> :
      Array.from({ length: SLOTS }, (_, i) => {
        const voter = shown[i];
        if (!voter) return <span key={`empty-${i}`} style={{ flex: 1 }} />;
        const { icon, name } = splitFanName(voter.name);
        return <span key={voter.id} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm, minWidth: 0 }}>
          <Avatar colors={colors} size="sm" label={icon || initials(name)} borderColor={voter.color} />
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ ...fanText('caption', colors, colors.textPrimary), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span style={{ ...fanText('tag', colors, voter.color), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voter.team}</span>
          </span>
        </span>;
      })}
  </button>;
}
