// RN navigation. The original app has TWO different bottom navs depending
// on platform: home_page_web.dart (web) uses no bottom nav at all — see
// apps/web's navbar+sidebar+3-column layout — while home_page.dart
// (mobile) uses a 3-item nav: Arena (fixtures), Feed (posts), Logs
// (history) — NOT the 5-item Home/Trending/+/Chat/Profile nav from the
// separate, seemingly-unused bottom_navigation.dart widget this file
// used to port. Profile/Comrades/Leaderboard/Admin/Notifications are
// reached via a header menu button (matching home_page.dart's
// _showTelegramMenu), not tabs. Chat is opened by tapping a channel
// chip in the header, not a tab either.

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { FloatingPillTabBar } from '@/components/FloatingPillTabBar';

import LoginScreen from '@/screens/LoginScreen';
import ArenaScreen from '@/screens/ArenaScreen';
import FeedScreen from '@/screens/FeedScreen';
import LogsScreen from '@/screens/LogsScreen';
import ChatScreen from '@/screens/ChatScreen';
import FixtureDetailScreen from '@/screens/FixtureDetailScreen';
import ComradesScreen from '@/screens/ComradesScreen';
import LeaderboardScreen from '@/screens/LeaderboardScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import AdminScreen from '@/screens/AdminScreen';
import ProfileScreen from '@/screens/ProfileScreen';

export type RootStackParamList = {
  Tabs: undefined;
  FixtureDetail: { matchId: string };
  Chat: { channelId?: string };
  Comrades: undefined;
  Leaderboard: undefined;
  Notifications: undefined;
  Admin: { channelId: string };
  Profile: undefined;
};
export type TabParamList = {
  Arena: undefined;
  Feed: undefined;
  Logs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingPillTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Arena" component={ArenaScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Logs" component={LogsScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { isInitialized, isLoggedIn } = useAuth();
  const colors = useFanColors();

  if (!isInitialized) return null;

  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.surfaceElevated }, headerTintColor: colors.textPrimary }}>
      {!isLoggedIn ? (
        <Stack.Screen name="Tabs" component={LoginScreen as any} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="FixtureDetail" component={FixtureDetailScreen} options={{ title: 'Match' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
          <Stack.Screen name="Comrades" component={ComradesScreen} options={{ title: 'Comrades' }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin Dashboard' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
