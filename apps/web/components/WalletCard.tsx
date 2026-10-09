'use client';

// New UI (no single Dart file equivalent — the original spreads this across
// wallet/topup modals) wired to the ported payment-service.ts: shows real
// balance, lets the user top up via M-Pesa STK push against the live
// backend, and lists recent transactions.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserBalance, getTransactionHistory, getSavedPhone, initiateSTKPush, initiateB2CPayment, savePhone, PaymentTransaction } from '@funspot/core';

export function WalletCard() {
  const { userId, username, authToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [amount, setAmount] = useState('100');
  const [mode, setMode] = useState<'topup' | 'withdraw'>('topup');
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
    let mounted = true;
    void refresh();
    if (userId) {
      getSavedPhone(userId, 'topup', authToken ?? undefined)
        .then((saved) => { if (mounted && saved) setPhone(saved); })
        .catch((error) => console.warn('Could not load saved top-up phone', error));
    }
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authToken]);

  async function handleTopUp() {
    if (!userId || !username) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setStatus('Enter a valid amount.');
      return;
    }
    if (submitting) return;
    if (mode === 'withdraw') {
      const cleanedPhone = phone.replace(/\D/g, '');
      if (!/^(0|254)?[71]\d{8}$/.test(cleanedPhone)) {
        setStatus('Enter a valid Kenyan phone number.');
        return;
      }
      if (balance == null || amt > balance) {
        setStatus('Insufficient balance for this withdrawal.');
        return;
      }
    }
    setSubmitting(true);
    setStatus(mode === 'topup' ? 'Sending M-Pesa prompt…' : 'Submitting withdrawal…');
    try {
      if (mode === 'topup') {
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
      } else {
        const result = await initiateB2CPayment({
          userId,
          username,
          channelId: 'user_withdrawal',
          amount: amt,
          phoneNumber: phone.trim(),
          authToken: authToken ?? undefined,
          remarks: 'User withdrawal',
          occasion: 'User Withdrawal',
        });
        setStatus(result.success ? 'Withdrawal submitted.' : (result.message ?? 'Withdrawal failed.'));
        if (result.success) {
          await savePhone(userId, 'withdraw', phone.trim(), authToken ?? undefined);
          await refresh();
        }
      }
    } catch (error) {
      console.error(mode === 'topup' ? 'Could not initiate M-Pesa top up' : 'Could not submit withdrawal', error);
      setStatus(mode === 'topup' ? 'Could not start payment. Please try again.' : 'Could not submit withdrawal. Please try again.');
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

      <div className="mb-fan-base grid grid-cols-2 gap-fan-sm">
        <button type="button" onClick={() => { setMode('topup'); setStatus(null); }} className={`rounded-fan-pill py-fan-sm text-fan-caption font-semibold ${mode === 'topup' ? 'bg-fan-primary text-fan-textInverse' : 'border border-fan-border text-fan-textSecondary'}`}>Top up</button>
        <button type="button" onClick={() => { setMode('withdraw'); setStatus(null); }} className={`rounded-fan-pill py-fan-sm text-fan-caption font-semibold ${mode === 'withdraw' ? 'bg-fan-primary text-fan-textInverse' : 'border border-fan-border text-fan-textSecondary'}`}>Withdraw</button>
      </div>
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
          placeholder={mode === 'withdraw' ? 'Withdrawal phone (07XXXXXXXX)' : '07XXXXXXXX'}
          className="rounded-fan-lg border border-fan-border bg-fan-inputSurface px-fan-base py-fan-md text-fan-body text-fan-textPrimary outline-none focus:border-fan-primary"
        />
      </div>
      <button
        onClick={handleTopUp}
        disabled={submitting}
        className="w-full rounded-fan-lg bg-fan-primary py-fan-md text-fan-body font-semibold text-fan-textInverse disabled:opacity-60"
      >
        {submitting ? 'Processing…' : mode === 'topup' ? 'Top Up via M-Pesa' : 'Withdraw via M-Pesa'}
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
