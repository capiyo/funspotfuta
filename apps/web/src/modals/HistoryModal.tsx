import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchHistoryGames, type HistoryGame, FAN_SPACING } from '@funspot/core';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from './Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { HistoryCard, type HistoryCardData, type VoterMini } from '@/components/HistoryCard';
import { AftermatchReviewModal } from '@/modals/AftermatchModal';
import { EmptyState, PagingFooter, SkeletonRows } from '@/components/ui/ListsStates';

const PAGE_SIZE = 20;
const MOCK_COMMENTORS = ['Kevo','Aisha','Brian','Faith','Otieno','Wanjiru','Denis','Nadia','Mutiso','Cheryl'];
const MOCK_COMMENTS = ['What a match that was','Saw that result coming honestly','Ref had a shocker today','That comeback was unreal','Told you they had this','Rough one to watch as a fan','Man of the match no debate','Deserved the win in the end','That second half was rough','Book the final ticket already'];

function hashSeed(seed: string): number { let h = 0; for (let i=0;i<seed.length;i++) h=(h*31+seed.charCodeAt(i))>>>0; return h||1; }
function seededPick<T>(pool:T[], seed:string, n:number):T[] {
  let h=hashSeed(seed); const used=new Set<number>(); const picks:T[]=[];
  while(picks.length<n&&used.size<pool.length){h=(h*1103515245+12345)>>>0;let idx=h%pool.length;while(used.has(idx))idx=(idx+1)%pool.length;used.add(idx);picks.push(pool[idx]);}
  return picks;
}
function mockCommentsFor(gameId:string){const names=seededPick(MOCK_COMMENTORS,gameId,2);const lines=seededPick(MOCK_COMMENTS,gameId+'#lines',2);return names.map((username,i)=>({username,text:lines[i]}));}
function pickKindOf(selection:string|undefined):'home'|'away'|'draw'{return selection==='home_team'||selection==='home'?'home':selection==='away_team'||selection==='away'?'away':'draw';}
function buildPeople(g:HistoryGame):VoterMini[]{
  const label=(kind:'home'|'away'|'draw')=>kind==='home'?g.homeTeam:kind==='away'?g.awayTeam:'Draw';
  const voters=((g as any).voters??[]) as Array<{id:string;name:string;selection?:string}>;
  const pledges=((g as any).pledges??[]) as Array<{userId?:string;userName?:string;selection?:string}>;
  const comments=((g as any).comments??[]) as Array<{id?:string;userId?:string;username?:string;selection?:string}>;
  const people:VoterMini[]=[];
  for(const v of voters.slice(0,3)){const kind=pickKindOf(v.selection);people.push({id:v.id,name:v.name,role:'voted',pick:label(kind),pickKind:kind});}
  if(!people.length)for(const p of pledges.slice(0,3)){const kind=pickKindOf(p.selection);people.push({id:p.userId??'pledge-'+people.length,name:p.userName??'Fan',role:'pledged',pick:label(kind),pickKind:kind});}
  if(!people.length)for(const c of comments.slice(0,3)){const kind=pickKindOf(c.selection);people.push({id:c.id??c.userId??'comment-'+people.length,name:c.username??'Anonymous',role:'commented',pick:label(kind),pickKind:kind});}
  return people;
}
function timeAgoLabel(g:HistoryGame):string{
  const raw=(g as any).dateIso??(g as any).date;if(!raw)return '—';const then=new Date(raw).getTime();if(Number.isNaN(then))return '—';
  const mins=Math.floor((Date.now()-then)/60000);if(mins<1)return 'Now';if(mins<60)return mins+'m';const hrs=Math.floor(mins/60);if(hrs<24)return hrs+'h';const days=Math.floor(hrs/24);if(days===1)return 'Yesterday';if(days<7)return days+'d';
  return new Date(then).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function commentsOf(g:HistoryGame){
  const real=(((g as any).comments??[]) as any[]).map(c=>({username:c.username??c.userName??'Fan',text:c.text??c.comment??''})).filter(c=>c.text);
  return real.length?real:mockCommentsFor(g.id);
}
function toCardData(g:HistoryGame):HistoryCardData{
  const people=buildPeople(g),comments=commentsOf(g);
  return {id:g.id,homeTeam:g.homeTeam,awayTeam:g.awayTeam,homeScore:g.homeScore??0,awayScore:g.awayScore??0,timeAgo:timeAgoLabel(g),league:(g as any).league??undefined,people,voteCount:(g as any).votes??((g as any).voters?.length||people.length),comments,latestComment:(g as any).latestComment??null,commentCount:(g as any).commentCount??comments.length,likesCount:(g as any).likesCount??0};
}

export default function HistoryModal({visible,onClose}:{visible:boolean;onClose:()=>void}){
  const colors=useFanColors();const dialog=useRef<HTMLDivElement>(null);const navigate=useNavigate();
  const {userId,username,authToken,isLoggedIn}=useAuth();const {requireLogin}=useLoginModal();
  const [reviewGame,setReviewGame]=useState<HistoryGame|null>(null);
  const {data,isPending,isError,isFetchingNextPage,hasNextPage,fetchNextPage,refetch}=useInfiniteQuery({
    queryKey:['history'],queryFn:({pageParam})=>fetchHistoryGames({limit:PAGE_SIZE,skip:pageParam}),
    initialPageParam:0,getNextPageParam:(lastPage,allPages)=>lastPage.length===PAGE_SIZE?allPages.length*PAGE_SIZE:undefined,
    placeholderData:keepPreviousData,retry:1,enabled:visible,
  });
  const games=useMemo(()=>data?.pages.flat()??[],[data]);
  const cards=useMemo(()=>games.map(g=>({g,card:toCardData(g)})),[games]);
  useEffect(()=>{if(!visible)return;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};},[visible,onClose]);
  function openChat(g:HistoryGame){if(!isLoggedIn)return requireLogin(()=>openChat(g));const channelId=(g as any).channelId??'';if(!channelId)return;onClose();navigate('/messages/'+encodeURIComponent(channelId)+'?fixtureId='+encodeURIComponent(g.id));}
  function openResults(g:HistoryGame){if(!isLoggedIn)return requireLogin(()=>openResults(g));setReviewGame(g);}
  function handleLike(_id:string){if(!userId)return;}
  function handleSubmitComment(_id:string,_text:string){if(!userId||!username)return;}
  if(!visible)return null;
  return <>{createPortal(<div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="History" className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl" style={{background:colors.background,color:colors.textPrimary}}>
      <div className="flex justify-center pb-2 pt-4"><div className="h-[3px] w-8 rounded-full" style={{background:colors.border}}/></div>
      <header className="flex items-center gap-3 px-5 pb-4"><div className="min-w-0 flex-1"><h2 style={fanText('title',colors,colors.textPrimary)}>History</h2><p style={{...fanText('tag',colors,colors.textTertiary),marginTop:1}}>{cards.length>0?`${cards.length} game${cards.length===1?'':'s'}`:'Completed matches'}</p></div><button type="button" aria-label="Close history" onClick={onClose} className="rounded-full p-2" style={{background:colors.inputSurface}}><X size={14}/></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6" onScroll={e=>{const el=e.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<el.clientHeight*.5&&hasNextPage&&!isFetchingNextPage)void fetchNextPage();}}>
        {isPending&&cards.length===0?<SkeletonRows colors={colors}/>:isError&&cards.length===0?<EmptyState colors={colors} title="You're offline" hint="Pull down to retry once you're back online."/>:cards.length===0?<EmptyState colors={colors} title="No history found"/>:cards.map(({g,card})=><div key={g.id} className="mb-3"><HistoryCard data={card} onOpenResults={()=>openResults(g)} onOpenChat={()=>openChat(g)} onLike={()=>handleLike(g.id)} onSubmitComment={handleSubmitComment}/></div>)}
        {isError&&cards.length>0&&<p role="status" className="py-3 text-center text-xs" style={{color:colors.textTertiary}}>Showing cached history. Refresh when you're back online.</p>}
        <PagingFooter colors={colors} loading={isFetchingNextPage}/>
        {hasNextPage&&!isFetchingNextPage&&<button className="w-full py-3 text-xs" style={{color:colors.primary}} onClick={()=>void fetchNextPage()}>Load more</button>}
        {isError&&cards.length===0&&<button className="mt-3 w-full rounded-lg border p-3 text-xs" style={{borderColor:colors.border}} onClick={()=>void refetch()}>Retry</button>}
      </div>
    </section>
  </div>,document.body)}
  {reviewGame&&<AftermatchReviewModal visible fixture={reviewGame as any} userId={userId??''} username={username??''} authToken={authToken} channelId={(reviewGame as any).channelId??''} isLoggedIn={!!isLoggedIn} onClose={()=>setReviewGame(null)}/>}</>;
}
