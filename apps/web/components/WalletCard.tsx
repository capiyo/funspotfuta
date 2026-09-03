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

  async function refresh() {
    if (!userId) return;
    const [bal, history] = await Promise.all([
      getUserBalance(userId, authToken ?? undefined, true),
      getTransactionHistory({ userId, authToken: authToken ?? undefined, limit: 10 }),
    ]);
    setBalance(bal);
    if (history.success) setTransactions(history.transactions);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleTopUp() {
    if (!userId || !username) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    setStatus('Sending M-Pesa prompt…');
    const result = await initiateSTKPush({
      userId,
      username,
      amount: amt,
      phoneNumber: phone || undefined,
      authToken: authToken ?? undefined,
      purpose: 'Top up balance',
    });
    setSubmitting(false);
    setStatus(result.message ?? (result.success ? 'Payment completed' : 'Payment failed'));
    if (result.success) refresh();
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-funspot-surface p-4">
      <p className="text-xs text-gray-400">Balance</p>
      <p className="mb-4 text-2xl font-bold text-white">
        {balance == null ? '—' : `KES ${balance.toLocaleString()}`}
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (KES)"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-funspot-green"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XXXXXXXX"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-funspot-green"
        />
      </div>
      <button
        onClick={handleTopUp}
        disabled={submitting}
        className="w-full rounded-xl bg-funspot-green py-2.5 text-sm font-semibold text-black disabled:opacity-60"
      >
        {submitting ? 'Processing…' : 'Top Up via M-Pesa'}
      </button>
      {status && <p className="mt-2 text-center text-xs text-gray-400">{status}</p>}

      {transactions.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="mb-1 text-xs text-gray-400">Recent transactions</p>
          {transactions.map((t) => (
            <div key={t.id} className="flex justify-between rounded-lg bg-black/20 px-2 py-1 text-xs text-gray-300">
              <span className="capitalize">{t.type} · {t.status}</span>
              <span>KES {t.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
