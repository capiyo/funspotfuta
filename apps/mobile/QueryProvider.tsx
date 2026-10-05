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

function prefetchStartupData() {
    queryClient.prefetchQuery({ queryKey: ['fixtures'], queryFn: getAllFixtures });
    queryClient.prefetchInfiniteQuery({
        queryKey: ['feed'],
        queryFn: ({ pageParam }) => getPosts({ page: pageParam, limit: FEED_PAGE_SIZE }),
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
        const subscription = AppState.addEventListener('change', (status) => {
            onAppStateChange(status);

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
        return () => subscription.remove();
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