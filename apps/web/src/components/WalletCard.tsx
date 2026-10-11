import { useEffect, useState } from 'react';
import { getUserBalance, getTransactionHistory, initiateSTKPush, type PaymentTransaction } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { colors } from '@/theme';

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
  useEffect(() => { void refresh(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleTopUp() {
    if (!userId || !username) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    setStatus('Sending M-Pesa prompt…');
    try {
      const result = await initiateSTKPush({
        userId, username, amount: amt, phoneNumber: phone || undefined,
        authToken: authToken ?? undefined, purpose: 'Top up balance',
      });
      setStatus(result.message ?? (result.success ? 'Payment completed' : 'Payment failed'));
      if (result.success) await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Payment failed');
    } finally { setSubmitting(false); }
  }

  const inputStyle: React.CSSProperties = { minWidth: 0, flex: 1, border: `1px solid ${colors.border}`, background: 'rgba(0,0,0,.3)', borderRadius: 12, padding: '8px 12px', color: 'white' };
  return <section className="mb-4 rounded-2xl border p-4" style={{ borderColor: colors.border, background: colors.surface }}>
    <p className="text-[11px]" style={{ color: colors.textMuted }}>Balance</p>
    <p className="mb-3 text-2xl font-extrabold text-white">{balance == null ? '—' : `KES ${balance.toLocaleString()}`}</p>
    <div className="mb-3 flex gap-2">
      <input aria-label="Amount (KES)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="Amount (KES)" style={inputStyle} />
      <input aria-label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" style={inputStyle} />
    </div>
    <button type="button" className="w-full rounded-xl py-3 text-[13px] font-bold" style={{ background: colors.green, color: '#000' }} disabled={submitting} onClick={() => void handleTopUp()}>
      {submitting ? 'Processing…' : 'Top Up via M-Pesa'}
    </button>
    {status && <p role="status" className="mt-2 text-center text-[11px]" style={{ color: colors.textMuted }}>{status}</p>}
    {transactions.length > 0 && <div className="mt-3">
      <p className="text-[11px]" style={{ color: colors.textMuted }}>Recent transactions</p>
      {transactions.map((transaction) => <div key={transaction.id} className="mt-1 flex justify-between rounded-lg px-2 py-1" style={{ background: 'rgba(0,0,0,.2)' }}>
        <span className="text-[11px] text-gray-300">{transaction.type} · {transaction.status}</span><span className="text-[11px] text-gray-300">KES {transaction.amount}</span>
      </div>)}
    </div>}
  </section>;
}
