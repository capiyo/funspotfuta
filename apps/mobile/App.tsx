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
import { useFanColors, useIsDark } from '@/theme/use-fan-colors';
import { NotificationService } from '@/lib/api/notification-service';
import { useToast } from '@/lib/toast/toast-context';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@funspot/core';
import { getFcmTokenIfPermitted, getInitialNotification, onForegroundMessage, onNotificationOpenedApp, onTokenRefresh } from '@/lib/firebase';

SplashScreen.preventAutoHideAsync();

const navigationRef = createNavigationContainerRef<RootStackParamList>();
let pendingNotificationChat: { channelId: string; fixtureId?: string } | null = null;

function flushPendingNotificationNavigation() {
  if (!navigationRef.isReady() || !pendingNotificationChat) return;
  navigationRef.navigate('Chat', pendingNotificationChat);
  pendingNotificationChat = null;
}

function normalizePushData(data: Record<string, string | object> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === 'string') normalized[key] = value;
    else {
      const serialized = JSON.stringify(value);
      if (serialized !== undefined) normalized[key] = serialized;
    }
  }
  return normalized;
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
  const queryClient = useQueryClient();
  const toast = useToast();

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
      if (!active) return;
      void NotificationService.reconcileFromServer({ userId, authToken: authToken ?? undefined });
      void queryClient.invalidateQueries({ queryKey: ['fixtureUnreadCount'] });
      void getFcmTokenIfPermitted().then((token) => {
        if (token) register(token);
      });
    };
    const stopForeground = onForegroundMessage((message) => {
      if (!active) return;
      const data = normalizePushData(message.data);
      void NotificationService.pushToStream({ messageId: message.messageId, data });
      const foregroundTitle = message.notification?.title ?? 'Funspot';
      const foregroundBody = message.notification?.body ?? '';
      if (foregroundBody) toast.showInfo(`${foregroundTitle}: ${foregroundBody}`);
      if (data.channel_id && data.fixture_id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.fixtureUnreadCount(data.channel_id, data.fixture_id, userId),
        });
      }
    });
    const stopOpened = onNotificationOpenedApp((message) => {
      if (active) openChatFromPush(normalizePushData(message.data));
    });
    const stopRefresh = onTokenRefresh(register);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') reconcile();
    });
    void getInitialNotification().then((message) => {
      if (active && message) openChatFromPush(normalizePushData(message.data));
    });
    reconcile();
    return () => {
      active = false;
      stopForeground();
      stopOpened();
      stopRefresh();
      appStateSubscription.remove();
    };
  }, [authToken, isLoggedIn, queryClient, toast, userId]);

  return null;
}

export default function App() {
  const colors = useFanColors();
  const dark = useIsDark();
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
