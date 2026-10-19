import { useQuery } from '@tanstack/react-query';
import type { QueryFunctionContext } from '@tanstack/react-query';
import { getUserComrades } from '../api/comrade-service';
import { getProfile, type UserProfile } from '../api/profile-service';
import { mergeCachedList, queryKeys } from './queryKeys';

export function profileQueryOptions(userId: string, authToken?: string | null) {
  return {
    queryKey: queryKeys.profile(userId),
    queryFn: (): Promise<UserProfile | null> => getProfile(userId, authToken ?? undefined),
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  } as const;
}

export function comradesQueryOptions(userId: string, authToken?: string | null) {
  const queryKey = queryKeys.comrades(userId);
  return {
    queryKey,
    queryFn: async ({ client }: QueryFunctionContext) => {
      const incoming = await getUserComrades(userId, authToken);
      const cached = client.getQueryData<Record<string, any>[]>(queryKey);
      return mergeCachedList(cached, incoming, (item) => {
        const value = item.comrade_id ?? item.id ?? item._id;
        return value === undefined || value === null ? undefined : String(value);
      });
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  } as const;
}

/**
 * Cache-first profile read shared by web and mobile. userId is part of the
 * key so account switching cannot reuse another account's profile.
 */
export function useCachedProfile(userId?: string, authToken?: string | null) {
  return useQuery({
    ...(userId ? profileQueryOptions(userId, authToken) : { queryKey: ['profile', 'anonymous'] as const, queryFn: async () => null }),
    enabled: Boolean(userId),
  });
}

/**
 * Cache-first comrade list. The key is user-scoped; the bearer token is never
 * part of the key or the cached result.
 */
export function useCachedComrades(userId?: string, authToken?: string | null) {
  return useQuery({
    ...(userId ? comradesQueryOptions(userId, authToken) : { queryKey: ['comrades', 'anonymous'] as const, queryFn: async () => [] }),
    enabled: Boolean(userId),
  });
}
