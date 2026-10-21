import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactNode, UIEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '@funspot/core';
import {
  getUserChannels, getAllChannels, joinChannel as joinChannelApi,
} from '@funspot/core/src/api/channels-service';
import { useAuth } from '@/lib/auth/auth-context';
import { useHeaderInset } from './header-inset';
import type { TabName } from '@/components/FloatingPillTabBar';

export const MAX_CHANNELS = 3;
const SCROLL_THRESHOLD = 6;
const SHOW_ON_REVERSE_THRESHOLD = 1;
const ACTIVE_CHANNEL_KEY = 'home.activeChannelId';
const ACTIVE_TAB_KEY = 'home.activeTab';
const NO_CHANNELS: Channel[] = [];

function readStoredActiveChannelId(): string | undefined {
  try { return window.localStorage.getItem(ACTIVE_CHANNEL_KEY) ?? undefined; } catch { return undefined; }
}
function writeStoredActiveChannelId(id: string | undefined) {
  try { if (id) window.localStorage.setItem(ACTIVE_CHANNEL_KEY, id); else window.localStorage.removeItem(ACTIVE_CHANNEL_KEY); } catch { /* storage can be unavailable */ }
}
function readStoredActiveTab(): TabName {
  try {
    const raw = window.localStorage.getItem(ACTIVE_TAB_KEY);
    if (raw === 'Chats' || raw === 'Feed') return raw;
  } catch { /* use default tab */ }
  return 'Chats';
}
function writeStoredActiveTab(tab: TabName) {
  try { window.localStorage.setItem(ACTIVE_TAB_KEY, tab); } catch { /* storage can be unavailable */ }
}

export type HomeScrollProps = {
  onScroll: (event: UIEvent<HTMLElement>) => void;
  onScrollBeginDrag: (event: UIEvent<HTMLElement>) => void;
  onScrollEndDrag: (event: UIEvent<HTMLElement>) => void;
  onMomentumScrollBegin: (event: UIEvent<HTMLElement>) => void;
  onMomentumScrollEnd: (event: UIEvent<HTMLElement>) => void;
  scrollEventThrottle: number;
};

type HomeCtx = {
  channels: Channel[];
  loadingChannels: boolean;
  isAdminOfAnyChannel: boolean;
  allChannels: Channel[];
  loadingAllChannels: boolean;
  activeChannel?: Channel;
  activeChannelId?: string;
  setActiveChannelId: (id: string) => void;
  joiningChannelIds: Set<string>;
  joinChannel: (channel: Channel) => Promise<void>;
  reloadChannels: () => Promise<void>;
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  headerVisible: boolean;
  reportScroll: (offsetY: number, source?: HTMLElement) => void;
  scrollProps: HomeScrollProps;
  resetHeaderOnTabChange: () => void;
};

const noop = () => undefined;
const noopScrollProps: HomeScrollProps = {
  onScroll: noop, onScrollBeginDrag: noop, onScrollEndDrag: noop,
  onMomentumScrollBegin: noop, onMomentumScrollEnd: noop, scrollEventThrottle: 16,
};
const Ctx = createContext<HomeCtx>({
  channels: NO_CHANNELS, loadingChannels: false, isAdminOfAnyChannel: false,
  allChannels: NO_CHANNELS, loadingAllChannels: false, activeChannel: undefined,
  activeChannelId: undefined, setActiveChannelId: noop, joiningChannelIds: new Set(),
  joinChannel: async () => undefined, reloadChannels: async () => undefined,
  activeTab: 'Chats', setActiveTab: noop, headerVisible: true, reportScroll: noop,
  scrollProps: noopScrollProps, resetHeaderOnTabChange: noop,
});

export function HomeProvider({ children }: { children: ReactNode }) {
  const { userId, username, authToken, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const channelsKey = useMemo(() => ['channels', userId] as const, [userId]);
  const browsableKey = useMemo(() => ['channels', 'browsable'] as const, []);

  const channelsQuery = useQuery({
    queryKey: channelsKey,
    queryFn: () => getUserChannels(userId!, authToken!),
    enabled: !!userId && !!authToken,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
  const channels = channelsQuery.data ?? NO_CHANNELS;
  const needsBrowsing = !isLoggedIn || channels.length < MAX_CHANNELS;
  const browsableQuery = useQuery({
    queryKey: browsableKey,
    queryFn: async () => {
      const fetched = await getAllChannels(authToken ?? undefined);
      const joinedIds = new Set(channels.map((channel) => channel.channelId));
      return fetched.filter((channel) => !joinedIds.has(channel.channelId));
    },
    enabled: needsBrowsing,
    placeholderData: (previous) => previous,
  });
  const allChannels = needsBrowsing ? browsableQuery.data ?? NO_CHANNELS : NO_CHANNELS;

  const [activeChannelId, setActiveChannelIdState] = useState<string | undefined>(readStoredActiveChannelId);
  const setActiveChannelId = useCallback((id: string) => {
    setActiveChannelIdState(id);
    writeStoredActiveChannelId(id);
  }, []);

  useEffect(() => {
    if (!activeChannelId && channels[0]?.channelId) setActiveChannelId(channels[0].channelId);
  }, [activeChannelId, channels, setActiveChannelId]);
  useEffect(() => {
    if (!userId && !isLoggedIn) {
      setActiveChannelIdState(undefined);
      writeStoredActiveChannelId(undefined);
    }
  }, [userId, isLoggedIn]);

  const [joiningChannelIds, setJoiningChannelIds] = useState<Set<string>>(new Set());
  const joinChannel = useCallback(async (channel: Channel) => {
    if (!isLoggedIn || !userId || !authToken || channels.length >= MAX_CHANNELS || joiningChannelIds.has(channel.channelId)) return;
    setJoiningChannelIds((previous) => new Set(previous).add(channel.channelId));
    try {
      await joinChannelApi(channel.channelId, { userId, username: username ?? '' }, authToken);
      setActiveChannelId(channel.channelId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: channelsKey }),
        queryClient.invalidateQueries({ queryKey: browsableKey }),
      ]);
    } catch (error) {
      console.error('joinChannel failed:', error);
    } finally {
      setJoiningChannelIds((previous) => {
        const next = new Set(previous);
        next.delete(channel.channelId);
        return next;
      });
    }
  }, [isLoggedIn, userId, username, authToken, channels.length, joiningChannelIds, queryClient, channelsKey, browsableKey, setActiveChannelId]);

  const reloadChannels = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: channelsKey });
  }, [queryClient, channelsKey]);
  const activeChannel = useMemo(() => channels.find((channel) => channel.channelId === activeChannelId), [channels, activeChannelId]);
  const isAdminOfAnyChannel = useMemo(() => channels.some((channel) => channel.isAdmin), [channels]);

  const [headerVisible, setHeaderVisible] = useState(true);
  // Chats and Feed are separate scroll containers. Keep independent baselines so
  // switching panes never compares unrelated scroll offsets.
  const lastScrollBySource = useRef<WeakMap<HTMLElement, number>>(new WeakMap());
  const fallbackLastScroll = useRef(0);
  const reportScroll = useCallback((offsetY: number, source?: HTMLElement) => {
    const offset = Math.max(0, offsetY);
    if (offset <= 0) {
      setHeaderVisible(true);
      if (source) lastScrollBySource.current.set(source, 0);
      else fallbackLastScroll.current = 0;
      return;
    }

    const previous = source
      ? lastScrollBySource.current.get(source)
      : fallbackLastScroll.current;
    if (previous === undefined) {
      if (source) lastScrollBySource.current.set(source, offset);
      else fallbackLastScroll.current = offset;
      return;
    }

    const diff = offset - previous;
    if (diff > SCROLL_THRESHOLD) {
      setHeaderVisible(false);
      if (source) lastScrollBySource.current.set(source, offset);
      else fallbackLastScroll.current = offset;
    } else if (diff < -SHOW_ON_REVERSE_THRESHOLD) {
      // Recover on even a small upward reversal; requiring another full
      // threshold here was leaving the header and floating tabs hidden.
      setHeaderVisible(true);
      if (source) lastScrollBySource.current.set(source, offset);
      else fallbackLastScroll.current = offset;
    }
    // Keep the downward anchor until the threshold is crossed, so small
    // native scroll events accumulate instead of preventing the hide action.
  }, []);
  const resetHeaderOnTabChange = useCallback(() => {
    lastScrollBySource.current = new WeakMap();
    fallbackLastScroll.current = 0;
    setHeaderVisible(true);
  }, []);

  const [activeTab, setActiveTabState] = useState<TabName>(readStoredActiveTab);
  const setActiveTab = useCallback((tab: TabName) => {
    setActiveTabState((previous) => {
      if (previous === tab) return previous;
      writeStoredActiveTab(tab);
      return tab;
    });
    resetHeaderOnTabChange();
  }, [resetHeaderOnTabChange]);

  const scrollProps = useMemo<HomeScrollProps>(() => ({
    onScroll: (event) => reportScroll(event.currentTarget.scrollTop, event.currentTarget),
    onScrollBeginDrag: (event) => {
      if (event.currentTarget.scrollTop <= 0) setHeaderVisible(true);
    },
    onScrollEndDrag: () => {},
    onMomentumScrollBegin: () => {},
    onMomentumScrollEnd: () => {},
    scrollEventThrottle: 16,
  }), [reportScroll]);

  const loadingChannels = channelsQuery.isLoading;
  const loadingAllChannels = browsableQuery.isLoading && needsBrowsing;
  const value = useMemo<HomeCtx>(() => ({
    channels, loadingChannels, isAdminOfAnyChannel, allChannels, loadingAllChannels,
    activeChannel, activeChannelId, setActiveChannelId, joiningChannelIds, joinChannel,
    reloadChannels, activeTab, setActiveTab, headerVisible, reportScroll, scrollProps,
    resetHeaderOnTabChange,
  }), [channels, loadingChannels, isAdminOfAnyChannel, allChannels, loadingAllChannels,
    activeChannel, activeChannelId, setActiveChannelId, joiningChannelIds, joinChannel,
    reloadChannels, activeTab, setActiveTab, headerVisible, reportScroll, scrollProps,
    resetHeaderOnTabChange]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useHome = () => useContext(Ctx);

export function useHomeList() {
  const { scrollProps } = useHome();
  const topInset = useHeaderInset();
  return { scrollProps, topInset };
}
