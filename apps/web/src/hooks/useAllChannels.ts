import { useQuery } from '@tanstack/react-query';
import { getAllChannels } from '@funspot/core';
import type { Channel } from '@funspot/core';

/** Public/discoverable channels, fetched for both guests and signed-in fans. */
export function useAllChannels(authToken?: string | null) {
  return useQuery<Channel[]>({
    queryKey: ['channels', 'all-public'],
    queryFn: () => getAllChannels(authToken ?? undefined),
    enabled: true,
    staleTime: 60_000,
    refetchOnMount: 'always',
  });
}
