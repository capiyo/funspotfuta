'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '@funspot/core';
import { webStorage } from '@funspot/storage';

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [{ queryClient }] = useState(() => createAppQueryClient(webStorage));

    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}