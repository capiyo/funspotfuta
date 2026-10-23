import { useEffect, useMemo, useState } from 'react';
import { createPoke, getOpenPokes, getUserPokes, getUserPoints, matchPoke, type Poke } from '@funspot/core';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Fixture, FanColorPalette } from '@funspot/core';
import { API_BASE_URL, fetchSubFixtures, fetchSubFixturePledges, fetchVoters, type SubFixtureMarket } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

type Props = { visible: boolean; fixture: Fixture; userId: string; username: string; authToken?: string | null; onClose: () => void };

export function PokeModal({ visible, fixture, userId, username, authToken, onClose }: Props) {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<'open' | 'matched' | 'subfixtures'>('open');
  const [openPokes, setOpenPokes] = useState<Poke[]>([]);
  const [matchedPokes, setMatchedPokes] = useState<Poke[]>([]);
  const [markets, setMarkets] = useState<SubFixtureMarket[]>([]);
  const [marketId, setMarketId] = useState('main_fixture');
  const [selection, setSelection] = useState<'home_team' | 'away_team'>('home_team');
  const [stake, setStake] = useState('5');
  const [balance, setBalance] = useState<number | null>(null);
  const [pokers, setPokers] = useState<Array<{ userName?: string; user_name?: string; starter_name?: string; selection?: string; amount?: number; starter_amount?: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true); setError(''); setMessage('');
    Promise.all([getUserPoints(userId, authToken ?? undefined), fetchSubFixtures(fixture.matchId || fixture.id, authToken)])
      .then(([points, available]) => {
        if (!active) return;
        setBalance(points);
        setMarkets(available.filter((market) => market.isVisible && !['closed', 'settled'].includes(market.status.toLowerCase())));
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load points and sub-fixtures.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, authToken, fixture.id, fixture.matchId, userId]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const fixtureId = fixture.matchId || fixture.id;
    const request = marketId === 'main_fixture' ? fetchVoters(fixtureId, authToken) : fetchSubFixturePledges(marketId, fixtureId, authToken);
    request.then((rows) => { if (active) setPokers(rows as typeof pokers); }).catch(() => { if (active) setPokers([]); });
    return () => { active = false; };
  }, [visible, authToken, fixture.id, fixture.matchId, marketId]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const matchId = fixture.matchId || fixture.id;
    Promise.all([getOpenPokes(matchId, authToken || undefined), getUserPokes(userId, authToken || undefined)])
      .then(([open, mine]) => {
        if (!active) return;
        setOpenPokes(open.filter((p) => p.status.toLowerCase() === 'open' && p.matchId === matchId));
        setMatchedPokes(mine.filter((p) => p.status.toLowerCase() !== 'open'));
      }).catch(() => {});
    return () => { active = false; };
  }, [visible, fixture.id, fixture.matchId, userId, authToken]);

  const selectedMarket = markets.find((market) => market.id === marketId);
  const options = useMemo(() => {
    const raw = selectedMarket?.options ?? [fixture.homeTeam, fixture.awayTeam];
    return raw.map((label) => {
      const value = label.trim().toLowerCase();
      if (value === 'home' || value === 'home_team' || value === fixture.homeTeam.toLowerCase()) return { label, value: 'home_team' as const };
      if (value === 'away' || value === 'away_team' || value === fixture.awayTeam.toLowerCase()) return { label, value: 'away_team' as const };
      return null;
    }).filter((item): item is { label: string; value: 'home_team' | 'away_team' } => item !== null);
  }, [selectedMarket, fixture.homeTeam, fixture.awayTeam]);

  async function submitPoke() {
    setError(''); setMessage('');
    const amount = Number(stake);
    if (!Number.isInteger(amount) || amount < 5) return setError('The minimum poke is 5 points.');
    if (balance === null) return setError('Your points balance is not available yet.');
    if (amount > balance) return setError('You do not have enough points for this poke.');
    if (!options.some((option) => option.value === selection)) return setError('Choose Home or Away.');
    setSubmitting(true);
    try {
      await createPoke({
        matchId: fixture.matchId || fixture.id,
        userId,
        userName: username,
        selection: selection === 'home_team' ? 'home' : 'away',
        amount,
        token: authToken ?? undefined,
        marketId: selectedMarket?.id ?? 'main_fixture',
      });
      const matchId = fixture.matchId || fixture.id;
      const [points, open, mine] = await Promise.all([
        getUserPoints(userId, authToken ?? undefined),
        getOpenPokes(matchId, authToken ?? undefined),
        getUserPokes(userId, authToken ?? undefined),
      ]);
      setBalance(points);
      setOpenPokes(open.filter((poke) => poke.status.toLowerCase() === 'open' && poke.matchId === matchId));
      setMatchedPokes(mine.filter((poke) => poke.status.toLowerCase() !== 'open'));
      setMessage('Poke was successful!');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit poke.'); }
    finally { setSubmitting(false); }
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={styles.eyebrow}>POKE WITH POINTS</Text><Text style={styles.title}>{fixture.homeTeam} vs {fixture.awayTeam}</Text></View>
          <Pressable onPress={onClose} disabled={submitting} accessibilityLabel="Close poke modal"><Text style={styles.close}>×</Text></Pressable>
        </View>
                <View style={styles.tabs}>
          {([{id:'open',label:'Open Pokes'},{id:'matched',label:'Matched Pokes'},{id:'subfixtures',label:'Sub-fixtures'}] as const).map((item) => <Pressable key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, tab === item.id && styles.tabActive]}><Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text></Pressable>)}
        </View>
        {tab === 'open' && <View style={styles.listSection}>
          <Text style={styles.label}>Open pokes · {openPokes.length}</Text>
          {openPokes.length ? openPokes.map((p) => <View key={p.id} style={styles.pokerRow}><View style={{flex:1}}><Text style={styles.choiceText}>{p.userName} · {p.selection}</Text><Text style={styles.muted}>{p.amount} pts</Text></View><Pressable disabled={p.userId === userId || submitting} onPress={() => void (async () => { setSubmitting(true); setError(''); try { const result = await matchPoke({pokeId:p.id,userId,userName:username,selection:p.selection === 'home' ? 'away' : 'home',amount:p.amount,token:authToken || undefined}); // matchPoke throws with the server's error message on failure. setMessage('Poke matched successfully'); const [points,open,mine]=await Promise.all([getUserPoints(userId,authToken || undefined),getOpenPokes(fixture.matchId || fixture.id,authToken || undefined),getUserPokes(userId,authToken || undefined)]); setBalance(points); setOpenPokes(open.filter(x=>x.status.toLowerCase()==='open' && x.matchId===(fixture.matchId || fixture.id))); setMatchedPokes(mine.filter(x=>x.status.toLowerCase()!=='open')); } catch(e) { setError(e instanceof Error?e.message:'Could not match poke'); } finally { setSubmitting(false); } })()} style={[styles.matchButton, (p.userId === userId || submitting) && {opacity:0.45}]}><Text style={styles.primaryText}>Match</Text></Pressable></View>) : <Text style={styles.muted}>No open pokes for this fixture yet.</Text>}
        </View>}
        {tab === 'matched' && <View style={styles.listSection}><Text style={styles.label}>Matched pokes · {matchedPokes.length}</Text>{matchedPokes.length ? matchedPokes.map(p => <View key={p.id} style={styles.pokerRow}><View style={{flex:1}}><Text style={styles.choiceText}>{p.userName} · {p.selection}</Text><Text style={styles.muted}>{p.amount} pts · {p.status}</Text><Text style={styles.muted}>{p.finisherName ? 'Matched with '+p.finisherName : 'Outcome pending'}</Text></View></View>) : <Text style={styles.muted}>Your matched pokes will appear here.</Text>}</View>}

        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.balance}><Text style={styles.muted}>Available points</Text><Text style={styles.balanceValue}>{loading ? 'Loading…' : balance === null ? 'Unavailable' : balance.toLocaleString()}</Text></View>
          <Text style={styles.label}>Fixture / sub-fixture</Text>
          <View style={styles.optionsWrap}>
            <Pressable onPress={() => setMarketId('main_fixture')} style={[styles.choice, marketId === 'main_fixture' && styles.selected]}><Text style={styles.choiceText}>Main fixture</Text></Pressable>
            {markets.map((market) => <Pressable key={market.id} onPress={() => setMarketId(market.id)} style={[styles.choice, marketId === market.id && styles.selected]}><Text style={styles.choiceText}>{market.marketType.replace(/([A-Z])/g, ' $1').trim()}</Text></Pressable>)}
          </View>
          <Text style={styles.label}>Pick a side</Text>
          <View style={styles.optionsWrap}>{options.map((option) => <Pressable key={option.value} onPress={() => setSelection(option.value)} style={[styles.choice, selection === option.value && styles.selected]}><Text style={styles.choiceText}>{option.label}</Text></Pressable>)}</View>
          <Text style={styles.label}>Stake (minimum 5 points)</Text>
          <TextInput value={stake} onChangeText={setStake} keyboardType="number-pad" editable={!submitting} style={styles.input} placeholder="5" placeholderTextColor={colors.textTertiary} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!message && <Text style={styles.success}>{message}</Text>}
          <Pressable onPress={() => void submitPoke()} disabled={loading || submitting} style={[styles.primaryButton, (loading || submitting) && { opacity: 0.6 }]}><Text style={styles.primaryText}>{submitting ? 'Sending poke…' : 'Poke'}</Text></Pressable>
          <Text style={styles.label}>Pokers</Text>
          {pokers.length ? pokers.map((poker, index) => <View key={`${poker.userName ?? poker.user_name ?? poker.starter_name ?? 'poker'}-${index}`} style={styles.pokerRow}><Text style={styles.choiceText}>{poker.userName ?? poker.user_name ?? poker.starter_name ?? 'Fan'}</Text><Text style={styles.muted}>{poker.selection ?? '—'} · {poker.amount ?? poker.starter_amount ?? 0} pts</Text></View>) : <Text style={styles.muted}>No pokes recorded yet.</Text>}
          
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', padding: 16 },
    panel: { maxHeight: '90%', backgroundColor: colors.background, borderRadius: 16, padding: 18 },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', marginBottom: 5 },
    title: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' },
    close: { color: colors.textPrimary, fontSize: 30, lineHeight: 32 },
    tabs: { flexDirection: 'row', gap: 4, marginBottom: 12, backgroundColor: colors.surfaceSunken, padding: 4, borderRadius: 10 },
    tab: { flex: 1, paddingVertical: 9, paddingHorizontal: 3, borderRadius: 7, alignItems: 'center' },
    tabActive: { backgroundColor: colors.primary },
    tabText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' },
    tabTextActive: { color: colors.textInverse },
    listSection: { marginBottom: 14 },
    matchButton: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, alignSelf: 'center' },
    balance: { backgroundColor: colors.surfaceSunken, padding: 13, borderRadius: 10, marginBottom: 12 },
    balanceValue: { color: colors.textPrimary, fontSize: 23, fontWeight: '800', marginTop: 3 },
    muted: { color: colors.textSecondary, fontSize: 12 },
    label: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8 },
    optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9 },
    selected: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
    choiceText: { color: colors.textPrimary, fontSize: 13 },
    input: { borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceSunken, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
    error: { color: colors.away, marginTop: 10, fontSize: 13 },
    success: { color: colors.primary, marginTop: 10, fontSize: 13, fontWeight: '700' },
    primaryButton: { marginTop: 14, backgroundColor: colors.primary, padding: 13, borderRadius: 9, alignItems: 'center' },
    primaryText: { color: colors.textInverse, fontWeight: '800' },
    pokerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    note: { color: colors.textTertiary, fontSize: 11, marginTop: 14, lineHeight: 16 },
  });
}
