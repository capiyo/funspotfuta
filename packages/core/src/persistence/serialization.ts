import type { PersistedClient } from '@tanstack/query-persist-client-core';

const TAG = '__funspotPersistedType';

/** JSON serialization that preserves Date values and explicit undefined values. */
export function serializePersistedClient(client: PersistedClient): string {
  return JSON.stringify(client, function (key, item: unknown) {
    // Date#toJSON executes before the replacer sees the value; inspect the
    // original property to preserve its runtime type.
    const original = this && typeof this === 'object'
      ? (this as Record<string, unknown>)[key]
      : undefined;
    if (original instanceof Date) return { [TAG]: 'Date', value: original.toISOString() };
    if (original === undefined) return { [TAG]: 'Undefined' };
    return item;
  });
}

export function deserializePersistedClient(serialized: string): PersistedClient {
  return JSON.parse(serialized, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const tagged = item as Record<string, unknown>;
    if (tagged[TAG] === 'Date' && typeof tagged.value === 'string') return new Date(tagged.value);
    if (tagged[TAG] === 'Undefined') return undefined;
    return item;
  }) as PersistedClient;
}
