import type { CSSProperties } from 'react';
import type { FanColorPalette } from '@funspot/core';
import { FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { Avatar } from './Avatar';

export function ScoreLine({ colors, homeTeam, awayTeam, center, homeWon = false, awayWon = false, crests = false }: {
  colors: FanColorPalette;
  homeTeam: string;
  awayTeam: string;
  center: string;
  homeWon?: boolean;
  awayWon?: boolean;
  crests?: boolean;
}) {
  const teamStyle = fanText('caption', colors, colors.textSecondary);
  const side: CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm, minWidth: 0 };
  return <div className="scoreline" style={{ display: 'flex', alignItems: 'center' }}>
    <div style={{ ...side, justifyContent: 'flex-end' }}>
      <span style={{ ...teamStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeTeam}</span>
      {crests && <Avatar colors={colors} size="sm" label={homeTeam.charAt(0).toUpperCase()} borderColor={colors.primary} />}
    </div>
    <span style={{ ...fanText('caption', colors, colors.textSecondary), paddingInline: FAN_SPACING.base, textAlign: 'center' }}>{center}</span>
    <div style={{ ...side, justifyContent: 'flex-start' }}>
      {crests && <Avatar colors={colors} size="sm" label={awayTeam.charAt(0).toUpperCase()} borderColor={colors.away} />}
      <span style={{ ...teamStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayTeam}</span>
    </div>
  </div>;
}
