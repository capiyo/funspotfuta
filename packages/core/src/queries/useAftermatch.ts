// packages/core/src/queries/use-aftermatch.ts
import { useQuery } from '@tanstack/react-query';
import { fetchAftermatch } from '../api/aftermatch_service';
import type { Fixture } from '../types/fixture';

export function useAftermatch(
  fixture: Fixture | null,
  channelId: string | null,
  authToken: string | null,
) {
  return useQuery({
    queryKey: [
      'aftermatch',
      fixture?.matchId || fixture?.id,
      channelId,
    ],
    queryFn: () => fetchAftermatch(fixture!, channelId!, authToken),
    enabled: !!fixture && !!channelId,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}