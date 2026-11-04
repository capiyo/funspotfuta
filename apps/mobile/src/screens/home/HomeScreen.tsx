// screens/home/HomeScreen.tsx
//
// The tab panes occupy the same fixed screen rectangle. Switching tabs never
// changes the parent layout, so the previous pane cannot briefly affect the
// incoming screen's width or flex measurements.

import { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { AppHeader } from './appHeader';
import CreateChannelModal from '@/modals/ChannelCreation';
import { FloatingPillTabBar, TabName } from '@/components/FloatingPillTabBar';
import { useFanColors } from '@/theme/use-fan-colors';
import { FanColorPalette, feedQueryOptions } from '@funspot/core';
import { HomeProvider, useHome } from './home-context';
import { HeaderInsetContext } from './header-inset';
import ChatsScreen from '@/screens/ChatsScreen';
import FeedScreen from '@/screens/FeedScreen';

const TABS: { name: TabName; Screen: ComponentType }[] = [
    { name: 'Chats', Screen: ChatsScreen },
    { name: 'Feed', Screen: FeedScreen },
];

const TAB_BAR_HIDE_OFFSET = 24;
const HEADER_HIDE_OFFSET = -8;

function HomeInner({ initialTab }: { initialTab?: TabName }) {
    const colors = useFanColors();
    const queryClient = useQueryClient();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { headerVisible, activeTab, setActiveTab } = useHome();
    useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab, setActiveTab]);

    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [visited, setVisited] = useState<Set<TabName>>(() => new Set([activeTab]));
    const [headerHeight, setHeaderHeight] = useState(0);
    const anim = useRef(new Animated.Value(1)).current;
    const tabOpacity = useRef(new Animated.Value(1)).current;
    const previousTab = useRef(activeTab);

    // Start the feed request during cold start, alongside the initial Chats
    // fixture request. FeedScreen is mounted lazily on mobile, so prefetching
    // here prevents the first Feed tap from being the first network request.
    useEffect(() => {
        void queryClient.prefetchInfiniteQuery(feedQueryOptions()).catch((error: unknown) => {
            if (__DEV__) console.warn('[startup] feed prefetch failed', error);
        });
    }, [queryClient]);

    useEffect(() => {
        Animated.timing(anim, {
            toValue: headerVisible ? 1 : 0,
            duration: headerVisible ? 220 : 260,
            easing: headerVisible ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [headerVisible, anim]);

    useEffect(() => {
        if (previousTab.current === activeTab) return;
        previousTab.current = activeTab;
        tabOpacity.setValue(0.94);
        Animated.timing(tabOpacity, {
            toValue: 1,
            duration: 140,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [activeTab, tabOpacity]);

    function changeTab(next: TabName) {
        if (next === activeTab) return;
        setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
        setActiveTab(next);
    }

    return (
        <HeaderInsetContext.Provider value={headerHeight}>
            <View style={styles.screen}>
                <View style={styles.tabs}>
                    {TABS.map(({ name, Screen }) => {
                        if (!visited.has(name)) return null;
                        const active = activeTab === name;
                        return (
                            <View
                                key={name}
                                pointerEvents={active ? 'auto' : 'none'}
                                accessibilityElementsHidden={!active}
                                importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
                                style={[styles.pane, { zIndex: active ? 1 : 0 }]}
                            >
                                <Animated.View
                                    pointerEvents={active ? 'auto' : 'none'}
                                    style={[
                                        styles.activePane,
                                        { opacity: active ? tabOpacity : 0 },
                                    ]}
                                >
                                    <Screen />
                                </Animated.View>
                            </View>
                        );
                    })}
                </View>

                <Animated.View
                    pointerEvents={headerVisible ? 'auto' : 'none'}
                    onLayout={(e) => {
                        const h = Math.round(e.nativeEvent.layout.height);
                        setHeaderHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
                    }}
                    style={[
                        styles.headerOverlay,
                        {
                            opacity: anim,
                            transform: [{ translateY: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [HEADER_HIDE_OFFSET, 0],
                            }) }],
                        },
                    ]}
                >
                    <AppHeader onAddChannel={() => setShowCreateChannel(true)} />
                </Animated.View>

                <Animated.View
                    pointerEvents={headerVisible ? 'auto' : 'none'}
                    style={{
                        opacity: anim,
                        transform: [{ translateY: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [TAB_BAR_HIDE_OFFSET, 0],
                        }) }],
                    }}
                >
                    <FloatingPillTabBar active={activeTab} onChange={changeTab} />
                </Animated.View>

                <CreateChannelModal
                    visible={showCreateChannel}
                    onClose={() => setShowCreateChannel(false)}
                    onChannelCreated={() => {
                        void queryClient.invalidateQueries({ queryKey: ['channels'] });
                    }}
                />
            </View>
        </HeaderInsetContext.Provider>
    );
}

export default function HomeScreen() {
    const route = useRoute<RouteProp<{ Tabs: { initialTab?: 'Chats' | 'Feed' } | undefined }, 'Tabs'>>();
    return (
        <HomeProvider>
            <HomeInner initialTab={route.params?.initialTab} />
        </HomeProvider>
    );
}

function createStyles(colors: FanColorPalette) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
        tabs: { flex: 1, position: 'relative' },
        pane: { ...StyleSheet.absoluteFillObject, flex: 1, backgroundColor: colors.background },
        activePane: { flex: 1, backgroundColor: colors.background },
        headerOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
        },
    });
}
