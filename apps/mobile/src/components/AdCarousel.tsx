import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView, TestIds, MobileAds } from 'react-native-google-mobile-ads';
import { getAllFixtures, type Fixture } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

const PRODUCTION_UNITS = ['ca-app-pub-8671302794311438/3524169425', 'ca-app-pub-8671302794311438/4130674080', 'ca-app-pub-8671302794311438/1504510743'] as const;
type LoadedAd = { id: string; ad: NativeAd };
type Slide = { type: 'fixture'; id: string; fixture: Fixture } | { type: 'ad'; id: string; ad: NativeAd };

export default function AdCarousel() {
  const colors = useFanColors();
  const { width } = useWindowDimensions();
  const [ads, setAds] = useState<LoadedAd[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  useEffect(() => {
    let alive = true;
    getAllFixtures().then((items) => { if (alive) setFixtures(items.filter((item) => item.homeTeam && item.awayTeam).slice(0, 4)); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let alive = true;
    const created: NativeAd[] = [];
    const loadAds = async () => {
      try {
        await MobileAds().initialize();
        if (!alive) return;
        const unitIds = __DEV__ ? [TestIds.NATIVE, TestIds.NATIVE, TestIds.NATIVE] : [...PRODUCTION_UNITS];
        const results = await Promise.all(unitIds.map(async (unitId, i) => {
          try { const ad = await NativeAd.createForAdRequest(unitId); created.push(ad); return { id: `native-ad-${i}`, ad }; }
          catch { return null; }
        }));
        if (!alive) { created.forEach((ad) => ad.destroy()); return; }
        setAds(results.filter((item): item is LoadedAd => item !== null));
      } catch { /* Ads are optional and must never block messaging. */ }
    };
    void loadAds();
    return () => { alive = false; created.forEach((ad) => ad.destroy()); };
  }, []);

  const slides = useMemo<Slide[]>(() => {
    const mixed: Slide[] = [];
    const count = Math.max(fixtures.length, ads.length);
    for (let i = 0; i < count; i += 1) {
      if (fixtures[i]) mixed.push({ type: 'fixture', id: `fixture-${fixtures[i].matchId || fixtures[i].id || i}`, fixture: fixtures[i] });
      if (ads[i]) mixed.push({ type: 'ad', id: ads[i].id, ad: ads[i].ad });
    }
    return mixed;
  }, [fixtures, ads]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((previous) => {
      const next = (previous + 1) % slides.length;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      return next;
    }), 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(() => { if (index >= slides.length) setIndex(0); }, [index, slides.length]);
  if (slides.length === 0) return null;

  return <View style={styles.wrap} accessibilityLabel="Automatic fixture and advertisement carousel">
    <FlatList ref={listRef} horizontal pagingEnabled data={slides} keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={(event) => setIndex(Math.max(0, Math.min(Math.round(event.nativeEvent.contentOffset.x / width), slides.length - 1)))}
      getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
      renderItem={({ item }) => <View style={[styles.slide, { width }]}>
        {item.type === 'ad' ? <NativeAdView nativeAd={item.ad} style={[styles.ad, { backgroundColor: colors.surface }]}>
          <View style={styles.labelRow}><Text style={[styles.label, { color: colors.textTertiary }]}>ADVERTISEMENT</Text><NativeAsset assetType={NativeAssetType.ADVERTISER} /></View>
          <View style={styles.content}><NativeMediaView style={styles.media} /><View style={styles.copy}><NativeAsset assetType={NativeAssetType.HEADLINE} /><NativeAsset assetType={NativeAssetType.BODY} /></View><NativeAsset assetType={NativeAssetType.CALL_TO_ACTION} /></View>
        </NativeAdView> : <View style={[styles.fixture, { backgroundColor: colors.surface }]}>
          <View style={styles.team}><Text style={[styles.teamName, { color: colors.textPrimary }]} numberOfLines={1}>{item.fixture.homeTeam}</Text><Text style={[styles.teamLabel, { color: colors.textTertiary }]}>HOME</Text></View>
          <View style={styles.center}><Text style={[styles.vs, { color: colors.primary }]}>VS</Text><Text style={[styles.status, { color: colors.textTertiary }]} numberOfLines={1}>{item.fixture.status || 'Fixture'}</Text></View>
          <View style={styles.team}><Text style={[styles.teamName, { color: colors.textPrimary }]} numberOfLines={1}>{item.fixture.awayTeam}</Text><Text style={[styles.teamLabel, { color: colors.textTertiary }]}>AWAY</Text></View>
        </View>}
      </View>}
    />
    {slides.length > 1 && <View style={styles.dots}>{slides.map((slide, dotIndex) => <Pressable key={slide.id} onPress={() => { setIndex(dotIndex); listRef.current?.scrollToIndex({ index: dotIndex, animated: true }); }} accessibilityLabel={`Show carousel slide ${dotIndex + 1}`}><View style={[styles.dot, { backgroundColor: index === dotIndex ? colors.primary : colors.textTertiary + '66', width: index === dotIndex ? 16 : 5 }]} /></Pressable>)}</View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginVertical: 4 }, slide: { paddingHorizontal: 12 },
  ad: { borderRadius: 10, padding: 8, minHeight: 86, overflow: 'hidden' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 9, letterSpacing: 0.6, fontWeight: '700' }, advertiser: { fontSize: 10 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 }, media: { width: 58, height: 54, borderRadius: 6, overflow: 'hidden' },
  copy: { flex: 1, gap: 3 }, headline: { fontSize: 12, fontWeight: '700' }, body: { fontSize: 10 },
  cta: { overflow: 'hidden', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 7, fontSize: 10, fontWeight: '700' },
  fixture: { minHeight: 86, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  team: { flex: 1, alignItems: 'center', minWidth: 0 }, teamName: { fontSize: 13, fontWeight: '700', textAlign: 'center' }, teamLabel: { fontSize: 9, marginTop: 3 },
  center: { alignItems: 'center', minWidth: 44 }, vs: { fontSize: 12, fontWeight: '800' }, status: { fontSize: 9, marginTop: 3, textTransform: 'uppercase' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 5 }, dot: { height: 5, borderRadius: 3 },
});
