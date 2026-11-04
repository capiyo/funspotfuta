import { Avatar } from '@/components/ui/Avatar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
  castPossessionVote,
  createPossessionPoke,
  fetchPossessionMarket,
  fetchPossessionPokes,
  fetchPossessionVotes,
  matchPossessionPoke,
} from '@funspot/core';
import type { Fixture, PossessionMarket, PossessionSide } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { PRESSED_OPACITY } from '@/theme/layout';

type Tab = 'vote' | 'poke';
type Props = {
  fixture: Fixture | null;
  channelId?: string;
  userId: string;
  username: string;
  authToken?: string | null;
  isLoggedIn: boolean;
  onClose: () => void;
};

export function PossessionModal({ fixture, channelId, userId, username, authToken, isLoggedIn, onClose }: Props) {
  const colors = useFanColors();
  const styles = createStyles(colors);\n  const { height: screenH } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('vote');
  const [pokeListTab, setPokeListTab] = useState<'open' | 'matched'>('open');
  const [market, setMarket] = useState<PossessionMarket | null>(null);
  const [selection, setSelection] = useState<PossessionSide>('home');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fixtureId = fixture?.matchId || fixture?.id || '';

  const refresh = useCallback(async () => {
    if (!fixtureId || !channelId) return;
    setLoading(true); setError(null);
    try {
      const context = { fixtureId, channelId, userId, authToken };
      const [nextMarket, votes, pokes] = await Promise.all([
        fetchPossessionMarket(context),
        fetchPossessionVotes(context),
        fetchPossessionPokes(context),
      ]);
      setMarket({ ...nextMarket, votes, pokes });
      setSelection(nextMarket.userSelection ?? 'home');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load possession market');
    } finally { setLoading(false); }
  }, [fixtureId, channelId, authToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!fixture) return null;
  const context = { fixtureId, channelId: channelId ?? '', userId, authToken };
  const homeVotes = market?.homeVotes ?? 0;
  const awayVotes = market?.awayVotes ?? 0;
  const total = homeVotes + awayVotes;
  const homePercent = total ? Math.round(homeVotes / total * 100) : 50;

  async function submitVote() {
    if (!isLoggedIn || !userId || !username || !channelId) { setError('Sign in to make a possession vote'); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await castPossessionVote({ ...context, userId, username, selection });
      if (!result.success) throw new Error(result.message || 'Possession vote was not accepted');
      setNotice(result.message || 'Possession vote recorded');
      if (result.market) setMarket(result.market); else await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit possession vote'); }
    finally { setBusy(false); }
  }

  async function submitPoke() {
    const points = Number(amount);
    if (!isLoggedIn || !userId || !username || !channelId) { setError('Sign in to create a possession poke'); return; }
    if (!Number.isSafeInteger(points) || points < 5) { setError('Enter at least 5 whole-number points'); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await createPossessionPoke({ ...context, userId, username, selection, amount: points });
      if (!result.success) throw new Error(result.message || 'Possession poke was not accepted');
      setNotice(result.message || 'Possession poke created');
      if (result.market) setMarket(result.market); else await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create possession poke'); }
    finally { setBusy(false); }
  }

  async function matchPoke(pokeId: string) {
    if (!userId || !channelId) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await matchPossessionPoke({ ...context, userId, pokeId });
      if (!result.success) throw new Error(result.message || 'Could not match possession poke');
      setNotice(result.message || 'Possession poke matched');
      if (result.market) setMarket(result.market); else await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not match possession poke'); }
    finally { setBusy(false); }
  }

  const sideButton = (side: PossessionSide, label: string) => (
    <Pressable onPress={() => setSelection(side)} accessibilityRole="button" accessibilityState={{ selected: selection === side }}
      style={({ pressed }) => [styles.sideButton, selection === side && styles.sideButtonActive, pressed && { opacity: PRESSED_OPACITY }]}>
      <Text style={[fanText('button', colors, selection === side ? colors.primary : colors.textPrimary), styles.center]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { height: screenH * 0.82, maxHeight: screenH * 0.82 }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerIcon}><Text style={{ color: colors.primary, fontSize: 17 }}>✦</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>Possession</Text>
                <Text style={styles.muted}>{fixture.league || 'Match'}</Text>
              </View>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close possession modal" hitSlop={10} style={styles.closeButton}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
            <View style={styles.matchHeader}>
              <View style={styles.matchSide}><Text style={[styles.matchName, { color: colors.primary }]} numberOfLines={1}>{fixture.homeTeam}</Text></View>
              <View style={styles.matchCenter}><Text style={styles.versus}>VS</Text>{(fixture.isLive || fixture.status === 'live') && <Text style={styles.liveBadge}>LIVE</Text>}</View>
              <View style={[styles.matchSide, { alignItems: 'flex-end' }]}><Text style={[styles.matchName, { color: colors.away }]} numberOfLines={1}>{fixture.awayTeam}</Text></View>
            </View>

            <View style={styles.tabs}>
              <Pressable onPress={() => { setTab('vote'); setError(null); }} style={[styles.tab, tab === 'vote' && styles.tabActive]}>
                <Text style={fanText('button', colors, tab === 'vote' ? colors.primary : colors.textSecondary)}>Vote</Text>
              </Pressable>
              <Pressable onPress={() => { setTab('poke'); setError(null); }} style={[styles.tab, tab === 'poke' && styles.tabActive]}>
                <Text style={fanText('button', colors, tab === 'poke' ? colors.primary : colors.textSecondary)}>Poke</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHead}>
              <Text style={fanText('button', colors, colors.textPrimary)}>Possession votes</Text>
              <Text style={fanText('tag', colors, colors.textSecondary)}>{total} {total === 1 ? 'vote' : 'votes'}</Text>
            </View>
            <View style={styles.bar}><View style={[styles.homeBar, { flex: homePercent }]} /><View style={[styles.awayBar, { flex: 100 - homePercent }]} /></View>
            <View style={styles.scoreLine}>
              <Text style={fanText('tag', colors, colors.textPrimary)}>{fixture.homeTeam}  {homeVotes} · {total ? homePercent : 0}%</Text>
              <Text style={fanText('tag', colors, colors.textPrimary)}>{fixture.awayTeam}  {awayVotes} · {total ? 100 - homePercent : 0}%</Text>
            </View>
            {(market?.votes ?? []).map((vote) => (
              <View key={vote.id} style={styles.pokeRow}>
                <Avatar colors={colors} size="md" userId={vote.userId} label={vote.username?.[0] ?? '?'} />
                <Text style={[fanText('button', colors, colors.textPrimary), { flex: 1 }]}>{vote.username}</Text>
                <Text style={fanText('tag', colors, vote.selection === 'home' ? colors.primary : colors.away)}>{vote.selection === 'home' ? fixture.homeTeam : fixture.awayTeam}</Text>
              </View>
            ))}
            {!loading && (market?.votes.length ?? 0) === 0 && <Text style={[fanText('caption', colors, colors.textSecondary), styles.empty]}>No possession votes yet.</Text>}

            <View style={styles.sideRow}>{sideButton('home', fixture.homeTeam)}{sideButton('away', fixture.awayTeam)}</View>
            {tab === 'vote' ? (
              <Pressable disabled={busy || loading || market !== null && market.status !== 'open'} onPress={() => void submitVote()} style={({ pressed }) => [styles.primaryButton, (pressed || busy) && { opacity: PRESSED_OPACITY }]}>
                <Text style={fanText('button', colors, '#FFFFFF')}>{busy ? 'Submitting…' : 'Submit possession vote'}</Text>
              </Pressable>
            ) : (
              <View style={styles.pokeEntry}>
                <View style={styles.amountWrap}>
                  <Text style={fanText('tag', colors, colors.textSecondary)}>Points to stake</Text>
                  <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Points" placeholderTextColor={colors.textTertiary} style={[fanText('body', colors, colors.textPrimary), styles.amountInput]} />
                </View>
                <Pressable disabled={busy || loading} onPress={() => void submitPoke()} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: PRESSED_OPACITY }]}>
                  <Text style={fanText('button', colors, '#FFFFFF')}>Create poke</Text>
                </Pressable>
              </View>
            )}

            {error && <Text accessibilityRole="alert" style={[fanText('caption', colors, colors.away), styles.message]}>{error}</Text>}
            {notice && <Text accessibilityRole="text" style={[fanText('caption', colors, colors.primary), styles.message]}>{notice}</Text>}

            <View style={styles.sectionHead}>
              <Text style={fanText('button', colors, colors.textPrimary)}>Possession pokes</Text>
              <Pressable onPress={() => void refresh()} disabled={loading}><Text style={fanText('tag', colors, colors.primary)}>Refresh</Text></Pressable>
            </View>
            <View style={styles.tabs}>
              <Pressable onPress={() => setPokeListTab('open')} style={[styles.tab, pokeListTab === 'open' && styles.tabActive]}><Text style={fanText('button', colors, pokeListTab === 'open' ? colors.primary : colors.textSecondary)}>Unmatched</Text></Pressable>
              <Pressable onPress={() => setPokeListTab('matched')} style={[styles.tab, pokeListTab === 'matched' && styles.tabActive]}><Text style={fanText('button', colors, pokeListTab === 'matched' ? colors.primary : colors.textSecondary)}>Matched</Text></Pressable>
            </View>
            {loading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
            {!loading && (market?.pokes ?? []).filter((poke) => pokeListTab === 'open' ? poke.status === 'open' : poke.status === 'matched' || poke.status === 'settled').length === 0 && <Text style={[fanText('caption', colors, colors.textSecondary), styles.empty]}>{pokeListTab === 'open' ? 'No unmatched possession pokes yet.' : 'No matched possession pokes yet.'}</Text>}
            {(market?.pokes ?? []).filter((poke) => pokeListTab === 'open' ? poke.status === 'open' : poke.status === 'matched' || poke.status === 'settled').map((poke) => (
              <View key={poke.id} style={styles.pokeRow}>
                <View style={styles.pokeDetails}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Avatar colors={colors} size="md" userId={poke.userId} label={poke.username?.[0] ?? '?'} /><Text style={fanText('button', colors, colors.textPrimary)}>{poke.username}</Text></View>
                  <Text style={fanText('tag', colors, colors.textSecondary)}>{poke.selection === 'home' ? fixture.homeTeam : fixture.awayTeam} · {poke.amount} pts</Text>{pokeListTab === 'matched' && poke.finisherName && <Text style={fanText('tag', colors, colors.textSecondary)}>↔ {poke.finisherName} · {poke.finisherSelection === 'home' ? fixture.homeTeam : fixture.awayTeam} · {poke.finisherAmount ?? poke.amount} pts</Text>}
                </View>
                {pokeListTab === 'open' && poke.userId !== userId && <Pressable disabled={busy} onPress={() => void matchPoke(poke.id)} style={styles.matchButton}><Text style={fanText('tag', colors, colors.primary)}>Match</Text></Pressable>}
              </View>
            ))}
            {market?.settlement && <Text style={[fanText('caption', colors, colors.textSecondary), styles.message]}>Settled · winner: {market.settlement.winner ?? 'No winner'}</Text>}
            <Text style={[fanText('tag', colors, colors.textTertiary), styles.disclaimer]}>Separate from match-winner votes and regular match pokes.</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useFanColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)' },
    sheet: { width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
    
    content: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
    handle: { width: 32, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: 'center', marginTop: 0, marginBottom: 7 },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    headerText: { flex: 1, minWidth: 0, gap: 3 },
    eyebrow: { fontWeight: '800', letterSpacing: 1 },
    close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    tabs: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.background, marginTop: 18, gap: 5 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 11 },
    tabActive: { backgroundColor: colors.primaryDim },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 9, gap: 10 },
    bar: { height: 9, flexDirection: 'row', borderRadius: 8, overflow: 'hidden', backgroundColor: colors.border },
    homeBar: { backgroundColor: colors.primary },
    awayBar: { backgroundColor: colors.away },
    scoreLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 7 },
    sideRow: { flexDirection: 'row', gap: 9, marginTop: 18 },
    sideButton: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    sideButtonActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
    center: { textAlign: 'center' },
    primaryButton: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    pokeEntry: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginTop: 12 },
    amountWrap: { flex: 1, minWidth: 0 },
    amountInput: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 5 },
    message: { marginTop: 12 },
    loader: { marginVertical: 14 },
    empty: { marginTop: 4 },
    pokeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    pokeDetails: { flex: 1, minWidth: 0, gap: 2 },
    matchButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primaryDim },
    disclaimer: { marginTop: 16, lineHeight: 16 },
  });
}
