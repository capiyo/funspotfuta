import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Eye, EyeOff, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { createChannel } from '@funspot/core';
import { colors } from '@/theme';

const ADMIN_ACCENT='#F59E0B', MEMBER_ACCENT='#10B981', DANGER='#EF4444';
const API_BASE='https://clash-api-m5mr.onrender.com/api';
function authHeaders(authToken?:string|null):HeadersInit{return {'Content-Type':'application/json',...(authToken?{Authorization:`Bearer ${authToken}`}:{})};}
async function fetchAllProfiles(authToken?:string|null):Promise<any[]>{try{const res=await fetch(`${API_BASE}/profile/profiles`,{headers:authHeaders(authToken)});if(!res.ok)return[];const body:unknown=await res.json();return Array.isArray(body)?body:[];}catch(e){console.warn('fetchAllProfiles failed:',e);return[];}}
async function fetchAllChannels(authToken?:string|null):Promise<any[]>{try{const res=await fetch(`${API_BASE}/channels/all`,{headers:authHeaders(authToken)});if(!res.ok)return[];const body:unknown=await res.json();if(Array.isArray(body))return body;const asObj=body as {channels?:unknown}|null;return asObj&&Array.isArray(asObj.channels)?asObj.channels as any[]:[];}catch(e){console.warn('fetchAllChannels failed:',e);return[];}}

interface ChannelMembership {channelId:string;channelName:string;role:'admin'|'member';joinedAt:string|null;seasonPoints:number;correctVotes:number;totalVotes:number;msgCount:number;lastActiveAt:string|null;likesCount:number;}
interface UserProfile {id:string;userId:string;username:string;nickname:string;clubFan:string;countryFan:string;phone:string;balance:number;numberOfBets:number;channelHistory:ChannelMembership[];}
function membershipFromJson(json:any,channelId:string,channelName:string):ChannelMembership{return {channelId,channelName,role:(json?.role?.toString()??'member') as 'admin'|'member',joinedAt:json?.joined_at?.toString()??null,seasonPoints:Number(json?.season_points??0),correctVotes:Number(json?.correct_votes??0),totalVotes:Number(json?.total_votes??0),msgCount:Number(json?.msg_count??0),lastActiveAt:json?.last_active_at?.toString()??null,likesCount:Number(json?.likes_count??0)};}
function userProfileFromJson(json:any):UserProfile{return {id:json?._id?.toString()??json?.id?.toString()??'',userId:json?.user_id?.toString()??'',username:json?.username?.toString()??'',nickname:json?.nickname?.toString()??json?.username?.toString()??'User',clubFan:json?.club_fan?.toString()??'Football Fan',countryFan:json?.country_fan?.toString()??'World',phone:json?.phone?.toString()??'',balance:Number(json?.balance??0),numberOfBets:Number(json?.number_of_bets??0),channelHistory:[]};}
function withAlpha(hex:string,alpha:number):string{const c=hex.replace('#','');if(c.length!==6)return hex;const r=parseInt(c.substring(0,2),16),g=parseInt(c.substring(2,4),16),b=parseInt(c.substring(4,6),16);return `rgba(${r}, ${g}, ${b}, ${alpha})`;}

export default function CreateChannelModal({visible,onClose,onChannelCreated}:{visible:boolean;onClose:()=>void;onChannelCreated:()=>void}) {
 const {userId,username,authToken}=useAuth(); const toast=useToast(); const dialogRef=useRef<HTMLDivElement>(null);
 const [channelName,setChannelName]=useState(''),[searchQuery,setSearchQuery]=useState('');
 const [allUsers,setAllUsers]=useState<UserProfile[]>([]),[selectedMembers,setSelectedMembers]=useState<UserProfile[]>([]);
 const [loading,setLoading]=useState(true),[creating,setCreating]=useState(false),[showOnlyAvailable,setShowOnlyAvailable]=useState(false);
 useEffect(()=>{if(!visible)return;setChannelName('');setSearchQuery('');setSelectedMembers([]);setShowOnlyAvailable(false);},[visible]);
 const loadUsers=useCallback(async()=>{
  if(!visible||!userId)return;setLoading(true);
  try {
   const [profiles,channels]=await Promise.all([fetchAllProfiles(authToken),fetchAllChannels(authToken)]);
   const users=(Array.isArray(profiles)?profiles:[]).map((p:any)=>userProfileFromJson(p)).filter((u:UserProfile)=>u.userId&&u.userId!==userId);
   const historyByUserId:Record<string,ChannelMembership[]>={};
   for(const rawChannel of channels){
    if(!rawChannel||typeof rawChannel!=='object')continue;
    const channelId=rawChannel.channel_id?.toString()??rawChannel._id?.toString()??'';
    const channelName=rawChannel.name?.toString()??'Channel';
    const members=Array.isArray(rawChannel.members)?rawChannel.members:[];
    for(const rawMember of members){if(!rawMember||typeof rawMember!=='object')continue;const memberUserId=rawMember.user_id?.toString()??'';if(!memberUserId)continue;if(!historyByUserId[memberUserId])historyByUserId[memberUserId]=[];historyByUserId[memberUserId].push(membershipFromJson(rawMember,channelId,channelName));}
   }
   for(const user of users)user.channelHistory=historyByUserId[user.userId]??[];
   setAllUsers(users);
  }catch(e:any){toast.showError(`Error loading users: ${e?.message??String(e)}`);}finally{setLoading(false);}
 },[visible,userId,authToken,toast]);
 useEffect(()=>{if(visible)void loadUsers();},[visible,userId,loadUsers]);
 useEffect(()=>{
  if(!visible)return;const previous=document.activeElement as HTMLElement|null;dialogRef.current?.querySelector<HTMLElement>('input')?.focus();
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();if(event.key!=='Tab'||!dialogRef.current)return;const items=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));if(!items.length)return;if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus();}else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus();}};
  document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
 },[visible,onClose]);
 const filteredUsers=useMemo(()=>{const q=searchQuery.trim().toLowerCase(),selectedIds=new Set(selectedMembers.map(m=>m.userId));return allUsers.filter(u=>{const matchesSearch=q.length===0||u.nickname.toLowerCase().includes(q)||u.username.toLowerCase().includes(q)||u.clubFan.toLowerCase().includes(q)||u.countryFan.toLowerCase().includes(q);return matchesSearch&&(showOnlyAvailable?!selectedIds.has(u.userId):true);});},[allUsers,searchQuery,selectedMembers,showOnlyAvailable]);
 function toggleMember(user:UserProfile){setSelectedMembers(prev=>prev.some(m=>m.userId===user.userId)?prev.filter(m=>m.userId!==user.userId):[...prev,user]);}
 async function handleCreate(){
  const name=channelName.trim();if(!name){toast.showError('Please enter a channel name');return;}if(selectedMembers.length===0){toast.showError('Please select at least one member');return;}if(!authToken){toast.showError('You must be logged in to create a channel');return;}
  setCreating(true);try{const members=selectedMembers.map(u=>({id:u.userId,username:u.username}));const result=await createChannel({name,createdBy:userId??'',createdByUsername:username??'',season:'2024',members,authToken});if(result.success){const inviteCode=result.data?.invite_code;const invite=inviteCode?` Invite: ${inviteCode}`:'';toast.showSuccess(`✅ Channel created!${invite}`);onChannelCreated();onClose();}else toast.showError(result.message??'Failed to create channel');}catch(e:any){toast.showError(`Error: ${e?.message??String(e)}`);}finally{setCreating(false);}
 }
 if(!visible)return null;
 const canCreate=channelName.trim().length>0&&selectedMembers.length>0;
 return createPortal(<div className="fixed inset-0 z-[960] flex items-end justify-center bg-black/55" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create Channel" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl" style={{background:colors.surface}}>
   <div className="flex justify-center pb-2 pt-3"><div className="h-1 w-8 rounded-full" style={{background:colors.border}}/></div>
   <header className="flex items-center gap-3 px-4 pb-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{background:withAlpha(MEMBER_ACCENT,.12)}}><UserPlus size={20} color={MEMBER_ACCENT}/></div>
    <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-white">Create Channel</h2><p className="text-[11px]" style={{color:colors.textMuted}}>Add members to your group</p></div>
    <button type="button" aria-label="Close" onClick={onClose} disabled={creating} className="rounded-full p-2"><X size={16} color={colors.textMuted}/></button>
   </header>
   <div className="flex items-center gap-2 px-4 pb-3"><Users size={16} color={colors.textMuted}/><input value={channelName} onChange={e=>setChannelName(e.target.value)} disabled={creating} placeholder="Enter channel name…" className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm text-white outline-none" style={{borderColor:colors.border,background:colors.bg}}/></div>
   <div className="flex items-center justify-between px-4 pb-2"><h3 className="text-[11px] font-bold" style={{color:colors.textSecondary}}>Add Members ({selectedMembers.length})</h3><button type="button" onClick={()=>setShowOnlyAvailable(v=>!v)} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px]" style={{borderColor:colors.border,color:showOnlyAvailable?MEMBER_ACCENT:colors.textMuted}}>{showOnlyAvailable?<Eye size={14}/>:<EyeOff size={14}/ >}{showOnlyAvailable?'Available':'All'}</button></div>
   <div className="flex items-center gap-2 px-4 pb-3"><Search size={16} color={colors.textMuted}/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} disabled={creating} placeholder="Search by name, club, or country…" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm text-white outline-none" style={{borderColor:colors.border,background:colors.bg}}/></div>
   <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
    {loading?<div className="flex flex-col items-center justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:MEMBER_ACCENT}}/><p className="mt-2 text-xs" style={{color:colors.textMuted}}>Loading users…</p></div>:filteredUsers.length===0?<div className="flex flex-col items-center justify-center py-10"><AlertCircle size={32} color={colors.textMuted}/><p className="mt-2 text-sm text-white">{searchQuery?'No matching users found':'No users available'}</p><p className="mt-1 text-xs" style={{color:colors.textMuted}}>{searchQuery?'Try a different search term':'Check back later'}</p></div>:filteredUsers.map(user=><UserTile key={user.userId} user={user} selected={selectedMembers.some(m=>m.userId===user.userId)} onToggle={()=>toggleMember(user)}/>)}
   </div>
   {selectedMembers.length>0&&<div className="flex gap-2 overflow-x-auto px-4 py-2">{selectedMembers.map(u=><span key={u.userId} className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px]" style={{background:withAlpha(MEMBER_ACCENT,.12),color:MEMBER_ACCENT}}>{u.nickname}<button type="button" onClick={()=>toggleMember(u)} aria-label={`Remove ${u.nickname}`}><X size={12}/></button></span>)}</div>}
   <footer className="flex gap-3 border-t p-4" style={{borderColor:colors.border}}><button type="button" onClick={onClose} disabled={creating} className="flex-1 rounded-xl border py-3 text-sm font-semibold" style={{borderColor:colors.border,color:colors.textSecondary}}>Cancel</button><button type="button" onClick={()=>void handleCreate()} disabled={creating||!canCreate} className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50" style={{background:canCreate?MEMBER_ACCENT:colors.textMuted}}>{creating?'Creating…':selectedMembers.length===0?'Select Members':`Create Channel (${selectedMembers.length})`}</button></footer>
  </section>
 </div>,document.body);
}

function UserTile({user,selected,onToggle}:{user:UserProfile;selected:boolean;onToggle:()=>void}) {
 const history=user.channelHistory,isAnyAdmin=history.some(m=>m.role==='admin'),totalPoints=history.reduce((s,m)=>s+m.seasonPoints,0),totalVotes=history.reduce((s,m)=>s+m.totalVotes,0),totalCorrect=history.reduce((s,m)=>s+m.correctVotes,0),accuracy=totalVotes>0?totalCorrect/totalVotes*100:0,accent=isAnyAdmin?ADMIN_ACCENT:MEMBER_ACCENT;
 const statusLabel=history.length===0?'NEW':isAnyAdmin?'ADMIN ELSEWHERE':'MEMBER ELSEWHERE',statusBg=history.length===0?withAlpha(colors.textMuted,.6):accent;
 return <button type="button" onClick={onToggle} className="mb-2 w-full rounded-xl border p-3 text-left" style={{background:selected?withAlpha(MEMBER_ACCENT,.08):colors.surface,borderColor:selected?withAlpha(MEMBER_ACCENT,.3):colors.border}}>
  <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold" style={{borderColor:selected?MEMBER_ACCENT:colors.border,color:MEMBER_ACCENT}}>{(user.nickname?.[0]??'?').toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-white">{user.nickname}</p><p className="truncate text-[11px]" style={{color:colors.textMuted}}>@{user.username}</p></div><span className="flex h-6 w-6 items-center justify-center rounded-md border" style={{background:selected?MEMBER_ACCENT:colors.surface,borderColor:selected?MEMBER_ACCENT:colors.border}}>{selected?<Check size={14} color="#fff"/>:<Plus size={14} color={colors.textMuted}/>}</span></div>
  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">{[[ 'Club',user.clubFan ],['Country',user.countryFan],...(history.length? [['Channels',String(history.length)],['Points',String(totalPoints)]]:[])].map(([label,value])=><div key={label} className="flex items-center justify-between gap-2"><span className="text-[9px]" style={{color:colors.textMuted}}>{label}</span><span className="truncate text-[10px]" style={{color:label==='Points'?MEMBER_ACCENT:colors.textSecondary}}>{value}</span></div>)}</div>
  <div className="mt-3 flex items-center gap-2"><span className="rounded px-2 py-1 text-[8px] font-bold tracking-wide text-white" style={{background:statusBg}}>{statusLabel}</span>{history.length>0&&<div className="h-1 flex-1 overflow-hidden rounded-full" style={{background:colors.border}}><div className="h-full" style={{width:`${Math.max(0,Math.min(100,accuracy))}%`,background:accent}}/></div>}</div>
 </button>;
}
