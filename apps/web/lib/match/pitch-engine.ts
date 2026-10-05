import type { SimplifiedPlayer } from '@funspot/core/src/types/matchDetails';

export type { SimplifiedPlayer };

export const NEUTRAL_GAP_FRACTION = 0.09;
export interface PitchPosition { x: number; y: number; }

export function getPositionRank(pos: string): string {
  const p = pos.toLowerCase().trim();
  if (p.includes('goalkeeper') || ['gk','g'].includes(p)) return 'goalkeeper';
  if (p.includes('back') || p.includes('defend') || ['def','d','cb','lb','rb','lwb','rwb','cwb','sw','dc','dl','dr'].includes(p)) return 'defender';
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') || p.includes('attack') || ['f','cf','st','lw','rw','ss','fw','lf','rf'].includes(p)) return 'forward';
  return 'midfielder';
}
export function parseFormation(formation: string): number[] {
  const parsed = formation.split('-').map(s => parseInt(s.trim(), 10) || 0).filter(n => n > 0);
  return parsed.length ? parsed : [4,4,2];
}
export function groupByFormation(players: SimplifiedPlayer[], formation: string): SimplifiedPlayer[][] {
  const rows = parseFormation(formation);
  const groups: Record<string,SimplifiedPlayer[]> = {goalkeeper:[],defender:[],midfielder:[],forward:[]};
  players.forEach(p => groups[getPositionRank(p.position)].push(p));
  Object.values(groups).forEach(a => a.sort((x,y) => x.number-y.number));
  const result: SimplifiedPlayer[][] = [groups.goalkeeper.slice(0,1)];
  const out=[...groups.defender,...groups.midfielder,...groups.forward]; let i=0;
  for(const count of rows){ result.push(out.slice(i,i+count)); i+=count; }
  while(i<out.length) result[result.length-1].push(out[i++]);
  return result;
}
function rowCurveDepth(count:number,rowIndex:number,totalRows:number){ if(count<=1)return 0; const d=rowIndex===1?.025:rowIndex>=2&&rowIndex<totalRows-1?.045:.035; return count===3?d*1.4:count===5?d*1.3:d; }
function getRowWidth(count:number,rowIndex:number,totalRows:number){ if(count<=1)return 0; const base=rowIndex===1?.55:rowIndex>=2&&rowIndex<totalRows-1?.62:rowIndex===totalRows-1?.58:.55; return Math.min(Math.max(base*Math.min(Math.max(count/4,.7),1.3),.25),.75); }
export function calculatePositions(players:SimplifiedPlayer[],formation:string,opts:{isHome:boolean;width:number;height:number}):PitchPosition[]{
  if(!players.length)return [];
  const {isHome,width,height}=opts, groups=groupByFormation(players,formation), edge=height*.06, half=height*(NEUTRAL_GAP_FRACTION/2), mid=height/2, gk=isHome?height-edge:edge, forward=isHome?mid+half:mid-half;
  const out:PitchPosition[]=[];
  groups.forEach((row,rowIndex)=>{if(!row.length)return; const total=Math.max(groups.length-1,1),t=rowIndex/total,y=gk+t*(forward-gk),curve=rowCurveDepth(row.length,rowIndex,groups.length),rw=getRowWidth(row.length,rowIndex,groups.length),start=.5-rw/2,center=(row.length-1)/2;
    row.forEach((p,i)=>{const x=row.length===1?.5:start+rw*i/(row.length-1),d=center?(i-center)/center:0,curved=isHome?y-curve*(d*d-.35):y+curve*(d*d-.35);
      out.push({x:x*width,y:Math.min(Math.max(curved,isHome?mid+half*.4:edge*.5),isHome?height-edge*.5:mid-half*.4)});
    });
  });
  return out;
}
export function shortName(name:string){const parts=name.trim().split(/\s+/); return parts.length>1?parts.map(p=>p[0]).join('').slice(0,3).toUpperCase():name.slice(0,10);}
