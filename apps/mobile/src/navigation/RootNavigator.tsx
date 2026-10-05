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
//
// Only two things are true routes: HomeScreen (which owns AppHeader,
// the channel chip row, and the Arena/Feed/Logs Tab.Navigator itself —
// see screens/home/HomeScreen.tsx), and Chat.
// Everything else (Login, Notifications, Comrades, Leaderboard, Admin,
// Profile) is a modal that lives in /modals and is mounted on demand.
//
// IMPORTANT: the Arena/Feed/Logs tab tree lives INSIDE HomeScreen, not
// here. Do not redeclare a second Tab.Navigator in this file — HomeScreen
// already wraps it with AppHeader (which owns top-safe-area padding via
// its own useSafeAreaInsets()) and the channel chip row above it. A
// second tab tree here would silently shadow HomeScreen's and drop
// the header/chips/menu from the app entirely.

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';

import HomeScreen from '@/screens/home/HomeScreen';
import ChatScreen from '@/screens/ChatScreen';
import TrendingScreen from '@/screens/TrendingScreen';
import FixtureDetailScreen from '@/screens/FixtureDetailScreen';

export type RootStackParamList = {
  Tabs: undefined;
  Chat: { channelId: string; fixtureId?: string };
  Trending: undefined;
  FixtureDetail: { matchId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isInitialized } = useAuth();
  const colors = useFanColors();

  if (!isInitialized) return null;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceElevated },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      <Stack.Screen
        name="Trending"
        component={TrendingScreen}
        options={{ title: 'Trending' }}
      />
      <Stack.Screen
        name="FixtureDetail"
        component={FixtureDetailScreen}
        options={{ title: 'Fixture' }}
      />
    </Stack.Navigator>
  );
}