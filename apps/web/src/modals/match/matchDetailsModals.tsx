import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FAN_RADIUS, FAN_SPACING, webSocketService } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';
import type { MatchStatistics, LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { parseMatchStatistics, parseLineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { LineupsTab } from './lineupsTab';
import { StatsTab } from './statsTab';

const API_BASE='https://clash-api-m5mr.onrender.com/api';
export interface MatchDetailsModalProps { visible:boolean; fixture:Fixture; userId:string; username:string; authToken?:string|null; onClose:()=>void; }

function formatTime(dateTime:string):string {
  try { const date=new Date(dateTime); if(Number.isNaN(date.getTime())) return ''; return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; } catch { return ''; }
}
function hasValidStatistics(data:any):boolean {
  const stats=data?.data??data;
  if(Array.isArray(stats?.statistics)) {
    const snapshots=stats.statistics;
    if(snapshots.length>0) { const latest=snapshots[snapshots.length-1],s=latest?.statistics??latest,home=s?.home??{},away=s?.away??{}; return (home?.possession??0)>0||(away?.possession??0)>0||(home?.shots??0)>0||(away?.shots??0)>0; }
    return false;
  }
  return (stats?.ball_possession_home??0)>0||(stats?.ball_possession_away??0)>0||(stats?.total_shots_home??0)>0||(stats?.total_shots_away??0)>0;
}

export function MatchDetailsModal({visible,fixture,userId,username,authToken,onClose}:MatchDetailsModalProps) {
  const colors=useFanColors();
  const dialogRef=useRef<HTMLDivElement>(null);
  const onCloseRef=useRef(onClose);
  useEffect(()=>{onCloseRef.current=onClose;},[onClose]);
  const [activeTab,setActiveTab]=useState<'lineups'|'stats'>('lineups');
  const [statistics,setStatistics]=useState<MatchStatistics|null>(null);
  const [lineups,setLineups]=useState<LineupsData|null>(null);
  const [lineupsMatchId,setLineupsMatchId]=useState<string|null>(null);
  const [loadingStats,setLoadingStats]=useState(true),[loadingLineups,setLoadingLineups]=useState(true);
  const [statsError,setStatsError]=useState(''),[lineupsError,setLineupsError]=useState('');
  const [hasStats,setHasStats]=useState(false);
  const fetchLineups=useCallback(async()=>{
    const headers=authToken?{Authorization:`Bearer ${authToken}`}:undefined;
    if(lineupsMatchId!==fixture.matchId)setLoadingLineups(true);setLineupsError('');
    try {
      const res=await fetch(`${API_BASE}/games/${fixture.matchId}/lineups`,{headers});
      if(res.status===200) { const data=await res.json(); if(data?.success===true&&data?.data!=null) { setLineups(parseLineupsData(data.data));setLineupsMatchId(fixture.matchId);setLoadingLineups(false);return; } }
      const fallbackRes=await fetch(`${API_BASE}/games/${fixture.matchId}/lineups/simplified`,{headers});
      if(fallbackRes.status===200) { const data=await fallbackRes.json(); if(data?.success===true&&data?.data!=null) { setLineups(parseLineupsData(data.data));setLineupsMatchId(fixture.matchId);setLoadingLineups(false);return; } }
      setLineupsMatchId(fixture.matchId);setLineupsError('No lineup available');setLoadingLineups(false);
    } catch(error) { console.warn('❌ Error fetching lineups:',error);setLineupsMatchId(fixture.matchId);setLineupsError('No network error');setLoadingLineups(false); }
  },[fixture.matchId,authToken,lineupsMatchId]);

  const fetchStatistics=useCallback(async()=>{
    const headers=authToken?{Authorization:`Bearer ${authToken}`}:undefined;
    setLoadingStats(true);setStatsError('');
    try {
      const res=await fetch(`${API_BASE}/games/${fixture.matchId}/statistics/latest`,{headers});
      if(res.status===200) { const data=await res.json(); if(hasValidStatistics(data)) { setStatistics(parseMatchStatistics(data));setHasStats(true);setLoadingStats(false);return; } }
      const fullRes=await fetch(`${API_BASE}/games/${fixture.matchId}/statistics`,{headers});
      if(fullRes.status===200) { const data=await fullRes.json(); if(data?.success===true) { const stats=data?.data??data; if(hasValidStatistics(stats)) { setStatistics(parseMatchStatistics(stats));setHasStats(true);setLoadingStats(false);return; } } }
      setHasStats(false);setStatistics(null);setStatsError('Statistics available after match starts');setLoadingStats(false);
    } catch(error) { console.warn('❌ Error fetching statistics:',error);setHasStats(false);setStatistics(null);setStatsError('Statistics coming soon');setLoadingStats(false); }
  },[fixture.matchId,authToken]);

  useEffect(()=>{
    if(!visible)return;
    const previous=document.activeElement as HTMLElement|null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape')onCloseRef.current();
      if(event.key!=='Tab'||!dialogRef.current)return;
      const items=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)'));
      if(!items.length)return;
      if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus();}
      else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus();}
    };
    document.addEventListener('keydown',keydown);
    setActiveTab('lineups');setStatistics(null);setLoadingStats(true);if(lineupsMatchId!==fixture.matchId)setLoadingLineups(true);setStatsError('');setLineupsError('');setHasStats(false);
    void fetchLineups();void fetchStatistics();
    return()=>{document.removeEventListener('keydown',keydown);previous?.focus();};
  // Fetch only when the modal opens or the selected match changes. Callback identity
  // must not restart loading and blank the pitch during ordinary parent re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible,fixture.matchId]);

  // Subscribe to live statistics while the selected fixture is open. The
  // fixture room is leased independently so another screen can safely share it.
  useEffect(()=>{
    if(!visible||!fixture?.matchId)return;
    const channelId=webSocketService.getCurrentChannelId();
    const roomId=channelId?`${channelId}_${fixture.matchId}`:null;
    if(roomId)webSocketService.acquireRoom(roomId);
    const unsubscribe=webSocketService.onStatisticsUpdated(event=>{
      if(String(event.fixture_id)!==String(fixture.matchId))return;
      setStatistics(parseMatchStatistics({statistics:event.statistics}));
      setHasStats(true);setStatsError('');setLoadingStats(false);
    });
    return()=>{unsubscribe();if(roomId)webSocketService.releaseRoom(roomId);};
  },[visible,fixture.matchId]);

  if(!visible||!fixture)return null;
  const home=fixture.homeScore??0,away=fixture.awayScore??0,isLive=fixture.status==='live';
  return createPortal(<div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${fixture.homeTeam} vs ${fixture.awayTeam} match details`} className="flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[20px]" style={{height:'88vh',backgroundColor:colors.surface}}>
      <div className="flex justify-center pb-2 pt-3"><div className="h-1 w-10 rounded-full" style={{backgroundColor:colors.borderActive}}/></div>
      <header className="flex items-center gap-3 px-4 pb-3 pt-1">
        <div className="min-w-0 flex-1 text-center"><p className="line-clamp-2" style={{...fanText('body',colors,colors.textPrimary),fontSize:11,fontWeight:400,lineHeight:'14px'}}>{fixture.homeTeam}</p>{isLive&&<span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-red-500" style={{background:'rgba(255,0,0,.12)'}}>LIVE</span>}</div>
        <div className="shrink-0 rounded-lg px-3.5 py-1.5" style={{backgroundColor:colors.background}}><span style={{...fanText('scoreHero',colors,colors.textPrimary),fontSize:18,fontWeight:400,lineHeight:'22px'}}>{home} - {away}</span></div>
        <div className="min-w-0 flex-1 text-center"><p className="line-clamp-2" style={{...fanText('body',colors,colors.textPrimary),fontSize:13,fontWeight:400,lineHeight:'17px'}}>{fixture.awayTeam}</p>{fixture.date&&<p className="mt-1" style={fanText('caption',colors,colors.textSecondary)}>{formatTime(fixture.date)}</p>}</div>
      </header>
      {hasStats&&<div className="mx-4 flex border-b" style={{borderColor:'rgba(0,0,0,.1)'}}>
        {(['lineups','stats'] as const).map(tab=><button key={tab} type="button" onClick={()=>setActiveTab(tab)} className="relative flex-1 py-2.5 text-[13px] font-semibold tracking-wide" style={{color:activeTab===tab?colors.primary:colors.textSecondary}}>{tab==='lineups'?'LINEUPS':'STATS'}{activeTab===tab&&<span className="absolute inset-x-0 bottom-0 h-0.5 rounded" style={{backgroundColor:colors.primary}}/>}</button>)}
      </div>}
      <div className="no-scrollbar min-h-0 flex-1">
        {activeTab==='lineups'?<LineupsTab fixture={fixture} lineups={lineupsMatchId===fixture.matchId?lineups:null} loading={loadingLineups||lineupsMatchId!==fixture.matchId} error={lineupsMatchId===fixture.matchId?lineupsError:''}/>:hasStats&&statistics?<StatsTab homeTeam={fixture.homeTeam} awayTeam={fixture.awayTeam} statistics={statistics}/>:<p className="p-4 text-center text-xs" style={{color:colors.textSecondary}}>{loadingStats?'Loading statistics…':statsError}</p>}
      </div>
    </section>
  </div>,document.body);
}
