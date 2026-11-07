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

import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, hydrate } from '@tanstack/react-query';
import {
    persistQueryClientSave,
    persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client';
import {
    createAppQueryClient,
    PERSIST_OPTIONS,
    deserializePersistedClient,
    feedQueryOptions,
} from '@funspot/core';
import { mobileCache, mobileStorage, mobileStorageReady } from '@funspot/storage';

const { queryClient, persister, persistOptions, resumePersistence } = createAppQueryClient(mobileStorage);

/**
 * Clear both live query state and its durable snapshot before changing the
 * authenticated identity. This is intentionally exported for AuthProvider:
 * account boundaries must not depend on a screen being mounted.
 */
export async function clearMobileQueryCache(): Promise<void> {
    await queryClient.cancelQueries();
    queryClient.clear();
    await persister.removeClient();
    resumePersistence();
}

// MMKV is synchronous. Hydrate the in-memory QueryClient before React mounts,
// so cached screens can render on the very first frame instead of waiting for
// PersistQueryClientProvider's async restore lifecycle.
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
function hydrateFromSynchronousAppCache(): void {
    try {
        const serialized = mobileCache.getItem('FUNSPOT_QUERY_CACHE');
        if (!serialized) return;
        const persisted = deserializePersistedClient(serialized);
        if (
            !Number.isFinite(persisted.timestamp) ||
            Date.now() - persisted.timestamp > CACHE_MAX_AGE ||
            persisted.timestamp > Date.now() + 60_000 ||
            persisted.buster !== PERSIST_OPTIONS.buster
        ) return;
        hydrate(queryClient, persisted.clientState);
    } catch (error) {
        if (__DEV__) console.warn('[query-cache] synchronous startup hydration failed', error);
    }
}


// Keep in sync with FeedScreen's PAGE_SIZE and query shape.
const BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

function prefetchStartupData() {
    // Refresh the persisted snapshots, not just mounted screens. These queries
    // are cache-first at startup, then quietly refreshed while the app is active.
    void queryClient.prefetchInfiniteQuery(feedQueryOptions());
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
    const persistenceUnsubscribe = useRef<(() => void) | null>(null);
    const [storageReady, setStorageReady] = useState(false);

    useEffect(() => {
        let active = true;
        void mobileStorageReady.then(() => {
            if (!active) return;
            // Restore from synchronous encrypted MMKV before mounting screens.
            // Subscribe directly instead of mounting PersistQueryClientProvider,
            // which would perform a second async restore and hold the whole app
            // behind it even though the same snapshot is already hydrated.
            hydrateFromSynchronousAppCache();
            persistenceUnsubscribe.current = persistQueryClientSubscribe({
                queryClient,
                persister,
                ...PERSIST_OPTIONS,
            });
            restored.current = true;
            prefetchStartupData();
            onReady?.();
            setStorageReady(true);
        });
        return () => {
            active = false;
            restored.current = false;
            persistenceUnsubscribe.current?.();
            persistenceUnsubscribe.current = null;
        };
    }, [onReady]);

    useEffect(() => {
        onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => {
            setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
        }));
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

    if (!storageReady) return null;

    return <>{children}</>;
}