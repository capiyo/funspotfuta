import { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView, TestIds, mobileAds } from 'react-native-google-mobile-ads';
import { useFanColors } from '@/theme/use-fan-colors';

const PRODUCTION_UNITS = [
  'ca-app-pub-8671302794311438/3524169425',
  'ca-app-pub-8671302794311438/4130674080',
  'ca-app-pub-8671302794311438/1504510743',
] as const;

type LoadedAd = { id: string; ad: NativeAd };

export default function AdCarousel() {
  const colors = useFanColors();
  const { width } = useWindowDimensions();
  const [ads, setAds] = useState<LoadedAd[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<LoadedAd>>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let alive = true;
    const created: NativeAd[] = [];
    const loadAds = async () => {
      try {
        await mobileAds().initialize();
        if (!alive) return;
        const unitIds = __DEV__ ? [TestIds.NATIVE, TestIds.NATIVE, TestIds.NATIVE] : [...PRODUCTION_UNITS];
        const results = await Promise.all(unitIds.map(async (unitId, i) => {
          try {
            const ad = await NativeAd.createForAdRequest(unitId);
            created.push(ad);
            return { id: `native-ad-${i}`, ad };
          } catch {
            return null;
          }
        }));
        if (!alive) {
          created.forEach((ad) => ad.destroy());
          return;
        }
        setAds(results.filter((item): item is LoadedAd => item !== null));
      } catch {
        // Ad initialization or inventory failure must never block messaging.
      }
    };
    void loadAds();
    return () => {
      alive = false;
      created.forEach((ad) => ad.destroy());
    };
  }, []);

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => {
      setIndex((previous) => {
        const next = (previous + 1) % ads.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (Platform.OS !== 'android' || ads.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityLabel="Sponsored carousel">
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        data={ads}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          setIndex(Math.max(0, Math.min(next, ads.length - 1)));
        }}
        getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <NativeAdView nativeAd={item.ad} style={[styles.ad, { backgroundColor: colors.surface }]}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>ADVERTISEMENT</Text>
                <NativeAsset assetType={NativeAssetType.ADVERTISER} style={[styles.advertiser, { color: colors.textTertiary }]} />
              </View>
              <View style={styles.content}>
                <NativeMediaView style={styles.media} />
                <View style={styles.copy}>
                  <NativeAsset assetType={NativeAssetType.HEADLINE} style={[styles.headline, { color: colors.textPrimary }]} />
                  <NativeAsset assetType={NativeAssetType.BODY} style={[styles.body, { color: colors.textSecondary }]} />
                </View>
                <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION} style={[styles.cta, { backgroundColor: colors.primary, color: '#fff' }]} />
              </View>
            </NativeAdView>
          </View>
        )}
      />
      {ads.length > 1 && (
        <View style={styles.dots}>
          {ads.map((ad, dotIndex) => (
            <Pressable key={ad.id} onPress={() => { setIndex(dotIndex); listRef.current?.scrollToIndex({ index: dotIndex, animated: true }); }} accessibilityLabel={`Show advertisement ${dotIndex + 1}`}>
              <View style={[styles.dot, { backgroundColor: index === dotIndex ? colors.primary : colors.textTertiary + '66' }]} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginVertical: 4 },
  slide: { paddingHorizontal: 12 },
  ad: { borderRadius: 10, padding: 8, minHeight: 86, overflow: 'hidden' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 9, letterSpacing: 0.6, fontWeight: '700' },
  advertiser: { fontSize: 10 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  media: { width: 58, height: 54, borderRadius: 6, overflow: 'hidden' },
  copy: { flex: 1, gap: 3 },
  headline: { fontSize: 12, fontWeight: '700' },
  body: { fontSize: 10 },
  cta: { overflow: 'hidden', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 7, fontSize: 10, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
