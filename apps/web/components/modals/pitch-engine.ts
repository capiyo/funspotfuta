// Positioning engine for the lineup pitch. Straight port of the module-level
// functions in RN src/modals/match/pitchView.tsx (no platform dependencies).

import { PositionRank, shortName } from '@funspot/core/src/types/matchDetails';
import type { SimplifiedPlayer } from '@funspot/core/src/types/matchDetails';

export { PositionRank, shortName };
export type { SimplifiedPlayer };

export const NEUTRAL_GAP_FRACTION = 0.09;

export function getPositionRank(pos: string): PositionRank {
  const p = pos.toLowerCase().trim();
  if (p.includes('goalkeeper') || p === 'gk' || p === 'g') return PositionRank.goalkeeper;
  if (
    p.includes('back') || p.includes('defend') || p.includes('def') ||
    ['d', 'cb', 'lb', 'rb', 'lwb', 'rwb', 'cwb', 'sw', 'dc', 'dl', 'dr'].includes(p)
  ) return PositionRank.defender;
  if (
    p.includes('forward') || p.includes('striker') || p.includes('winger') || p.includes('attack') ||
    ['f', 'cf', 'st', 'lw', 'rw', 'ss', 'fw', 'lf', 'rf'].includes(p)
  ) return PositionRank.forward;
  return PositionRank.midfielder;
}

export function parseFormation(formation: string): number[] {
  try {
    const parsed = formation.split('-').map((s) => parseInt(s.trim(), 10) || 0).filter((n) => n > 0);
    return parsed.length ? parsed : [4, 4, 2];
  } catch {
    return [4, 4, 2];
  }
}

const byRankThenNumber = (a: SimplifiedPlayer, b: SimplifiedPlayer) => {
  const ra = getPositionRank(a.position);
  const rb = getPositionRank(b.position);
  return ra !== rb ? ra.localeCompare(rb) : a.number - b.number;
};

export function groupByFormation(players: SimplifiedPlayer[], formation: string): SimplifiedPlayer[][] {
  const formationRows = parseFormation(formation);
  const gks: SimplifiedPlayer[] = [], defs: SimplifiedPlayer[] = [], mids: SimplifiedPlayer[] = [], fwds: SimplifiedPlayer[] = [];
  for (const p of players) {
    switch (getPositionRank(p.position)) {
      case PositionRank.goalkeeper: gks.push(p); break;
      case PositionRank.defender: defs.push(p); break;
      case PositionRank.midfielder: mids.push(p); break;
      case PositionRank.forward: fwds.push(p); break;
    }
  }
  [gks, defs, mids, fwds].forEach((l) => l.sort(byRankThenNumber));

  const result: SimplifiedPlayer[][] = [gks.slice(0, 1)];
  const outfield = [...defs, ...mids, ...fwds];
  let idx = 0;
  for (const rowCount of formationRows) {
    const row: SimplifiedPlayer[] = [];
    for (let i = 0; i < rowCount && idx < outfield.length; i++) row.push(outfield[idx++]);
    result.push(row);
  }
  while (idx < outfield.length) result[result.length - 1].push(outfield[idx++]);
  return result;
}

export function rowCurveDepth(count: number, rowIndex: number, totalRows: number): number {
  if (count <= 1) return 0.0;
  const isDefenseRow = rowIndex === 1;
  const isMidfieldRow = rowIndex >= 2 && rowIndex < totalRows - 1;
  const isForwardRow = rowIndex === totalRows - 1;
  switch (count) {
    case 2: return isDefenseRow ? 0.02 : isMidfieldRow ? 0.025 : 0.015;
    case 3: return isDefenseRow ? 0.035 : isMidfieldRow ? 0.07 : isForwardRow ? 0.05 : 0.06;
    case 4: return isDefenseRow ? 0.025 : isMidfieldRow ? 0.045 : 0.035;
    case 5: return isMidfieldRow ? 0.06 : 0.045;
    default: return 0.04;
  }
}

export function getRowWidth(count: number, rowIndex: number, totalRows: number): number {
  if (count <= 1) return 0.0;
  const isDefenseRow = rowIndex === 1;
  const isMidfieldRow = rowIndex >= 2 && rowIndex < totalRows - 1;
  const isForwardRow = rowIndex === totalRows - 1;
  const baseWidth = isDefenseRow ? 0.55 : isMidfieldRow ? 0.62 : isForwardRow ? 0.58 : 0.55;
  const countFactor = Math.min(Math.max(count / 4.0, 0.7), 1.3);
  return Math.min(Math.max(baseWidth * countFactor, 0.25), 0.75);
}

export interface PitchPosition { x: number; y: number }

export function calculatePositions(
  players: SimplifiedPlayer[],
  formation: string,
  opts: { isHome: boolean; width: number; height: number },
): PitchPosition[] {
  const { isHome, width, height } = opts;
  if (players.length === 0) return [];
  const groups = groupByFormation(players, formation);
  const positions: PitchPosition[] = [];

  const edgeMargin = height * 0.06;
  const halfGap = height * (NEUTRAL_GAP_FRACTION / 2);
  const halfwayY = height / 2;
  const gkY = isHome ? height - edgeMargin : edgeMargin;
  const forwardY = isHome ? halfwayY + halfGap : halfwayY - halfGap;

  for (let rowIndex = 0; rowIndex < groups.length; rowIndex++) {
    const row = groups[rowIndex];
    if (row.length === 0) continue;
    const totalRows = groups.length > 1 ? groups.length - 1 : 1;
    const t = totalRows > 0 ? rowIndex / totalRows : 0.5;
    const yPos = gkY + t * (forwardY - gkY);
    const curveDepth = rowCurveDepth(row.length, rowIndex, groups.length);
    const rowWidth = getRowWidth(row.length, rowIndex, groups.length);
    const rowStart = 0.5 - rowWidth / 2;
    const sortedRow = [...row].sort(byRankThenNumber);
    const n = sortedRow.length;
    const center = n > 1 ? (n - 1) / 2 : 0;

    for (let i = 0; i < n; i++) {
      const xPos = n === 1 ? 0.5 : rowStart + (rowWidth * i) / (n - 1);
      const d = n > 1 && center > 0 ? (i - center) / center : 0;
      const advance = curveDepth * (d * d - 0.35);
      const yCurved = isHome ? yPos - advance : yPos + advance;
      const clampMin = isHome ? halfwayY + halfGap * 0.4 : edgeMargin * 0.5;
      const clampMax = isHome ? height - edgeMargin * 0.5 : halfwayY - halfGap * 0.4;
      positions.push({ x: xPos * width, y: Math.min(Math.max(yCurved, clampMin), clampMax) });
    }
  }
  return positions;
}
