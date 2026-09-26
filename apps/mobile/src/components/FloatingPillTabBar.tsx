// components/FloatingPillTabBar.tsx
//
// Custom floating pill nav — semi-transparent dark surface, rounded
// fully, centered with margin on all sides. The ACTIVE tab gets a
// colored pill background behind its icon+label, inactive tabs are
// bare icon+label.
//
// LAYOUT FIX: previously took react-navigation's BottomTabBarProps and
// called navigation.navigate(). HomeScreen no longer uses
// Tab.Navigator (see HomeScreen.tsx's header comment for why — it was
// the prime suspect for tab content rendering only in the bottom half
// of the screen), so this now takes plain `active`/`onChange` props
// instead. Visuals are unchanged.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Shield, Newspaper, History as HistoryIcon } from 'lucide-react-native';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { FAN_SPACING, FAN_RADIUS, FanColorPalette } from '@funspot/core';

export type TabName = 'Arena' | 'Feed' | 'Logs';
const TABS: TabName[] = ['Arena', 'Feed', 'Logs'];

const ICONS: Record<TabName, typeof Shield> = {
  Arena: Shield,
  Feed: Newspaper,
  Logs: HistoryIcon,
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
      // Android needs elevation for the floating pill to read above
      // scrolled content; iOS uses the shadow* props.
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