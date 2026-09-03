'use client';

// Simplified port of funspot/lib/modals/homepage/channel_creation.dart —
// the original (1049 lines) also handles searching/inviting comrades inline;
// that piece depends on comrade_service.dart's search endpoint and is left
// as Phase-2 follow-up work (see README). Channel creation itself is fully
// wired to the real POST /api/channels/ endpoint.

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { createChannel } from '@funspot/core';

export function ChannelCreationModal({ onClose }: { onClose: () => void }) {
  const { userId, username, authToken } = useAuth();
  const [name, setName] = useState('');
  const [season, setSeason] = useState('2025/26');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give your channel a name');
      return;
    }
    if (!userId || !username || !authToken) {
      setError('Log in to create a channel');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createChannel({
      name: name.trim(),
      createdBy: userId,
      createdByUsername: username,
      season,
      members: [{ id: userId, username }],
      authToken,
    });
    setSubmitting(false);
    if (result.success) onClose();
    else setError(result.message ?? 'Failed to create channel');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-funspot-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-600" />
        <h2 className="mb-4 text-lg font-bold text-white">Create Channel</h2>

        <label className="mb-1 block text-xs text-gray-400">Channel name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunday League Squad"
          className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-funspot-green"
        />

        <label className="mb-1 block text-xs text-gray-400">Season</label>
        <input
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-funspot-green"
        />

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={submitting}
          className="w-full rounded-xl bg-funspot-green py-3 text-sm font-semibold text-black disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create Channel'}
        </button>
      </div>
    </div>
  );
}
