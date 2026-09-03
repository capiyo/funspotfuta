'use client';

// New UI, functionally ported from the core data flows of
// lib/modals/homepage/admin_dashboard.dart (2,284 lines — the original also
// includes an in-dashboard payments UI, which is already covered by the
// wallet on /profile using the same payment-service.ts): channel stats,
// member list + removal, and admin payout compute.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { getChannelDetail, removeMember, ChannelDetail, computeAdminPayout } from '@funspot/core';

export default function AdminDashboardPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const { userId, authToken } = useAuth();
  const toast = useToast();

  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [computingPayout, setComputingPayout] = useState(false);

  async function refresh() {
    setLoading(true);
    const d = await getChannelDetail(channelId, authToken ?? undefined);
    setDetail(d);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  async function handleRemove(memberId: string) {
    if (!userId || !authToken) return;
    setRemovingId(memberId);
    const result = await removeMember(channelId, memberId, userId, authToken);
    setRemovingId(null);
    if (result.success) {
      toast.showSuccess('Member removed');
      refresh();
    } else {
      toast.showError(result.message ?? 'Failed to remove member');
    }
  }

  async function handleComputePayout() {
    setComputingPayout(true);
    const result = await computeAdminPayout(channelId, authToken ?? undefined);
    setComputingPayout(false);
    if (result.success) {
      toast.showSuccess(`Payout computed: KES ${result.amount} (${result.status})`);
    } else {
      toast.showError(result.message ?? 'Failed to compute payout');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
      </div>
    );
  }

  if (!detail) {
    return <p className="py-16 text-center text-sm text-gray-500">Channel not found or you don&apos;t have access.</p>;
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-10">
      <h1 className="mb-1 text-lg font-bold text-white">Admin Dashboard</h1>
      <p className="mb-4 text-xs text-gray-500">Channel {detail.channelId}</p>

      <div className="mb-6 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-funspot-surface p-3 text-center">
          <p className="text-lg font-bold text-white">{detail.memberCount}</p>
          <p className="text-[10px] text-gray-500">Members</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-funspot-surface p-3 text-center">
          <p className="text-lg font-bold text-white">{detail.totalMessages}</p>
          <p className="text-[10px] text-gray-500">Messages</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-funspot-surface p-3 text-center">
          <p className="text-lg font-bold text-white">{detail.messagesThisWeek}</p>
          <p className="text-[10px] text-gray-500">This week</p>
        </div>
      </div>

      <button
        onClick={handleComputePayout}
        disabled={computingPayout}
        className="mb-6 w-full rounded-xl bg-funspot-green py-2.5 text-sm font-semibold text-black disabled:opacity-60"
      >
        {computingPayout ? 'Computing…' : 'Compute Engagement Payout'}
      </button>

      <p className="mb-2 text-xs text-gray-400">Members</p>
      <div className="space-y-2">
        {detail.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between rounded-xl border border-white/10 bg-funspot-surface px-3 py-2">
            <span className="text-sm text-white">{m.username}</span>
            <button
              onClick={() => handleRemove(m.userId)}
              disabled={removingId === m.userId || m.userId === userId}
              className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400 disabled:opacity-40"
            >
              {removingId === m.userId ? '…' : 'Remove'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
