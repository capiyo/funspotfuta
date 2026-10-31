import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeftRight, CircleDot, X } from 'lucide-react';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';
import type { LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { BenchColumn, PitchView } from './pitchView';

function hexWithAlpha(hex: string, alpha: number): string {
  const clean=hex.replace('#','');
  if(clean.length!==6) return hex;
  const r=parseInt(clean.substring(0,2),16),g=parseInt(clean.substring(2,4),16),b=parseInt(clean.substring(4,6),16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function FormationPill({teamName,formation,color,alignRight=false,imageUrl}:{teamName:string;formation:string;color:string;alignRight?:boolean;imageUrl?:string|null}) {
  const colors=useFanColors();
  return <div className={`min-w-0 ${alignRight?'text-right':'text-left'}`}>
    <div className={`flex items-center gap-1.5 ${alignRight?'justify-end':'justify-start'}`}>
      {imageUrl ? <img src={imageUrl} alt="" className="h-[18px] w-[18px] rounded-full object-contain" loading="lazy"/> : null}
      <p className="truncate" style={fanText('tag',colors,color)}>{teamName}</p>
    </div>
    <div className="h-[3px]"/>
    <span className="inline-block rounded-md border px-2 py-[3px] text-[11px] font-bold" style={{backgroundColor:hexWithAlpha(color,.12),borderColor:hexWithAlpha(color,.3),color}}>{formation}</span>
  </div>;
}

function EmptyState({icon,message}:{icon:'error'|'soccer';message:string}) {
  const colors=useFanColors();
  const Icon=icon==='error'?AlertCircle:CircleDot;
  return <div className="flex h-full flex-col items-center justify-center p-6 text-center">
    <Icon size={48} color={hexWithAlpha(colors.textTertiary,.5)}/>
    <div style={{height:FAN_SPACING.md}}/>
    <p style={fanText('body',colors,colors.textSecondary)}>{message}</p>
  </div>;
}

export interface LineupsTabProps { fixture:Fixture; lineups:LineupsData|null; loading:boolean; error:string; }

export function LineupsTab({fixture,lineups,loading,error}:LineupsTabProps) {
  const colors=useFanColors();
  const [showBench,setShowBench]=useState(false);
  useEffect(()=>{if(!lineups) setShowBench(false);},[lineups]);
  if(loading) return <div className="flex h-full items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:colors.primary}} aria-label="Loading lineups"/></div>;
  if(error) return <EmptyState icon="error" message={error}/>;
  if(!lineups) return <EmptyState icon="soccer" message="No lineup available"/>;
  const hasBench=lineups.homeBench.length>0||lineups.awayBench.length>0;
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex items-center px-4 pb-1 pt-2">
      <FormationPill teamName={fixture.homeTeam} formation={lineups.homeFormation} color={colors.primary} imageUrl={fixture.homeTeamImageUrl}/>
      <div className="flex-1"/>
      {hasBench&&<button type="button" onClick={()=>setShowBench(v=>!v)} className="flex items-center gap-1 rounded-full border px-3.5 py-2 text-xs font-semibold" style={{backgroundColor:showBench?colors.primary:colors.background,borderColor:showBench?colors.primary:colors.borderActive,color:showBench?'#fff':colors.textSecondary}}>
        {showBench?<X size={15}/>:<ArrowLeftRight size={15}/>}<span>Bench</span>
      </button>}
      <div className="flex-1"/>
      <FormationPill teamName={fixture.awayTeam} formation={lineups.awayFormation} color={colors.away} imageUrl={fixture.awayTeamImageUrl} alignRight/>
    </div>
    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${showBench?'grid-rows-[1fr] opacity-100':'grid-rows-[0fr] opacity-0'}`}>
      <div className="overflow-hidden">
        <div className="border-b px-3.5 pb-3 pt-2" style={{backgroundColor:colors.background,borderBottomColor:hexWithAlpha(colors.primary,.25)}}>
          <div className="flex items-center gap-2"><span className="h-[13px] w-[3px] rounded" style={{backgroundColor:colors.primary}}/><span className="text-[10px] font-bold tracking-widest" style={{color:colors.primary}}>BENCH</span></div>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <BenchColumn players={lineups.homeBench} color={colors.primary}/>
            <div className="w-px justify-self-center" style={{backgroundColor:colors.borderActive}}/>
            <BenchColumn players={lineups.awayBench} color={colors.away}/>
          </div>
        </div>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
      <PitchView homeTeam={fixture.homeTeam} awayTeam={fixture.awayTeam} homeFormation={lineups.homeFormation} awayFormation={lineups.awayFormation} homePlayers={lineups.homeStartingXI} awayPlayers={lineups.awayStartingXI}/>
    </div>
  </div>;
}
