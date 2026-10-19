import { useInfiniteQuery } from '@tanstack/react-query';
import { getPosts } from '../api/posts-service';
import type { Post } from '../types/post';
import { queryKeys } from './queryKeys';

export interface FeedPage {
  posts: Post[];
}

/** Shared cache-first infinite feed for web and mobile. */
export function useFeed(options: { enabled?: boolean; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 10;
  return useInfiniteQuery({
    queryKey: queryKeys.feed(),
    queryFn: async ({ pageParam }) => {
      const response = await getPosts({ page: pageParam, limit: pageSize });
      return { posts: response.posts };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.posts.length === pageSize ? allPages.length + 1 : undefined,
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}
