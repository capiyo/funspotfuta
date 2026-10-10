import { useRef } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  createAppQueryClient,
  getAllFixtures,
  getPosts,
} from '@funspot/core';
import { webStorage } from '@funspot/storage';

const { queryClient, persistOptions } = createAppQueryClient(webStorage);
const FEED_PAGE_SIZE = 10;

function prefetchStartupData() {
  void queryClient.prefetchQuery({
    queryKey: ['fixtures'],
    queryFn: getAllFixtures,
  });
  void queryClient.prefetchInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => getPosts({ page: pageParam, limit: FEED_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: { posts: unknown[] }, allPages: unknown[]) =>
      lastPage.posts.length === FEED_PAGE_SIZE ? allPages.length + 1 : undefined,
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const restored = useRef(false);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => {
        if (restored.current) return;
        restored.current = true;
        prefetchStartupData();
      }}
      onError={() => {
        // If a saved snapshot is corrupt or expired, start with an empty cache.
        if (restored.current) return;
        restored.current = true;
        prefetchStartupData();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
