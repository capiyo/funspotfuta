import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '../api/config';
import { channelFromJson, type Channel } from '../types/channels';
import { queryKeys } from './queryKeys';

function channelListFromResponse(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') throw new Error('Invalid channels response');
  const value = payload as Record<string, unknown>;
  if (Array.isArray(value.channels)) return value.channels;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.fixtures)) return value.fixtures;
  throw new Error('Invalid channels response: expected an array');
}

/** Shared cache-first public channel query for web and mobile. */
export function useAllChannels(authToken?: string | null) {
  return useQuery<Channel[]>({
    queryKey: queryKeys.channels(),
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/channels/all`, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`GET channels failed: HTTP ${response.status}`);
      const payload: unknown = await response.json();
      return channelListFromResponse(payload).map((item) => channelFromJson(item as Record<string, unknown>));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}
