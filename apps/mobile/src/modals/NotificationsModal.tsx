// apps/mobile/src/modals/NotificationsScreen.tsx
//
// RN port of funspot-next/app/(app)/notifications/page.tsx — as a MODAL.
//
// Rewritten to use NotificationService (app-local port of
// funspot/lib/services/notification_service.dart) rather than
// @funspot/core, so this screen shares storage keys and endpoints with
// every other notification code path in the app.

import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { FAN_SPACING, FAN_RADIUS, getAllFixtures, type Fixture } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { NotificationService, type StoredNotification } from '@/lib/api/notification-service';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type FanColors = ReturnType<typeof useFanColors>;

interface NotificationPreferences {
  vote_alerts: boolean;
  like_alerts: boolean;
  comment_alerts: boolean;
  message_alerts: boolean;
  mention_alerts: boolean;
  reply_alerts: boolean;
  reaction_alerts: boolean;
  push_enabled: boolean;
  show_preview: boolean;
  sound_enabled: boolean;
}

interface UnreadSummary {
  notifications: number;
  comments: number;
}

const LABELS: Record<keyof NotificationPreferences, string> = {
  vote_alerts: 'Vote alerts',
  like_alerts: 'Like alerts',
  comment_alerts: 'Comment alerts',
  message_alerts: 'Chat messages',
  mention_alerts: 'Mentions',
  reply_alerts: 'Replies',
  reaction_alerts: 'Reactions',
  push_enabled: 'Push notifications',
  show_preview: 'Show push message previews',
  sound_enabled: 'Notification sounds',
};

export default function NotificationsScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useFanColors();
  const styles = createStyles(colors);
  const { userId, authToken } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [summary, setSummary] = useState<UnreadSummary | null>(null);
  const [activity, setActivity] = useState<Array<{ fixtureId: string; title: string; preview: string; count: number; time: number }>>([]);
  const [inbox, setInbox] = useState<StoredNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // fetchUnreadSummary isn't exposed as a public method on
        // NotificationService (the Dart source keeps it private and only
        // calls it from reconcileFromServer). The two counts the UI wants
        // are just the persisted totals, so read those directly.
        const [counts, p, unread, fixtures, notifications] = await Promise.all([
          NotificationService.loadInitialBadgeCounts(),
          NotificationService.getNotificationPreferences(userId, authToken ?? undefined),
          NotificationService.getAllUnreadFixturesWithDetails(),
          getAllFixtures().catch((): Fixture[] => []),
          NotificationService.getUserNotifications(userId, authToken ?? undefined),
        ]);
        const rows = Object.entries(unread).map(([fixtureId, details]) => {
          const fixture = fixtures.find((item) => String(item.matchId ?? item.id) === fixtureId);
          const latest = details.latest_notification ?? {};
          return {
            fixtureId,
            title: fixture ? `${fixture.homeTeam} vs ${fixture.awayTeam}` : 'Match conversation',
            preview: String(latest.message ?? latest.text ?? latest.type ?? 'New match activity').replace(/[._-]+/g, ' '),
            count: Number(details.notification_count ?? details.count ?? 0),
            time: Number(details.last_notification_time ?? 0),
          };
        }).sort((a, b) => b.time - a.time);
        setActivity(rows);
        setInbox(notifications);
        if (cancelled) return;
        setSummary({
          notifications: counts.unread_notifications,
          comments: counts.unread_comments,
        });
        setPrefs(p);
      } catch {
        if (!cancelled) {
          setSummary({ notifications: 0, comments: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, visible, userId]);

  useEffect(() => {
    if (!visible) return;
    const unsubscribe = NotificationService.onNotification(() => {
      void Promise.all([
        NotificationService.loadInitialBadgeCounts(),
        NotificationService.getAllUnreadFixturesWithDetails(),
        userId ? NotificationService.getUserNotifications(userId, authToken ?? undefined) : Promise.resolve([]),
      ]).then(([counts, unread, notifications]) => {
        setInbox(notifications);
        setSummary({
          notifications: counts.unread_notifications,
          comments: counts.unread_comments,
        });
        setActivity((current) => {
          const byId = new Map(current.map((item) => [item.fixtureId, item]));
          return Object.entries(unread).map(([fixtureId, details]) => ({
            ...(byId.get(fixtureId) ?? { fixtureId, title: 'Match conversation', preview: 'New match activity' }),
            count: Number(details.notification_count ?? details.count ?? 0),
            time: Number(details.last_notification_time ?? 0),
          })).sort((a, b) => b.time - a.time);
        });
      });
    });
    return unsubscribe;
  }, [authToken, userId, visible]);

  async function toggle(key: keyof NotificationPreferences) {
    if (!prefs || !userId) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    try {
      const ok = await NotificationService.updateNotificationPreferences({
        userId,
        voteAlerts: next.vote_alerts,
        likeAlerts: next.like_alerts,
        commentAlerts: next.comment_alerts,
        messageAlerts: next.message_alerts,
        mentionAlerts: next.mention_alerts,
        replyAlerts: next.reply_alerts,
        reactionAlerts: next.reaction_alerts,
        pushEnabled: next.push_enabled,
        showPreview: next.show_preview,
        soundEnabled: next.sound_enabled,
        authToken: authToken ?? undefined,
      });
      if (!ok) {
        // Roll back so the UI reflects the server's actual state
        setPrefs(prefs);
        toast.showError('Failed to save preference');
      }
    } catch {
      setPrefs(prefs);
      toast.showError('Failed to save preference');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
</View>

          {loading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : (
            <ScrollView
              style={styles.screen}
              contentContainerStyle={styles.content}
            >
              {summary && (
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>
                      {summary.notifications}
                    </Text>
                    <Text style={styles.statLabel}>Unread notifications</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{summary.comments}</Text>
                    <Text style={styles.statLabel}>Unread comments</Text>
                  </View>
                </View>
              )}

              {inbox.length > 0 && (
                <View style={{ marginBottom: FAN_SPACING.lg, gap: FAN_SPACING.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>Inbox</Text>
                    {inbox.some((item) => item.is_read !== true) && (
                      <Pressable onPress={async () => {
                        if (!userId) return;
                        await NotificationService.markAsRead({ userId, authToken: authToken ?? undefined });
                        await NotificationService.reconcileFromServer({ userId, authToken: authToken ?? undefined });
                        setInbox((current) => current.map((item) => ({ ...item, is_read: true })));
                      }}>
                        <Text style={{ color: '#25D366', fontSize: 11, fontWeight: '700' }}>Mark all read</Text>
                      </Pressable>
                    )}
                  </View>
                  {inbox.slice(0, 30).map((item, index) => {
                    const rawId = item.id ?? (typeof item._id === 'string' ? item._id : item._id?.$oid);
                    const id = String(rawId ?? '');
                    const data = item.data && typeof item.data === 'object' ? item.data as Record<string, unknown> : {};
                    const channelId = typeof data.channel_id === 'string' ? data.channel_id : null;
                    const fixtureId = typeof data.fixture_id === 'string' ? data.fixture_id : undefined;
                    const unread = item.is_read !== true;
                    return (
                      <Pressable key={id || index} onPress={async () => {
                        if (!userId) return;
                        if (id) await NotificationService.markAsRead({ userId, authToken: authToken ?? undefined, notificationIds: [id] });
                        await NotificationService.reconcileFromServer({ userId, authToken: authToken ?? undefined });
                        setInbox((current) => current.map((entry) => entry === item ? { ...entry, is_read: true } : entry));
                        if (channelId) {
                          onClose();
                          navigation.navigate('Chat', { channelId, ...(fixtureId ? { fixtureId } : {}) });
                        }
                      }} style={{ paddingVertical: FAN_SPACING.sm, paddingHorizontal: FAN_SPACING.sm, borderRadius: FAN_RADIUS.md, backgroundColor: unread ? colors.primary + '12' : 'transparent' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm }}>
                          <Text numberOfLines={1} style={{ flex: 1, color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{item.title || 'Funspot notification'}</Text>
                          {unread && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#25D366' }} />}
                        </View>
                        {!!item.body && <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }}>{item.body}</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {activity.length > 0 && (
                <View style={{ marginBottom: FAN_SPACING.lg, gap: FAN_SPACING.sm }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>Recent activity</Text>
                  {activity.map((item) => (
                    <Pressable
                      key={item.fixtureId}
                      onPress={() => {
                        void NotificationService.clearUnreadForFixture(item.fixtureId).then(async () => {
                          const counts = await NotificationService.loadInitialBadgeCounts();
                          setSummary({ notifications: counts.unread_notifications, comments: counts.unread_comments });
                        });
                        setActivity((current) => current.filter((row) => row.fixtureId !== item.fixtureId));
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.md, paddingVertical: FAN_SPACING.sm }}
                    >
                      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '1A' }}>
                        <Text style={{ fontSize: 18 }}>⚽</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>{item.title}</Text>
                        <Text numberOfLines={1} style={{ color: colors.textTertiary, fontSize: 11, marginTop: 3 }}>{item.preview}</Text>
                      </View>
                      {item.count > 0 && <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
                        <Text style={{ color: colors.textInverse, fontSize: 10, fontWeight: '800' }}>{item.count}</Text>
                      </View>}
                    </Pressable>
                  ))}
                </View>
              )}

              {prefs && (
                <View style={styles.prefList}>
                  {(Object.keys(LABELS) as (keyof NotificationPreferences)[]).map(
                    (key, i) => (
                      <View
                        key={key}
                        style={[styles.prefRow, i > 0 && styles.prefRowBorder]}
                      >
                        <Text style={styles.prefLabel}>{LABELS[key]}</Text>
                        <Pressable
                          disabled={saving}
                          onPress={() => toggle(key)}
                          style={[styles.toggle, prefs[key] && styles.toggleOn]}
                        >
                          <View
                            style={[
                              styles.toggleKnob,
                              prefs[key] && styles.toggleKnobOn,
                            ]}
                          />
                        </Pressable>
                      </View>
                    ),
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: FanColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '80%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    handleWrap: {
      alignItems: 'center',
      paddingTop: FAN_SPACING.md,
      paddingBottom: FAN_SPACING.sm,
    },
    handle: {
      width: 32,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: FAN_SPACING.lg,
      paddingVertical: FAN_SPACING.md,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    closeBtn: {
      borderRadius: 999,
      padding: 6,
      backgroundColor: 'transparent',
    },
    screen: { backgroundColor: colors.background },
    content: {
      padding: FAN_SPACING.lg,
      paddingBottom: FAN_SPACING.xxxl,
    },
    statsRow: {
      flexDirection: 'row',
      gap: FAN_SPACING.md,
      marginBottom: FAN_SPACING.lg,
    },
    statCard: {
      flex: 1,
      borderRadius: FAN_RADIUS.lg,
      borderWidth:0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      padding: FAN_SPACING.base,
      alignItems: 'center',
    },
    statNumber: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    statLabel: {
      color: colors.textTertiary,
      fontSize: 10,
      marginTop: 2,
    },
    prefList: {
      borderRadius: FAN_RADIUS.lg,
      borderWidth:0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    prefRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: FAN_SPACING.lg,
      paddingVertical: 14,
    },
    prefRowBorder: {
      borderTopWidth:0,
      borderTopColor: colors.border,
    },
    prefLabel: {
      color: colors.textPrimary,
      fontSize: 13,
    },
    toggle: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceSunken,
      padding: 2,
    },
    toggleOn: { backgroundColor: colors.primary },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
    },
    toggleKnobOn: { transform: [{ translateX: 20 }] },
  });
}