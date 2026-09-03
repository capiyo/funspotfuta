// Root navigation. Mirrors the app's real shape: a login gate
// (app_shell.dart's isLoggedIn check), then a 5-tab bottom nav
// (bottom_navigation.dart: Home, Trending, +Create, Chat, Profile) with
// stack screens layered on top for things reached via in-page links rather
// than tabs (fixture detail, comrades, leaderboard, history, notifications,
// admin) — same navigation shape as the web port's /profile links.

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, TrendingUp, MessageCircle, User, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { colors } from '@/theme';

import LoginScreen from '@/screens/LoginScreen';
import HomeScreen from '@/screens/HomeScreen';
import TrendingScreen from '@/screens/TrendingScreen';
import ChatScreen from '@/screens/ChatScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import FixtureDetailScreen from '@/screens/FixtureDetailScreen';
import FeedScreen from '@/screens/FeedScreen';
import ComradesScreen from '@/screens/ComradesScreen';
import LeaderboardScreen from '@/screens/LeaderboardScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import AdminScreen from '@/screens/AdminScreen';

export type RootStackParamList = {
  Tabs: undefined;
  FixtureDetail: { matchId: string };
  Feed: undefined;
  Comrades: undefined;
  Leaderboard: undefined;
  History: undefined;
  Notifications: undefined;
  Admin: { channelId: string };
};
export type TabParamList = {
  Home: undefined;
  Trending: undefined;
  CreateChannel: undefined;
  Chat: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: '#000000f2', borderTopColor: 'rgba(255,255,255,0.05)' },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: '#4b5563',
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tab.Screen
        name="Trending"
        component={TrendingScreen}
        options={{ tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} /> }}
      />
      {/* Center "+" button — matches the gradient FAB in bottom_navigation.dart.
          Actual channel-creation UI lives inline on Home, same as the web port. */}
      <Tab.Screen
        name="CreateChannel"
        component={HomeScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View
              style={{
                height: 48,
                width: 48,
                borderRadius: 24,
                backgroundColor: colors.green,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
              }}
            >
              <Plus color="white" size={24} />
            </View>
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Home', { openCreateChannel: true } as never);
          },
        })}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { isInitialized, isLoggedIn } = useAuth();

  if (!isInitialized) return null; // splash screen covers this in practice

  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary }}>
      {!isLoggedIn ? (
        <Stack.Screen name="Tabs" component={LoginScreen as any} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="FixtureDetail" component={FixtureDetailScreen} options={{ title: 'Match' }} />
          <Stack.Screen name="Feed" component={FeedScreen} options={{ title: 'Feed' }} />
          <Stack.Screen name="Comrades" component={ComradesScreen} options={{ title: 'Comrades' }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Match History' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin Dashboard' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
