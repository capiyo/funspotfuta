// RN port of funspot-next/app/(app)/admin/[channelId]/page.tsx — as a MODAL.
//
// SCOPED to your RN app's single-channel architecture. The Flutter
// AdminDashboardModal supports multiple admin channels via a horizontal
// switcher; this file keeps the single `channelId` prop your existing
// screen already uses.
//
// Ported from Flutter:
//   - Payout banner (auto-fetched on mount, tap to re-fetch)
//   - Member removal confirmation dialog (30-point warning)
//   - Per-member stat grid (points, votes + accuracy, messages)
//   - Role pill + accuracy bar
//   - Admin / member empty states
//   - Pull-to-refresh
//
// Deliberately NOT ported (each is its own subsystem, none is core
// to the admin dashboard surface):
//   - Load funds (STK push) / Withdraw funds (B2C)
//   - Share channel sheet
//   - Multi-channel switcher
//   - Clipboard-on-handle
//   - Search / filter members (dead code in the Flutter source — the
//     search field is never rendered in the build tree)

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
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import {
  getChannelDetail,
  removeMember,
  computeAdminPayout,
  ChannelDetail,
  AdminPayoutResult,
} from '@funspot/core';
import { colors } from '@/theme';

// ── Rank palette (not in the design tokens — admin/member accents) ──
const ADMIN_ACCENT = '#F59E0B'; // amber — matches Flutter FanColors.secondary
const MEMBER_ACCENT = '#10B981'; // emerald — matches Flutter FanColors.primary
const DANGER = '#EF4444';

// ── Member shape helpers ─────────────────────────────────────────
// ChannelDetail.members is typed { userId, username, [key: string]: any }.
// The Rust backend returns snake_case; we accept both spellings.
function readNumber(m: any, camel: string, snake: string): number {
  const v = m?.[camel] ?? m?.[snake];
  return typeof v === 'number' ? v : Number(v ?? 0) || 0;
}
function readString(m: any, camel: string, snake: string): string {
  const v = m?.[camel] ?? m?.[snake];
  return v == null ? '' : String(v);
}
function memberIsAdmin(m: any): boolean {
  return String(m?.role ?? '').toLowerCase() === 'admin';
}
function memberAccuracy(m: any): number {
  const total = readNumber(m, 'totalVotes', 'total_votes');
  if (total <= 0) return 0;
  const correct = readNumber(m, 'correctVotes', 'correct_votes');
  return (correct / total) * 100;
}

// ─────────────────────────────────────────────────────────────────

export default function AdminScreen({
  visible,
  channelId,
  onClose,
}: {
  visible: boolean;
  channelId: string;
  onClose: () => void;
}) {
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
    refresh(true);
    fetchPayout();
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

    const result = await removeMember(
      channelId,
      targetId,
      userId,
      authToken,
    );
    setRemovingId(null);

    if (result.success) {
      toast.showSuccess(`${username} removed (30 points deducted)`);
      await refresh(false);
    } else {
      toast.showError(result.message ?? 'Failed to remove member');
    }
  }

  // ─────────────────────────────────────────────────────────────

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
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerIcon}>
                <ShieldAlert size={16} color={ADMIN_ACCENT} />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>Admin Dashboard</Text>
                {detail && (
                  <Text style={styles.headerSub}>
                    {members.length} member{members.length === 1 ? '' : 's'}
                  </Text>
                )}
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                <X size={14} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Content */}
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.green} />
              </View>
            ) : !detail ? (
              <View style={styles.center}>
                <ShieldAlert size={36} color={colors.textMuted} />
                <Text style={[styles.empty, { marginTop: 12 }]}>
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
                    tintColor={colors.green}
                    colors={[colors.green]}
                  />
                }
              >
                {/* Payout banner */}
                <PayoutBanner
                  loading={loadingPayout}
                  payout={payout}
                  onPress={fetchPayout}
                />

                {/* Stats trio */}
                <View style={styles.statsRow}>
                  <StatCard
                    icon={<Users size={16} color={colors.green} />}
                    value={detail.memberCount}
                    label="Members"
                  />
                  <StatCard
                    icon={
                      <MessageSquare size={16} color={colors.green} />
                    }
                    value={detail.totalMessages}
                    label="Messages"
                  />
                  <StatCard
                    icon={<TrendingUp size={16} color={colors.green} />}
                    value={detail.messagesThisWeek}
                    label="This week"
                  />
                </View>

                {/* Members */}
                <View style={styles.sectionHeader}>
                  <Users size={14} color={colors.green} />
                  <Text style={styles.sectionLabel}>MEMBERS</Text>
                  <Text style={styles.sectionCount}>
                    {members.length} total
                  </Text>
                </View>

                {members.length === 0 ? (
                  <Text style={[styles.empty, { marginTop: 24 }]}>
                    No members found.
                  </Text>
                ) : (
                  members.map((m) => (
                    <MemberCard
                      key={m.userId}
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

      {/* Removal confirmation — nested modal so it stacks above the sheet */}
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
          <Pressable
            style={styles.confirmCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.confirmIconWrap}>
              <AlertTriangle size={28} color={DANGER} />
            </View>
            <Text style={styles.confirmTitle}>Remove Member</Text>
            <Text style={styles.confirmBody}>
              Remove {confirmTarget?.username} from the channel?
            </Text>
            <View style={styles.confirmWarning}>
              <AlertTriangle size={14} color={DANGER} />
              <Text style={styles.confirmWarningText}>
                ⚠️ This member will lose 30 points for leaving the channel.
                This helps prevent channel hopping.
              </Text>
            </View>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setConfirmTarget(null)}
                style={[styles.confirmBtn, styles.confirmCancel]}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmRemove}
                style={[styles.confirmBtn, styles.confirmRemove]}
              >
                <Text style={styles.confirmRemoveText}>Remove</Text>
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
  loading,
  payout,
  onPress,
}: {
  loading: boolean;
  payout: AdminPayoutResult | null;
  onPress: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.payoutCard}>
        <ActivityIndicator size="small" color={ADMIN_ACCENT} />
        <Text style={styles.payoutSub}>Checking payout…</Text>
      </View>
    );
  }

  // No payout yet (or last fetch failed) — offer a tap-to-retry card
  if (!payout || !payout.success) {
    return (
      <Pressable onPress={onPress} style={styles.payoutCard}>
        <RefreshCw size={16} color={colors.textMuted} />
        <Text style={styles.payoutSub}>
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
    <Pressable onPress={onPress} style={styles.payoutCardActive}>
      {isBonus ? (
        <Award size={20} color={ADMIN_ACCENT} />
      ) : (
        <Wallet size={20} color={ADMIN_ACCENT} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.payoutTitle}>
          {isBonus ? '🎉 Welcome bonus earned!' : 'Engagement payout'}
        </Text>
        <Text style={styles.payoutSub}>{statusLine}</Text>
      </View>
      <Text style={styles.payoutAmount}>KES {amount.toFixed(2)}</Text>
    </Pressable>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MemberCard({
  member,
  isCurrentUser,
  isRemoving,
  onRequestRemove,
}: {
  member: any;
  isCurrentUser: boolean;
  isRemoving: boolean;
  onRequestRemove: () => void;
}) {
  const isAdmin = memberIsAdmin(member);
  const accent = isAdmin ? ADMIN_ACCENT : MEMBER_ACCENT;
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
        <View
          style={[
            styles.memberAvatar,
            { backgroundColor: withAlpha(accent, 0.12) },
          ]}
        >
          <Text style={[styles.memberAvatarText, { color: accent }]}>
            {(member.username?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.memberNameRow}>
            <Text
              style={[
                styles.memberName,
                { color: isCurrentUser ? MEMBER_ACCENT : '#FFFFFF' },
              ]}
              numberOfLines={1}
            >
              {isCurrentUser ? 'You' : member.username}
            </Text>
            {isAdmin && (
              <View
                style={[
                  styles.adminPill,
                  { backgroundColor: withAlpha(ADMIN_ACCENT, 0.12) },
                ]}
              >
                <Text style={[styles.adminPillText, { color: ADMIN_ACCENT }]}>
                  admin
                </Text>
              </View>
            )}
          </View>
          {!!joinedAt && (
            <Text style={styles.memberSub} numberOfLines={1}>
              joined {relativeTime(joinedAt)}
            </Text>
          )}
        </View>
        {canRemove && (
          <Pressable
            onPress={onRequestRemove}
            disabled={isRemoving}
            hitSlop={6}
            style={[
              styles.removeIconBtn,
              { backgroundColor: withAlpha(DANGER, 0.1) },
            ]}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={DANGER} />
            ) : (
              <X size={14} color={DANGER} />
            )}
          </Pressable>
        )}
      </View>

      {/* Stat grid */}
      <View style={styles.statGrid}>
        <StatRow
          label="Points"
          trailing={
            <Text style={[styles.memberStatValue, { color: accent }]}>
              {points}
            </Text>
          }
        />
        <StatRow
          label="Votes"
          trailing={
            <View style={styles.inlineRow}>
              <Text style={styles.memberStatValue}>{totalVotes}</Text>
              <Text style={styles.memberStatMuted}>
                {accuracy.toFixed(0)}% correct
              </Text>
            </View>
          }
        />
        <StatRow
          label="Messages"
          trailing={
            <Text style={styles.memberStatValue}>{msgCount}</Text>
          }
        />
      </View>

      {/* Role pill + accuracy bar */}
      <View style={styles.memberFooter}>
        <View style={[styles.rolePill, { backgroundColor: accent }]}>
          <Text style={styles.rolePillText}>
            {isAdmin ? 'ADMIN' : 'MEMBER'}
          </Text>
        </View>
        <View style={styles.accuracyTrack}>
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
  label,
  trailing,
}: {
  label: string;
  trailing: React.ReactNode;
}) {
  return (
    <View style={styles.memberStatRow}>
      <Text style={styles.memberStatLabel}>{label}</Text>
      {trailing}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function withAlpha(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return hex;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ADMIN_ACCENT, 0.12),
  },
  headerTextWrap: { flex: 1, marginLeft: 10 },
  headerTitle: { color: 'white', fontSize: 15, fontWeight: '700' },
  headerSub: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  closeBtn: {
    borderRadius: 999,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  screen: { backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },

  // ── Payout banner ────────────────────────────────────
  payoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
  },
  payoutCardActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(ADMIN_ACCENT, 0.25),
    backgroundColor: withAlpha(ADMIN_ACCENT, 0.08),
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  payoutTitle: { color: 'white', fontSize: 12, fontWeight: '600' },
  payoutSub: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  payoutAmount: {
    color: ADMIN_ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Stats trio (outer summary tiles) ─────────────────
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: { color: 'white', fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10 },

  // ── Members section ──────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 10,
    marginLeft: 'auto',
  },

  // ── Member card ──────────────────────────────────────
  memberCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 8,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 14, fontWeight: '700' },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  memberSub: { color: colors.textMuted, fontSize: 9, marginTop: 1 },
  adminPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  adminPillText: { fontSize: 7, fontWeight: '700', letterSpacing: 0.3 },
  removeIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Member stat grid (renamed to avoid collision with the
  //    outer stats-row style block above) ────────────────
  statGrid: { marginTop: 10 },
  memberStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  memberStatLabel: { color: colors.textMuted, fontSize: 9 },
  memberStatValue: { color: 'white', fontSize: 10, fontWeight: '600' },
  memberStatMuted: { color: colors.textMuted, fontSize: 9, marginLeft: 6 },
  inlineRow: { flexDirection: 'row', alignItems: 'center' },

  memberFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rolePillText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  accuracyTrack: {
    flex: 1,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  accuracyFill: { height: 4, borderRadius: 3 },

  // ── Confirmation modal ───────────────────────────────
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
  },
  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(DANGER, 0.15),
    marginBottom: 12,
  },
  confirmTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  confirmBody: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  confirmWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: withAlpha(DANGER, 0.25),
    backgroundColor: withAlpha(DANGER, 0.08),
    marginBottom: 16,
  },
  confirmWarningText: {
    color: colors.textMuted,
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancel: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: { color: 'white', fontSize: 14, fontWeight: '600' },
  confirmRemove: {
    backgroundColor: DANGER,
  },
  confirmRemoveText: { color: 'white', fontSize: 14, fontWeight: '700' },
});