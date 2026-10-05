// modals/AdminModal.tsx
//
// Faithful RN port of funspot/lib/.../admin_dashboard_modal.dart
// (AdminDashboardModal). Scoped to the app's single-channel architecture —
// the Dart source's horizontal channel switcher is not ported.
//
// Preserved from Dart:
//   - Payout banner (loading / no-payout retry / active)
//   - Stats grid — Messages / Weekly / Members / Votes
//   - Members list with per-member stat rows
//   - Role pill + accuracy bar
//   - Remove-member confirmation with the 30-point warning
//   - Admin / member empty states
//   - Pull-to-refresh
//
// Deliberately NOT ported (each is its own subsystem):
//   - Load funds (STK push) / Withdraw funds (B2C)
//   - Share channel sheet
//   - Multi-channel switcher
//   - Clipboard-on-handle
//   - Search / filter members
//
// Colors from useFanColors(). Spacing from FAN_SPACING. Radius from
// FAN_RADIUS. Text from fanText(). Copy from Dart verbatim.
//
// Palette mapping (Dart → FanColorPalette):
//   FanColors.secondary (admin amber)     → colors.draw
//   FanColors.primary   (member emerald)  → colors.primary
//   FanColors.away      (danger red)      → colors.away
//   FanColors.textMuted                   → colors.textTertiary
//   FanColors.background                  → colors.background
//   FanColors.surface                     → colors.surface
//   FanColors.border                      → colors.border

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
  RefreshControl,
} from 'react-native';
import {
  X,
  ShieldAlert,
  Users,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Award,
  Wallet,
  Vote,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import {
  getChannelDetail,
  removeMember,
  computeAdminPayout,
  ChannelDetail,
  ChannelMember,
  AdminPayoutResult,
  FanColorPalette,
  FAN_SPACING,
  FAN_RADIUS,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON, PRESSED_OPACITY } from '@/theme/layout';

// ─────────────────────────────────────────────────────────────────
//  Helpers — ChannelMember fields are snake_case on the wire, camel
//  after parsing. Read both defensively.
// ─────────────────────────────────────────────────────────────────

function readNumber(m: any, camel: string, snake: string): number {
  const v = m?.[camel] ?? m?.[snake];
  return typeof v === 'number' ? v : Number(v ?? 0) || 0;
}
function readString(m: any, camel: string, snake: string): string {
  const v = m?.[camel] ?? m?.[snake];
  return v == null ? '' : String(v);
}
function memberIsAdmin(m: any): boolean {
  const role = String(m?.role ?? '').toLowerCase();
  return role === 'admin' || role === 'owner';
}
function memberAccuracy(m: any): number {
  const total = readNumber(m, 'totalVotes', 'total_votes');
  if (total <= 0) return 0;
  const correct = readNumber(m, 'correctVotes', 'correct_votes');
  return (correct / total) * 100;
}
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────

export default function AdminModal({
  visible,
  channelId,
  onClose,
}: {
  visible: boolean;
  channelId: string;
  onClose: () => void;
}) {
  const colors = useFanColors();
  const styles = createStyles(colors);
  const { userId, authToken } = useAuth();
  const toast = useToast();

  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [payout, setPayout] = useState<AdminPayoutResult | null>(null);
  const [loadingPayout, setLoadingPayout] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  // ── Data loading ─────────────────────────────────────────────
  const refresh = useCallback(
    async (showSpinner: boolean) => {
      if (!channelId) return;
      if (showSpinner) setLoading(true);
      const d = await getChannelDetail(channelId, authToken ?? undefined);
      setDetail(d);
      if (showSpinner) setLoading(false);
      setRefreshing(false);
    },
    [channelId, authToken],
  );

  const fetchPayout = useCallback(async () => {
    if (!channelId) return;
    setLoadingPayout(true);
    const r = await computeAdminPayout(channelId, authToken ?? undefined);
    setPayout(r);
    setLoadingPayout(false);
  }, [channelId, authToken]);

  useEffect(() => {
    if (!visible || !channelId) return;
    void refresh(true);
    void fetchPayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, channelId]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(false), fetchPayout()]);
  }, [refresh, fetchPayout]);

  // ── Removal ──────────────────────────────────────────────────
  function requestRemove(memberUserId: string, username: string) {
    if (memberUserId === userId) {
      toast.showError('You cannot remove yourself');
      return;
    }
    setConfirmTarget({ userId: memberUserId, username });
  }

  async function confirmRemove() {
    if (!confirmTarget || !userId || !authToken) return;
    const { userId: targetId, username } = confirmTarget;
    setConfirmTarget(null);
    setRemovingId(targetId);

    const result = await removeMember(channelId, targetId, userId, authToken);
    setRemovingId(null);

    if (result.success) {
      toast.showSuccess(`${username} removed (30 points deducted)`);
      await refresh(false);
    } else {
      toast.showError(result.message ?? 'Failed to remove member');
    }
  }

  const members = detail?.members ?? [];

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => { }}>
            <View style={styles.handleWrap}>
              <View
                style={[styles.handle, { backgroundColor: colors.border }]}
              />
            </View>

            {/* Header */}
            <View style={styles.headerRow}>
              <View
                style={[styles.headerIcon, { backgroundColor: colors.drawDim }]}
              >
                <ShieldAlert size={ICON.md} color={colors.draw} />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={fanText('title', colors, colors.textPrimary)}>
                  Admin Dashboard
                </Text>
                {detail && (
                  <Text
                    style={[
                      fanText('tag', colors, colors.textTertiary),
                      { marginTop: 1 },
                    ]}
                  >
                    {members.length} member{members.length === 1 ? '' : 's'}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: PRESSED_OPACITY },
                ]}
              >
                <X size={14} color={colors.textTertiary} />
              </Pressable>
            </View>

            {/* Content */}
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : !detail ? (
              <View style={styles.center}>
                <ShieldAlert size={36} color={colors.textTertiary} />
                <Text
                  style={[
                    fanText('caption', colors, colors.textTertiary),
                    {
                      marginTop: FAN_SPACING.base,
                      textAlign: 'center',
                    },
                  ]}
                >
                  You are not an admin of this channel, or it no longer exists.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.screen}
                contentContainerStyle={styles.content}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handlePullRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                  />
                }
              >
                {/* Payout banner */}
                <PayoutBanner
                  colors={colors}
                  styles={styles}
                  loading={loadingPayout}
                  payout={payout}
                  onPress={fetchPayout}
                />

                {/* Stats grid — 4 tiles matching Dart */}
                <View style={styles.statsRow}>
                  <StatCard
                    colors={colors}
                    styles={styles}
                    icon={
                      <MessageSquare size={ICON.md} color={colors.primary} />
                    }
                    value={detail.totalMessages}
                    label="Messages"
                  />
                  <StatCard
                    colors={colors}
                    styles={styles}
                    icon={<TrendingUp size={ICON.md} color={colors.secondary} />}
                    value={detail.messagesThisWeek}
                    label="Weekly"
                  />
                  <StatCard
                    colors={colors}
                    styles={styles}
                    icon={<Users size={ICON.md} color={colors.textPrimary} />}
                    value={detail.memberCount}
                    label="Members"
                  />
                  <StatCard
                    colors={colors}
                    styles={styles}
                    icon={<Vote size={ICON.md} color={colors.draw} />}
                    value={detail.totalMessages}
                    label="Votes"
                  />
                </View>

                {/* Members header */}
                <View style={styles.sectionHeader}>
                  <Users size={14} color={colors.primary} />
                  <Text
                    style={[
                      fanText('tag', colors, colors.textSecondary),
                      { letterSpacing: 1 },
                    ]}
                  >
                    MEMBERS
                  </Text>
                  <Text
                    style={[
                      fanText('tag', colors, colors.textTertiary),
                      { marginLeft: 'auto' },
                    ]}
                  >
                    {members.length} total
                  </Text>
                </View>

                {/* Members list */}
                {members.length === 0 ? (
                  <Text
                    style={[
                      fanText('caption', colors, colors.textTertiary),
                      {
                        textAlign: 'center',
                        marginTop: FAN_SPACING.xxl,
                      },
                    ]}
                  >
                    No members found.
                  </Text>
                ) : (
                  members.map((m) => (
                    <MemberCard
                      key={m.userId}
                      colors={colors}
                      styles={styles}
                      member={m}
                      isCurrentUser={m.userId === userId}
                      isRemoving={removingId === m.userId}
                      onRequestRemove={() =>
                        requestRemove(m.userId, m.username)
                      }
                    />
                  ))
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Removal confirmation — nested modal */}
      <Modal
        visible={!!confirmTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmTarget(null)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.confirmBackdrop}
          onPress={() => setConfirmTarget(null)}
        >
          <Pressable style={styles.confirmCard} onPress={() => { }}>
            <View
              style={[
                styles.confirmIconWrap,
                { backgroundColor: colors.awayDim },
              ]}
            >
              <AlertTriangle size={28} color={colors.away} />
            </View>
            <Text
              style={[
                fanText('headline', colors, colors.textPrimary),
                { marginBottom: FAN_SPACING.sm },
              ]}
            >
              Remove Member
            </Text>
            <Text
              style={[
                fanText('body', colors, colors.textSecondary),
                { textAlign: 'center', marginBottom: FAN_SPACING.base },
              ]}
            >
              Remove {confirmTarget?.username} from the channel?
            </Text>
            <View
              style={[
                styles.confirmWarning,
                {
                  borderColor: colors.awayDim,
                  backgroundColor: colors.awayDim,
                },
              ]}
            >
              <AlertTriangle size={14} color={colors.away} />
              <Text
                style={[
                  fanText('tag', colors, colors.textTertiary),
                  { flex: 1, lineHeight: 14 },
                ]}
              >
                ⚠️ This member will lose 30 points for leaving the channel.
                This helps prevent channel hopping.
              </Text>
            </View>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setConfirmTarget(null)}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { borderWidth: 1, borderColor: colors.border },
                  pressed && { opacity: PRESSED_OPACITY },
                ]}
              >
                <Text style={fanText('body', colors, colors.textPrimary)}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmRemove}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { backgroundColor: colors.away },
                  pressed && { opacity: PRESSED_OPACITY },
                ]}
              >
                <Text style={fanText('body', colors, colors.background)}>
                  Remove
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════

function PayoutBanner({
  colors,
  styles,
  loading,
  payout,
  onPress,
}: {
  colors: FanColorPalette;
  styles: ReturnType<typeof createStyles>;
  loading: boolean;
  payout: AdminPayoutResult | null;
  onPress: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.payoutCard}>
        <ActivityIndicator size="small" color={colors.draw} />
        <Text
          style={[
            fanText('caption', colors, colors.textTertiary),
            { marginLeft: FAN_SPACING.md },
          ]}
        >
          Checking payout…
        </Text>
      </View>
    );
  }

  // No payout yet — offer a tap-to-retry card
  if (!payout || !payout.success) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.payoutCard,
          pressed && { opacity: PRESSED_OPACITY },
        ]}
      >
        <RefreshCw size={ICON.md} color={colors.textTertiary} />
        <Text
          style={[
            fanText('caption', colors, colors.textTertiary),
            { marginLeft: FAN_SPACING.md, flex: 1 },
          ]}
        >
          {payout?.message ?? 'Tap to check your payout'}
        </Text>
      </Pressable>
    );
  }

  const isBonus = (payout.payoutType ?? '') === 'signup_bonus';
  const amount = payout.amount ?? 0;
  const statusLine =
    (payout.status ?? 'pending') === 'pending'
      ? 'Pending — based on votes & messages'
      : `Status: ${payout.status}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.payoutCardActive,
        pressed && { opacity: PRESSED_OPACITY },
      ]}
    >
      {isBonus ? (
        <Award size={20} color={colors.draw} />
      ) : (
        <Wallet size={20} color={colors.draw} />
      )}
      <View style={{ flex: 1, marginLeft: FAN_SPACING.md }}>
        <Text style={fanText('caption', colors, colors.textPrimary)}>
          {isBonus ? '🎉 Welcome bonus earned!' : 'Engagement payout'}
        </Text>
        <Text
          style={[
            fanText('tag', colors, colors.textTertiary),
            { marginTop: 1 },
          ]}
        >
          {statusLine}
        </Text>
      </View>
      <Text style={[fanText('statValue', colors, colors.draw), { fontSize: 16 }]}>
        KES {amount.toFixed(2)}
      </Text>
    </Pressable>
  );
}

function StatCard({
  colors,
  styles,
  icon,
  value,
  label,
}: {
  colors: FanColorPalette;
  styles: ReturnType<typeof createStyles>;
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text
        style={[
          fanText('statValue', colors, colors.textPrimary),
          { marginTop: FAN_SPACING.sm },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[fanText('tag', colors, colors.textTertiary), { marginTop: 2 }]}
      >
        {label}
      </Text>
    </View>
  );
}

function MemberCard({
  colors,
  styles,
  member,
  isCurrentUser,
  isRemoving,
  onRequestRemove,
}: {
  colors: FanColorPalette;
  styles: ReturnType<typeof createStyles>;
  member: ChannelMember | any;
  isCurrentUser: boolean;
  isRemoving: boolean;
  onRequestRemove: () => void;
}) {
  const isAdmin = memberIsAdmin(member);
  const accent = isAdmin ? colors.draw : colors.primary;
  const accentDim = isAdmin ? colors.drawDim : colors.primaryDim;
  const accuracy = memberAccuracy(member);
  const points = readNumber(member, 'seasonPoints', 'season_points');
  const totalVotes = readNumber(member, 'totalVotes', 'total_votes');
  const msgCount = readNumber(member, 'msgCount', 'msg_count');
  const joinedAt = readString(member, 'joinedAt', 'joined_at');
  const canRemove = !isCurrentUser && !isAdmin;

  return (
    <View style={styles.memberCard}>
      {/* Header row */}
      <View style={styles.memberHeader}>
        <View style={[styles.memberAvatar, { backgroundColor: accentDim }]}>
          <Text style={[fanText('title', colors, accent), { fontSize: 14 }]}>
            {(member.username?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: FAN_SPACING.md }}>
          <View style={styles.memberNameRow}>
            <Text
              style={[
                fanText(
                  'caption',
                  colors,
                  isCurrentUser ? colors.primary : colors.textPrimary,
                ),
                { fontWeight: '600', flexShrink: 1 },
              ]}
              numberOfLines={1}
            >
              {isCurrentUser ? 'You' : member.username}
            </Text>
            {isAdmin && (
              <View
                style={[styles.adminPill, { backgroundColor: colors.drawDim }]}
              >
                <Text
                  style={[fanText('tag', colors, colors.draw), { fontSize: 7 }]}
                >
                  admin
                </Text>
              </View>
            )}
          </View>
          {!!joinedAt && (
            <Text
              style={[
                fanText('tag', colors, colors.textTertiary),
                { fontSize: 9, marginTop: 1 },
              ]}
              numberOfLines={1}
            >
              joined {relativeTime(joinedAt)}
            </Text>
          )}
        </View>
        {canRemove && (
          <Pressable
            onPress={onRequestRemove}
            disabled={isRemoving}
            hitSlop={6}
            style={({ pressed }) => [
              styles.removeIconBtn,
              { backgroundColor: colors.awayDim },
              pressed && { opacity: PRESSED_OPACITY },
            ]}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={colors.away} />
            ) : (
              <X size={14} color={colors.away} />
            )}
          </Pressable>
        )}
      </View>

      {/* Stat rows */}
      <View style={styles.statGrid}>
        <StatRow
          colors={colors}
          styles={styles}
          label="Points"
          trailing={
            <Text
              style={[
                fanText('caption', colors, accent),
                { fontWeight: '700' },
              ]}
            >
              {points}
            </Text>
          }
        />
        <StatRow
          colors={colors}
          styles={styles}
          label="Votes"
          trailing={
            <View style={styles.inlineRow}>
              <Text style={fanText('caption', colors, colors.textPrimary)}>
                {totalVotes}
              </Text>
              <Text
                style={[
                  fanText('tag', colors, colors.textTertiary),
                  { marginLeft: FAN_SPACING.sm },
                ]}
              >
                {accuracy.toFixed(0)}% correct
              </Text>
            </View>
          }
        />
        <StatRow
          colors={colors}
          styles={styles}
          label="Messages"
          trailing={
            <Text style={fanText('caption', colors, colors.textPrimary)}>
              {msgCount}
            </Text>
          }
        />
      </View>

      {/* Role pill + accuracy bar */}
      <View style={styles.memberFooter}>
        <View style={[styles.rolePill, { backgroundColor: accent }]}>
          <Text
            style={[fanText('tag', colors, colors.background), { fontSize: 8 }]}
          >
            {isAdmin ? 'ADMIN' : 'MEMBER'}
          </Text>
        </View>
        <View
          style={[styles.accuracyTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={[
              styles.accuracyFill,
              {
                width: `${Math.max(0, Math.min(100, accuracy))}%`,
                backgroundColor: accent,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function StatRow({
  colors,
  styles,
  label,
  trailing,
}: {
  colors: FanColorPalette;
  styles: ReturnType<typeof createStyles>;
  label: string;
  trailing: React.ReactNode;
}) {
  return (
    <View style={styles.memberStatRow}>
      <Text style={fanText('tag', colors, colors.textTertiary)}>{label}</Text>
      {trailing}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '85%',
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
    handle: { width: 32, height: 3, borderRadius: 2 },

    // ── Header ──────────────────────────────────────────
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: FAN_SPACING.lg,
      paddingVertical: FAN_SPACING.md,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: FAN_RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextWrap: { flex: 1, marginLeft: FAN_SPACING.md },
    closeBtn: {
      borderRadius: 999,
      padding: FAN_SPACING.md,
      backgroundColor: colors.inputSurface,
    },

    // ── Scroll view ─────────────────────────────────────
    screen: { backgroundColor: colors.background },
    content: {
      padding: FAN_SPACING.lg,
      paddingBottom: FAN_SPACING.xxxl,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: FAN_SPACING.xxl,
    },

    // ── Payout banner ───────────────────────────────────
    payoutCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: FAN_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: FAN_SPACING.base,
      paddingVertical: FAN_SPACING.base,
      marginBottom: FAN_SPACING.base,
    },
    payoutCardActive: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: FAN_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.draw,
      backgroundColor: colors.drawDim,
      paddingHorizontal: FAN_SPACING.base,
      paddingVertical: FAN_SPACING.base,
      marginBottom: FAN_SPACING.base,
    },

    // ── Stat grid (4 tiles) ─────────────────────────────
    statsRow: {
      flexDirection: 'row',
      gap: FAN_SPACING.sm,
      marginBottom: FAN_SPACING.lg,
    },
    statCard: {
      flex: 1,
      borderRadius: FAN_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: FAN_SPACING.base,
      paddingHorizontal: FAN_SPACING.sm,
      alignItems: 'center',
      gap: FAN_SPACING.xs,
    },

    // ── Section header ──────────────────────────────────
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.md,
      marginBottom: FAN_SPACING.md,
    },

    // ── Member card ─────────────────────────────────────
    memberCard: {
      borderRadius: FAN_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: FAN_SPACING.base,
      marginBottom: FAN_SPACING.md,
    },
    memberHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
    },
    adminPill: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: FAN_RADIUS.sm,
    },
    removeIconBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    statGrid: { marginTop: FAN_SPACING.md },
    memberStatRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 2,
    },
    inlineRow: { flexDirection: 'row', alignItems: 'center' },

    memberFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.md,
      marginTop: FAN_SPACING.md,
    },
    rolePill: {
      paddingHorizontal: FAN_SPACING.md,
      paddingVertical: 3,
      borderRadius: FAN_RADIUS.md,
    },
    accuracyTrack: {
      flex: 1,
      height: 4,
      borderRadius: 3,
      overflow: 'hidden',
    },
    accuracyFill: { height: 4, borderRadius: 3 },

    // ── Confirmation modal ──────────────────────────────
    confirmBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: FAN_SPACING.xxl,
    },
    confirmCard: {
      width: '100%',
      maxWidth: 380,
      borderRadius: FAN_RADIUS.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: FAN_SPACING.xl,
      alignItems: 'center',
    },
    confirmIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: FAN_SPACING.base,
    },
    confirmWarning: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: FAN_SPACING.md,
      padding: FAN_SPACING.md,
      borderRadius: FAN_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: FAN_SPACING.lg,
    },
    confirmActions: {
      flexDirection: 'row',
      gap: FAN_SPACING.md,
      alignSelf: 'stretch',
    },
    confirmBtn: {
      flex: 1,
      height: 44,
      borderRadius: FAN_RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}