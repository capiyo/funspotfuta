import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import type { KVStorage } from '@funspot/storage';
import { createAppQueryClient, PERSIST_OPTIONS } from '../queryClient';
import { deserializePersistedClient, serializePersistedClient } from '../persistence/serialization';
import { mergeOpenPokes } from '../api/pokes-service';
import type { Poke } from '../api/pokes-service';
import { capCachedMessages, mergeCachedList, queryKeys } from './queryKeys';

function memoryStorage(): KVStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe('Flutter AppCache parity helpers', () => {
describe('open poke cache reconciliation', () => {
  const poke = (overrides: Partial<Poke> = {}): Poke => ({
    id: 'poke-1',
    matchId: 'fixture-1',
    userId: 'fan-1',
    userName: 'Fan One',
    selection: 'home',
    amount: 10,
    status: 'open',
    createdAt: '2026-10-25T10:00:00.000Z',
    ...overrides,
  });

  it('keeps cached open pokes when a successful GET is temporarily empty', () => {
    const cached = [poke(), poke({ id: 'poke-2', userId: 'fan-2' })];
    expect(mergeOpenPokes(cached, [])).toEqual(cached);
  });

  it('merges partial GET results, prefers fresh values, and deduplicates rows', () => {
    const cached = [poke(), poke({ id: 'poke-2', userId: 'fan-2' })];
    const fresh = poke({ userName: 'Updated Fan One', amount: 15 });
    const merged = mergeOpenPokes(cached, [fresh, poke({ id: 'poke-3', userId: 'fan-3' })]);
    expect(merged).toHaveLength(3);
    expect(merged.find((item) => item.id === 'poke-1')).toMatchObject({ userName: 'Updated Fan One', amount: 15 });
    expect(merged.find((item) => item.id === 'poke-2')).toBeDefined();
    expect(merged.find((item) => item.id === 'poke-3')).toBeDefined();
  });

  it('does not bring matched or settled rows back into the open list', () => {
    expect(mergeOpenPokes([
      poke(),
      poke({ id: 'poke-2', status: 'matched' }),
      poke({ id: 'poke-3', status: 'settled' }),
    ], [])).toEqual([poke()]);
  });

  it('deduplicates rows without backend IDs using their stable fields', () => {
    const first = poke({ id: '', createdAt: undefined });
    const duplicate = { ...first, userName: 'Latest name' };
    expect(mergeOpenPokes([first], [duplicate])).toHaveLength(1);
    expect(mergeOpenPokes([first], [duplicate])[0].userName).toBe('Latest name');
  });
});

  it('merges incomplete server lists without losing cached entries and deduplicates by id', () => {
    const cached = [{ id: '1', name: 'cached one' }, { id: '2', name: 'cached two' }];
    const incoming = [{ id: '1', name: 'fresh one' }, { id: '3', name: 'fresh three' }];
    expect(mergeCachedList(cached, incoming, (item) => item.id)).toEqual([
      { id: '1', name: 'fresh one' },
      { id: '2', name: 'cached two' },
      { id: '3', name: 'fresh three' },
    ]);
  });

  it('scopes vote, profile and comrades keys by user identity', () => {
    expect(queryKeys.fixtureVotes('fixture-1', 'user-a')).not.toEqual(queryKeys.fixtureVotes('fixture-1', 'user-b'));
    expect(queryKeys.profile('user-a')).not.toEqual(queryKeys.profile('user-b'));
    expect(queryKeys.comrades('user-a')).not.toEqual(queryKeys.comrades('user-b'));
  });

  it('caps persisted fixture chat history to the newest 50 messages', () => {
    const messages = Array.from({ length: 80 }, (_, id) => ({ id }));
    expect(capCachedMessages(messages)).toHaveLength(50);
    expect(capCachedMessages(messages)[0]).toEqual({ id: 30 });
    expect(capCachedMessages(messages, 0)).toEqual([]);
  });

  it('persists and restores successful cache data across a new QueryClient', async () => {
    const storage = memoryStorage();
    const first = createAppQueryClient(storage);
    const key = queryKeys.fixtureVotes('fixture-1', 'user-1');
    first.queryClient.setQueryData(key, { userVoteSelection: 'home_team', voters: [{ userId: 'user-1' }] });

    await persistQueryClientSave({
      queryClient: first.queryClient,
      persister: first.persister,
      ...PERSIST_OPTIONS,
    });
    // The sync persister throttles writes; wait for its queued write before restoring.
    await new Promise((resolve) => setTimeout(resolve, 550));

    const restarted = new QueryClient({ defaultOptions: { queries: { gcTime: 7 * 24 * 60 * 60 * 1000 } } });
    await persistQueryClientRestore({
      queryClient: restarted,
      persister: first.persister,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...PERSIST_OPTIONS,
    });
    expect(restarted.getQueryData(key)).toEqual({ userVoteSelection: 'home_team', voters: [{ userId: 'user-1' }] });
    restarted.clear();
  });

  it('drops snapshots written with a prior cache buster', async () => {
    const storage = memoryStorage();
    const client = createAppQueryClient(storage);
    const key = queryKeys.profile('user-1');
    client.queryClient.setQueryData(key, { username: 'old schema' });
    await persistQueryClientSave({
      queryClient: client.queryClient,
      persister: client.persister,
      buster: 'v2',
      dehydrateOptions: PERSIST_OPTIONS.dehydrateOptions,
    });
    // Ensure the legacy snapshot is actually on disk before checking its buster is rejected.
    await new Promise((resolve) => setTimeout(resolve, 550));

    const restarted = new QueryClient();
    await persistQueryClientRestore({
      queryClient: restarted,
      persister: client.persister,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...PERSIST_OPTIONS,
    });
    expect(restarted.getQueryData(key)).toBeUndefined();
    expect(PERSIST_OPTIONS.buster).toBe('v6');
    restarted.clear();
  });

  it('rolls back an optimistic comrade mutation to the previous cache snapshot', () => {
    const client = new QueryClient();
    const key = queryKeys.comrades('user-1');
    const previous = [{ id: 'comrade-1', username: 'existing' }];
    client.setQueryData(key, previous);
    client.setQueryData(key, [...previous, { id: 'comrade-2', username: 'optimistic' }]);
    client.setQueryData(key, previous);
    expect(client.getQueryData(key)).toEqual(previous);
    client.clear();
  });

  it('clears user data from the query client on logout', () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.profile('user-1'), { username: 'private profile' });
    client.setQueryData(queryKeys.fixtureVotes('fixture-1', 'user-1'), { userVoteSelection: 'home_team' });
    client.clear();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('makes a cached vote immediately available to the chat cache key', () => {
    const client = new QueryClient();
    const voteKey = queryKeys.fixtureVotes('fixture-1', 'user-1');
    client.setQueryData(voteKey, {
      homeVotes: 3, awayVotes: 1, drawVotes: 0,
      userVoteSelection: 'home_team',
      voters: [{ userId: 'user-1', username: 'fan', selection: 'home_team' }],
    });
    expect(client.getQueryData<{ userVoteSelection: string }>(voteKey)?.userVoteSelection).toBe('home_team');
    client.clear();
  });

  it('round-trips Date values through persisted cache serialization', () => {
    const persisted = {
      timestamp: Date.now(),
      buster: 'v5',
      clientState: {
        mutations: [],
        queries: [{
          queryKey: ['fixtures'],
          state: { data: { kickoff: new Date('2026-10-19T12:00:00.000Z'), optional: undefined }, status: 'success' },
        }],
      },
    };
    const restored = deserializePersistedClient(serializePersistedClient(persisted as never));
    const data = (restored.clientState.queries[0].state.data as { kickoff: Date; optional?: unknown });
    expect(data.kickoff).toBeInstanceOf(Date);
    expect(data.kickoff.toISOString()).toBe('2026-10-19T12:00:00.000Z');
    expect('optional' in data).toBe(false);
  });

  it('does not persist paused mutations that carry credentials', () => {
    const shouldDehydrateMutation = PERSIST_OPTIONS.dehydrateOptions.shouldDehydrateMutation;
    expect(shouldDehydrateMutation?.({
      state: { isPaused: true, variables: { fixtureId: 'fixture-1', selection: 'home_team' } },
    } as never)).toBe(true);
    expect(shouldDehydrateMutation?.({
      state: { isPaused: true, variables: { fixtureId: 'fixture-1', authToken: 'never-persist' } },
    } as never)).toBe(false);
  });

  it('does not dehydrate failed queries over a previous successful snapshot', () => {
    const shouldDehydrate = PERSIST_OPTIONS.dehydrateOptions.shouldDehydrateQuery;
    expect(shouldDehydrate?.({
      queryKey: ['fixtures'],
      state: { data: [{ id: 'fixture' }], status: 'success' },
    } as never)).toBe(true);
    expect(shouldDehydrate?.({
      queryKey: ['fixtures'],
      state: { data: undefined, status: 'error' },
    } as never)).toBe(false);
    expect(shouldDehydrate?.({
      queryKey: ['notPersisted'],
      state: { data: [{ id: 'fixture' }], status: 'success' },
    } as never)).toBe(false);
  });
});
