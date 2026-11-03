// App.tsx
//
// Keep startup cache-first: restore the synchronous MMKV query cache, render
// immediately, and let fonts/network refresh in the background. Waiting for
// Google-font hook completion before mounting navigation made every cold resume
// show a blank/splash delay even when useful screen data was already cached.

import { useCallback, useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  createNavigationContainerRef,
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

import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { LoginModalProvider } from './src/modals/Login-modal-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from './QueryProvider';
import RootNavigator, { type RootStackParamList } from '@/navigation/RootNavigator';
import { useFanColors } from '@/theme/use-fan-colors';
import { NotificationService } from '@/lib/api/notification-service';
import { getFcmTokenIfPermitted, getInitialNotification, onForegroundMessage, onNotificationOpenedApp, onTokenRefresh } from '@/lib/firebase';

SplashScreen.preventAutoHideAsync();

const navigationRef = createNavigationContainerRef<RootStackParamList>();
let pendingNotificationChat: { channelId: string; fixtureId?: string } | null = null;

function flushPendingNotificationNavigation() {
  if (!navigationRef.isReady() || !pendingNotificationChat) return;
  navigationRef.navigate('Chat', pendingNotificationChat);
  pendingNotificationChat = null;
}

function openChatFromPush(data: Record<string, string> | undefined) {
  const channelId = data?.channel_id;
  if (!channelId) return;
  const params = {
    channelId,
    ...(data.fixture_id ? { fixtureId: data.fixture_id } : {}),
  };
  if (!navigationRef.isReady()) {
    pendingNotificationChat = params;
    return;
  }
  navigationRef.navigate('Chat', params);
}

function NotificationRuntime() {
  const { isLoggedIn, userId, authToken } = useAuth();

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    let active = true;
    const register = (token: string) => {
      if (!active || !token) return;
      void NotificationService.registerToken({
        userId,
        fcmToken: token,
        platform: Platform.OS,
        authToken: authToken ?? undefined,
      });
    };
    const reconcile = () => {
      void NotificationService.reconcileFromServer({ userId, authToken: authToken ?? undefined });
    };
    const stopForeground = onForegroundMessage((message) => {
      void NotificationService.pushToStream({ data: message.data ?? {} });
    });
    const stopOpened = onNotificationOpenedApp((message) => openChatFromPush(message.data));
    const stopRefresh = onTokenRefresh(register);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') reconcile();
    });
    void getInitialNotification().then((message) => {
      if (message) openChatFromPush(message.data);
    });
    reconcile();
    void getFcmTokenIfPermitted().then((token) => {
      if (token) register(token);
    });
    return () => {
      active = false;
      stopForeground();
      stopOpened();
      stopRefresh();
      appStateSubscription.remove();
    };
  }, [authToken, isLoggedIn, userId]);

  return null;
}

export default function App() {
  const colors = useFanColors();
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

  const onFirstContentLayout = useCallback(() => {
    // Hide only after the cache-restored app surface has actually mounted and
    // laid out. The outer root can lay out before cache restoration completes,
    // and that early event must not be the one responsible for dismissing splash.
    void SplashScreen.hideAsync();
  }, []);

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
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <LoginModalProvider>
            <ToastProvider>
              <QueryProvider>
                <NotificationRuntime />
                <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onFirstContentLayout}>
                  <NavigationContainer ref={navigationRef} onReady={flushPendingNotificationNavigation} theme={navTheme}>
                    <RootNavigator />
                  </NavigationContainer>
                  <StatusBar style={dark ? 'light' : 'dark'} />
                </View>
              </QueryProvider>
            </ToastProvider>
          </LoginModalProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}
