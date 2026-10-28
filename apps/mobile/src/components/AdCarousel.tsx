import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeAd as NativeAdInstance } from 'react-native-google-mobile-ads';
type NativeAdsModule = typeof import('react-native-google-mobile-ads');
import { useFanColors } from '@/theme/use-fan-colors';
import type { Fixture } from '@funspot/core';

const PRODUCTION_UNITS = ['ca-app-pub-8671302794311438/3524169425', 'ca-app-pub-8671302794311438/4130674080', 'ca-app-pub-8671302794311438/1504510743'] as const;
type LoadedAd = { id: string; ad: NativeAdInstance };
type Slide =
  | { type: 'ad'; id: string; ad: NativeAdInstance }
  | { type: 'fixture'; id: string; fixture: Fixture };

export default function AdCarousel({ showDots = false, flush = false, fixture = null }: { showDots?: boolean; flush?: boolean; fixture?: Fixture | null }) {
  const colors = useFanColors();
  const { width: windowWidth } = useWindowDimensions();
  const [carouselWidth, setCarouselWidth] = useState(0);
  const slideWidth = carouselWidth || windowWidth;
  const [ads, setAds] = useState<LoadedAd[]>([]);
  const [adsModule, setAdsModule] = useState<NativeAdsModule | null>(null);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let alive = true;
    const created: NativeAdInstance[] = [];
    const loadAds = async () => {
      try {
        // Load the native SDK only when an ad carousel is actually mounted.
        // A JS bundle can outlive its native binary during development; a
        // static import would crash the entire app before the fallback renders.
        const nativeAds = require('react-native-google-mobile-ads') as NativeAdsModule;
        if (!alive) return;
        setAdsModule(nativeAds);
        await nativeAds.MobileAds().initialize();
        if (!alive) return;
        const unitIds = __DEV__ ? [nativeAds.TestIds.NATIVE, nativeAds.TestIds.NATIVE, nativeAds.TestIds.NATIVE] : [...PRODUCTION_UNITS];
        const results = await Promise.all(unitIds.map(async (unitId, i) => {
          try { const ad = await nativeAds.NativeAd.createForAdRequest(unitId); created.push(ad); return { id: `native-ad-${i}`, ad }; }
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
    // Messaging gets only the fixture supplied by the active chat route.
    // Alternate that fixture with ads; never enumerate the global fixture list.
    if (!fixture) return adSlides;
    const currentFixture: Slide = {
      type: 'fixture',
      id: `fixture-${fixture.matchId ?? fixture.id}`,
      fixture,
    };
    const mixed: Slide[] = [];
    for (const ad of adSlides) {
      mixed.push(ad, { ...currentFixture, id: `${currentFixture.id}-after-${ad.id}` });
    }
    return mixed;
  }, [ads, fixture]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length, fixture?.matchId, fixture?.id]);

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

  const NativeAdView = adsModule?.NativeAdView;
  const NativeAsset = adsModule?.NativeAsset;
  const NativeMediaView = adsModule?.NativeMediaView;
  const NativeAssetType = adsModule?.NativeAssetType;

  return <View
    onLayout={(event) => {
      const nextWidth = event.nativeEvent.layout.width;
      setCarouselWidth((current) => Math.abs(current - nextWidth) > 1 ? nextWidth : current);
    }}
    style={[styles.wrap, flush && styles.flushWrap]}
    accessibilityLabel="Fixture and advertisement carousel"
  >
    <FlatList ref={listRef} horizontal pagingEnabled data={slides} keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={(event) => setIndex(Math.max(0, Math.min(Math.round(event.nativeEvent.contentOffset.x / slideWidth), slides.length - 1)))}
      getItemLayout={(_, itemIndex) => ({ length: slideWidth, offset: slideWidth * itemIndex, index: itemIndex })}
      renderItem={({ item }) => <View style={[styles.slide, { width: slideWidth }]}>
        {item.type === 'ad' && NativeAdView && NativeAsset && NativeMediaView && NativeAssetType ? (
          <NativeAdView nativeAd={item.ad} style={[styles.ad, { backgroundColor: colors.surface }]}>
            <View style={styles.labelRow}><Text style={[styles.label, { color: colors.textTertiary }]}>ADVERTISEMENT</Text><NativeAsset assetType={NativeAssetType.ADVERTISER}><Text style={[styles.advertiser, { color: colors.textTertiary }]}>{item.ad.advertiser ?? ''}</Text></NativeAsset></View>
            <View style={styles.content}><NativeMediaView style={styles.media} /><View style={styles.copy}><NativeAsset assetType={NativeAssetType.HEADLINE}><Text style={[styles.headline, { color: colors.textPrimary }]}>{item.ad.headline ?? ''}</Text></NativeAsset><NativeAsset assetType={NativeAssetType.BODY}><Text style={[styles.body, { color: colors.textSecondary }]}>{item.ad.body ?? ''}</Text></NativeAsset></View><NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}><Text style={[styles.cta, { backgroundColor: colors.primary, color: colors.surface }]}>{item.ad.callToAction ?? 'Learn more'}</Text></NativeAsset></View>
          </NativeAdView>
        ) : item.type === 'fixture' ? (
          <View style={[styles.fixture, { backgroundColor: colors.surface }]}>
            <Text numberOfLines={1} style={[styles.team, { color: colors.textPrimary, textAlign: 'right' }]}>{item.fixture.homeTeam}</Text>
            <Text style={[styles.vs, { color: colors.textTertiary }]}>VS</Text>
            <Text numberOfLines={1} style={[styles.team, { color: colors.textPrimary }]}>{item.fixture.awayTeam}</Text>
          </View>
        ) : null}
      </View>}
    />
  </View>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginVertical: 0 }, flushWrap: { margin: 0, padding: 0 }, slide: { paddingHorizontal: 0 },
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
