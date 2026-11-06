// New UI, functionally ported from the core data flows of
// lib/modals/homepage/admin_dashboard.dart (2,284 lines — the original also
// includes an in-dashboard payments UI, which is already covered by the
// wallet on /profile using the same payment-service.ts): channel stats,
// member list + removal, and admin payout compute.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { getChannelDetail, removeMember, ChannelDetail, computeAdminPayout, AdminPayoutResult } from '@funspot/core';

export default function AdminDashboardPage() {
  const { channelId = '' } = useParams<{ channelId: string }>();
  const { userId, authToken } = useAuth();
  const toast = useToast();

  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [computingPayout, setComputingPayout] = useState(false);
  const [payout, setPayout] = useState<AdminPayoutResult | null>(null);
  const [loadingPayout, setLoadingPayout] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const d = await getChannelDetail(channelId, authToken ?? undefined);
      setDetail(d);
    } catch (error) {
      console.error('Could not load admin dashboard', error);
      setDetail(null);
      toast.showError('Could not load channel admin details. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshPayout() {
    setLoadingPayout(true);
    try {
      const result = await computeAdminPayout(channelId, authToken ?? undefined);
      setPayout(result);
    } catch (error) {
      console.error('Could not load admin payout', error);
      setPayout({ success: false, message: 'Could not load payout status.' });
    } finally {
      setLoadingPayout(false);
    }
  }

  useEffect(() => {
    void refresh();
    void refreshPayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  async function handleRemove(memberId: string) {
    if (!userId || !authToken || removingId) return;
    const member = detail?.members.find((item) => item.userId === memberId);
    const name = member?.username ?? 'this member';
    if (!window.confirm(`Remove ${name} from this channel? This may affect their channel points (30-point warning).`)) return;

    setRemovingId(memberId);
    try {
      const result = await removeMember(channelId, memberId, userId, authToken);
      if (result.success) {
        toast.showSuccess('Member removed');
        await refresh();
      } else {
        toast.showError(result.message ?? 'Failed to remove member');
      }
    } catch (error) {
      console.error('Could not remove channel member', error);
      toast.showError('Could not remove this member. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }

  async function handleComputePayout() {
    if (computingPayout) return;
    setComputingPayout(true);
    try {
      const result = await computeAdminPayout(channelId, authToken ?? undefined);
      setPayout(result);
      if (result.success) {
        toast.showSuccess(`Payout computed: KES ${result.amount} (${result.status})`);
      } else {
        toast.showError(result.message ?? 'Failed to compute payout');
      }
    } catch (error) {
      console.error('Could not compute admin payout', error);
      toast.showError('Could not compute payout. Please try again.');
    } finally {
      setComputingPayout(false);
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
      <div className="mb-fan-sm flex items-center justify-between gap-fan-md">
        <h1 className="font-condensed text-fan-headline text-fan-textPrimary">Admin Dashboard</h1>
        <button onClick={() => void refresh()} disabled={loading} className="rounded-fan-pill border border-fan-border px-fan-md py-fan-sm text-fan-caption text-fan-textSecondary disabled:opacity-50">Refresh</button>
      </div>
      <p className="mb-fan-lg text-fan-caption text-fan-textTertiary">Channel {detail.channelId}</p>

      <section aria-label="Admin payout status" className="mb-fan-lg rounded-fan-xl border border-fan-border bg-fan-surface p-fan-lg">
        <div className="mb-fan-sm flex items-center justify-between gap-fan-md">
          <h2 className="text-fan-body font-semibold text-fan-textPrimary">Engagement payout</h2>
          <button onClick={() => void refreshPayout()} disabled={loadingPayout} className="rounded-fan-pill border border-fan-border px-fan-md py-fan-xs text-fan-caption text-fan-textSecondary disabled:opacity-50">{loadingPayout ? 'Checking…' : 'Refresh'}</button>
        </div>
        {loadingPayout ? (
          <p className="text-fan-caption text-fan-textTertiary">Checking payout status…</p>
        ) : payout?.success ? (
          <>
            <p className="font-condensed text-fan-statValue text-fan-textPrimary">KES {(payout.amount ?? 0).toLocaleString()}</p>
            <p className="text-fan-caption text-fan-textTertiary">{(payout.payoutType ?? 'engagement_rate').replace(/_/g, ' ')} · {payout.status ?? 'pending'} · {payout.computedAt?.toLocaleString() ?? 'Recently computed'}</p>
          </>
        ) : (
          <p className="text-fan-caption text-fan-textTertiary">{payout?.message ?? 'No payout has been computed yet.'}</p>
        )}
      </section>

      <div className="mb-fan-xxl grid grid-cols-2 gap-fan-md">
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
        <div className="rounded-fan-lg border border-fan-border bg-fan-surface p-fan-base text-center">
          <p className="font-condensed text-fan-statValue text-fan-textPrimary">{detail.members.reduce((total, member) => total + (Number(member.totalVotes ?? 0) || 0), 0)}</p>
          <p className="text-[10px] text-fan-textTertiary">Votes</p>
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
          <div key={m.userId} className="flex items-center justify-between gap-fan-md rounded-fan-lg border border-fan-border bg-fan-surface px-fan-base py-fan-md">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-fan-sm">
                <span className="text-fan-body text-fan-textPrimary">{m.username}</span>
                {String(m.role ?? '').toLowerCase() === 'admin' || String(m.role ?? '').toLowerCase() === 'owner' ? <span className="rounded-fan-pill bg-fan-primary/10 px-fan-sm py-0.5 text-[10px] font-semibold uppercase text-fan-primary">Admin</span> : null}
              </div>
              <p className="mt-1 text-[11px] text-fan-textTertiary">{m.seasonPoints} season points · {m.totalVotes} votes · {m.correctVotes} correct · {m.msgCount} messages</p>
              <p className="mt-1 text-[10px] text-fan-textTertiary">{m.totalVotes > 0 ? `${Math.round((m.correctVotes / m.totalVotes) * 100)}% vote accuracy` : 'No votes recorded'}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-fan-pill bg-fan-surfaceSunken">
                <div className="h-full rounded-fan-pill bg-fan-primary" style={{ width: `${Math.max(0, Math.min(100, (m.totalVotes > 0 ? (m.correctVotes / m.totalVotes) * 100 : 0)))}%` }} />
              </div>
            </div>
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
