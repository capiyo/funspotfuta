import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, AlertCircle, Check, CheckCircle2, Globe2, Info, Search,
  Trophy, User as UserIcon, Users, X,
} from 'lucide-react';
import { FAN_SPACING, FAN_RADIUS, type Channel } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { useToast } from '@/lib/toast/toast-context';
import { NotificationService } from '@/lib/api/notification-service';
import AdSenseCarousel from '@/components/AdSenseCarousel';
import { ComradeCard } from './comradeCard';
import { comradeProfileFromJson, type ComradeProfile } from './types';

const API_BASE = 'https://clash-api-m5mr.onrender.com/api';
const MAX_CHANNELS = 3;
type Screen = 'list' | 'picker' | 'profile';

export interface ComradeListModalProps {
  visible: boolean;
  onClose: () => void;
  /** IDs of users already in the current user's comrades graph. */
  comradesList: string[];
  /** Channels the current user belongs to. */
  userChannels: Channel[];
  onComradeAdded?: () => void;
}

function alpha(hex: string, opacity: number) {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useFanColors();
  return <div className="min-w-0 flex-1 rounded-xl border p-3 text-center" style={{ borderColor: alpha(colors.border, .3), background: alpha(colors.surfaceElevated, .6) }}>
    <div className="truncate text-base font-bold" style={{ color }}>{value}</div>
    <div className="mt-1 text-[10px]" style={{ color: colors.textTertiary }}>{label}</div>
  </div>;
}

export default function ComradeListModal({
  visible, onClose, comradesList, userChannels, onComradeAdded,
}: ComradeListModalProps) {
  const colors = useFanColors();
  const { userId, authToken } = useAuth();
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>('list');
  const [comrades, setComrades] = useState<ComradeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeComrade, setActiveComrade] = useState<ComradeProfile | null>(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<ComradeProfile | null>(null);

  const adminChannels = useMemo(() => userChannels.filter((channel) => channel.isAdmin), [userChannels]);
  const hasAdminChannels = adminChannels.length > 0;
  const remainingSlots = MAX_CHANNELS - userChannels.length;
  const isFull = remainingSlots <= 0;
  const comradeIdSet = useMemo(() => new Set(comradesList), [comradesList]);
  const filteredComrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return comrades;
    return comrades.filter((comrade) =>
      comrade.nickname.toLowerCase().includes(query) ||
      comrade.username.toLowerCase().includes(query) ||
      comrade.clubFan.toLowerCase().includes(query));
  }, [comrades, searchQuery]);

  const fetchComrades = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      };
      const response = await fetch(`${API_BASE}/profile/profiles`, { headers });
      if (response.status === 200) {
        const data: unknown = await response.json();
        const profiles = (Array.isArray(data) ? data : [])
          .filter((item: any) => item?.user_id?.toString() !== userId)
          .map((item: any) => comradeProfileFromJson(item));
        setComrades(profiles);
      } else {
        setError('Failed to load comrades');
      }
    } catch (cause) {
      setError(`Network error: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setLoading(false);
    }
  }, [userId, authToken]);

  useEffect(() => {
    if (!visible) return;
    setScreen('list');
    setSearchQuery('');
    setActiveComrade(null);
    setSelectedChannelIds(new Set());
    setViewingProfile(null);
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('input,button')?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    if (userId) void fetchComrades();
    else setLoading(false);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [visible, userId, fetchComrades, onClose]);

  function isUserInChannel(targetUserId: string, channelId: string) {
    const channel = userChannels.find((item) => item.channelId === channelId);
    return Boolean(channel?.members?.some((member) => member.userId === targetUserId));
  }
  function channelName(channelId: string) {
    return userChannels.find((channel) => channel.channelId === channelId)?.name ?? 'Unknown';
  }
  function openPicker(comrade: ComradeProfile) {
    if (isFull) {
      toast.showWarning(`${comrade.nickname} already has 3 channels`);
      return;
    }
    setActiveComrade(comrade);
    setSelectedChannelIds(new Set());
    setScreen('picker');
  }
  function openProfile(comrade: ComradeProfile) {
    setViewingProfile(comrade);
    setScreen('profile');
  }
  function backToList() {
    setScreen('list');
    setActiveComrade(null);
    setSelectedChannelIds(new Set());
    setViewingProfile(null);
  }
  function toggleChannel(channelId: string) {
    setSelectedChannelIds((current) => {
      const next = new Set(current);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }

  async function addToChannels(comrade: ComradeProfile) {
    if (!authToken || selectedChannelIds.size === 0) return;
    setProcessing(true);
    const results: Array<{ success: boolean; message: string }> = [];
    const headers = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };
    try {
      for (const channelId of selectedChannelIds) {
        if (isUserInChannel(comrade.id, channelId)) {
          results.push({ success: false, message: 'Already in channel' });
          continue;
        }
        try {
          const response = await fetch(`${API_BASE}/channels/members/add`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ channel_id: channelId, members: [{ user_id: comrade.id, username: comrade.username }] }),
          });
          if (response.status === 200 || response.status === 201) {
            results.push({ success: true, message: 'Added successfully' });
            void NotificationService.sendNotification({
              userId: comrade.id, notificationType: 'comrade_added',
              title: "🎉 You've been added!",
              body: `You were added to ${channelName(channelId)}`,
              data: { type: 'comrade_added' },
            });
          } else {
            let message = 'Failed to add';
            try { const body = await response.json(); message = body?.message ?? message; } catch { /* response may not be JSON */ }
            results.push({ success: false, message });
          }
        } catch (cause) {
          results.push({ success: false, message: cause instanceof Error ? cause.message : 'Network error' });
        }
      }
      const successCount = results.filter((result) => result.success).length;
      const failCount = results.length - successCount;
      if (successCount > 0) {
        toast.showSuccess(`Added to ${successCount} ${successCount === 1 ? 'channel' : 'channels'}${failCount > 0 ? ` (${failCount} failed)` : ''}`);
        onComradeAdded?.();
        setSelectedChannelIds(new Set());
        setActiveComrade(null);
        setScreen('list');
        void fetchComrades();
      } else toast.showError('Failed to add to channels');
    } catch (cause) {
      toast.showError(`Error: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setProcessing(false); }
  }

  async function inviteToChannels(comrade: ComradeProfile) {
    if (!authToken || selectedChannelIds.size === 0) return;
    setProcessing(true);
    try {
      for (const channelId of selectedChannelIds) {
        const name = channelName(channelId);
        // Retain mobile behavior: inviter_name is set to the channel name.
        await NotificationService.sendNotification({
          userId: comrade.id, notificationType: 'channel_invite', title: '📨 Channel Invite',
          body: `${comrade.username} invited you to join "${name}"`,
          data: { channel_id: channelId, channel_name: name, inviter_id: userId ?? '', inviter_name: name },
        });
      }
      toast.showSuccess('Invites sent successfully!');
      setSelectedChannelIds(new Set());
      setActiveComrade(null);
      setScreen('list');
    } catch (cause) {
      toast.showError(`Failed to send invites: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setProcessing(false); }
  }

  if (!visible) return null;
  const active = activeComrade;
  const viewed = viewingProfile;
  const channelsForPicker = hasAdminChannels ? adminChannels : userChannels;
  const selectedCount = selectedChannelIds.size;
  const surface = { background: colors.background, color: colors.textPrimary };
  const border = { borderColor: alpha(colors.border, .3) };
  const action = () => active && (hasAdminChannels ? void addToChannels(active) : void inviteToChannels(active));

  return createPortal(
    <div className="fixed inset-0 z-[950] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Comrades"
        className="w-full max-w-xl overflow-hidden rounded-t-2xl border sm:rounded-2xl"
        style={{ ...surface, ...border, maxHeight: '85vh' }}>
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full" style={{ background: alpha(colors.border, .5) }} /></div>
        <header className="flex items-center gap-3 border-b px-4 py-3" style={border}>
          {screen !== 'list' && <button type="button" onClick={backToList} className="rounded-full p-2" aria-label="Back to comrades"><ArrowLeft size={16} /></button>}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: colors.primaryDim, color: colors.primary }}><Users size={21} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold">{screen === 'list' ? 'Comrades' : screen === 'picker' ? (hasAdminChannels ? `Add ${active?.nickname ?? ''}` : `Invite ${active?.nickname ?? ''}`) : viewed?.nickname}</h2>
            <p className="text-[10px]" style={{ color: colors.textSecondary }}>{screen === 'list' ? 'Discover fans and connect through channels' : screen === 'picker' ? (hasAdminChannels ? 'Choose channels you administer' : 'Choose channels to invite them to') : `@${viewed?.username ?? ''}`}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2" aria-label="Close comrades"><X size={17} /></button>
        </header>

        <div className="overflow-y-auto p-3 sm:p-4" style={{ maxHeight: 'calc(85vh - 72px)' }}>
          {screen === 'list' && <>
            <div className="px-4 pt-2">
              <AdSenseCarousel placement="chats" label="Comrades sponsored carousel" slots={['9051548379', '3164796870', '1372263706']} />
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-xl border px-3" style={{ ...border, background: colors.surface }}>
              <Search size={15} style={{ color: colors.textTertiary }} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, username or club…" aria-label="Search comrades"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
              <span className="text-[10px]" style={{ color: colors.textTertiary }}>{filteredComrades.length}</span>
            </div>
            <div className="mb-3 flex items-start gap-2 rounded-xl p-3 text-[11px]" style={{ background: colors.surfaceSunken, color: colors.textSecondary }}>
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>{remainingSlots > 0 ? `You can join ${remainingSlots} more ${remainingSlots === 1 ? 'channel' : 'channels'}.` : 'You have reached the 3-channel limit.'} {hasAdminChannels ? 'As a channel admin, you can add fans directly.' : 'You can invite fans to channels you belong to.'}</span>
            </div>
            {loading ? <div className="grid gap-3 py-8" role="status"><span className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent" /><p className="text-center text-xs" style={{ color: colors.textSecondary }}>Loading comrades…</p></div>
              : error ? <div className="rounded-xl border p-5 text-center" style={border}><AlertCircle size={22} className="mx-auto mb-2" style={{ color: colors.away }} /><p className="text-sm">{error}</p><button type="button" onClick={() => void fetchComrades()} className="mt-3 rounded-lg px-4 py-2 text-xs font-semibold" style={{ background: colors.primary, color: colors.textInverse }}>Retry</button></div>
              : filteredComrades.length === 0 ? <div className="py-10 text-center"><Users size={28} className="mx-auto mb-2" style={{ color: colors.textTertiary }} /><p className="text-sm font-semibold">{searchQuery ? 'No matching fans' : 'No fans to show'}</p><p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>Try another search.</p></div>
              : <div>{filteredComrades.map((comrade) => <ComradeCard key={comrade.id} comrade={comrade} isAdded={comradeIdSet.has(comrade.id)} isFull={isFull} hasAdminChannels={hasAdminChannels} onProfile={() => openProfile(comrade)} onAction={() => openPicker(comrade)} />)}</div>}
          </>}

          {screen === 'picker' && active && <>
            <div className="mb-4 flex items-center gap-3 rounded-xl border p-3" style={{ ...border, background: colors.surface }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: colors.primaryDim, color: colors.primary }}>{active.nickname[0]?.toUpperCase() ?? '?'}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{active.nickname}</p><p className="truncate text-xs" style={{ color: colors.textSecondary }}>@{active.username}</p></div>
              <span className="text-[10px]" style={{ color: colors.textTertiary }}>{selectedCount} selected</span>
            </div>
            {channelsForPicker.length === 0 ? <div className="rounded-xl border p-5 text-center" style={border}><p className="text-sm font-semibold">No channels available</p><p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>{hasAdminChannels ? 'You do not administer any channels.' : 'Join a channel before inviting fans.'}</p></div>
              : <div className="divide-y rounded-xl border" style={border}>{channelsForPicker.map((channel) => {
                const alreadyIn = isUserInChannel(active.id, channel.channelId);
                const checked = selectedChannelIds.has(channel.channelId);
                return <button key={channel.channelId} type="button" disabled={alreadyIn || processing} onClick={() => toggleChannel(channel.channelId)}
                  className="flex w-full items-center gap-3 p-3 text-left disabled:opacity-50" style={{ borderColor: alpha(colors.border, .2) }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded border-2" style={{ borderColor: checked ? colors.primary : colors.border, background: checked ? colors.primary : 'transparent', color: colors.textInverse }}>{checked && <Check size={13} />}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold" style={{ background: colors.primaryDim, color: colors.primary }}>{channel.name?.[0]?.toUpperCase() ?? '#'}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{channel.name}</span><span className="block text-[10px]" style={{ color: colors.textTertiary }}>{channel.members?.length ?? 0} members</span></span>
                  {alreadyIn && <span className="rounded-full px-2 py-1 text-[9px]" style={{ background: colors.primaryDim, color: colors.primary }}>✓ In</span>}
                </button>;
              })}</div>}
            <button type="button" disabled={!selectedCount || processing || channelsForPicker.length === 0} onClick={action}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50"
              style={{ background: colors.primary, color: colors.textInverse }}>
              {processing ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{hasAdminChannels ? 'Adding…' : 'Sending invites…'}</> : <>{hasAdminChannels ? 'Add to selected channels' : 'Send invitations'} ({selectedCount})</>}
            </button>
          </>}

          {screen === 'profile' && viewed && <>
            <div className="flex flex-col items-center py-5 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 text-2xl font-bold" style={{ background: colors.primaryDim, color: colors.primary, borderColor: alpha(colors.primary, .4) }}>{viewed.nickname[0]?.toUpperCase() ?? '?'}</div>
              <h3 className="mt-3 text-lg font-bold">{viewed.nickname}</h3><p className="text-xs" style={{ color: colors.textSecondary }}>@{viewed.username}</p>
              <div className="mt-4 flex w-full gap-2"><Stat label="Bets" value={String(viewed.numberOfBets)} color={colors.primary} /><Stat label="Status" value={viewed.numberOfBets > 0 ? 'Active' : 'New fan'} color={colors.away} /></div>
            </div>
            <div className="divide-y rounded-xl border" style={border}>
              <div className="flex items-center gap-3 p-3"><Trophy size={16} style={{ color: colors.primary }} /><span className="flex-1 text-xs" style={{ color: colors.textSecondary }}>Favorite club</span><strong className="text-xs">{viewed.clubFan || 'Not set'}</strong></div>
              <div className="flex items-center gap-3 p-3"><Globe2 size={16} style={{ color: colors.primary }} /><span className="flex-1 text-xs" style={{ color: colors.textSecondary }}>Country</span><strong className="text-xs">{viewed.countryFan || 'Not set'}</strong></div>
              <div className="flex items-center gap-3 p-3"><UserIcon size={16} style={{ color: colors.primary }} /><span className="flex-1 text-xs" style={{ color: colors.textSecondary }}>Phone</span><strong className="text-xs">{viewed.phone || 'Not set'}</strong></div>
              <div className="flex items-center gap-3 p-3"><CheckCircle2 size={16} style={{ color: colors.primary }} /><span className="flex-1 text-xs" style={{ color: colors.textSecondary }}>Channels you share</span><strong className="text-xs">{userChannels.filter((channel) => channel.members?.some((member) => member.userId === viewed.id)).length}</strong></div>
            </div>
          </>}
        </div>
        <footer className="flex justify-between border-t px-4 py-3 text-[10px]" style={border}>
          <span style={{ color: colors.textTertiary }}>{screen === 'list' ? `${filteredComrades.length} profiles` : screen === 'picker' ? `${selectedCount} selected` : 'Fan profile'}</span>
          <button type="button" onClick={screen === 'list' ? onClose : backToList} className="font-semibold" style={{ color: colors.primary }}>{screen === 'list' ? 'Close' : 'Back'}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
