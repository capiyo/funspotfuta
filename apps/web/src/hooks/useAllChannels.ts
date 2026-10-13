import { useQuery } from '@tanstack/react-query';
import type { Channel } from '@funspot/core';
import { channelFromJson } from '@funspot/core/src/api/channels-service';
import { apiFetch } from '@/lib/api/api-client';

/** Fetch public/discoverable channels for guests and signed-in users; failures remain errors so React Query can retry. */
export function useAllChannels(authToken?: string | null) {
  return useQuery<Channel[]>({
    queryKey: ['channels', 'all-public'],
    queryFn: async () => {
      const response = await apiFetch('channels/all', {}, authToken ?? undefined);
      if (!response.ok) throw new Error(`Failed to fetch channels: ${response.status}`);
      const payload = await response.json() as { channels?: unknown; data?: unknown };
      const list = Array.isArray(payload) ? payload : Array.isArray(payload.channels) ? payload.channels : Array.isArray(payload.data) ? payload.data : null;
      if (!list) throw new Error('Invalid channels response');
      return list.map((channel) => channelFromJson(channel as Record<string, any>));
    },
    enabled: true,
  });
}
