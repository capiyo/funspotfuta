// Shared header across Arena/Feed/Logs: brand+bell+avatar row, then
// channel indicator row. Previously only ArenaScreen had any header.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Plus } from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { Channel, FAN_SPACING, FanColorPalette } from '@funspot/core';

export function AppHeader({ channel, points, onAddChannel }: { channel?: Channel; points?: number; onAddChannel?: () => void }) {
  const colors = useFanColors();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.top);
  const { username } = useAuth();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.brand}>Funspot😂</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => navigation.navigate('Notifications')}>
            <Bell size={18} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.avatar}>
            <Text style={fanText('caption', colors, colors.primary)}>{(username ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
        </View>
      </View>
      {channel && (
        <View style={styles.channelRow}>
          <Text style={fanText('caption', colors, colors.draw)}>👑</Text>
          <Text style={fanText('caption', colors, colors.primary)}> {channel.name}</Text>
          <Text style={fanText('caption', colors)}>  {username} ({points ?? 0}pts)</Text>
          <Pressable onPress={onAddChannel} style={{ marginLeft: FAN_SPACING.md }}>
            <Plus size={14} color={colors.textTertiary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: FanColorPalette, topInset: number) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.background,
      paddingHorizontal: FAN_SPACING.lg,
      paddingTop: topInset + FAN_SPACING.md,
      paddingBottom: FAN_SPACING.sm,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    brand: { fontFamily: 'SairaCondensed_600SemiBold', fontSize: 15, letterSpacing: -0.3, color: colors.primary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.base },
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: FAN_SPACING.sm },
  });
}