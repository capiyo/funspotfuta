import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Trophy, X } from 'lucide-react-native';
import { getChannelWeeklyLeaderboard, type WeeklyChannelLeader } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';

export function WeeklyLeaderboardModal({ visible, onClose, channelId, channelName }: {
  visible: boolean;
  onClose: () => void;
  channelId: string | null;
  channelName: string;
}) {
  const colors = useFanColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { authToken, userId } = useAuth();
  const [rows, setRows] = useState<WeeklyChannelLeader[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !channelId) return;
    let cancelled = false;
    setLoading(true);
    void getChannelWeeklyLeaderboard(channelId, authToken, userId).then((result) => {
      if (!cancelled) setRows(result);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, channelId, authToken, userId]);

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  const period = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Trophy size={20} color={colors.primary} />
            <View style={styles.heading}>
              <Text style={styles.title} numberOfLines={1}>WEEKLY LEADERBOARD</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{channelName} · {period}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close weekly leaderboard" onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.caption}>Ranked by points won in the current ISO week (EAT)</Text>
          {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : rows.length === 0 ? (
            <View style={styles.center}><Text style={styles.emptyTitle}>No weekly gains to show yet</Text><Text style={styles.emptyCopy}>Weekly rankings show points won by channel members during the current ISO week.</Text></View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {rows.map((row) => (
                <View key={row.user_id || row.username} style={styles.row}>
                  <Text style={styles.rank}>{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}</Text>
                  <Text style={styles.name} numberOfLines={1}>{row.username}</Text>
                  <Text style={styles.points}>+{row.weekly_points.toLocaleString()} pts</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useFanColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: { maxHeight: '82%', minHeight: 330, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingBottom: 28, borderWidth: 0, overflow: 'hidden' },
    handle: { width: 40, height: 4, borderRadius: 999, alignSelf: 'center', backgroundColor: colors.borderActive, marginTop: 12, marginBottom: 18 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heading: { flex: 1, minWidth: 0 },
    title: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
    subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    caption: { color: colors.textTertiary, fontSize: 12, marginTop: 18, marginBottom: 8 },
    center: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
    emptyCopy: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 280 },
    list: { flexGrow: 0 },
    listContent: { paddingBottom: 12 },
    row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0 },
    rank: { width: 34, color: colors.textSecondary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    name: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    points: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  });
}
