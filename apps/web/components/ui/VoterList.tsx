// Web port of RN Voterstack.tsx — up to 3 real voters side by side.

import { Users } from 'lucide-react';
import { Avatar } from './Avatar';

export interface VoterItem {
  id: string;
  /** May start with an emoji, e.g. "🔥 FireStriker" */
  name: string;
  /** Team (or "Draw") this person picked */
  team: string;
  /** CSS color for the avatar ring + team text */
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

export function VoterList({
  voters,
  emptyLabel,
  onClick,
}: {
  voters: VoterItem[];
  emptyLabel: string;
  onClick?: () => void;
}) {
  const shown = voters.slice(0, SLOTS);
  const Root = onClick ? 'button' : 'div';
  return (
    <Root
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className="flex w-full items-center gap-2 text-left transition-opacity hover:opacity-70"
    >
      {shown.length === 0 ? (
        <span className="flex items-center gap-1">
          <Users size={14} color="var(--fan-text-tertiary)" />
          <span className="text-fan-caption text-fan-textSecondary">{emptyLabel}</span>
        </span>
      ) : (
        Array.from({ length: SLOTS }, (_, i) => {
          const v = shown[i];
          if (!v) return <span key={`empty-${i}`} className="min-w-0 flex-1" />;
          const { icon, name } = splitFanName(v.name);
          return (
            <span key={v.id} className="flex min-w-0 flex-1 items-center gap-1">
              <Avatar size="sm" label={icon || initials(name)} borderColor={v.color} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-fan-caption text-fan-textPrimary">{name}</span>
                <span className="block truncate text-fan-tag" style={{ color: v.color }}>
                  {v.team}
                </span>
              </span>
            </span>
          );
        })
      )}
    </Root>
  );
}
