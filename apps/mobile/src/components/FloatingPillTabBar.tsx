// Custom tab bar replacing React Navigation's default flat bar — the
// real app renders a floating, pill-shaped nav (semi-transparent dark
// surface, rounded fully, centered with margin on all sides) where the
// ACTIVE tab gets a colored pill background behind its icon+label,
// inactive tabs are bare icon+label. Confirmed from screenshots of the
// live app's Arena/Feed/Logs tabs — the previous version used React
// Navigation's default flat, full-width bar with no active-state pill.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Shield, Newspaper, History as HistoryIcon } from 'lucide-react-native';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { FAN_SPACING, FAN_RADIUS, FanColorPalette } from '@funspot/core';

const ICONS: Record<string, typeof Shield> = {
  Arena: Shield,
  Feed: Newspaper,
  Logs: HistoryIcon,
};

export function FloatingPillTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useFanColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const isActive = state.index === index;
          const Icon = ICONS[route.name] ?? Shield;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                if (!isActive) navigation.navigate(route.name);
              }}
              style={[styles.item, isActive && styles.itemActive]}
            >
              <Icon size={16} color={isActive ? colors.textInverse : colors.textTertiary} />
              <Text style={fanText('tag', colors, isActive ? colors.textInverse : colors.textTertiary)}>
                {route.name.toLowerCase()}
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
