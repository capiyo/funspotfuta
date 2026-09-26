// QueryProvider.tsx
//
// Creates the app's QueryClient (with MMKV-backed persistence via
// createAppQueryClient) and wraps children in the plain QueryClientProvider.
//
// Persistence and rehydration are already wired inside createAppQueryClient.
// We await its rehydratePromise here and call `onReady` when the cache has
// been read from MMKV and merged into the client. App.tsx gates the nav tree
// on that signal so screens mount with a warm cache.

import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { createAppQueryClient } from '@funspot/core';
import { mobileStorage } from '@funspot/storage';

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
    const [client] = useState(() => {
        const { queryClient, rehydratePromise } = createAppQueryClient(mobileStorage);
        return { queryClient, rehydratePromise };
    });

    useEffect(() => {
        const subscription = AppState.addEventListener('change', onAppStateChange);
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        let cancelled = false;
        client.rehydratePromise
            .then(() => {
                if (!cancelled) onReady?.();
            })
            .catch(() => {
                // Rehydration failed (corrupt cache, storage error). Still signal
                // ready so the app can render — screens will fetch fresh data.
                if (!cancelled) onReady?.();
            });
        return () => {
            cancelled = true;
        };
    }, [client, onReady]);

    return (
        <QueryClientProvider client={client.queryClient}>
            {children}
        </QueryClientProvider>
    );
}