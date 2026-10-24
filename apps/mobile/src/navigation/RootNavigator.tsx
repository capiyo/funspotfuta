import { ActivityIndicator, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';

import HomeScreen from '@/screens/home/HomeScreen';
import ChatScreen from '@/screens/MessageScreen';

export type RootStackParamList = {
  Tabs: { initialTab?: 'Chats' | 'Feed' } | undefined;
  Chat: { channelId: string; fixtureId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const styles = StyleSheet.create({
  startup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  brand: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default function RootNavigator() {
  const { isInitialized } = useAuth();
  const colors = useFanColors();
  // Swap for your theme's own dark flag if useFanColors/theme exposes one.
  const isDark = useColorScheme() === 'dark';
  const barStyle = isDark ? 'light-content' : 'dark-content';

  if (!isInitialized) {
    // Keep the cold-start surface intentional while AsyncStorage restores the
    // session. Do not mount account-dependent screens until identity is known:
    // otherwise a cached signed-in session can briefly render as a guest.
    return (
      <View style={[styles.startup, { backgroundColor: colors.background }]}>
        <Text style={[styles.brand, { color: colors.textPrimary }]}>FunspotFuta</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar translucent backgroundColor="transparent" barStyle={barStyle} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surfaceElevated },
          headerTintColor: colors.textPrimary,
          statusBarTranslucent: true,
          statusBarStyle: isDark ? 'light' : 'dark',
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
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </>
  );
}
