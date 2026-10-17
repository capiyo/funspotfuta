import { useQuery } from '@tanstack/react-query';
import type { Channel } from '@funspot/core';
import { channelFromJson } from '@funspot/core/src/api/channels-service';
import { apiFetch, apiUrl } from '@/lib/api/api-client';

/** Fetch public/discoverable channels for guests and signed-in users; failures remain errors so React Query can retry. */
export function useAllChannels(authToken?: string | null) {
  return useQuery<Channel[]>({
    queryKey: ['channels', 'all-public'],
    queryFn: async () => {
      const url = apiUrl('channels/all');
      let status: number | undefined;
      try {
        const response = await apiFetch('channels/all', {}, authToken ?? undefined);
        status = response.status;
        if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status} ${response.statusText}`.trim());
        const payload = await response.json() as { channels?: unknown; data?: unknown; fixtures?: unknown };
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.channels) ? payload.channels
            : Array.isArray(payload.data) ? payload.data
              : Array.isArray(payload.fixtures) ? payload.fixtures : null;
        if (!list) throw new Error('Invalid channels response: expected an array, channels, data, or fixtures array');
        return list.map((channel) => channelFromJson(channel as Record<string, any>));
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[useAllChannels] GET channels failed', {
            url, status,
            message: error instanceof Error ? error.message : String(error),
            error,
          });
        }
        throw error;
      }
    },
    enabled: true,
  });
}
