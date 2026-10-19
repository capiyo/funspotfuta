import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import type { KVStorage } from '@funspot/storage';
import { createAppQueryClient, PERSIST_OPTIONS } from '../queryClient';
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

    const restarted = new QueryClient();
    await persistQueryClientRestore({
      queryClient: restarted,
      persister: client.persister,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...PERSIST_OPTIONS,
    });
    expect(restarted.getQueryData(key)).toBeUndefined();
    expect(PERSIST_OPTIONS.buster).toBe('v4');
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
