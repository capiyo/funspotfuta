// App.tsx
//
// Provider order matters:
//   AuthProvider       — must come first; LoginModalProvider and everything
//                        below it reads useAuth()
//   LoginModalProvider — mounts LoginModal globally; every screen calls
//                        useLoginModal().requireLogin() to gate actions
//   ToastProvider
//   QueryProvider      — rehydrates the MMKV-backed cache; calls onReady
//                        when done
//   NavigationContainer → RootNavigator
//
// SAFE AREA: SafeAreaProvider is the ONLY safe-area wrapper in the app.
// There is NO SafeAreaView at the root. Top inset is applied per-screen by
// AppHeader (via useSafeAreaInsets() → paddingTop: insets.top + FAN_SPACING.md).
// Do NOT add a SafeAreaView around NavigationContainer — it would double up
// with AppHeader's own inset and push everything down into a dead gap.
// Bottom inset is handled per-screen too (e.g. FloatingPillTabBar).

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
import  {QueryProvider}  from './QueryProvider';
import RootNavigator from '@/navigation/RootNavigator';
import { useFanColors } from '@/theme/use-fan-colors';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const colors = useFanColors();
  const [cacheReady, setCacheReady] = useState(false);

  // Stable reference so QueryProvider's rehydration effect doesn't
  // re-subscribe on every App re-render (theme change, font load, etc.)
  const handleCacheReady = useCallback(() => setCacheReady(true), []);

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    SairaCondensed_400Regular,
    SairaCondensed_600SemiBold,
    SairaCondensed_700Bold,
    SairaCondensed_800ExtraBold,
  });

  const appReady = fontsLoaded && cacheReady;

  const onLayout = useCallback(async () => {
    if (appReady) await SplashScreen.hideAsync();
  }, [appReady]);

  const navTheme = {
    ...(colors.background === '#0F1E27' ? DarkTheme : DefaultTheme),
    colors: {
      ...(colors.background === '#0F1E27'
        ? DarkTheme.colors
        : DefaultTheme.colors),
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
                {appReady ? (
                  <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <NavigationContainer theme={navTheme}>
                      <RootNavigator />
                    </NavigationContainer>
                    <StatusBar
                      style={
                        colors.background === '#0F1E27' ? 'light' : 'dark'
                      }
                    />
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