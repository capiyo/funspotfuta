'use client';
// Web port of RN src/modals/match/pitchView.tsx. react-native-svg -> inline <svg>;
// onLayout -> ResizeObserver; absolute-positioned player dots over the SVG.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useFanColors, hexWithAlpha } from '@/lib/theme/use-fan-colors';
import {
  calculatePositions, shortName, NEUTRAL_GAP_FRACTION,
  type PitchPosition, type SimplifiedPlayer,
} from '@/lib/match/pitch-engine';

const GRASS_EVEN = '#0D5E1A';
const GRASS_ODD = '#0A5218';
const DOT_SIZE = 34;
const LABEL_BLOCK_HEIGHT = 21;
const PITCH_ASPECT_RATIO = 0.68;

function PitchSvg({ width: w, height: h, homeColor, awayColor }: { width: number; height: number; homeColor: string; awayColor: string }) {
  const stripeCount = 12;
  const stripeH = h / stripeCount;
  const gapH = h * NEUTRAL_GAP_FRACTION;
  const penW = w * 0.55, penH = h * 0.16, gW = w * 0.3, gH = h * 0.06, cr = 10;
  const line = 'rgba(255,255,255,0.35)';
  const corner = 'rgba(255,255,255,0.25)';
  const box = { stroke: line, strokeWidth: 1.1, fill: 'none' as const };
  return (
    <svg width={w} height={h} className="absolute inset-0">
      <defs>
        <linearGradient id="awayWash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={awayColor} stopOpacity="0.16" />
          <stop offset="1" stopColor={awayColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="homeWash" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={homeColor} stopOpacity="0.16" />
          <stop offset="1" stopColor={homeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: stripeCount }).map((_, i) => (
        <rect key={i} x={0} y={i * stripeH} width={w} height={stripeH} fill={i % 2 === 0 ? GRASS_EVEN : GRASS_ODD} />
      ))}
      <rect x={0} y={0} width={w} height={h * 0.5} fill="url(#awayWash)" />
      <rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill="url(#homeWash)" />
      <rect x={0} y={h / 2 - gapH / 2} width={w} height={gapH} fill="rgba(0,0,0,0.18)" />
      <rect x={6} y={6} width={w - 12} height={h - 12} rx={4} ry={4} {...box} />
      <line x1={6} y1={h / 2} x2={w / 2} y2={h / 2} stroke={awayColor} strokeOpacity={0.9} strokeWidth={2.2} />
      <line x1={w / 2} y1={h / 2} x2={w - 6} y2={h / 2} stroke={homeColor} strokeOpacity={0.9} strokeWidth={2.2} />
      <circle cx={w / 2} cy={h / 2} r={w * 0.13} {...box} />
      <circle cx={w / 2} cy={h / 2} r={3} fill={line} />
      <rect x={(w - penW) / 2} y={6} width={penW} height={penH} {...box} />
      <rect x={(w - penW) / 2} y={h - 6 - penH} width={penW} height={penH} {...box} />
      <rect x={(w - gW) / 2} y={6} width={gW} height={gH} {...box} />
      <rect x={(w - gW) / 2} y={h - 6 - gH} width={gW} height={gH} {...box} />
      <circle cx={w / 2} cy={h * 0.13} r={2.5} fill={line} />
      <circle cx={w / 2} cy={h * 0.87} r={2.5} fill={line} />
      <path d={`M ${6 + cr} 6 A ${cr} ${cr} 0 0 1 6 ${6 + cr}`} stroke={corner} strokeWidth={1} fill="none" />
      <path d={`M ${w - 6 - cr} 6 A ${cr} ${cr} 0 0 1 ${w - 6} ${6 + cr}`} stroke={corner} strokeWidth={1} fill="none" />
      <path d={`M 6 ${h - 6 - cr} A ${cr} ${cr} 0 0 0 ${6 + cr} ${h - 6}`} stroke={corner} strokeWidth={1} fill="none" />
      <path d={`M ${w - 6} ${h - 6 - cr} A ${cr} ${cr} 0 0 1 ${w - 6 - cr} ${h - 6}`} stroke={corner} strokeWidth={1} fill="none" />
    </svg>
  );
}

function PlayerDot({ player, position, color, isHome }: { player: SimplifiedPlayer; position: PitchPosition; color: string; isHome: boolean }) {
  const dot = (
    <span
      className="flex items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md"
      style={{ width: DOT_SIZE, height: DOT_SIZE, background: color }}
    >
      {player.number}
    </span>
  );
  const label = (
    <span className="flex max-w-[84px] items-center gap-1 rounded-fan-sm bg-black/75 px-1.5 py-px">
      <span className="truncate text-fan-tag text-white">{shortName(player.name)}</span>
      {player.captain && <span className="text-[8px] font-extrabold" style={{ color }}>C</span>}
    </span>
  );
  return (
    <div
      className="absolute flex flex-col items-center gap-[3px]"
      style={{
        left: position.x - DOT_SIZE / 2,
        top: isHome ? position.y - DOT_SIZE / 2 : position.y - DOT_SIZE / 2 - LABEL_BLOCK_HEIGHT,
        width: DOT_SIZE,
      }}
    >
      {isHome ? <>{dot}{label}</> : <>{label}{dot}</>}
    </div>
  );
}

export function BenchColumn({ players, color }: { players: SimplifiedPlayer[]; color: string }) {
  if (players.length === 0) return <p className="text-center text-fan-caption text-fan-textTertiary">No data</p>;
  return (
    <div className="space-y-1">
      {players.slice(0, 9).map((p, idx) => (
        <div key={`${p.number}-${p.name}-${idx}`} className="flex items-center gap-1.5 rounded-fan-sm px-1.5 py-1" style={{ background: hexWithAlpha(color, 0.06) }}>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-fan-sm px-1 text-[10px] font-bold" style={{ background: hexWithAlpha(color, 0.18), color }}>{p.number}</span>
          <span className="min-w-0 flex-1 truncate text-fan-caption text-fan-textPrimary">{shortName(p.name)}</span>
          <span className="text-fan-tag text-fan-textTertiary">{p.position.toUpperCase()}</span>
          {p.captain && <span className="text-[9px] font-extrabold" style={{ color }}>C</span>}
        </div>
      ))}
    </div>
  );
}

function OverflowButton({ label, count, color, expanded, onTap }: { label: string; count: number; color: string; expanded: boolean; onTap: () => void }) {
  const c = useFanColors();
  const shortLabel = label.length > 12 ? `${label.substring(0, 11)}…` : label;
  return (
    <button
      type="button"
      onClick={onTap}
      className="inline-flex items-center gap-1 rounded-fan-pill border px-2 py-1"
      style={{ background: expanded ? hexWithAlpha(color, 0.15) : c.background, borderColor: expanded ? color : c.borderActive }}
    >
      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold" style={{ background: expanded ? hexWithAlpha(color, 0.9) : hexWithAlpha(color, 0.15), color: expanded ? '#fff' : color }}>{count}</span>
      <span className="text-fan-tag" style={{ color: expanded ? color : c.textSecondary }}>{shortLabel}</span>
      {expanded ? <ChevronUp size={14} color={color} /> : <ChevronDown size={14} color={c.textTertiary} />}
    </button>
  );
}

export function PitchView({
  homeTeam, awayTeam, homeFormation, awayFormation, homePlayers, awayPlayers,
}: {
  homeTeam: string; awayTeam: string; homeFormation: string; awayFormation: string;
  homePlayers: SimplifiedPlayer[]; awayPlayers: SimplifiedPlayer[];
}) {
  const c = useFanColors();
  const [showHome, setShowHome] = useState(false);
  const [showAway, setShowAway] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cappedHome = useMemo(() => homePlayers.slice(0, 11), [homePlayers]);
  const cappedAway = useMemo(() => awayPlayers.slice(0, 11), [awayPlayers]);
  const homeOverflow = homePlayers.slice(11);
  const awayOverflow = awayPlayers.slice(11);
  const hasOverflow = homeOverflow.length > 0 || awayOverflow.length > 0;

  const homePos = useMemo(() => (size.width > 0 ? calculatePositions(cappedHome, homeFormation, { isHome: true, ...size }) : []), [cappedHome, homeFormation, size]);
  const awayPos = useMemo(() => (size.width > 0 ? calculatePositions(cappedAway, awayFormation, { isHome: false, ...size }) : []), [cappedAway, awayFormation, size]);

  const sh = showHome && homeOverflow.length > 0;
  const sa = showAway && awayOverflow.length > 0;
  const label = (text: string, color: string, pos: React.CSSProperties) => (
    <div className="pointer-events-none absolute left-0 right-0 flex justify-center" style={pos}>
      <span className="max-w-[60%] truncate rounded-fan-pill bg-black/45 px-2.5 py-0.5 text-fan-tag" style={{ color, letterSpacing: 0.4 }}>{text}</span>
    </div>
  );

  return (
    <div>
      {hasOverflow && (
        <div className="mb-2 flex items-center justify-between">
          {homeOverflow.length > 0 && <OverflowButton label={homeTeam} count={homeOverflow.length} color={c.primary} expanded={showHome} onTap={() => setShowHome((v) => !v)} />}
          {awayOverflow.length > 0 && <OverflowButton label={awayTeam} count={awayOverflow.length} color={c.away} expanded={showAway} onTap={() => setShowAway((v) => !v)} />}
        </div>
      )}
      {(sh || sa) && (
        <div className="mb-2 rounded-fan-md border p-2" style={{ background: c.background, borderColor: c.borderActive }}>
          <p className="mb-2 text-fan-tag tracking-[0.8px] text-fan-textTertiary">EXTRA PLAYERS</p>
          <div className="flex gap-2">
            {sh && <div className="flex-1"><BenchColumn players={homeOverflow} color={c.primary} /></div>}
            {sh && sa && <span className="w-px self-stretch" style={{ background: c.borderActive }} />}
            {sa && <div className="flex-1"><BenchColumn players={awayOverflow} color={c.away} /></div>}
          </div>
        </div>
      )}
      <div ref={ref} className="relative w-full overflow-hidden rounded-fan-lg" style={{ aspectRatio: String(PITCH_ASPECT_RATIO) }}>
        {size.width > 0 && size.height > 0 && (
          <>
            <PitchSvg width={size.width} height={size.height} homeColor={c.primary} awayColor={c.away} />
            {label(homeTeam, c.primary, { bottom: size.height * 0.03 })}
            {label(awayTeam, c.away, { top: size.height * 0.03 })}
            {cappedHome.map((p, i) => i < homePos.length && <PlayerDot key={`h-${i}-${p.number}`} player={p} position={homePos[i]} color={c.primary} isHome />)}
            {cappedAway.map((p, i) => i < awayPos.length && <PlayerDot key={`a-${i}-${p.number}`} player={p} position={awayPos[i]} color={c.away} isHome={false} />)}
          </>
        )}
      </div>
    </div>
  );
}
