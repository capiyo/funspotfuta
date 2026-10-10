// components/FloatingPillTabBar.tsx
//
// Custom floating pill nav — semi-transparent dark surface, rounded
// fully, centered with margin on all sides. The ACTIVE tab gets a
// colored pill background behind its icon+label, inactive tabs are
// bare icon+label.
//
// THREE TABS: Arena, Feed, Logs. Arena keeps the existing fixture/chat flow.
//
// LAYOUT FIX (unchanged from prior version): HomeScreen doesn't use
// Tab.Navigator, so this takes plain `active`/`onChange` props.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Trophy, Newspaper, History } from 'lucide-react-native';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { FAN_SPACING, FAN_RADIUS, FanColorPalette } from '@funspot/core';

export type TabName = 'Arena' | 'Feed' | 'Logs';
const TABS: TabName[] = ['Arena', 'Feed', 'Logs'];

const ICONS: Record<TabName, typeof Trophy> = {
  Arena: Trophy,
  Feed: Newspaper,
  Logs: History,
};

export function FloatingPillTabBar({
  active,
  onChange,
}: {
  active: TabName;
  onChange: (tab: TabName) => void;
}) {
  const colors = useFanColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        {TABS.map((name) => {
          const isActive = active === name;
          const Icon = ICONS[name];

          return (
            <Pressable
              key={name}
              onPress={() => {
                if (!isActive) onChange(name);
              }}
              style={[styles.item, isActive && styles.itemActive]}
            >
              <Icon size={16} color={isActive ? colors.textInverse : colors.textTertiary} />
              <Text style={fanText('tag', colors, isActive ? colors.textInverse : colors.textTertiary)}>
                {name.toLowerCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      bottom: FAN_SPACING.lg,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    pill: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: FAN_RADIUS.pill,
      padding: FAN_SPACING.xs,
      gap: FAN_SPACING.xs,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.xs,
      paddingHorizontal: FAN_SPACING.base,
      paddingVertical: FAN_SPACING.sm + 2,
      borderRadius: FAN_RADIUS.pill,
    },
    itemActive: {
      backgroundColor: colors.primary,
    },
  });
}