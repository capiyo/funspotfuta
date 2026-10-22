// App.tsx
//
// Keep startup cache-first: restore the synchronous MMKV query cache, render
// immediately, and let fonts/network refresh in the background. Waiting for
// Google-font hook completion before mounting navigation made every cold resume
// show a blank/splash delay even when useful screen data was already cached.

import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  SairaCondensed_400Regular,
  SairaCondensed_600SemiBold,
  SairaCondensed_700Bold,
  SairaCondensed_800ExtraBold,
} from '@expo-google-fonts/saira-condensed';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider } from '@/lib/auth/auth-context';
import { LoginModalProvider } from './src/modals/Login-modal-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from './QueryProvider';
import RootNavigator from '@/navigation/RootNavigator';
import { useFanColors } from '@/theme/use-fan-colors';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const colors = useFanColors();
  const [cacheReady, setCacheReady] = useState(false);

  const handleCacheReady = useCallback(() => setCacheReady(true), []);

  // Font files are bundled locally; load them without making the cached app
  // wait to mount its navigation tree. Text can use fallback fonts briefly.
  useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    SairaCondensed_400Regular,
    SairaCondensed_600SemiBold,
    SairaCondensed_700Bold,
    SairaCondensed_800ExtraBold,
  });

  const onLayout = useCallback(async () => {
    if (cacheReady) await SplashScreen.hideAsync();
  }, [cacheReady]);

  const dark = colors.background === '#0F1E27';
  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surfaceElevated,
      primary: colors.primary,
      text: colors.textPrimary,
      border: colors.border,
    },
  };

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <AuthProvider>
          <LoginModalProvider>
            <ToastProvider>
              <QueryProvider onReady={handleCacheReady}>
                {cacheReady ? (
                  <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <NavigationContainer theme={navTheme}>
                      <RootNavigator />
                    </NavigationContainer>
                    <StatusBar style={dark ? 'light' : 'dark'} />
                  </View>
                ) : null}
              </QueryProvider>
            </ToastProvider>
          </LoginModalProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}
