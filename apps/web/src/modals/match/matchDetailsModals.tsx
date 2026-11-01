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
export interface MatchDetailsModalProps { visible:boolean; fixture:Fixture; userId:string; username:string; authToken?:string|null; presentation?:'details'|'watch'; onClose:()=>void; }

function formatTime(dateTime:string):string {
  try { const date=new Date(dateTime); if(Number.isNaN(date.getTime())) return ''; return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; } catch { return ''; }
}
function hasValidStatistics(data:any):boolean {
  const stats=data?.data??data;
  if(Array.isArray(stats?.statistics)) {
    const snapshots=stats.statistics;
    if(snapshots.length>0) { const latest=snapshots[snapshots.length-1],s=latest?.statistics??latest,home=s?.home??{},away=s?.away??{}; const positive=(value:unknown)=>value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>0;
      const fields=['possession','ball_possession','shots','total_shots','shotsOnTarget','shots_on_target','corners','fouls','offsides','yellowCards','yellow_cards','passAccuracy','pass_accuracy'];
      return fields.some(field=>positive(home?.[field])||positive(away?.[field])); }
    return false;
  }
  if(stats?.home||stats?.away||stats?.statistics?.home||stats?.statistics?.away){
    const nested=stats?.statistics?.home||stats?.statistics?.away?stats.statistics:stats;
    const home=nested?.home??{},away=nested?.away??{};
    const fields=['possession','ball_possession','shots','total_shots','shotsOnTarget','shots_on_target','corners','fouls','offsides','yellowCards','yellow_cards','passAccuracy','pass_accuracy'];
    return fields.some(field=>{const hv=home[field],av=away[field];return (hv!==null&&hv!==undefined&&Number.isFinite(Number(hv))&&Number(hv)>0)||(av!==null&&av!==undefined&&Number.isFinite(Number(av))&&Number(av)>0);});
  }
  const fields=['ball_possession_home','ball_possession_away','total_shots_home','total_shots_away','shots_on_target_home','shots_on_target_away','corners_home','corners_away','fouls_home','fouls_away','offsides_home','offsides_away','yellow_cards_home','yellow_cards_away','pass_accuracy_home','pass_accuracy_away'];
  return fields.some(field=>{const value=stats?.[field];return value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>0;});
}

export function MatchDetailsModal({visible,fixture,userId,username,authToken,presentation='details',onClose}:MatchDetailsModalProps) {
  const colors=useFanColors();
  const dialogRef=useRef<HTMLDivElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const peerRef=useRef<RTCPeerConnection|null>(null);
  const onCloseRef=useRef(onClose);
  useEffect(()=>{onCloseRef.current=onClose;},[onClose]);
  const [activeTab,setActiveTab]=useState<'lineups'|'stats'|'video'>('lineups');
  const [videoUrl,setVideoUrl]=useState('');
  const [videoError,setVideoError]=useState('');
  const [videoLoading,setVideoLoading]=useState(false);
  const swipeStart=useRef<{x:number;y:number}|null>(null);
  const [statistics,setStatistics]=useState<MatchStatistics|null>(null);
  const [lineups,setLineups]=useState<LineupsData|null>(null);
  const [lineupsMatchId,setLineupsMatchId]=useState<string|null>(null);
  const [loadingStats,setLoadingStats]=useState(true),[loadingLineups,setLoadingLineups]=useState(true);
  const [statsError,setStatsError]=useState(''),[lineupsError,setLineupsError]=useState('');
  const [hasStats,setHasStats]=useState(false);
  const liveStatisticsReceived=useRef(false);
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
      if(res.status===200) { const data=await res.json(); if(hasValidStatistics(data)) { if(!liveStatisticsReceived.current){setStatistics(parseMatchStatistics(data));setHasStats(true);}setLoadingStats(false);return; } }
      const fullRes=await fetch(`${API_BASE}/games/${fixture.matchId}/statistics`,{headers});
      if(fullRes.status===200) { const data=await fullRes.json(); if(data?.success===true) { const stats=data?.data??data; if(hasValidStatistics(stats)) { if(!liveStatisticsReceived.current){setStatistics(parseMatchStatistics(stats));setHasStats(true);}setLoadingStats(false);return; } } }
      if(!liveStatisticsReceived.current){setHasStats(false);setStatistics(null);setStatsError('Statistics available after match starts');}setLoadingStats(false);
    } catch(error) { console.warn('❌ Error fetching statistics:',error);if(!liveStatisticsReceived.current){setHasStats(false);setStatistics(null);setStatsError('Statistics coming soon');}setLoadingStats(false); }
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
    liveStatisticsReceived.current=false;setActiveTab(presentation==='watch'?'video':'lineups');setStatistics(null);setLoadingStats(true);if(lineupsMatchId!==fixture.matchId)setLoadingLineups(true);setStatsError('');setLineupsError('');setHasStats(false);
    if(presentation==='details'){void fetchLineups();void fetchStatistics();}
    return()=>{document.removeEventListener('keydown',keydown);previous?.focus();};
  // Fetch only when the modal opens or the selected match changes. Callback identity
  // must not restart loading and blank the pitch during ordinary parent re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible,fixture.matchId,presentation]);

  useEffect(()=>{
    setVideoUrl('');
    setVideoError('');
    if(videoRef.current)videoRef.current.srcObject=null;
    if(!visible||activeTab!=='video'||fixture.status!=='live')return;
    if(!authToken){setVideoError('Sign in to watch this live fixture.');return;}
    const controller=new AbortController();
    let peer:RTCPeerConnection|null=null;
    setVideoLoading(true);
    void (async()=>{
      try {
        const response=await fetch(`${API_BASE}/video/fixtures/${encodeURIComponent(fixture.matchId)}/grant`,{
          headers:{Authorization:`Bearer ${authToken}`},
          signal:controller.signal,
        });
        const payload=await response.json().catch(()=>null);
        if(!response.ok||payload?.success!==true||typeof payload?.hls_url!=='string')throw new Error(payload?.error||'Live playback is not available.');
        setVideoUrl(payload.hls_url);
        if(typeof RTCPeerConnection==='undefined'||typeof payload?.rtc_api_url!=='string'||typeof payload?.webrtc_url!=='string')return;

        const activePeer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
        peer=activePeer;
        peerRef.current=activePeer;
        activePeer.addTransceiver('audio',{direction:'recvonly'});
        activePeer.addTransceiver('video',{direction:'recvonly'});
        activePeer.ontrack=event=>{
          if(videoRef.current&&event.streams[0])videoRef.current.srcObject=event.streams[0];
        };
        await activePeer.setLocalDescription(await activePeer.createOffer());
        if(activePeer.iceGatheringState!=='complete'){
          await new Promise<void>((resolve,reject)=>{
            const timeout=window.setTimeout(()=>reject(new Error('Timed out preparing the low-latency connection.')),10000);
            const onState=()=>{
              if(activePeer.iceGatheringState==='complete'){
                window.clearTimeout(timeout);
                activePeer.removeEventListener('icegatheringstatechange',onState);
                resolve();
              }
            };
            activePeer.addEventListener('icegatheringstatechange',onState);
            controller.signal.addEventListener('abort',()=>{window.clearTimeout(timeout);reject(new DOMException('Aborted','AbortError'));},{once:true});
          });
        }
        const rtcResponse=await fetch(payload.rtc_api_url,{
          method:'POST',
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${payload.grant}`},
          body:JSON.stringify({api:payload.rtc_api_url,streamurl:payload.webrtc_url,clientip:null,sdp:activePeer.localDescription?.sdp}),
          signal:controller.signal,
        });
        const rtcPayload=await rtcResponse.json();
        if(!rtcResponse.ok||rtcPayload?.code!==0||typeof rtcPayload?.sdp!=='string')throw new Error('Low-latency playback is unavailable; using HLS fallback.');
        await activePeer.setRemoteDescription({type:'answer',sdp:rtcPayload.sdp});
      } catch(error) {
        if(!controller.signal.aborted){
          const message=error instanceof Error?error.message:'Unable to start live playback.';
          if(videoRef.current&&!videoRef.current.srcObject)setVideoError(message);
        }
      } finally {
        if(!controller.signal.aborted)setVideoLoading(false);
      }
    })();
    return()=>{
      controller.abort();
      peer?.close();
      if(peerRef.current===peer)peerRef.current=null;
      if(videoRef.current)videoRef.current.srcObject=null;
    };
  },[visible,activeTab,fixture.matchId,fixture.status,authToken]);

  // Subscribe to live statistics while the selected fixture is open. The
  // fixture room is leased independently so another screen can safely share it.
  useEffect(()=>{
    if(!visible||!fixture?.matchId)return;
    const channelId=webSocketService.getCurrentChannelId();
    const roomId=channelId?`${channelId}_${fixture.matchId}`:null;
    if(roomId)webSocketService.acquireRoom(roomId);
    const unsubscribe=webSocketService.onStatisticsUpdated(event=>{
      if(String(event.fixture_id)!==String(fixture.matchId))return;
      if(!hasValidStatistics(event.statistics))return;
      liveStatisticsReceived.current=true;setStatistics(parseMatchStatistics({statistics:event.statistics}));
      setHasStats(true);setStatsError('');setLoadingStats(false);
    });
    return()=>{unsubscribe();if(roomId)webSocketService.releaseRoom(roomId);};
  },[visible,fixture.matchId]);

  if(!visible||!fixture)return null;
  const home=fixture.homeScore??0,away=fixture.awayScore??0,isLive=fixture.status==='live';
  const watchMode=presentation==='watch';
  return createPortal(<div className={`fixed inset-0 z-[1000] flex ${watchMode?'items-center justify-center p-3 sm:p-6':'items-end justify-center'} bg-black/70`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${fixture.homeTeam} vs ${fixture.awayTeam} ${watchMode?'live stream':'match details'}`} className={`flex w-full flex-col overflow-hidden ${watchMode?'max-w-6xl rounded-2xl shadow-2xl':'max-w-2xl rounded-t-[20px]'}`} style={{height:watchMode?'85vh':'88vh',backgroundColor:colors.surface}}>
      <div className="flex justify-center pb-2 pt-3"><div className="h-1 w-10 rounded-full" style={{backgroundColor:colors.borderActive}}/></div>
      <header className={`flex items-center gap-3 px-4 pb-3 pt-1 ${watchMode?'border-b':''}`} style={watchMode?{borderColor:colors.border}:undefined}>
        <div className="min-w-0 flex-1 text-center"><p className="line-clamp-2" style={{...fanText('body',colors,colors.textPrimary),fontSize:11,fontWeight:400,lineHeight:'14px'}}>{fixture.homeTeam}</p>{isLive&&<span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-red-500" style={{background:'rgba(255,0,0,.12)'}}>LIVE</span>}</div>
        <div className="shrink-0 rounded-lg px-3.5 py-1.5" style={{backgroundColor:colors.background}}><span style={{...fanText('scoreHero',colors,colors.textPrimary),fontSize:18,fontWeight:400,lineHeight:'22px'}}>{home} - {away}</span></div>
        <div className="min-w-0 flex-1 text-center"><p className="line-clamp-2" style={{...fanText('body',colors,colors.textPrimary),fontSize:13,fontWeight:400,lineHeight:'17px'}}>{fixture.awayTeam}</p>{fixture.date&&<p className="mt-1" style={fanText('caption',colors,colors.textSecondary)}>{formatTime(fixture.date)}</p>}</div>
        <button type="button" onClick={onClose} aria-label="Close live viewer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl" style={{backgroundColor:colors.background,color:colors.textSecondary}}>×</button>
      </header>
      {!watchMode&&<div className="mx-4 flex border-b" style={{borderColor:'rgba(0,0,0,.1)'}}>
        {(['lineups',...(hasStats?['stats' as const]:[]),'video'] as const).map(tab=><button key={tab} type="button" onClick={()=>setActiveTab(tab)} className="relative flex-1 py-2.5 text-[13px] font-semibold tracking-wide" style={{color:activeTab===tab?colors.primary:colors.textSecondary}}>{tab.toUpperCase()}{activeTab===tab&&<span className="absolute inset-x-0 bottom-0 h-0.5 rounded" style={{backgroundColor:colors.primary}}/>}</button>)}
      </div>}
      <div
        className="no-scrollbar min-h-0 flex-1"
        onTouchStart={event=>{const touch=event.touches[0];swipeStart.current=touch?{x:touch.clientX,y:touch.clientY}:null;}}
        onTouchEnd={event=>{
          if(!hasStats){swipeStart.current=null;return;}
          const touch=event.changedTouches[0],start=swipeStart.current;swipeStart.current=null;
          if(!touch||!start)return;
          const deltaX=touch.clientX-start.x,deltaY=touch.clientY-start.y;
          if(Math.abs(deltaX)<56||Math.abs(deltaX)<Math.abs(deltaY)*1.25)return;
          setActiveTab(deltaX<0?'stats':'lineups');
        }}
        style={{touchAction:'pan-y'}}
      >
        {watchMode?<div className="flex h-full min-h-0 flex-1 flex-col gap-2 p-3 sm:p-5"><div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black">{videoUrl?<video ref={videoRef} key={videoUrl} src={videoUrl} controls autoPlay playsInline className="h-full w-full object-contain" />:<div className="flex h-full items-center justify-center px-5 text-center text-sm text-white">{videoLoading?'Connecting to live stream…':videoError||'No live stream is available for this fixture.'}</div>}</div><p className="shrink-0 text-center text-xs" style={{color:colors.textSecondary}}>{videoError||'Live stream · low-latency WebRTC with HLS fallback'}</p></div>:activeTab==='lineups'?<LineupsTab fixture={fixture} lineups={lineupsMatchId===fixture.matchId?lineups:null} loading={loadingLineups||lineupsMatchId!==fixture.matchId} error={lineupsMatchId===fixture.matchId?lineupsError:''}/>:activeTab==='stats'?hasStats&&statistics?<StatsTab homeTeam={fixture.homeTeam} awayTeam={fixture.awayTeam} statistics={statistics}/>:<p className="p-4 text-center text-xs" style={{color:colors.textSecondary}}>{loadingStats?'Loading statistics…':statsError}</p>:<div className="flex h-full min-h-0 flex-col justify-center gap-3 p-4"><div className="aspect-video w-full overflow-hidden rounded-xl bg-black">{videoUrl?<video ref={videoRef} key={videoUrl} src={videoUrl} controls autoPlay playsInline className="h-full w-full" />:<div className="flex h-full items-center justify-center px-5 text-center text-sm text-white">{videoLoading?'Connecting to live stream…':videoError||'No live stream is available for this fixture.'}</div>}</div><p className="text-center text-xs" style={{color:colors.textSecondary}}>{videoError||'Live video · WebRTC low latency / HLS fallback'}</p></div>}
      </div>
    </section>
  </div>,document.body);
}
