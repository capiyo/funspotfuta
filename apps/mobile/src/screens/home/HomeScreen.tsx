// screens/home/HomeScreen.tsx
//
// RN home screen. The header (brand row + channel chips) is an OVERLAY on top
// of the tabs. The tabs fill the whole screen and never resize, so hiding the
// header can't shift layout or scroll position. Each tab pads its scrollable
// content by useHomeList().topInset.
//
// THREE TABS: Arena, Feed, Logs. Arena reuses the existing fixture/chat flow;
// Logs is the core-backed history screen, matching web /home's three columns.
//
// activeTab lives in home-context (not here) so the screens can gate their
// queries on it. This component tracks only `visited` — which tabs have been
// mounted at least once — so an unvisited tab doesn't render until the user
// taps it.

import { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { AppHeader } from './appHeader';
import { ChannelCreationModal } from '@/modals/ChannelCreationModal';
import { FloatingPillTabBar, TabName } from '@/components/FloatingPillTabBar';
import { useFanColors } from '@/theme/use-fan-colors';
import { FanColorPalette } from '@funspot/core';
import { HomeProvider, useHome } from './home-context';
import { HeaderInsetContext } from './header-inset';
import ChatsScreen from '@/screens/ChatsScreen';
import FeedScreen from '@/screens/FeedScreen';
import HistoryScreen from '@/screens/HistoryScreen';

const TABS: { name: TabName; Screen: ComponentType }[] = [
    { name: 'Arena', Screen: ChatsScreen },
    { name: 'Feed', Screen: FeedScreen },
    { name: 'Logs', Screen: HistoryScreen },
];

const TAB_BAR_HIDE_OFFSET = 24;
const HEADER_HIDE_OFFSET = -8;

function HomeInner() {
    const colors = useFanColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { headerVisible, activeTab, setActiveTab } = useHome();

    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [visited, setVisited] = useState<Set<TabName>>(
        () => new Set([activeTab]),
    );
    const [headerHeight, setHeaderHeight] = useState(0);

    const anim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: headerVisible ? 1 : 0,
            duration: headerVisible ? 220 : 260,
            easing: headerVisible ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [headerVisible, anim]);

    function changeTab(next: TabName) {
        if (next === activeTab) return;
        setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
        setActiveTab(next);
    }

    return (
        <HeaderInsetContext.Provider value={headerHeight}>
            <View style={styles.screen}>
                <View style={styles.tabs}>
                    {TABS.map(({ name, Screen }) =>
                        visited.has(name) ? (
                            <View
                                key={name}
                                style={[styles.pane, activeTab !== name && styles.paneHidden]}
                            >
                                <Screen />
                            </View>
                        ) : null,
                    )}
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
                            transform: [
                                {
                                    translateY: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [HEADER_HIDE_OFFSET, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <AppHeader onAddChannel={() => setShowCreateChannel(true)} />
                </Animated.View>

                <Animated.View
                    pointerEvents={headerVisible ? 'auto' : 'none'}
                    style={{
                        opacity: anim,
                        transform: [
                            {
                                translateY: anim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [TAB_BAR_HIDE_OFFSET, 0],
                                }),
                            },
                        ],
                    }}
                >
                    <FloatingPillTabBar active={activeTab} onChange={changeTab} />
                </Animated.View>

                {showCreateChannel && (
                    <ChannelCreationModal onClose={() => setShowCreateChannel(false)} />
                )}
            </View>
        </HeaderInsetContext.Provider>
    );
}

export default function HomeScreen() {
    return (
        <HomeProvider>
            <HomeInner />
        </HomeProvider>
    );
}

function createStyles(colors: FanColorPalette) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        tabs: { flex: 1 },
        pane: { flex: 1 },
        paneHidden: { display: 'none' },
        headerOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
        },
    });
}