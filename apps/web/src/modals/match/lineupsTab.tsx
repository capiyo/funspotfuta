import { AlertCircle, CircleDot } from 'lucide-react';
import { FAN_SPACING } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';
import type { LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { PitchView } from './pitchView';

function hexWithAlpha(hex: string, alpha: number): string {
  const clean=hex.replace('#','');
  if(clean.length!==6) return hex;
  const r=parseInt(clean.substring(0,2),16),g=parseInt(clean.substring(2,4),16),b=parseInt(clean.substring(4,6),16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  if(loading) return <div className="flex h-full items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:colors.primary}} aria-label="Loading lineups"/></div>;
  if(error) return <EmptyState icon="error" message={error}/>;
  if(!lineups) return <EmptyState icon="soccer" message="No lineup available"/>;
  return <div className="flex min-h-0 flex-1 flex-col">
    {hasBench && <div className="flex justify-center py-1">
      <button type="button" onClick={()=>setShowBench(v=>!v)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors" style={{backgroundColor:showBench?colors.primary:'transparent',color:showBench?'#fff':colors.textSecondary,border:0}}>
        {showBench?<X size={15}/>:<ArrowLeftRight size={15}/>}<span>{showBench?'Hide bench':'Show bench'}</span>
      </button>
    </div>}
    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${showBench?'grid-rows-[1fr] opacity-100':'grid-rows-[0fr] opacity-0'}`}>
      <div className="overflow-hidden">
        <div className="px-3.5 pb-3 pt-2">
          <div className="flex items-center gap-2"><span className="h-[13px] w-[3px] rounded" style={{backgroundColor:colors.primary}}/><span className="text-[10px] font-bold tracking-widest" style={{color:colors.primary}}>BENCH</span></div>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <BenchColumn players={lineups.homeBench} color={colors.primary}/>
            
            <BenchColumn players={lineups.awayBench} color={colors.away}/>
          </div>
        </div>
      </div>
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-0">
      <PitchView homeTeam={fixture.homeTeam} awayTeam={fixture.awayTeam} homeFormation={lineups.homeFormation} awayFormation={lineups.awayFormation} homePlayers={lineups.homeStartingXI} awayPlayers={lineups.awayStartingXI}/>
    </div>
  </div>;
}
