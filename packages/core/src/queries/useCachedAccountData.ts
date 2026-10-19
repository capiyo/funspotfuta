import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserComrades } from '../api/comrade-service';
import { getProfile, type UserProfile } from '../api/profile-service';
import { mergeCachedList, queryKeys } from './queryKeys';

/**
 * Cache-first profile read shared by web and mobile. userId is part of the
 * key so account switching cannot reuse another account's profile.
 */
export function useCachedProfile(userId?: string, authToken?: string | null) {
  return useQuery({
    queryKey: userId ? queryKeys.profile(userId) : ['profile', 'anonymous'],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!userId) return null;
      return getProfile(userId, authToken ?? undefined);
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Cache-first comrade list. The key is user-scoped; the bearer token is never
 * part of the key or the cached result.
 */
export function useCachedComrades(userId?: string, authToken?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = userId ? queryKeys.comrades(userId) : ['comrades', 'anonymous'];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const incoming = await getUserComrades(userId as string, authToken);
      const cached = queryClient.getQueryData<Record<string, unknown>[]>(queryKey);
      return mergeCachedList(cached, incoming, (item) => {
        const value = item.comrade_id ?? item.id ?? item._id;
        return value === undefined || value === null ? undefined : String(value);
      });
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}
