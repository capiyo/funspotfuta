import { useQuery } from '@tanstack/react-query';
import { getUserComrades } from '../api/comrade-service';
import { getProfile, type UserProfile } from '../api/profile-service';
import { queryKeys } from './queryKeys';

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
  return useQuery({
    queryKey: userId ? queryKeys.comrades(userId) : ['comrades', 'anonymous'],
    queryFn: () => getUserComrades(userId as string, authToken),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}
