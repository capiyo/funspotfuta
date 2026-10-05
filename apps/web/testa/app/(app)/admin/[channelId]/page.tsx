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
        <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
      </div>
    );
  }

  if (!detail) {
    return <p className="py-16 text-center text-fan-body text-fan-textTertiary">Channel not found or you don&apos;t have access.</p>;
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-10">
      <h1 className="mb-fan-sm font-condensed text-fan-headline text-fan-textPrimary">Admin Dashboard</h1>
      <p className="mb-fan-lg text-fan-caption text-fan-textTertiary">Channel {detail.channelId}</p>

      <div className="mb-fan-xxl grid grid-cols-3 gap-fan-md">
        <div className="rounded-fan-lg border border-fan-border bg-fan-surface p-fan-base text-center">
          <p className="font-condensed text-fan-statValue text-fan-textPrimary">{detail.memberCount}</p>
          <p className="text-[10px] text-fan-textTertiary">Members</p>
        </div>
        <div className="rounded-fan-lg border border-fan-border bg-fan-surface p-fan-base text-center">
          <p className="font-condensed text-fan-statValue text-fan-textPrimary">{detail.totalMessages}</p>
          <p className="text-[10px] text-fan-textTertiary">Messages</p>
        </div>
        <div className="rounded-fan-lg border border-fan-border bg-fan-surface p-fan-base text-center">
          <p className="font-condensed text-fan-statValue text-fan-textPrimary">{detail.messagesThisWeek}</p>
          <p className="text-[10px] text-fan-textTertiary">This week</p>
        </div>
      </div>

      <button
        onClick={handleComputePayout}
        disabled={computingPayout}
        className="mb-fan-xxl w-full rounded-fan-lg bg-fan-primary py-fan-md text-fan-body font-semibold text-fan-textInverse disabled:opacity-60"
      >
        {computingPayout ? 'Computing…' : 'Compute Engagement Payout'}
      </button>

      <p className="mb-fan-md text-fan-caption text-fan-textTertiary">Members</p>
      <div className="space-y-2">
        {detail.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between rounded-fan-lg border border-fan-border bg-fan-surface px-fan-base py-fan-md">
            <span className="text-fan-body text-fan-textPrimary">{m.username}</span>
            <button
              onClick={() => handleRemove(m.userId)}
              disabled={removingId === m.userId || m.userId === userId}
              className="rounded-fan-pill border border-fan-away/30 bg-fan-awayDim px-fan-base py-fan-sm text-fan-caption font-semibold text-fan-away disabled:opacity-40"
            >
              {removingId === m.userId ? '…' : 'Remove'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
