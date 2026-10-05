import { StatusBar, useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';

import HomeScreen from '@/screens/home/HomeScreen';
import ChatScreen from '@/screens/MessageScreen';

export type RootStackParamList = {
  Tabs: undefined;
  Chat: { channelId: string; fixtureId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isInitialized } = useAuth();
  const colors = useFanColors();
  // Swap for your theme's own dark flag if useFanColors/theme exposes one.
  const isDark = useColorScheme() === 'dark';
  const barStyle = isDark ? 'light-content' : 'dark-content';

  if (!isInitialized) return null;

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
