// RN port of funspot-next/app/(app)/profile/page.tsx.

import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Users, Trophy, Bell, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { WalletCard } from '@/components/WalletCard';
import { colors } from '@/theme';
import { RootStackParamList } from '@/navigation/RootNavigator';

const LINKS = [
  { route: 'Comrades' as const, label: 'Comrades', Icon: Users },
  { route: 'Leaderboard' as const, label: 'Leaderboard', Icon: Trophy },
  { route: 'Notifications' as const, label: 'Notifications', Icon: Bell },
];

export default function ProfileScreen() {
  const { username, phone, userId, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(username ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>{username}</Text>
        {phone && <Text style={styles.phone}>{phone}</Text>}
        <Text style={styles.userId}>ID: {userId}</Text>
      </View>

      <View style={styles.linkList}>
        {LINKS.map(({ route, label, Icon }, i) => (
          <Pressable key={route} onPress={() => navigation.navigate(route)} style={[styles.linkRow, i > 0 && styles.linkRowBorder]}>
            <Icon color={colors.green} size={18} />
            <Text style={styles.linkText}>{label}</Text>
            <ChevronRight color={colors.textMuted} size={16} />
          </Pressable>
        ))}
      </View>

      <WalletCard />

      <Pressable style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: colors.green, fontSize: 28, fontWeight: '800' },
  username: { color: 'white', fontSize: 18, fontWeight: '700' },
  phone: { color: colors.textMuted, fontSize: 13 },
  userId: { color: '#4b5563', fontSize: 11, marginTop: 4 },
  linkList: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 16, overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  linkRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  linkText: { flex: 1, color: 'white', fontSize: 14 },
  logoutButton: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#f87171', fontWeight: '700', fontSize: 13 },
});
