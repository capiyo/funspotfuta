import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { fanShadowStyle } from '@/theme/use-fan-shadow';
import type { SimplifiedPlayer } from '../../../../../packages/core/src/types/matchDetails';
import { PositionRank, shortName } from '../../../../../packages/core/src/types/matchDetails';

export const NEUTRAL_GAP_FRACTION = 0.09;

export function getPositionRank(pos: string): PositionRank {
  const p = pos.toLowerCase().trim();
  if (p.includes('goalkeeper') || p === 'gk' || p === 'g') return PositionRank.goalkeeper;
  if (p.includes('back') || p.includes('defend') || p.includes('def') ||
      ['d','cb','lb','rb','lwb','rwb','cwb','sw','dc','dl','dr'].includes(p)) return PositionRank.defender;
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') ||
      p.includes('attack') || ['f','cf','st','lw','rw','ss','fw','lf','rf'].includes(p)) return PositionRank.forward;
  return PositionRank.midfielder;
}

export function parseFormation(formation: string): number[] {
  try {
    const parsed = formation.split('-').map((s) => parseInt(s.trim(), 10) || 0).filter((n) => n > 0);
    return parsed.length ? parsed : [4, 4, 2];
  } catch { return [4, 4, 2]; }
}

export function groupByFormation(players: SimplifiedPlayer[], formation: string): SimplifiedPlayer[][] {
  const formationRows = parseFormation(formation);
  const gks: SimplifiedPlayer[] = [], defs: SimplifiedPlayer[] = [], mids: SimplifiedPlayer[] = [], fwds: SimplifiedPlayer[] = [];
  for (const player of players) {
    switch (getPositionRank(player.position)) {
      case PositionRank.goalkeeper: gks.push(player); break;
      case PositionRank.defender: defs.push(player); break;
      case PositionRank.midfielder: mids.push(player); break;
      case PositionRank.forward: fwds.push(player); break;
    }
  }
  const sortByPosition = (list: SimplifiedPlayer[]) => list.sort((a,b) => {
    const rankA = getPositionRank(a.position), rankB = getPositionRank(b.position);
    return rankA !== rankB ? rankA.localeCompare(rankB) : a.number - b.number;
  });
  sortByPosition(gks); sortByPosition(defs); sortByPosition(mids); sortByPosition(fwds);
  const result: SimplifiedPlayer[][] = [gks.slice(0,1)];
  const outfield = [...defs, ...mids, ...fwds];
  let outfieldIndex = 0;
  for (const rowCount of formationRows) {
    const row: SimplifiedPlayer[] = [];
    for (let i=0; i<rowCount && outfieldIndex<outfield.length; i++) row.push(outfield[outfieldIndex++]);
    result.push(row);
  }
  while (outfieldIndex < outfield.length) {
    if (result.length > 0) result[result.length-1].push(outfield[outfieldIndex++]);
    else break;
  }
  return result;
}

export function rowCurveDepth(count: number, rowIndex: number, totalRows: number): number {
  if (count <= 1) return 0;
  const isDefenseRow = rowIndex === 1, isMidfieldRow = rowIndex >= 2 && rowIndex < totalRows - 1, isForwardRow = rowIndex === totalRows - 1;
  switch (count) {
    case 2: if (isDefenseRow) return .020; if (isMidfieldRow) return .025; return .015;
    case 3: if (isDefenseRow) return .035; if (isMidfieldRow) return .070; if (isForwardRow) return .050; return .060;
    case 4: if (isDefenseRow) return .025; if (isMidfieldRow) return .045; return .035;
    case 5: if (isMidfieldRow) return .060; return .045;
    default: return .040;
  }
}

export function getRowWidth(count: number, rowIndex: number, totalRows: number): number {
  if (count <= 1) return 0;
  const isDefenseRow = rowIndex === 1, isMidfieldRow = rowIndex >= 2 && rowIndex < totalRows - 1, isForwardRow = rowIndex === totalRows - 1;
  let baseWidth: number;
  if (isDefenseRow) baseWidth = .55;
  else if (isMidfieldRow) baseWidth = .62;
  else if (isForwardRow) baseWidth = .58;
  else baseWidth = .55;
  const countFactor = Math.min(Math.max(count / 4, .7), 1.3);
  return Math.min(Math.max(baseWidth * countFactor, .25), .75);
}

export interface PitchPosition { x: number; y: number; }

export function calculatePositions(players: SimplifiedPlayer[], formation: string, opts: { isHome: boolean; width: number; height: number }): PitchPosition[] {
  const { isHome, width, height } = opts;
  if (players.length === 0) return [];
  const groups = groupByFormation(players, formation);
  const positions: PitchPosition[] = [];
  const edgeMargin = height * .06, halfGap = height * (NEUTRAL_GAP_FRACTION / 2), halfwayY = height / 2;
  const gkY = isHome ? height - edgeMargin : edgeMargin;
  const forwardY = isHome ? halfwayY + halfGap : halfwayY - halfGap;
  for (let rowIndex=0; rowIndex<groups.length; rowIndex++) {
    const row = groups[rowIndex];
    if (row.length === 0) continue;
    const totalRows = groups.length > 1 ? groups.length - 1 : 1;
    const t = totalRows > 0 ? rowIndex / totalRows : .5;
    const yPos = gkY + t * (forwardY - gkY);
    const curveDepth = rowCurveDepth(row.length, rowIndex, groups.length), rowWidth = getRowWidth(row.length, rowIndex, groups.length);
    const rowStart = .5 - rowWidth / 2;
    const sortedRow = [...row].sort((a,b) => {
      const rankA = getPositionRank(a.position), rankB = getPositionRank(b.position);
      return rankA !== rankB ? rankA.localeCompare(rankB) : a.number - b.number;
    });
    const playerCount = sortedRow.length, center = playerCount > 1 ? (playerCount - 1) / 2 : 0;
    for (let i=0; i<playerCount; i++) {
      const xPos = playerCount === 1 ? .5 : rowStart + (rowWidth * i) / (playerCount - 1);
      let d = 0;
      if (playerCount > 1 && center > 0) d = (i-center)/center;
      const advance = curveDepth * (d*d - .35);
      const yPosCurved = isHome ? yPos - advance : yPos + advance;
      const clampMin = isHome ? halfwayY + halfGap*.4 : edgeMargin*.5;
      const clampMax = isHome ? height-edgeMargin*.5 : halfwayY-halfGap*.4;
      positions.push({ x: xPos*width, y: Math.min(Math.max(yPosCurved,clampMin),clampMax) });
    }
  }
  return positions;
}

function hexWithAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#','');
  if (clean.length !== 6) return hex;
  const r=parseInt(clean.substring(0,2),16), g=parseInt(clean.substring(2,4),16), b=parseInt(clean.substring(4,6),16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function BenchColumn({ players, color }: { players: SimplifiedPlayer[]; color: string }) {
  const colors = useFanColors();
  if (!players.length) return <div className="text-center" style={fanText('caption', colors, colors.textTertiary)}>No data</div>;
  return <div className="space-y-1">
    {players.slice(0,9).map((p,idx) => <div key={`${p.number}-${p.name}-${idx}`} className="flex items-center gap-1.5 rounded px-1.5 py-1" style={{backgroundColor:hexWithAlpha(color,.06)}}>
      <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{backgroundColor:hexWithAlpha(color,.18),color}}>{p.number}</span>
      <span className="min-w-0 flex-1 truncate" style={fanText('caption',colors,colors.textPrimary)}>{shortName(p.name)}</span>
      <span style={fanText('tag',colors,colors.textTertiary)}>{p.position.toUpperCase()}</span>
      {p.captain && <span className="ml-0.5 text-[8px] font-bold" style={{color}}>C</span>}
    </div>)}
  </div>;
}

export interface PitchViewProps {
  homeTeam: string; awayTeam: string; homeFormation: string; awayFormation: string;
  homePlayers: SimplifiedPlayer[]; awayPlayers: SimplifiedPlayer[];
}
const PITCH_ASPECT_RATIO = .68;
const GRASS_EVEN = '#0D5E1A', GRASS_ODD = '#0A5218';

export function PitchView({ homeTeam, awayTeam, homeFormation, awayFormation, homePlayers, awayPlayers }: PitchViewProps) {
  const colors = useFanColors();
  const [showHomeOverflow,setShowHomeOverflow] = useState(false), [showAwayOverflow,setShowAwayOverflow] = useState(false);
  const [pitchSize,setPitchSize] = useState({width:0,height:0});
  const cappedHome=homePlayers.slice(0,11), cappedAway=awayPlayers.slice(0,11);
  const homeOverflow=homePlayers.slice(11), awayOverflow=awayPlayers.slice(11);
  const homePositions=useMemo(()=>pitchSize.width>0?calculatePositions(cappedHome,homeFormation,{isHome:true,width:pitchSize.width,height:pitchSize.height}):[],[homePlayers,homeFormation,pitchSize.width,pitchSize.height]);
  const awayPositions=useMemo(()=>pitchSize.width>0?calculatePositions(cappedAway,awayFormation,{isHome:false,width:pitchSize.width,height:pitchSize.height}):[],[awayPlayers,awayFormation,pitchSize.width,pitchSize.height]);
  const width=600, height=width*PITCH_ASPECT_RATIO;
  const renderPlayers=(players:SimplifiedPlayer[],positions:PitchPosition[],color:string,isHome:boolean)=>players.slice(0,11).map((player,index)=>{
    const point=positions[index]; if(!point) return null;
    const x=pitchSize.width>0?point.x/pitchSize.width*600:(index%4)*100+150;
    const y=pitchSize.height>0?point.y/pitchSize.height*height:(isHome?height*.78:height*.22);
    return <g key={`${isHome?'h':'a'}-${player.number}-${player.name}-${index}`} transform={`translate(${x} ${y})`}>
      <circle r="19" fill={hexWithAlpha(color,.18)} stroke={color} strokeWidth="2.5"/>
      <circle r="15" fill={color}/>
      <text textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="800" fill="#fff">{player.number}</text>
      <rect x="-34" y="21" width="68" height="17" rx="4" fill="rgba(0,0,0,.72)"/>
      <text x="0" y="33" textAnchor="middle" fontSize="10" fill="#fff">{shortName(player.name).slice(0,12)}{player.captain?' ©':''}</text>
    </g>;
  });
  const hasOverflow=homeOverflow.length>0||awayOverflow.length>0;
  return <div className="w-full">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="truncate text-[11px] font-semibold" style={{color:colors.primary}}>{homeTeam} · {homeFormation}</span>
      {hasOverflow && <div className="flex gap-1">
        {homeOverflow.length>0&&<button type="button" onClick={()=>setShowHomeOverflow(v=>!v)} className="rounded-full px-2 py-1 text-[10px]" style={{background:colors.background,color:colors.primary}}>{showHomeOverflow?'Hide home bench':'Home bench'} {showHomeOverflow?<ChevronUp size={12} className="inline"/>:<ChevronDown size={12} className="inline"/>}</button>}
        {awayOverflow.length>0&&<button type="button" onClick={()=>setShowAwayOverflow(v=>!v)} className="rounded-full px-2 py-1 text-[10px]" style={{background:colors.background,color:colors.away}}>{showAwayOverflow?'Hide away bench':'Away bench'} {showAwayOverflow?<ChevronUp size={12} className="inline"/>:<ChevronDown size={12} className="inline"/>}</button>}
      </div>}
      <span className="truncate text-[11px] font-semibold" style={{color:colors.away}}>{awayTeam} · {awayFormation}</span>
    </div>
    <div className="overflow-hidden rounded-xl" style={{...fanShadowStyle('card', true),background:GRASS_EVEN}}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${homeTeam} vs ${awayTeam} lineups`} className="block w-full" onLoad={(event)=>{const rect=event.currentTarget.getBoundingClientRect(); if(rect.width && (pitchSize.width!==rect.width || pitchSize.height!==rect.height)) setPitchSize({width:rect.width,height:rect.height});}}>
        {Array.from({length:8},(_,i)=><rect key={i} x={i*width/8} y="0" width={width/8} height={height} fill={i%2===0?GRASS_EVEN:GRASS_ODD}/>)}
        <g fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2">
          <rect x="15" y="15" width={width-30} height={height-30} rx="2"/>
          <line x1="15" y1={height/2} x2={width-15} y2={height/2}/>
          <circle cx={width/2} cy={height/2} r="48"/>
          <circle cx={width/2} cy={height/2} r="2" fill="rgba(255,255,255,.75)"/>
          <rect x={width*.28} y="15" width={width*.44} height={height*.18}/>
          <rect x={width*.38} y="15" width={width*.24} height={height*.07}/>
          <rect x={width*.28} y={height*.82} width={width*.44} height={height*.18}/>
          <rect x={width*.38} y={height*.93} width={width*.24} height={height*.07}/>
        </g>
        {renderPlayers(cappedAway,awayPositions,colors.away,false)}
        {renderPlayers(cappedHome,homePositions,colors.primary,true)}
      </svg>
    </div>
    {(showHomeOverflow||showAwayOverflow)&&<div className="mt-3 grid grid-cols-2 gap-3">
      {showHomeOverflow&&<section><p className="mb-2 text-[10px] font-bold" style={{color:colors.primary}}>HOME BENCH</p><BenchColumn players={homeOverflow} color={colors.primary}/></section>}
      {showAwayOverflow&&<section><p className="mb-2 text-[10px] font-bold" style={{color:colors.away}}>AWAY BENCH</p><BenchColumn players={awayOverflow} color={colors.away}/></section>}
    </div>}
  </div>;
}
