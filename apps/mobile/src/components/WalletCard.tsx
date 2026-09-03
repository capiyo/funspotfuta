// RN port of funspot-next/components/WalletCard.tsx.

import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserBalance, getTransactionHistory, initiateSTKPush, PaymentTransaction } from '@funspot/core';
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
    <View style={styles.card}>
      <Text style={styles.label}>Balance</Text>
      <Text style={styles.balance}>{balance == null ? '—' : `KES ${balance.toLocaleString()}`}</Text>

      <View style={styles.row}>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Amount (KES)" placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1 }]} />
        <TextInput value={phone} onChangeText={setPhone} placeholder="07XXXXXXXX" placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1 }]} />
      </View>

      <Pressable style={styles.button} disabled={submitting} onPress={handleTopUp}>
        <Text style={styles.buttonText}>{submitting ? 'Processing…' : 'Top Up via M-Pesa'}</Text>
      </Pressable>
      {status && <Text style={styles.status}>{status}</Text>}

      {transactions.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Recent transactions</Text>
          {transactions.map((t) => (
            <View key={t.id} style={styles.txRow}>
              <Text style={styles.txText}>{t.type} · {t.status}</Text>
              <Text style={styles.txText}>KES {t.amount}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, marginBottom: 16 },
  label: { color: colors.textMuted, fontSize: 11 },
  balance: { color: 'white', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: 'white' },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 13 },
  status: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  txText: { color: '#d1d5db', fontSize: 11 },
});
