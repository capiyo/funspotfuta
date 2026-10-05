// apps/mobile/src/modals/NotificationsScreen.tsx
//
// RN port of funspot-next/app/(app)/notifications/page.tsx — as a MODAL.
//
// Rewritten to use NotificationService (app-local port of
// funspot/lib/services/notification_service.dart) rather than
// @funspot/core, so this screen shares storage keys and endpoints with
// every other notification code path in the app.

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { X } from 'lucide-react-native';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { NotificationService } from '@/lib/api/notification-service';

type FanColors = ReturnType<typeof useFanColors>;

interface NotificationPreferences {
  vote_alerts: boolean;
  like_alerts: boolean;
  comment_alerts: boolean;
}

interface UnreadSummary {
  notifications: number;
  comments: number;
}

const LABELS: Record<keyof NotificationPreferences, string> = {
  vote_alerts: 'Vote alerts',
  like_alerts: 'Like alerts',
  comment_alerts: 'Comment alerts',
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

  const [summary, setSummary] = useState<UnreadSummary | null>(null);
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
        const [counts, p] = await Promise.all([
          NotificationService.loadInitialBadgeCounts(),
          NotificationService.getNotificationPreferences(userId),
        ]);
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
  }, [visible, userId]);

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
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={14} color={colors.textSecondary} />
            </Pressable>
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
      borderTopLeftRadius: FAN_RADIUS.xl,
      borderTopRightRadius: FAN_RADIUS.xl,
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
      backgroundColor: colors.surfaceSunken,
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
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
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
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
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
      borderTopWidth: 1,
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