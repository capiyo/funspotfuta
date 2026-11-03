// screens/home/home-context.tsx
//
// Shared home state: joined channels, browsable channels, active channel,
// active tab, and header visibility driven by scroll direction.
//
// Lists wire up with one hook:
//   const { scrollProps, topInset } = useHomeList();
//
// Changes in this version:
//   - loadingChannels / loadingAllChannels use isLoading (pending AND fetching).
//     isPending is true forever for a disabled query (guest / not signed in),
//     which kept skeletons on screen permanently.
//   - query keys and empty arrays are stable, so callbacks don't re-create on
//     every render.
//   - the context value is memoized, so scroll-driven headerVisible changes
//     don't re-render every consumer needlessly (still re-renders on
//     headerVisible itself; that's expected).
//   - startup prefetch lives in QueryProvider (runs right after cache restore).

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    ReactNode,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Channel,
    getUserChannels,
    getAllChannels,
    joinChannel as joinChannelApi,
} from '@funspot/core/src/api/channels-service';
import { mobileStorage } from '@funspot/storage';
import { useAuth } from '@/lib/auth/auth-context';
import { useHeaderInset } from './header-inset';
import type { TabName } from '@/components/FloatingPillTabBar';

export const MAX_CHANNELS = 3;

// Minimum accumulated scroll distance (px) before the header reacts.
const SCROLL_THRESHOLD = 6;

const ACTIVE_CHANNEL_KEY = 'home.activeChannelId';
const ACTIVE_TAB_KEY = 'home.activeTab';

const NO_CHANNELS: Channel[] = [];

function readStoredActiveChannelId(): string | undefined {
    return (mobileStorage.getItem(ACTIVE_CHANNEL_KEY) as string | null) ?? undefined;
}

function writeStoredActiveChannelId(id: string | undefined) {
    if (id) mobileStorage.setItem(ACTIVE_CHANNEL_KEY, id);
    else mobileStorage.removeItem(ACTIVE_CHANNEL_KEY);
}

function readStoredActiveTab(): TabName {
    const raw = mobileStorage.getItem(ACTIVE_TAB_KEY) as string | null;
    if (raw === 'Chats' || raw === 'Feed') return raw;
    return 'Chats';
}

function writeStoredActiveTab(tab: TabName) {
    mobileStorage.setItem(ACTIVE_TAB_KEY, tab);
}

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/** Spread onto a FlatList / ScrollView / SectionList. */
export type HomeScrollProps = {
    onScroll: (e: ScrollEvent) => void;
    onScrollBeginDrag: (e: ScrollEvent) => void;
    onScrollEndDrag: (e: ScrollEvent) => void;
    onMomentumScrollBegin: (e: ScrollEvent) => void;
    onMomentumScrollEnd: (e: ScrollEvent) => void;
    scrollEventThrottle: number;
};

type HomeCtx = {
    channels: Channel[];
    loadingChannels: boolean;
    isAdminOfAnyChannel: boolean;

    allChannels: Channel[]; // browsable / not-yet-joined
    loadingAllChannels: boolean;

    activeChannel?: Channel;
    activeChannelId?: string;
    setActiveChannelId: (id: string) => void;

    joiningChannelIds: Set<string>;
    joinChannel: (channel: Channel) => Promise<void>;

    reloadChannels: () => Promise<void>;

    /** Currently visible tab; screens may gate queries on it. */
    activeTab: TabName;
    /** Switch tabs; synchronously shows the header. */
    setActiveTab: (tab: TabName) => void;

    headerVisible: boolean;
    /** Legacy entry point; prefer spreading `scrollProps` onto the list. */
    reportScroll: (offsetY: number) => void;
    scrollProps: HomeScrollProps;
    resetHeaderOnTabChange: () => void;
};

const noopScrollProps: HomeScrollProps = {
    onScroll: () => { },
    onScrollBeginDrag: () => { },
    onScrollEndDrag: () => { },
    onMomentumScrollBegin: () => { },
    onMomentumScrollEnd: () => { },
    scrollEventThrottle: 16,
};

const Ctx = createContext<HomeCtx>({
    channels: NO_CHANNELS,
    loadingChannels: false,
    isAdminOfAnyChannel: false,
    allChannels: NO_CHANNELS,
    loadingAllChannels: false,
    activeChannel: undefined,
    activeChannelId: undefined,
    setActiveChannelId: () => { },
    joiningChannelIds: new Set(),
    joinChannel: async () => { },
    reloadChannels: async () => { },
    activeTab: 'Chats',
    setActiveTab: () => { },
    headerVisible: true,
    reportScroll: () => { },
    scrollProps: noopScrollProps,
    resetHeaderOnTabChange: () => { },
});

export function HomeProvider({ children }: { children: ReactNode }) {
    const { userId, username, authToken, isLoggedIn } = useAuth();
    const queryClient = useQueryClient();

    const channelsKey = useMemo(() => ['channels', userId] as const, [userId]);
    const browsableKey = useMemo(() => ['channels', 'browsable'] as const, []);

    // ── joined channels ──────────────────────────────────────────
    const channelsQuery = useQuery({
        queryKey: channelsKey,
        queryFn: () => getUserChannels(userId!, authToken!),
        enabled: !!userId && !!authToken,
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const channels = channelsQuery.data ?? NO_CHANNELS;

    // ── browsable channels (not joined yet) ──────────────────────
    const needsBrowsing = !isLoggedIn || channels.length < MAX_CHANNELS;

    const browsableQuery = useQuery({
        queryKey: browsableKey,
        queryFn: async () => {
            const fetched = await getAllChannels(authToken ?? undefined);
            const joinedIds = new Set(channels.map((c) => c.channelId));
            return fetched.filter((c) => !joinedIds.has(c.channelId));
        },
        enabled: needsBrowsing,
        placeholderData: (prev) => prev,
    });

    const allChannels = needsBrowsing ? browsableQuery.data ?? NO_CHANNELS : NO_CHANNELS;

    // ── active channel (persisted) ───────────────────────────────
    const [activeChannelId, setActiveChannelIdState] = useState<string | undefined>(
        () => readStoredActiveChannelId(),
    );

    const setActiveChannelId = useCallback((id: string) => {
        setActiveChannelIdState(id);
        writeStoredActiveChannelId(id);
    }, []);

    useEffect(() => {
        if (!activeChannelId && channels[0]?.channelId) {
            setActiveChannelId(channels[0].channelId);
        }
    }, [activeChannelId, channels, setActiveChannelId]);

    useEffect(() => {
        if (!userId && !isLoggedIn) {
            setActiveChannelIdState(undefined);
            writeStoredActiveChannelId(undefined);
        }
    }, [userId, isLoggedIn]);

    // ── join a browsable channel directly ────────────────────────
    const [joiningChannelIds, setJoiningChannelIds] = useState<Set<string>>(new Set());

    const joinChannel = useCallback(
        async (channel: Channel) => {
            if (!isLoggedIn || !userId || !authToken) return;
            if (channels.length >= MAX_CHANNELS) return;
            if (joiningChannelIds.has(channel.channelId)) return;

            setJoiningChannelIds((prev) => new Set(prev).add(channel.channelId));
            try {
                await joinChannelApi(
                    channel.channelId,
                    { userId, username: username ?? '' },
                    authToken,
                );
                setActiveChannelId(channel.channelId);
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: channelsKey }),
                    queryClient.invalidateQueries({ queryKey: browsableKey }),
                ]);
            } catch (e) {
                console.error('joinChannel failed:', e);
            } finally {
                setJoiningChannelIds((prev) => {
                    const next = new Set(prev);
                    next.delete(channel.channelId);
                    return next;
                });
            }
        },
        [
            isLoggedIn,
            userId,
            username,
            authToken,
            channels.length,
            joiningChannelIds,
            queryClient,
            channelsKey,
            browsableKey,
            setActiveChannelId,
        ],
    );

    const reloadChannels = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: channelsKey });
    }, [queryClient, channelsKey]);

    const activeChannel = useMemo(
        () => channels.find((c) => c.channelId === activeChannelId),
        [channels, activeChannelId],
    );

    const isAdminOfAnyChannel = useMemo(
        () => channels.some((c) => c.isAdmin),
        [channels],
    );

    // ── header/chip-row visibility, driven by USER scrolling ─────
    const [headerVisible, setHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);
    const dragging = useRef(false);
    const momentum = useRef(false);
    const gestureAware = useRef(false);

    const reportScroll = useCallback((offsetY: number) => {
        if (offsetY <= 0) {
            setHeaderVisible(true);
            lastScrollY.current = 0;
            return;
        }

        const userDriven = !gestureAware.current || dragging.current || momentum.current;
        if (!userDriven) {
            lastScrollY.current = offsetY;
            return;
        }

        const diff = offsetY - lastScrollY.current;
        if (diff > SCROLL_THRESHOLD) {
            setHeaderVisible(false);
            lastScrollY.current = offsetY;
        } else if (diff < -SCROLL_THRESHOLD) {
            setHeaderVisible(true);
            lastScrollY.current = offsetY;
        }
    }, []);

    const resetHeaderOnTabChange = useCallback(() => {
        lastScrollY.current = 0;
        dragging.current = false;
        momentum.current = false;
        setHeaderVisible(true);
    }, []);

    // ── active tab (persisted) ───────────────────────────────────
    const [activeTab, setActiveTabState] = useState<TabName>(() => readStoredActiveTab());

    const setActiveTab = useCallback((tab: TabName) => {
        setActiveTabState((prev) => {
            if (prev === tab) return prev;
            writeStoredActiveTab(tab);
            return tab;
        });
        resetHeaderOnTabChange();
    }, [resetHeaderOnTabChange]);

    const scrollProps = useMemo<HomeScrollProps>(
        () => ({
            onScroll: (e) => reportScroll(e.nativeEvent.contentOffset.y),
            onScrollBeginDrag: (e) => {
                gestureAware.current = true;
                dragging.current = true;
                lastScrollY.current = Math.max(0, e.nativeEvent.contentOffset.y);
            },
            onScrollEndDrag: () => {
                dragging.current = false;
            },
            onMomentumScrollBegin: () => {
                momentum.current = true;
            },
            onMomentumScrollEnd: () => {
                momentum.current = false;
            },
            scrollEventThrottle: 16,
        }),
        [reportScroll],
    );

    const loadingChannels = channelsQuery.isLoading;
    const loadingAllChannels = browsableQuery.isLoading && needsBrowsing;

    const value = useMemo<HomeCtx>(
        () => ({
            channels,
            loadingChannels,
            isAdminOfAnyChannel,
            allChannels,
            loadingAllChannels,
            activeChannel,
            activeChannelId,
            setActiveChannelId,
            joiningChannelIds,
            joinChannel,
            reloadChannels,
            activeTab,
            setActiveTab,
            headerVisible,
            reportScroll,
            scrollProps,
            resetHeaderOnTabChange,
        }),
        [
            channels,
            loadingChannels,
            isAdminOfAnyChannel,
            allChannels,
            loadingAllChannels,
            activeChannel,
            activeChannelId,
            setActiveChannelId,
            joiningChannelIds,
            joinChannel,
            reloadChannels,
            activeTab,
            setActiveTab,
            headerVisible,
            reportScroll,
            scrollProps,
            resetHeaderOnTabChange,
        ],
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useHome = () => useContext(Ctx);

/**
 * One hook for Chats / Feed lists: scroll handlers that drive the header,
 * plus the top padding (header height) so content starts below the overlay.
 */
export function useHomeList() {
    const { scrollProps } = useHome();
    const topInset = useHeaderInset();
    return { scrollProps, topInset };
}