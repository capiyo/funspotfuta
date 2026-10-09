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
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createChannel({
        name: name.trim(),
        createdBy: userId,
        createdByUsername: username,
        season,
        members: [{ id: userId, username }],
        authToken,
      });
      if (result.success) onClose();
      else setError(result.message ?? 'Failed to create channel');
    } catch (requestError) {
      console.error('Could not create channel', requestError);
      setError('Could not create channel. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-fan-surface p-fan-xxl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-fan-lg h-1 w-10 rounded-fan-pill bg-gray-600" />
        <h2 className="mb-fan-lg text-lg font-bold text-fan-textPrimary">Create Channel</h2>

        <label className="mb-fan-sm block text-fan-caption text-fan-textTertiary">Channel name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunday League Squad"
          className="mb-fan-base w-full rounded-fan-lg border border-fan-border bg-fan-inputSurface px-fan-base py-fan-md text-fan-body text-fan-textPrimary outline-none focus:border-fan-primary"
        />

        <label className="mb-fan-sm block text-fan-caption text-fan-textTertiary">Season</label>
        <input
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="mb-fan-lg w-full rounded-fan-lg border border-fan-border bg-fan-inputSurface px-fan-base py-fan-md text-fan-body text-fan-textPrimary outline-none focus:border-fan-primary"
        />

        {error && <p className="mb-fan-base text-fan-caption text-fan-away">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={submitting}
          className="w-full rounded-fan-lg bg-fan-primary py-fan-base text-fan-body font-semibold text-fan-textInverse disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create Channel'}
        </button>
      </div>
    </div>
  );
}
