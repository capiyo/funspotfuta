// RN port of funspot-next/app/(app)/admin/[channelId]/page.tsx.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { getChannelDetail, removeMember, ChannelDetail, computeAdminPayout } from '@funspot/core';
import { colors } from '@/theme';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'Admin'>;

export default function AdminScreen() {
  const { params } = useRoute<Route>();
  const channelId = params.channelId;
  const { userId, authToken } = useAuth();
  const toast = useToast();

  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [computingPayout, setComputingPayout] = useState(false);

  async function refresh() {
    setLoading(true);
    setDetail(await getChannelDetail(channelId, authToken ?? undefined));
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
    if (result.success) toast.showSuccess(`Payout computed: KES ${result.amount} (${result.status})`);
    else toast.showError(result.message ?? 'Failed to compute payout');
  }

  if (loading) return <ActivityIndicator color={colors.green} style={{ marginTop: 60 }} />;
  if (!detail) return <Text style={styles.empty}>Channel not found or you don&apos;t have access.</Text>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Channel {detail.channelId}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{detail.memberCount}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{detail.totalMessages}</Text>
          <Text style={styles.statLabel}>Messages</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{detail.messagesThisWeek}</Text>
          <Text style={styles.statLabel}>This week</Text>
        </View>
      </View>

      <Pressable style={styles.payoutButton} disabled={computingPayout} onPress={handleComputePayout}>
        <Text style={styles.payoutButtonText}>{computingPayout ? 'Computing…' : 'Compute Engagement Payout'}</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Members</Text>
      {detail.members.map((m) => (
        <View key={m.userId} style={styles.memberRow}>
          <Text style={styles.memberName}>{m.username}</Text>
          <Pressable
            disabled={removingId === m.userId || m.userId === userId}
            style={[styles.removeButton, m.userId === userId && { opacity: 0.4 }]}
            onPress={() => handleRemove(m.userId)}
          >
            <Text style={styles.removeButtonText}>{removingId === m.userId ? '…' : 'Remove'}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48 },
  subtitle: { color: colors.textMuted, fontSize: 11, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, alignItems: 'center' },
  statNumber: { color: 'white', fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10 },
  payoutButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 20 },
  payoutButtonText: { color: '#000', fontWeight: '700', fontSize: 13 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 8 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  memberName: { color: 'white', fontSize: 13 },
  removeButton: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 12, paddingVertical: 4 },
  removeButtonText: { color: '#f87171', fontWeight: '700', fontSize: 11 },
});
