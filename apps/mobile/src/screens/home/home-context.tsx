// lib/home/home-context.tsx
//
// Shared home state — joined channels (for the tabs/chips), browsable
// channels (not-yet-joined, shown so the user can join), plus the active
// channel selection used by Arena/Feed/Logs.
//
// Mirrors home_page.dart's two-track channel loading:
//   - _loadUserChannels / _refreshChannelsInBackground -> reloadChannels()
//   - _fetchAllChannelsForBrowsing -> reloadBrowsableChannels()
//   - _maybeFetchAllChannelsForBrowsing -> the effect below that re-runs
//     browsable-fetch whenever login state or joined-channel count changes
//   - _joinChannelDirectly -> joinChannel()
//
// Channel identity is `channelId` (matches UserChannel.channelId in
// user_channel.dart) — there is no separate `id` field.

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from 'react';
import { getUserChannels, getAllChannels, joinChannel as joinChannelApi, type Channel } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';

export const MAX_CHANNELS = 3;

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
};

const Ctx = createContext<HomeCtx>({
    channels: [],
    loadingChannels: false,
    isAdminOfAnyChannel: false,
    allChannels: [],
    loadingAllChannels: false,
    activeChannel: undefined,
    activeChannelId: undefined,
    setActiveChannelId: () => { },
    joiningChannelIds: new Set(),
    joinChannel: async () => { },
    reloadChannels: async () => { },
});

export function HomeProvider({ children }: { children: ReactNode }) {
    const { userId, username, authToken, isLoggedIn } = useAuth();

    const [channels, setChannels] = useState<Channel[]>([]);
    const [loadingChannels, setLoadingChannels] = useState(false);
    const [activeChannelId, setActiveChannelId] = useState<string | undefined>();

    const [allChannels, setAllChannels] = useState<Channel[]>([]);
    const [loadingAllChannels, setLoadingAllChannels] = useState(false);

    const [joiningChannelIds, setJoiningChannelIds] = useState<Set<string>>(new Set());

    // ── joined channels ──────────────────────────────────────────
    const reloadChannels = useCallback(async () => {
        if (!userId || !authToken) {
            setChannels([]);
            setActiveChannelId(undefined);
            return;
        }
        setLoadingChannels(true);
        try {
            const list = await getUserChannels(userId, authToken);
            setChannels(list);
            setActiveChannelId((prev) => prev ?? list[0]?.channelId);
        } catch (e) {
            console.error('reloadChannels failed:', e);
            // keep whatever was already in state rather than wiping it
        } finally {
            setLoadingChannels(false);
        }
    }, [userId, authToken]);

    useEffect(() => {
        void reloadChannels();
    }, [reloadChannels]);

    // ── browsable channels (not joined yet) ──────────────────────
    // Mirrors _maybeFetchAllChannelsForBrowsing: fetch while logged out,
    // or logged in with room left (< MAX_CHANNELS); clear once full.
    const reloadBrowsableChannels = useCallback(async () => {
        const needsBrowsing = !isLoggedIn || channels.length < MAX_CHANNELS;
        if (!needsBrowsing) {
            setAllChannels([]);
            setLoadingAllChannels(false);
            return;
        }

        setLoadingAllChannels(true);
        try {
            const fetched = await getAllChannels(authToken ?? undefined);
            const joinedIds = new Set(channels.map((c) => c.channelId));
            setAllChannels(fetched.filter((c) => !joinedIds.has(c.channelId)));
        } catch (e) {
            console.error('reloadBrowsableChannels failed:', e);
        } finally {
            setLoadingAllChannels(false);
        }
    }, [isLoggedIn, authToken, channels]);

    useEffect(() => {
        void reloadBrowsableChannels();
        // channels.length (not the array identity) is what should
        // re-trigger this, same as Dart re-checking after join count changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn, channels.length]);

    // ── join a browsable channel directly ────────────────────────
    // Mirrors _joinChannelDirectly: direct add (not a request-to-join),
    // then revalidate both joined and browsable lists.
    const joinChannel = useCallback(
        async (channel: Channel) => {
            if (!isLoggedIn || !userId || !authToken) return;
            if (channels.length >= MAX_CHANNELS) return;
            if (joiningChannelIds.has(channel.channelId)) return;

            setJoiningChannelIds((prev) => new Set(prev).add(channel.channelId));
            try {
                await joinChannelApi(channel.channelId, { userId, username: username ?? '' }, authToken);
                setActiveChannelId(channel.channelId);
                await reloadChannels();
                // reloadBrowsableChannels re-runs automatically via the
                // channels.length effect above once reloadChannels resolves
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
        [isLoggedIn, userId, username, authToken, channels.length, joiningChannelIds, reloadChannels],
    );

    const activeChannel = useMemo(
        () => channels.find((c) => c.channelId === activeChannelId),
        [channels, activeChannelId],
    );

    const isAdminOfAnyChannel = useMemo(
        () => channels.some((c) => c.isAdmin),
        [channels],
    );

    return (
        <Ctx.Provider
            value={{
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
            }}
        >
            {children}
        </Ctx.Provider>
    );
}

export const useHome = () => useContext(Ctx);