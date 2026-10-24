import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView, TestIds, MobileAds } from 'react-native-google-mobile-ads';
import { useFanColors } from '@/theme/use-fan-colors';
import { getAllFixtures, type Fixture } from '@funspot/core';

const PRODUCTION_UNITS = ['ca-app-pub-8671302794311438/3524169425', 'ca-app-pub-8671302794311438/4130674080', 'ca-app-pub-8671302794311438/1504510743'] as const;
type LoadedAd = { id: string; ad: NativeAd };
type Slide =
  | { type: 'ad'; id: string; ad: NativeAd }
  | { type: 'fixture'; id: string; fixture: Fixture };

export default function AdCarousel() {
  const colors = useFanColors();
  const { width } = useWindowDimensions();
  const [ads, setAds] = useState<LoadedAd[]>([]);
  const [index, setIndex] = useState(0);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const listRef = useRef<FlatList<Slide>>(null);

  useEffect(() => {
    let alive = true;
    getAllFixtures()
      .then((items) => { if (alive) setFixtures(items.slice(0, PRODUCTION_UNITS.length)); })
      .catch(() => undefined);
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
    const adSlides: Slide[] = ads.map((item) => ({ type: 'ad', id: item.id, ad: item.ad }));
    const fixtureSlides: Slide[] = fixtures.map((fixture) => ({
      type: 'fixture',
      id: `fixture-${fixture.matchId ?? fixture.id}`,
      fixture,
    }));
    const mixed: Slide[] = [];
    const count = Math.max(adSlides.length, fixtureSlides.length);
    for (let slideIndex = 0; slideIndex < count; slideIndex += 1) {
      if (adSlides[slideIndex]) mixed.push(adSlides[slideIndex]);
      if (fixtureSlides[slideIndex]) mixed.push(fixtureSlides[slideIndex]);
    }
    return mixed;
  }, [ads, fixtures]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % slides.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);
  if (slides.length === 0) return null;

  return <View style={styles.wrap} accessibilityLabel="Automatic advertisement carousel">
    <FlatList ref={listRef} horizontal pagingEnabled data={slides} keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={(event) => setIndex(Math.max(0, Math.min(Math.round(event.nativeEvent.contentOffset.x / width), slides.length - 1)))}
      getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
      renderItem={({ item }) => <View style={[styles.slide, { width }]}>
        {item.type === 'ad' ? (
          <NativeAdView nativeAd={item.ad} style={[styles.ad, { backgroundColor: colors.surface }]}>
            <View style={styles.labelRow}><Text style={[styles.label, { color: colors.textTertiary }]}>ADVERTISEMENT</Text><NativeAsset assetType={NativeAssetType.ADVERTISER}><Text style={[styles.advertiser, { color: colors.textTertiary }]}>{item.ad.advertiser ?? ''}</Text></NativeAsset></View>
            <View style={styles.content}><NativeMediaView style={styles.media} /><View style={styles.copy}><NativeAsset assetType={NativeAssetType.HEADLINE}><Text style={[styles.headline, { color: colors.textPrimary }]}>{item.ad.headline ?? ''}</Text></NativeAsset><NativeAsset assetType={NativeAssetType.BODY}><Text style={[styles.body, { color: colors.textSecondary }]}>{item.ad.body ?? ''}</Text></NativeAsset></View><NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}><Text style={[styles.cta, { backgroundColor: colors.primary, color: colors.surface }]}>{item.ad.callToAction ?? 'Learn more'}</Text></NativeAsset></View>
          </NativeAdView>
        ) : (
          <View style={[styles.fixture, { backgroundColor: colors.surface }]}>
            <Text numberOfLines={1} style={[styles.team, { color: colors.textPrimary, textAlign: 'right' }]}>{item.fixture.homeTeam}</Text>
            <Text style={[styles.vs, { color: colors.textTertiary }]}>VS</Text>
            <Text numberOfLines={1} style={[styles.team, { color: colors.textPrimary }]}>{item.fixture.awayTeam}</Text>
          </View>
        )}
      </View>}
    />
    {slides.length > 1 && <View style={styles.dots}>{slides.map((slide, dotIndex) => <Pressable key={slide.id} onPress={() => { setIndex(dotIndex); listRef.current?.scrollToIndex({ index: dotIndex, animated: true }); }} accessibilityLabel={`Show carousel slide ${dotIndex + 1}`}><View style={[styles.dot, { backgroundColor: index === dotIndex ? colors.primary : colors.textTertiary + '66', width: index === dotIndex ? 16 : 5 }]} /></Pressable>)}</View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginVertical: 2 }, slide: { paddingHorizontal: 10 },
  ad: { borderRadius: 8, padding: 6, minHeight: 68, overflow: 'hidden' },
  fixture: { borderRadius: 8, paddingHorizontal: 14, minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  team: { flex: 1, fontSize: 12, fontWeight: '700' },
  vs: { fontSize: 10, fontWeight: '700' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  label: { fontSize: 8, letterSpacing: 0.5, fontWeight: '700' }, advertiser: { fontSize: 9 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 6 }, media: { width: 46, height: 42, borderRadius: 5, overflow: 'hidden' },
  copy: { flex: 1, gap: 2 }, headline: { fontSize: 11, fontWeight: '700' }, body: { fontSize: 9 },
  cta: { overflow: 'hidden', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, fontSize: 9, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 3 }, dot: { height: 5, borderRadius: 3 },
});
