import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { createAppQueryClient } from '@funspot/core';
import { mobileStorage } from '@funspot/storage';

function onAppStateChange(status: AppStateStatus) {
    focusManager.setFocused(status === 'active');
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => createAppQueryClient(mobileStorage));

    useEffect(() => {
        const subscription = AppState.addEventListener('change', onAppStateChange);
        return () => subscription.remove();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}