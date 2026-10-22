// QueryProvider.tsx
//
// - Client + persister are created ONCE at module scope.
// - <PersistQueryClientProvider> restores the MMKV cache and holds queries
//   until restore finishes (no fetch-before-restore race).
// - onSuccess/onError => onReady(): hold your splash on this ONLY, never on
//   the network (MMKV restore takes milliseconds).
// - After restore, the main queries are prefetched in parallel so new users
//   (empty cache) don't wait for a tab to be opened. prefetchQuery skips the
//   network when fresh cached data exists.
// - On background/inactive the cache is flushed to disk, but never before the
//   restore has finished (that could overwrite the snapshot with an empty one).

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';
import {
    PersistQueryClientProvider,
    persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import {
    createAppQueryClient,
    PERSIST_OPTIONS,
    getAllFixtures,
    getPosts,
} from '@funspot/core';
import { mobileStorage } from '@funspot/storage';

const { queryClient, persister, persistOptions } = createAppQueryClient(mobileStorage);

// Keep in sync with FeedScreen's PAGE_SIZE and query shape.
const FEED_PAGE_SIZE = 10;
const BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

function prefetchStartupData() {
    // Refresh the persisted snapshots, not just mounted screens. These queries
    // are cache-first at startup, then quietly refreshed while the app is active.
    void queryClient.prefetchQuery({ queryKey: ['fixtures'], queryFn: getAllFixtures, staleTime: 0 });
    void queryClient.prefetchInfiniteQuery({
        queryKey: ['feed'],
        queryFn: ({ pageParam }) => getPosts({ page: pageParam, limit: FEED_PAGE_SIZE }),
        staleTime: 0,
        initialPageParam: 1,
        getNextPageParam: (lastPage: { posts: unknown[] }, allPages: unknown[]) =>
            lastPage.posts.length === FEED_PAGE_SIZE ? allPages.length + 1 : undefined,
    });
}

function onAppStateChange(status: AppStateStatus) {
    focusManager.setFocused(status === 'active');
}

export function QueryProvider({
    children,
    onReady,
}: {
    children: React.ReactNode;
    onReady?: () => void;
}) {
    const restored = useRef(false);

    useEffect(() => {
        let refreshTimer: ReturnType<typeof setInterval> | undefined;
        const startBackgroundRefresh = () => {
            if (refreshTimer) clearInterval(refreshTimer);
            // Keep the cache fresh even when the user is on Messages/Profile
            // rather than Chats/Feed. The timer is deliberately foreground-only.
            refreshTimer = setInterval(() => {
                if (restored.current) prefetchStartupData();
            }, BACKGROUND_REFRESH_MS);
        };
        const stopBackgroundRefresh = () => {
            if (refreshTimer) clearInterval(refreshTimer);
            refreshTimer = undefined;
        };

        if (AppState.currentState === 'active') startBackgroundRefresh();
        const subscription = AppState.addEventListener('change', (status) => {
            onAppStateChange(status);

            if (status === 'active') {
                // Timers pause while backgrounded; refresh immediately on resume
                // so the cached matches/feed do not stay stale after a long pause.
                if (restored.current) prefetchStartupData();
                startBackgroundRefresh();
            } else {
                stopBackgroundRefresh();
            }

            if ((status === 'background' || status === 'inactive') && restored.current) {
                persistQueryClientSave({
                    queryClient,
                    persister,
                    ...PERSIST_OPTIONS,
                }).catch((e) => {
                    console.warn('[QueryProvider] persist flush failed:', e);
                });
            }
        });
        return () => {
            stopBackgroundRefresh();
            subscription.remove();
        };
    }, []);

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
            onSuccess={() => {
                restored.current = true;
                prefetchStartupData();
                onReady?.();
            }}
            onError={() => {
                // Restore failed (corrupt snapshot etc.): carry on with an empty cache.
                restored.current = true;
                prefetchStartupData();
                onReady?.();
            }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}