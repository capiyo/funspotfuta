import { Avatar } from '@/components/ui/Avatar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TeamCrest } from '@/components/TeamCrest';
import { useQueryClient } from '@tanstack/react-query';
import { createPoke, getOpenPokes, getUserPokes, getUserPoints, matchPoke, mergeOpenPokes, type Poke } from '@funspot/core';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { Channel, Fixture, FanColorPalette } from '@funspot/core';
import { queryKeys } from '@funspot/core';
import { API_BASE_URL, fetchSubFixtures, fetchSubFixturePledges, fetchVoters, type SubFixtureMarket } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

function pokeIdentity(poke: Poke): string {
  return poke.id
    ? String(poke.id)
    : [poke.matchId, poke.userId, poke.selection, poke.amount, poke.createdAt ?? ''].join(':');
}

type Props = { visible: boolean; fixture: Fixture; userId: string; username: string; authToken?: string | null; channelId?: string; onClose: () => void };

function cachedChannelMemberPoints(channels: Channel[] | undefined, channelId: string | undefined, userId: string): number | null {
  const member = channels?.find((channel) => channel.channelId === channelId)?.members.find((item) => item.userId === userId);
  return typeof member?.seasonPoints === 'number' && Number.isFinite(member.seasonPoints) ? member.seasonPoints : null;
}

function writeCachedChannelMemberPoints(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  channelId: string | undefined,
  points: number,
): void {
  if (!channelId) return;
  queryClient.setQueryData<Channel[]>(queryKeys.channels(userId), (channels) => channels?.map((channel) => (
    channel.channelId !== channelId ? channel : {
      ...channel,
      members: channel.members.map((member) => member.userId === userId ? { ...member, seasonPoints: points } : member),
    }
  )));
}

export function PokeModal({ visible, fixture, userId, username, authToken, channelId, onClose }: Props) {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height: screenH } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'open' | 'matched' | 'subfixtures'>('open');
  const [openPokes, setOpenPokes] = useState<Poke[]>([]);
  const [matchedPokes, setMatchedPokes] = useState<Poke[]>([]);
  const [markets, setMarkets] = useState<SubFixtureMarket[]>([]);
  const [marketId, setMarketId] = useState('main_fixture');
  const [selection, setSelection] = useState<'home_team' | 'away_team'>('home_team');
  const [stake, setStake] = useState('5');
  const [balance, setBalance] = useState<number | null>(null);
  const [pokers, setPokers] = useState<Array<{ userId?: string; user_id?: string; userName?: string; user_name?: string; starter_name?: string; selection?: string; amount?: number; starter_amount?: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const tabOrder = ['open', 'matched', 'subfixtures'] as const;
  function handleTouchStart(event: { nativeEvent: { pageX: number; pageY: number } }) { touchStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }; }
  function handleTouchEnd(event: { nativeEvent: { pageX: number; pageY: number } }) { const start = touchStart.current; touchStart.current = null; if (!start) return; const dx = event.nativeEvent.pageX - start.x; const dy = event.nativeEvent.pageY - start.y; if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.25) return; setTab((current) => { const index = tabOrder.indexOf(current); return tabOrder[Math.max(0, Math.min(tabOrder.length - 1, index + (dx < 0 ? 1 : -1)))]; }); }
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true); setError(''); setMessage('');
    const cachedPoints = cachedChannelMemberPoints(queryClient.getQueryData<Channel[]>(queryKeys.channels(userId)), channelId, userId);
    if (cachedPoints !== null) setBalance(cachedPoints);
    Promise.all([
      cachedPoints !== null ? Promise.resolve(cachedPoints) : getUserPoints(userId, authToken ?? undefined),
      fetchSubFixtures(fixture.matchId || fixture.id, authToken),
    ])
      .then(([points, available]) => {
        if (!active) return;
        setBalance(points);
        setMarkets(available.filter((market) => market.isVisible && !['closed', 'settled'].includes(market.status.toLowerCase())));
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load points and sub-fixtures.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, authToken, fixture.id, fixture.matchId, userId, channelId, queryClient]);

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
    // Do not turn a temporarily missing channel selection into an empty list.
    if (!channelId) return () => { active = false; };
    const matchId = String(fixture.matchId || fixture.id);
    const cacheKey = channelId ? queryKeys.openPokes(matchId, channelId, marketId) : null;
    const cachedOpen = cacheKey ? queryClient.getQueryData<Poke[]>(cacheKey) : undefined;
    if (cachedOpen) setOpenPokes(cachedOpen);
    Promise.all([getOpenPokes(matchId, authToken || undefined, channelId, marketId), getUserPokes(userId, authToken || undefined)])
      .then(([open, mine]) => {
        if (!active) return;
        const nextOpen = open.filter((p) => p.status.trim().toLowerCase() === 'open' && String(p.matchId) === matchId);
        const previousOpen = cacheKey ? queryClient.getQueryData<Poke[]>(cacheKey) ?? [] : [];
        // The endpoint can return an incomplete list while writes propagate.
        // Merge rather than replacing cached rows with an empty or partial response.
        const stableOpen = mergeOpenPokes(previousOpen, nextOpen);
        if (cacheKey) queryClient.setQueryData<Poke[]>(cacheKey, stableOpen);
        setOpenPokes(stableOpen);
        setMatchedPokes(mine.filter((p) => String(p.matchId) === String(fixture.matchId || fixture.id) && p.status.trim().toLowerCase() !== 'open'));
      }).catch(() => {});
    return () => { active = false; };
  }, [visible, fixture.id, fixture.matchId, userId, authToken, channelId, marketId, queryClient]);

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
    if (!channelId) { setError('Choose a channel before creating or matching a poke.'); return; }
    if (fixture.isLive || fixture.status === 'live') { setError('Pokes are closed once a match goes live.'); return; }
    setError(''); setMessage('');
    const amount = Number(stake);
    if (!Number.isInteger(amount) || amount < 5) return setError('The minimum poke is 5 points.');
    if (balance === null) return setError('Your points balance is not available yet.');
    if (amount > balance) return setError('You do not have enough points for this poke.');
    if (!options.some((option) => option.value === selection)) return setError('Choose Home or Away.');
    setSubmitting(true);
    try {
      const createdPoke = await createPoke({
        matchId: fixture.matchId || fixture.id,
        userId,
        userName: username,
        selection: selection === 'home_team' ? 'home' : 'away',
        amount,
        token: authToken ?? undefined,
        marketId: selectedMarket?.id ?? 'main_fixture',
        channelId,
      });
      const matchId = fixture.matchId || fixture.id;
      const [open, mine] = await Promise.all([
        getOpenPokes(matchId, authToken ?? undefined, channelId, marketId),
        getUserPokes(userId, authToken ?? undefined),
      ]);
      const nextBalance = balance === null ? null : Math.max(0, balance - amount);
      setBalance(nextBalance);
      if (nextBalance !== null) writeCachedChannelMemberPoints(queryClient, userId, channelId, nextBalance);
      const nextOpen = open.filter((poke) => poke.status.trim().toLowerCase() === 'open' && String(poke.matchId) === String(matchId));
      const cacheKey = queryKeys.openPokes(String(matchId), channelId, marketId);
      const previousOpen = queryClient.getQueryData<Poke[]>(cacheKey) ?? [];
      // Include the confirmed create response immediately; GET may lag behind POST.
      const stableOpen = mergeOpenPokes(previousOpen, nextOpen, [createdPoke]);
      if (channelId) queryClient.setQueryData<Poke[]>(cacheKey, stableOpen);
      setOpenPokes(stableOpen);
      setMatchedPokes(mine.filter((poke) => String(poke.matchId) === String(fixture.matchId || fixture.id) && poke.status.trim().toLowerCase() !== 'open'));
      setMessage('Poke was successful!');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit poke.'); }
    finally { setSubmitting(false); }
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={[styles.panel, { width: '100%', height: screenH * 0.82, maxHeight: screenH * 0.82 }]} onPress={() => { }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <View style={styles.handleWrap}><View style={styles.handle} /></View>
        <View style={styles.header}>
          <View style={styles.headerIcon}><Text style={{ color: colors.primary, fontSize: 17 }}>✦</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.title}>Poke</Text><Text style={styles.muted}>{fixture.league || 'Match'}</Text></View>
          <Pressable onPress={onClose} disabled={submitting} accessibilityRole="button" accessibilityLabel="Close poke modal" style={styles.closeButton}><Text style={styles.close}>×</Text></Pressable>
        </View>
        <View style={styles.matchHeader}>
          <View style={styles.matchSide}><Text style={[styles.matchName, { color: colors.primary }]}>{fixture.homeTeam}</Text></View>
          <View style={styles.matchCenter}><Text style={styles.versus}>VS</Text>{(fixture.isLive || fixture.status === 'live') && <Text style={styles.liveBadge}>LIVE</Text>}</View>
          <View style={[styles.matchSide, { alignItems: 'flex-end' }]}><Text style={[styles.matchName, { color: colors.away }]}>{fixture.awayTeam}</Text></View>
        </View>
                <View style={styles.pointsSummary}><View style={{ flex: 1 }}><Text style={styles.muted}>Your points</Text><Text style={styles.balanceValue}>{loading ? 'Loading…' : balance === null ? 'Unavailable' : `${balance.toLocaleString()} pts`}</Text></View><Text style={styles.minimum}>MIN 5 PTS</Text></View>
        <View style={styles.tabs}>
          {([{id:'open',label:'Open Pokes'},{id:'matched',label:'Matched Pokes'},{id:'subfixtures',label:'Sub-fixtures'}] as const).map((item) => <Pressable key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, tab === item.id && styles.tabActive]}><Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text></Pressable>)}
        </View>
        {tab === 'open' && <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"><View style={styles.listSection}>
          <Text style={styles.label}>Open pokes · {openPokes.length}</Text>
          {openPokes.length ? openPokes.map((p) => <View key={p.id} style={styles.pokerRow}><Avatar colors={colors} size="md" userId={p.userId} label={p.userName?.[0] ?? '?'} /><View style={{flex:1}}><Text style={styles.choiceText}><Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800' }}>✊ POKE</Text> · {p.userName} · {p.selection}</Text><Text style={styles.muted}>{p.amount} pts</Text></View><Pressable disabled={p.userId === userId || submitting || fixture.isLive || fixture.status === 'live'} onPress={() => void (async () => { setSubmitting(true); setError(''); try { if (!channelId) throw new Error('Choose a channel before matching a poke.'); if (fixture.isLive || fixture.status === 'live') throw new Error('Pokes are closed once a match goes live.'); if (balance === null || balance < p.amount) throw new Error('You do not have enough points to match this poke.'); await matchPoke({pokeId:p.id,userId,userName:username,selection:p.selection === 'home' ? 'away' : 'home',amount:p.amount,token:authToken || undefined}); setMessage('Poke matched successfully'); const matchedCacheKey = queryKeys.openPokes(String(fixture.matchId || fixture.id), channelId, marketId); queryClient.setQueryData<Poke[]>(matchedCacheKey, (current = []) => current.filter((item) => pokeIdentity(item) !== pokeIdentity(p))); setOpenPokes((current) => current.filter((item) => item.id !== p.id)); const [open,mine]=await Promise.all([getOpenPokes(fixture.matchId || fixture.id,authToken || undefined,channelId,marketId),getUserPokes(userId,authToken || undefined)]); const nextBalance=balance===null?null:Math.max(0,balance-p.amount); setBalance(nextBalance); if(nextBalance!==null) writeCachedChannelMemberPoints(queryClient,userId,channelId,nextBalance); const nextOpen=open.filter(x=>x.status.trim().toLowerCase()==='open' && String(x.matchId)===String(fixture.matchId || fixture.id) && pokeIdentity(x)!==pokeIdentity(p)); const currentOpen=(queryClient.getQueryData<Poke[]>(matchedCacheKey) ?? []).filter(x=>pokeIdentity(x)!==pokeIdentity(p)); const stableOpen=mergeOpenPokes(currentOpen,nextOpen); if(channelId) queryClient.setQueryData<Poke[]>(matchedCacheKey,stableOpen); setOpenPokes(stableOpen); setMatchedPokes(mine.filter(x=>String(x.matchId)===String(fixture.matchId || fixture.id) && x.status.toLowerCase()!=='open')); } catch(e) { setError(e instanceof Error?e.message:'Could not match poke'); } finally { setSubmitting(false); } })()} style={[styles.matchButton, (p.userId === userId || submitting || fixture.isLive || fixture.status === 'live') && {opacity:0.45}]}><Text style={styles.primaryText}>Match</Text></Pressable></View>) : <Text style={styles.muted}>No open pokes for this fixture yet.</Text>}
        </View></ScrollView>}
        {tab === 'matched' && <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"><View style={styles.listSection}><Text style={styles.label}>Matched pokes · {matchedPokes.length}</Text>{matchedPokes.length ? matchedPokes.map(p => { const starterTeam = p.selection === 'away' ? fixture.awayTeam : fixture.homeTeam; const finisherSelection = p.finisherSelection?.toLowerCase(); const finisherTeam = finisherSelection ? (finisherSelection.includes('away') ? fixture.awayTeam : fixture.homeTeam) : (p.selection === 'away' ? fixture.homeTeam : fixture.awayTeam); return <View key={p.id} style={[styles.pokerRow,{flexDirection:'row',alignItems:'center',gap:6}]}><View style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:6}}><Avatar colors={colors} size="md" userId={p.userId} label={p.userName?.[0] ?? '?'} /><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.choiceText}>{p.userName || 'Fan'}</Text><View style={{flexDirection:'row',alignItems:'center',gap:5}}><TeamCrest name={starterTeam} fixture={fixture as unknown as Record<string,unknown>} side={p.selection === 'away' ? 'away' : 'home'} size={18}/><Text numberOfLines={1} style={styles.muted}>{starterTeam}</Text></View><Text style={[styles.choiceText,{fontWeight:'800',fontSize:12}]}>{p.amount} pts</Text></View></View><Text style={{color:colors.textTertiary,fontSize:10,fontWeight:'800'}}>VS</Text><View style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:6}}><View style={{flex:1,minWidth:0,alignItems:'flex-end'}}><Text numberOfLines={1} style={styles.choiceText}>{p.finisherName || 'Matched user'}</Text><View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:5}}><Text numberOfLines={1} style={styles.muted}>{finisherTeam}</Text><TeamCrest name={finisherTeam} fixture={fixture as unknown as Record<string,unknown>} side={finisherSelection?.includes('away') ? 'away' : finisherSelection ? 'home' : p.selection === 'away' ? 'home' : 'away'} size={18}/></View><Text style={[styles.choiceText,{fontWeight:'800',fontSize:12}]}>{p.finisherAmount ?? p.amount} pts</Text></View><Avatar colors={colors} size="md" userId={p.finisherId ?? undefined} label={p.finisherName?.[0] ?? '?'} /></View></View>; }) : <Text style={styles.muted}>Your matched pokes will appear here.</Text>}</View></ScrollView>}

        {tab === 'subfixtures' && <ScrollView keyboardShouldPersistTaps="handled">
  
          <Text style={styles.label}>Fixture / sub-fixture</Text>
          <View style={styles.optionsWrap}>
            <Pressable onPress={() => setMarketId('main_fixture')} style={[styles.choice, marketId === 'main_fixture' && styles.selected]}><Text style={styles.choiceText}>Main fixture</Text></Pressable>
            {markets.map((market) => <Pressable key={market.id} onPress={() => setMarketId(market.id)} style={[styles.choice, marketId === market.id && styles.selected]}><Text style={styles.choiceText}>{market.marketType.replace(/([A-Z])/g, ' $1').trim()}</Text></Pressable>)}
          </View>
          <Text style={styles.label}>Pick a side</Text>
          <View style={styles.optionsWrap}>{options.map((option) => <Pressable key={option.value} onPress={() => setSelection(option.value)} style={[styles.choice, selection === option.value && styles.selected]}><Text style={styles.choiceText}>{option.label}</Text></Pressable>)}</View>
          <Text style={styles.label}>Stake (minimum 5 points)</Text>
          <TextInput value={stake} onChangeText={setStake} keyboardType="number-pad" editable={!submitting} style={styles.input} placeholder="5" placeholderTextColor={colors.textTertiary} />
          <View style={styles.projection}><View style={styles.projectionRow}><Text style={styles.muted}>Your pick</Text><Text style={styles.choiceText}>{selection === 'home_team' ? fixture.homeTeam : fixture.awayTeam}</Text></View><View style={styles.projectionRow}><Text style={styles.muted}>Opponent stake</Text><Text style={styles.choiceText}>{Number.isInteger(Number(stake)) && Number(stake) >= 5 ? `${Number(stake)} points to match` : '—'}</Text></View><View style={[styles.projectionRow, styles.projectionTotal]}><Text style={styles.muted}>If you win</Text><Text style={[styles.choiceText, { color: colors.primary, fontWeight: '800' }]}>{balance !== null && Number.isInteger(Number(stake)) && Number(stake) >= 5 && Number(stake) <= balance ? `${balance + Number(stake)} pts balance` : '—'}</Text></View></View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!message && <Text style={styles.success}>{message}</Text>}
          <Pressable onPress={() => void submitPoke()} disabled={loading || submitting || fixture.isLive || fixture.status === 'live'} style={[styles.primaryButton, (loading || submitting || fixture.isLive || fixture.status === 'live') && { opacity: 0.6 }]}><Text style={styles.primaryText}>{submitting ? 'Sending poke…' : 'Poke'}</Text></Pressable>
          <Text style={styles.label}>Pokers</Text>
          {pokers.length ? pokers.map((poker, index) => {
            const pickedSide = poker.selection === 'home' || poker.selection === 'home_team'
              ? fixture.homeTeam
              : poker.selection === 'away' || poker.selection === 'away_team'
                ? fixture.awayTeam
                : poker.selection ?? '—';
            return (
              <View key={`${poker.userName ?? poker.user_name ?? poker.starter_name ?? 'poker'}-${index}`} style={styles.pokerRow}>
                <Avatar colors={colors} size="md" userId={poker.userId ?? poker.user_id} label={(poker.userName ?? poker.user_name ?? poker.starter_name ?? 'F')[0]} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={[styles.choiceText, { fontWeight: '700' }]}>
                    <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800' }}>✊ POKE</Text>
                    {' · '}{poker.userName ?? poker.user_name ?? poker.starter_name ?? 'Fan'}
                  </Text>
                  <Text style={styles.muted}>{pickedSide}</Text>
                </View>
                <Text style={[styles.muted, { fontWeight: '700' }]}>{poker.amount ?? poker.starter_amount ?? 0} pts</Text>
              </View>
            );
          }) : <Text style={styles.muted}>No pokes recorded yet.</Text>}
          
        </ScrollView>}
      </Pressable>
    </Pressable>
  </Modal>;
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    panel: { width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden', paddingHorizontal: 12, paddingBottom: 8 },
    handleWrap: { alignItems: 'center', paddingTop: 5, paddingBottom: 5 },
    handle: { width: 32, height: 4, borderRadius: 999, backgroundColor: colors.border },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
    headerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
    closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken },
    matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, paddingBottom: 8, marginBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    matchSide: { flex: 1, minWidth: 0 },
    matchName: { fontSize: 13, fontWeight: '800' },
    matchCenter: { alignItems: 'center', gap: 4 },
    versus: { color: colors.textTertiary, fontSize: 10, fontWeight: '800' },
    liveBadge: { color: colors.textInverse, backgroundColor: colors.away, fontSize: 8, fontWeight: '800', overflow: 'hidden', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
    eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', marginBottom: 5 },
    title: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
    close: { color: colors.textPrimary, fontSize: 30, lineHeight: 32 },
    pointsSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7, padding: 8, backgroundColor: colors.primaryDim, borderColor: colors.borderActive, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
    minimum: { color: colors.primary, fontSize: 10, fontWeight: '800' },
    projection: { marginTop: 10, padding: 10, backgroundColor: colors.surfaceSunken, borderRadius: 8, gap: 7 },
    projectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    projectionTotal: { paddingTop: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    tabs: { flexDirection: 'row', gap: 4, marginBottom: 6, backgroundColor: colors.surfaceSunken, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, padding: 3, borderRadius: 10 },
    tab: { flex: 1, paddingVertical: 6, paddingHorizontal: 2, borderRadius: 7, alignItems: 'center' },
    tabActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    tabText: { color: colors.textTertiary, fontSize: 10, fontWeight: '500', textAlign: 'center' },
    tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
    listSection: { marginBottom: 14 },
    matchButton: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, alignSelf: 'center' },
    balance: { backgroundColor: colors.surfaceSunken, padding: 13, borderRadius: 10, marginBottom: 12 },
    balanceValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 2 },
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
