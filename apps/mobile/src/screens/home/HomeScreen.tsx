import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';

import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { FAN_SPACING, FAN_RADIUS, type FanColorPalette } from '@funspot/core';
import { HomeProvider, useHome } from './home-context';
import { AppHeader } from './appHeader';
import { ArenaScreen } from '../ArenaScreen';
import FeedScreen from '../FeedScreen';
import HistoryScreen from '../HistoryScreen';
import { FloatingPillTabBar, type TabName } from '@/components/FloatingPillTabBar';
import { ChannelCreationModal } from '@/components/ChannelCreationModal';

export default function HomeScreen() {
  return (
    <HomeProvider>
      <HomeContent />
    </HomeProvider>
  );
}

function HomeContent() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<TabName>('Arena');
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const {
    channels,
    allChannels,
    activeChannelId,
    setActiveChannelId,
    joiningChannelIds,
    joinChannel,
    reloadChannels,
  } = useHome();

  return (
    <View style={styles.screen}>
      <AppHeader onAddChannel={() => setCreateChannelOpen(true)} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.channelStrip}
      >
        {channels.map((channel) => {
          const active = channel.channelId === activeChannelId;
          return (
            <Pressable
              key={channel.channelId}
              onPress={() => setActiveChannelId(channel.channelId)}
              accessibilityRole="button"
              accessibilityLabel={'Open ' + channel.name}
              style={[styles.channelChip, active && styles.channelChipActive]}
            >
              <Text
                numberOfLines={1}
                style={fanText(
                  'caption',
                  colors,
                  active ? colors.textInverse : colors.textSecondary,
                )}
              >
                {channel.name}
              </Text>
            </Pressable>
          );
        })}

        {allChannels.slice(0, 3).map((channel) => {
          const joining = joiningChannelIds.has(channel.channelId);
          return (
            <Pressable
              key={'browse-' + channel.channelId}
              onPress={() => void joinChannel(channel)}
              disabled={joining}
              accessibilityRole="button"
              accessibilityLabel={'Join ' + channel.name}
              style={styles.joinChip}
            >
              <Plus size={13} color={colors.primary} />
              <Text style={fanText('caption', colors, colors.primary)}>
                {joining ? 'Joining…' : channel.name}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => setCreateChannelOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Create channel"
          style={styles.addChip}
        >
          <Plus size={14} color={colors.textSecondary} />
          <Text style={fanText('caption', colors, colors.textSecondary)}>
            New channel
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.content}>
        {activeTab === 'Arena' && <ArenaScreen />}
        {activeTab === 'Feed' && <FeedScreen />}
        {activeTab === 'Logs' && <HistoryScreen />}
      </View>

      <FloatingPillTabBar active={activeTab} onChange={setActiveTab} />

      {createChannelOpen && (
        <ChannelCreationModal
          onClose={() => {
            setCreateChannelOpen(false);
            void reloadChannels();
          }}
        />
      )}
    </View>
  );
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    channelStrip: {
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      paddingHorizontal: FAN_SPACING.lg,
      paddingBottom: FAN_SPACING.sm,
    },
    channelChip: {
      maxWidth: 190,
      borderRadius: FAN_RADIUS.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: FAN_SPACING.md,
      paddingVertical: FAN_SPACING.sm,
      backgroundColor: colors.surface,
    },
    channelChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    joinChip: {
      maxWidth: 190,
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.xs,
      borderRadius: FAN_RADIUS.pill,
      borderWidth: 1,
      borderColor: colors.primaryMuted,
      paddingHorizontal: FAN_SPACING.md,
      paddingVertical: FAN_SPACING.sm,
      backgroundColor: colors.surface,
    },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.xs,
      borderRadius: FAN_RADIUS.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: FAN_SPACING.md,
      paddingVertical: FAN_SPACING.sm,
    },
    content: {
      flex: 1,
    },
  });
}
