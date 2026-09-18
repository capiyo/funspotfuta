'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '@funspot/core';
import { webStorage } from '@funspot/storage';

/**
 * Wrap your Next.js root layout with this once:
 *
 *   <QueryProvider>{children}</QueryProvider>
 *
 * useState(() => ...) ensures the client is created once per browser
 * session, not re-created on every render.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient(webStorage));

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
