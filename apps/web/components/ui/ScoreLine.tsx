// Web port of RN Scoreline.tsx — Home | score | Away.

import { Avatar } from './Avatar';

export function ScoreLine({
  homeTeam,
  awayTeam,
  center,
  crests = false,
}: {
  homeTeam: string;
  awayTeam: string;
  /** "2 : 1", or "vs" before kickoff */
  center: string;
  crests?: boolean;
}) {
  return (
    <div className="flex items-center">
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        <span className="min-w-0 truncate text-fan-caption text-fan-textSecondary">{homeTeam}</span>
        {crests && <Avatar size="sm" label={homeTeam.charAt(0).toUpperCase()} borderColor="var(--fan-primary)" />}
      </div>
      <span className="px-3 text-center text-fan-caption text-fan-textSecondary">{center}</span>
      <div className="flex min-w-0 flex-1 items-center justify-start gap-1">
        {crests && <Avatar size="sm" label={awayTeam.charAt(0).toUpperCase()} borderColor="var(--fan-away)" />}
        <span className="min-w-0 truncate text-fan-caption text-fan-textSecondary">{awayTeam}</span>
      </div>
    </div>
  );
}
