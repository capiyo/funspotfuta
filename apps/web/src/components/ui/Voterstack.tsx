import { Users } from 'lucide-react';
import type { FanColorPalette } from '@funspot/core';
import { FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { HIT_SLOP, ICON, PRESSED_OPACITY } from '@/theme/layout';
import { Avatar } from './Avatar';

export interface VoterItem {
  id: string;
  name: string;
  uri?: string | null;
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
  return <button type="button" onClick={onPress} className="voter-list" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8, width: '100%', minWidth: 0, boxSizing: 'border-box', border: 0, padding: '4px 0', background: 'transparent', textAlign: 'left', opacity: 1 }} onMouseDown={(e) => { if (onPress) e.currentTarget.style.opacity = String(PRESSED_OPACITY); }} onMouseUp={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
    {shown.length === 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: FAN_SPACING.sm }}><Users size={ICON.sm} color={colors.textTertiary} /><span className="match-card-prompt-line" style={fanText('caption', colors, colors.textSecondary)}>{emptyLabel}</span></span> :
      shown.map((voter) => {
        const { icon, name } = splitFanName(voter.name);
        return <span key={voter.id} className="voter-list-item" style={{ flex: '1 1 0%', display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
          <Avatar colors={colors} size="sm" label={icon || initials(name)} uri={voter.uri}
            userId={voter.id} borderColor={voter.color} />
          <span style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ ...fanText('caption', colors, colors.textPrimary), whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flexWrap: 'wrap' }}><span style={{ ...fanText('tag', colors, voter.color), whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{voter.team}</span><span aria-label={voter.id.startsWith('poke:') ? "poke mark" : "vote mark"} title={voter.id.startsWith('poke:') ? "poke" : "vote"} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, padding: '1px 4px', borderRadius: 4, background: `${voter.color}18`, color: voter.color, fontSize: 8, fontWeight: 800, lineHeight: '12px' }}>{voter.id.startsWith('poke:') ? '↗ poke' : '✓ vote'}</span></span>
          </span>
        </span>;
      })}
  </button>;
}
