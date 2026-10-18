import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronDown, Menu, Plus, RefreshCw } from 'lucide-react';
import type { Channel } from '@funspot/core';
import { FAN_RADIUS } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { useHome, MAX_CHANNELS } from './home-context';
import { useAllChannels } from '@/hooks/useAllChannels';
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
      root?.querySelector<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')?.focus();
    });
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
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
  const location = useLocation();
  const queryClient = useQueryClient();
  const { userId, username, authToken, isLoggedIn, logout } = useAuth();
  const publicChannelsQuery = useAllChannels(authToken);
  const { requireLogin } = useLoginModal();
  const {
    activeChannel, activeChannelId, channels, allChannels, setActiveChannelId,
    joiningChannelIds, joinChannel, activeTab, setActiveTab, headerVisible,
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
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEscapeAndFocusTrap(menuOpen, menuRef, closeMenu);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

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

  const openMenu = useCallback((anchor?: HTMLButtonElement | null) => {
    const rect = (anchor ?? avatarRef.current ?? mobileMenuButtonRef.current)?.getBoundingClientRect();
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
  const publicChannels = publicChannelsQuery.data ?? [];
  const availableChannels = allChannels.length > 0 ? allChannels : publicChannels.length > 0 ? publicChannels : joinedChannels;
  const displayedChannels = loggedIn && hasJoinedChannels ? joinedChannels : availableChannels;
  useEffect(() => {
    if (import.meta.env.DEV) console.error('[AppHeader] channels', { joined: joinedChannels.length, browsable: allChannels.length, loading: !!props.loadingChannels || !!publicChannelsQuery.isLoading });
  }, [joinedChannels.length, allChannels.length, props.loadingChannels, publicChannelsQuery.isLoading]);

  function openChat(channel: Channel) {
    navigate(`/messages/${encodeURIComponent(channel.channelId)}`, {
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
  return (
    <>
      <header
        className="desktop-home-header sticky top-0 z-50 w-full border-b"
        style={{ background: colors.surfaceElevated, borderColor: colors.border, paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
      >
        <div className="flex min-h-14 w-full items-center gap-4 px-3">
          <a
            href="/"
            onClick={(event) => { event.preventDefault(); navigate('/'); }}
            aria-label="Funspot home"
            className="shrink-0 text-[19px] font-bold tracking-tight sm:text-xl"
            style={{ color: colors.primary, fontFamily: 'SairaCondensed_600SemiBold, sans-serif' }}
          >Funspot😂</a>

          <nav className="min-w-0 max-w-[min(62vw,900px)] flex-none" aria-label="Channels">
            <div className="no-scrollbar flex items-center gap-4 overflow-x-auto whitespace-nowrap py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {displayedChannels.slice(0, 4).map((channel) => {
                const joined = loggedIn && hasJoinedChannels && joinedChannels.some((item) => item.channelId === channel.channelId);
                const active = selectedChannelId === channel.channelId;
                const leader = topMember(channel);
                const joining = joiningChannelIds.has(channel.channelId);
                return (
                  <button
                    key={channel.channelId}
                    type="button"
                    disabled={!joined && joining}
                    className={`flex shrink-0 items-center gap-1 border-b-2 px-0 py-2 text-[11px] transition-colors sm:text-xs ${joined ? '' : 'border-transparent'}`}
                    style={{ borderColor: joined && active ? colors.primary : 'transparent', color: joined && active ? colors.primary : colors.textSecondary }}
                    aria-current={joined && active ? 'page' : undefined}
                    onClick={() => joined ? selectChannel(channel) : join(channel)}
                    onContextMenu={joined ? (event) => handleChipContextMenu(event, channel) : undefined}
                    onDoubleClick={joined ? () => openChat(channel) : undefined}
                    title={joined ? 'Select to open leaderboard; double-click or right-click to open chat' : 'Join channel'}
                  >
                    {channel.isAdmin && joined && <span aria-label="Admin" className="mr-1">👑</span>}
                    <span className="desktop-channel-avatar" aria-hidden="true">{channel.name.trim().charAt(0).toUpperCase() || '?'}</span>
                    <span>{channel.name}</span>
                    {joined && leader && <span className="ml-1 text-[9px]" style={{ color: colors.primary }}>{leader.username} ({leader.seasonPoints}pts)</span>}
                    {!joined && <span className="text-[9px] font-bold" style={{ color: colors.primary }}>{joining ? '…' : 'join'}</span>}
                  </button>
                );
              })}
              {(loggedIn && hasJoinedChannels ? joinedChannels.length : 0) < MAX_CHANNELS && (
                <button
                  type="button"
                  onClick={() => requireLogin(() => props.onAddChannel ? props.onAddChannel() : setCreateChannelOpen(true))}
                  className="flex shrink-0 items-center gap-1 px-0 py-2 text-[10px] font-medium sm:text-xs"
                  style={{ color: colors.primary }}
                ><Plus size={13} /> create channel</button>
              )}
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            {props.onEnableNotifications && <button type="button" onClick={() => { void props.onEnableNotifications?.(); }} className="hidden rounded-full px-3 py-2 text-[11px] font-medium lg:inline-flex" style={{ color: colors.textSecondary, background: colors.surface }}>Enable notifications</button>}
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
                  onClick={() => openMenu(avatarRef.current)}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                    if (event.key === 'ArrowDown') { event.preventDefault(); openMenu(avatarRef.current); }
                  }}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={`Account menu for ${currentUsername ?? 'profile'}`}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full"
                  style={{ background: colors.primaryMuted }}
                ><img src={avatarUri} alt="" className="h-full w-full object-cover" /></button>
                <button type="button" className="hidden max-w-28 items-center gap-1 truncate text-xs sm:flex" style={{ color: colors.textSecondary }} onClick={() => openMenu(avatarRef.current)}>
                  {currentUsername ?? 'Profile'} <ChevronDown size={13} />
                </button>
              </>
            ) : (
              <button type="button" onClick={() => props.onLogin ? props.onLogin() : requireLogin()} className="shrink-0 text-[16px] font-bold tracking-tight transition-[filter,color] hover:brightness-125 sm:text-[17px]" style={{ color: colors.primary, fontFamily: 'SairaCondensed_600SemiBold, sans-serif', background: 'transparent', border: 0, padding: 0 }}>Join</button>
            )}
            <button
              type="button"
              onClick={() => props.onRefresh ? props.onRefresh() : void queryClient.invalidateQueries({ queryKey: ['channels'] })}
              aria-label="Refresh channels"
              title="Refresh channels"
              className="hidden h-9 w-9 items-center justify-center rounded-full sm:flex"
              style={{ color: colors.textSecondary }}
            >↻</button>
            <button type="button" onClick={(event) => openMenu(event.currentTarget)} aria-label="Open menu" aria-haspopup="menu" aria-expanded={menuOpen} className="hidden h-9 w-9 items-center justify-center sm:flex" style={{ color: colors.textSecondary }}><Menu size={19} /></button>
          </div>
        </div>

      </header>

      <header
        className={'mobile-home-header ' + (headerVisible ? 'home-header-visible' : 'home-header-hidden')}
        style={{ background: colors.surfaceElevated, color: colors.textPrimary, paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
      >
        <div className="mobile-home-header-row">
          <a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }} aria-label="Funspot home"
            className="mobile-home-brand" style={{ color: colors.primary, fontFamily: 'SairaCondensed_600SemiBold, sans-serif' }}>Funspot😂</a>
          <div className="mobile-home-header-actions">
            <button type="button" onClick={() => setNotifOpen(true)} aria-label="Notifications"
              className="mobile-home-icon-button" style={{ color: colors.textSecondary }}>
              <Bell size={18} />
              {unreadCount > 0 && <span className="mobile-home-notification-count" style={{ background: colors.primary }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            <button type="button"
              onClick={() => props.onRefresh ? props.onRefresh() : void queryClient.invalidateQueries({ queryKey: ['channels'] })}
              aria-label="Refresh" className="mobile-home-icon-button" style={{ color: colors.textSecondary }}><RefreshCw size={17} /></button>
            <button ref={mobileMenuButtonRef} type="button" onClick={() => openMenu(mobileMenuButtonRef.current)}
              aria-label="Open menu" aria-haspopup="menu" aria-expanded={menuOpen}
              className="mobile-home-menu-button" style={{ color: colors.textSecondary, background: loggedIn ? colors.primaryMuted : 'transparent' }}>
              {loggedIn ? <img src={avatarUri} alt="" /> : <Menu size={20} />}
            </button>
            {!loggedIn && <button type="button" onClick={() => requireLogin()}
              className="mobile-home-join" style={{ color: colors.primary, fontFamily: 'SairaCondensed_600SemiBold, sans-serif' }}>Join</button>}
          </div>
        </div>
        <nav className="mobile-home-channel-row no-scrollbar" aria-label="Channels">
          {loggedIn && hasJoinedChannels ? joinedChannels.map((channel) => {
            const active = selectedChannelId === channel.channelId;
            const leader = topMember(channel);
            return <button key={channel.channelId} type="button" className="mobile-home-channel-chip"
              style={{ color: active ? colors.primary : colors.textSecondary, borderBottomColor: active ? colors.primary : 'transparent' }}
              aria-current={active ? 'page' : undefined} onClick={() => selectChannel(channel)}
              onContextMenu={(event) => handleChipContextMenu(event, channel)} onDoubleClick={() => openChat(channel)}>
              {channel.isAdmin && <span>👑 </span>}{channel.name}
              {leader && <small style={{ color: colors.primary }}>{leader.username} ({leader.seasonPoints}pts)</small>}
            </button>;
          }) : availableChannels.map((channel) => {
            const joining = joiningChannelIds.has(channel.channelId);
            return <button key={channel.channelId} type="button" disabled={joining} className="mobile-home-channel-chip"
              style={{ color: colors.textSecondary, borderBottomColor: 'transparent' }} onClick={() => join(channel)}>
              {channel.name}<small style={{ color: colors.primary }}>{joining ? '…' : 'join'}</small>
            </button>;
          })}
          {(loggedIn && hasJoinedChannels ? joinedChannels.length : 0) < MAX_CHANNELS && (
            <button type="button" className="mobile-home-channel-chip mobile-home-create-channel" style={{ color: colors.primary, borderBottomColor: 'transparent' }}
              onClick={() => requireLogin(() => setCreateChannelOpen(true))}><Plus size={12} /> create channel</button>
          )}
        </nav>
      </header>

      {menuOpen && createPortal(
        <div className="fixed inset-0 z-[950]" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
          <div
            ref={menuRef}
            role="menu"
            aria-label="Account menu"
            className="home-menu-popover fixed w-[220px] overflow-y-auto no-scrollbar"
            style={{ top: menuAnchor.top, right: menuAnchor.right, maxHeight: 'calc(100vh - 16px)', background: colors.background, color: colors.textPrimary }}
          >
            {!loggedIn && <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.primary }} onClick={() => pick(() => requireLogin())}>Login</button>}
            {loggedIn && <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.away }} onClick={() => pick(signOut)}>Logout</button>}
            {loggedIn && <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.textPrimary }} onClick={() => pick(() => setPostOpen(true))}>Create Post</button>}
            <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setCreateChannelOpen(true)))}>Create Channel</button>
            <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setProfileOpen(true)))}>Profile</button>
            <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setComradesOpen(true)))}>Comrades</button>
            <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setHistoryOpen(true)))}>History</button>
            <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.textPrimary }} onClick={() => pick(() => setNotifOpen(true))}>Notifications</button>
            {activeChannelId && <button type="button" role="menuitem" className="home-menu-item" style={{ color: colors.textPrimary }} onClick={() => pick(() => requireLogin(() => setAdminOpen(true)))}>Admin Dashboard</button>}
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
