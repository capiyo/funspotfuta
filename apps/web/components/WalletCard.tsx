'use client';

// New UI (no single Dart file equivalent — the original spreads this across
// wallet/topup modals) wired to the ported payment-service.ts: shows real
// balance, lets the user top up via M-Pesa STK push against the live
// backend, and lists recent transactions.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserBalance, getTransactionHistory, initiateSTKPush, PaymentTransaction } from '@funspot/core';

export function WalletCard() {
  const { userId, username, authToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [amount, setAmount] = useState('100');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (!userId || refreshing) return;
    setRefreshing(true);
    try {
      const [bal, history] = await Promise.all([
        getUserBalance(userId, authToken ?? undefined, true),
        getTransactionHistory({ userId, authToken: authToken ?? undefined, limit: 10 }),
      ]);
      setBalance(bal);
      if (history.success) setTransactions(history.transactions);
    } catch (error) {
      console.error('Could not refresh wallet', error);
      setStatus('Could not refresh wallet details. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleTopUp() {
    if (!userId || !username) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (submitting) return;
    setSubmitting(true);
    setStatus('Sending M-Pesa prompt…');
    try {
      const result = await initiateSTKPush({
        userId,
        username,
        amount: amt,
        phoneNumber: phone || undefined,
        authToken: authToken ?? undefined,
        purpose: 'Top up balance',
      });
      setStatus(result.message ?? (result.success ? 'Payment completed' : 'Payment failed'));
      if (result.success) await refresh();
    } catch (error) {
      console.error('Could not initiate M-Pesa top up', error);
      setStatus('Could not start payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-fan-xxl rounded-fan-xl border border-fan-border bg-fan-surface p-fan-lg">
      <p className="text-fan-caption text-fan-textTertiary">Balance</p>
      <p className="mb-fan-lg font-condensed text-fan-scoreCompact text-fan-textPrimary">
        {balance == null ? '—' : `KES ${balance.toLocaleString()}`}
      </p>

      <div className="mb-fan-base grid grid-cols-2 gap-fan-md">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (KES)"
          className="rounded-fan-lg border border-fan-border bg-fan-inputSurface px-fan-base py-fan-md text-fan-body text-fan-textPrimary outline-none focus:border-fan-primary"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XXXXXXXX"
          className="rounded-fan-lg border border-fan-border bg-fan-inputSurface px-fan-base py-fan-md text-fan-body text-fan-textPrimary outline-none focus:border-fan-primary"
        />
      </div>
      <button
        onClick={handleTopUp}
        disabled={submitting}
        className="w-full rounded-fan-lg bg-fan-primary py-fan-md text-fan-body font-semibold text-fan-textInverse disabled:opacity-60"
      >
        {submitting ? 'Processing…' : 'Top Up via M-Pesa'}
      </button>
      {status && <p className="mt-fan-md text-center text-fan-caption text-fan-textTertiary">{status}</p>}

      {transactions.length > 0 && (
        <div className="mt-fan-lg space-y-1">
          <p className="mb-fan-sm text-fan-caption text-fan-textTertiary">Recent transactions</p>
          {transactions.map((t) => (
            <div key={t.id} className="flex justify-between rounded-fan-md bg-fan-surfaceSunken px-fan-md py-fan-sm text-fan-caption text-fan-textSecondary">
              <span className="capitalize">{t.type} · {t.status}</span>
              <span>KES {t.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
