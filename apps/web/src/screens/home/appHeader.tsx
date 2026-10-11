import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronDown, LogOut, Plus, UserRound, Wallet } from 'lucide-react';
import type { Channel } from '@funspot/core';
import { FAN_RADIUS } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { useHome, MAX_CHANNELS } from './home-context';
import NotificationsModal from '@/modals/NotificationsModal';
import ProfileModal from '@/modals/profile/ProfileModal';
import ComradeListModal from '@/modals/comradelist/index';
import LeaderboardModal from '@/modals/LeaderboardModal';
import AdminModal from '@/modals/AdminModal';
import AddPostModal from '@/modals/addPostModal';
import HistoryModal from '@/modals/HistoryModal';
import CreateChannelModal from '@/modals/ChannelCreation';
import { NotificationService } from '@/lib/api/notification-service';

type HeaderProps = {
  channels?: Channel[];
  activeChannelId?: string | null;
  loadingChannels?: boolean;
  username?: string | null;
  isLoggedIn?: boolean;
  onSelectChannel?: (id: string) => void;
  onLogout?: () => void;
  onLogin?: () => void;
  onRefresh?: () => void;
  onEnableNotifications?: () => void | Promise<void>;
  onAddChannel?: () => void;
};

function topMember(channel: Channel) {
  if (!channel.members?.length) return undefined;
  return [...channel.members].sort((a, b) => b.seasonPoints - a.seasonPoints)[0];
}

/** Browser equivalent of the mobile modal's Escape, focus and Tab handling. */
function useEscapeAndFocusTrap(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const frame = window.requestAnimationFrame(() => {
      root?.querySelector<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')?.focus();
    });
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
      ));
      if (!items.length) event.preventDefault();
      else if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [open, ref, close]);
}

export function AppHeader(props: HeaderProps = {}) {
  const colors = useFanColors();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, username, authToken, isLoggedIn, logout } = useAuth();
  const { requireLogin } = useLoginModal();
  const {
    activeChannel, activeChannelId, channels, allChannels, setActiveChannelId,
    joiningChannelIds, joinChannel,
  } = useHome();

  // Retain HomeScreen's existing callback API while sourcing channel state and
  // login behavior from the same context used by the mobile implementation.
  const joinedChannels = props.channels ?? channels;
  const selectedChannelId = props.activeChannelId ?? activeChannelId ?? null;
  const loggedIn = props.isLoggedIn ?? isLoggedIn;
  const currentUsername = props.username ?? username;

  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [comradesOpen, setComradesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [chipLeaderboardChannel, setChipLeaderboardChannel] = useState<Channel | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, right: 8 });
  const avatarRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEscapeAndFocusTrap(menuOpen, menuRef, closeMenu);

  // Keep the bell badge synchronized with the notification service stream and
  // the same persisted unread counts used by NotificationsModal.
  useEffect(() => {
    if (!loggedIn || !userId) {
      setUnreadCount(0);
      return;
    }
    let mounted = true;
    const refresh = async () => {
      try {
        const counts = await NotificationService.loadInitialBadgeCounts();
        if (mounted) setUnreadCount(counts.unread_notifications);
      } catch {
        if (mounted) setUnreadCount(0);
      }
    };
    void refresh();
    const unsubscribe = NotificationService.onBadge((event) => {
      const count = event.total_unread_notifications ?? event.unread_notifications ?? event.count;
      if (typeof count === 'number' && Number.isFinite(count)) setUnreadCount(Math.max(0, count));
      else void refresh();
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loggedIn, userId]);

  const openMenu = useCallback(() => {
    const rect = avatarRef.current?.getBoundingClientRect();
    if (rect) setMenuAnchor({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    setMenuOpen(true);
  }, []);
  const pick = useCallback((action: () => void) => {
    setMenuOpen(false);
    action();
  }, []);

  const points = activeChannel?.members?.find((member) => member.userId === userId)?.seasonPoints ?? 0;
  const comradesList = queryClient.getQueryData<string[]>(['comrades']) ?? [];
  const avatarUri = `https://i.pravatar.cc/150?u=${encodeURIComponent(userId ?? 'guest')}`;
  const hasJoinedChannels = joinedChannels.length > 0;
  const availableChannels = allChannels.length > 0 ? allChannels : joinedChannels;

  function openChat(channel: Channel) {
    navigate(`/chat/${encodeURIComponent(channel.channelId)}`, {
      state: { channelId: channel.channelId, channelName: channel.name, userId, username, authToken },
    });
  }
  function selectChannel(channel: Channel) {
    (props.onSelectChannel ?? setActiveChannelId)(channel.channelId);
    setChipLeaderboardChannel(channel);
  }
  function join(channel: Channel) {
    if (!loggedIn) {
      requireLogin(() => { void joinChannel(channel); });
      return;
    }
    void joinChannel(channel);
  }
  function handleChipContextMenu(event: ReactMouseEvent<HTMLButtonElement>, channel: Channel) {
    event.preventDefault();
    (props.onSelectChannel ?? setActiveChannelId)(channel.channelId);
    openChat(channel);
  }
  function signOut() {
    if (props.onLogout) props.onLogout();
    else void logout();
  }
  function openProfile() {
    pick(() => requireLogin(() => setProfileOpen(true)));
  }

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full border-b"
        style={{ background: colors.surfaceElevated, borderColor: colors.border, paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
      >
        <div className="mx-auto flex min-h-14 w-full max-w-[1600px] items-center gap-3 px-3 sm:px-5 lg:px-7">
          <a
            href="/"
            onClick={(event) => { event.preventDefault(); navigate('/'); }}
            aria-label="Funspot home"
            className="shrink-0 text-[19px] font-bold tracking-tight sm:text-xl"
            style={{ color: colors.primary, fontFamily: 'SairaCondensed_600SemiBold, sans-serif' }}
          >Funspot😂</a>

          <nav className="min-w-0 flex-1" aria-label="Channels">
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {loggedIn && hasJoinedChannels ? joinedChannels.map((channel) => {
                const active = selectedChannelId === channel.channelId;
                const leader = topMember(channel);
                return (
                  <button
                    key={channel.channelId}
                    type="button"
                    className="flex shrink-0 items-center border-b-2 px-2 py-2 text-[11px] transition-colors sm:text-xs"
                    style={{ borderColor: active ? colors.primary : 'transparent', color: active ? colors.primary : colors.textSecondary }}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => selectChannel(channel)}
                    onContextMenu={(event) => handleChipContextMenu(event, channel)}
                    onDoubleClick={() => openChat(channel)}
                    title="Select to open leaderboard; double-click or right-click to open chat"
                  >
                    {channel.isAdmin && <span aria-label="Admin" className="mr-1">👑</span>}
                    <span>{channel.name}</span>
                    {leader && <span className="ml-1 text-[9px]" style={{ color: colors.primary }}>{leader.username} ({leader.seasonPoints}pts)</span>}
                  </button>
                );
              }) : availableChannels.map((channel) => {
                const joining = joiningChannelIds.has(channel.channelId);
                return (
                  <button
                    key={channel.channelId}
                    type="button"
                    disabled={joining}
                    className="flex shrink-0 items-center gap-1 border-b-2 border-transparent px-2 py-2 text-[11px] sm:text-xs"
                    style={{ color: colors.textSecondary }}
                    onClick={() => join(channel)}
                  >
                    <span>{channel.name}</span>
                    <span className="text-[9px] font-bold" style={{ color: colors.primary }}>{joining ? '…' : 'join'}</span>
                  </button>
                );
              })}
              {props.loadingChannels && <span className="px-2 text-xs" style={{ color: colors.textMuted }}>Loading channels…</span>}
              {!props.loadingChannels && loggedIn && joinedChannels.length === 0 && availableChannels.length === 0 && (
                <span className="px-2 text-xs" style={{ color: colors.textMuted }}>No channels available</span>
              )}
              {(loggedIn && hasJoinedChannels ? joinedChannels.length : 0) < MAX_CHANNELS && (
                <button
                  type="button"
                  onClick={() => requireLogin(() => props.onAddChannel ? props.onAddChannel() : setCreateChannelOpen(true))}
                  className="flex shrink-0 items-center gap-1 rounded-md px-2 py-2 text-[10px] font-medium sm:text-xs"
                  style={{ color: colors.primary }}
                ><Plus size={13} /> create channel</button>
              )}
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              className="relative flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: colors.textSecondary }}
            >
              <Bell size={19} />
              {unreadCount > 0 && <span className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: colors.primary }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {loggedIn ? (
              <>
                <button
                  ref={avatarRef}
                  type="button"
                  onClick={openMenu}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                    if (event.key === 'ArrowDown') { event.preventDefault(); openMenu(); }
                  }}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={`Account menu for ${currentUsername ?? 'profile'}`}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full"
                  style={{ background: colors.primaryMuted }}
                ><img src={avatarUri} alt="" className="h-full w-full object-cover" /></button>
                <button type="button" className="hidden max-w-28 items-center gap-1 truncate text-xs sm:flex" style={{ color: colors.textSecondary }} onClick={openMenu}>
                  {currentUsername ?? 'Profile'} <ChevronDown size={13} />
                </button>
              </>
            ) : (
              <button type="button" onClick={() => props.onLogin ? props.onLogin() : requireLogin()} className="rounded-full px-3 py-2 text-xs font-bold sm:px-4" style={{ background: colors.primary, color: '#fff' }}>Join</button>
            )}
            <button
              type="button"
              onClick={() => props.onRefresh ? props.onRefresh() : void queryClient.invalidateQueries({ queryKey: ['channels'] })}
              aria-label="Refresh channels"
              title="Refresh channels"
              className="hidden h-9 w-9 items-center justify-center rounded-full sm:flex"
              style={{ color: colors.textSecondary }}
            >↻</button>
          </div>
        </div>
      </header>

      {menuOpen && createPortal(
        <div className="fixed inset-0 z-[950]" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
          <div
            ref={menuRef}
            role="menu"
            aria-label="Account menu"
            className="fixed w-48 overflow-hidden rounded-lg border py-1 shadow-xl"
            style={{ top: menuAnchor.top, right: menuAnchor.right, background: colors.surfaceElevated, borderColor: colors.border, boxShadow: '0 12px 36px rgba(0,0,0,.28)' }}
          >
            <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setPostOpen(true)))}><Plus size={15} /> Create Post</button>
            <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setCreateChannelOpen(true)))}><Plus size={15} /> Create Channel</button>
            <div className="my-1 border-t" style={{ borderColor: colors.border }} />
            <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm" style={{ color: colors.textPrimary }} onClick={openProfile}><UserRound size={15} /> Profile</button>
            <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setComradesOpen(true)))}><UserRound size={15} /> Comrades</button>
            <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setHistoryOpen(true)))}><Wallet size={15} /> History</button>
            {activeChannelId && <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setAdminOpen(true)))}><UserRound size={15} /> Admin Dashboard</button>}
            <div className="my-1 border-t" style={{ borderColor: colors.border }} />
            <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm" style={{ color: colors.away }} onClick={() => pick(signOut)}><LogOut size={15} /> Logout</button>
          </div>
        </div>,
        document.body,
      )}

      <NotificationsModal visible={notifOpen} onClose={() => setNotifOpen(false)} />
      <ProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} channels={joinedChannels ?? (activeChannel ? [activeChannel] : [])} />
      <ComradeListModal
        visible={comradesOpen}
        onClose={() => setComradesOpen(false)}
        comradesList={comradesList}
        userChannels={joinedChannels ?? (activeChannel ? [activeChannel] : [])}
        onComradeAdded={() => { void queryClient.invalidateQueries({ queryKey: ['comrades'] }); }}
      />
      <HistoryModal visible={historyOpen} onClose={() => setHistoryOpen(false)} />
      <CreateChannelModal
        visible={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        onChannelCreated={() => { void queryClient.invalidateQueries({ queryKey: ['channels'] }); }}
      />
      <LeaderboardModal visible={!!chipLeaderboardChannel} channelId={chipLeaderboardChannel?.channelId} onClose={() => setChipLeaderboardChannel(null)} />
      {activeChannelId && <AdminModal visible={adminOpen} channelId={activeChannelId} onClose={() => setAdminOpen(false)} />}
      <AddPostModal visible={postOpen} onClose={() => setPostOpen(false)} onPostCreated={() => { void queryClient.invalidateQueries({ queryKey: ['posts'] }); }} />
      <span className="sr-only" aria-hidden="true">{points}</span>
    </>
  );
}
