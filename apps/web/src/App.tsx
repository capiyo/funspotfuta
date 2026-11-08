import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@funspot/core';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { LoginModalProvider } from '@/modals/Login-modal-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import RootNavigator from '@/navigation/RootNavigator';
import NotificationGate from '@/modals/NotificationGate';
import { listenForForegroundMessages, NotificationService, requestWebPushToken, type ForegroundNotice } from '@/lib/api/notification-service';

declare global {
  interface Window { FunspotNotificationUrl?: { normalize: (input: unknown) => string } }
}
function AppRoutes() {
  const { isInitialized, isLoggedIn, userId, authToken } = useAuth();
  const queryClient = useQueryClient();
  const [notificationGateDismissed, setNotificationGateDismissed] = useState(false);
  const [notice, setNotice] = useState<ForegroundNotice | null>(null);
  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    let active = true;
    let stop: (() => void) | undefined;
    listenForForegroundMessages((incoming) => {
      if (!active) return;
      setNotice(incoming);
      const data = incoming.data ?? {};
      void NotificationService.pushToStream({ messageId: incoming.messageId, data });
      if (data.channel_id && data.fixture_id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.fixtureUnreadCount(data.channel_id, data.fixture_id, userId),
        });
      }
    }).then((unsubscribe) => {
      if (active) stop = unsubscribe;
      else unsubscribe();
    }).catch(() => undefined);
    return () => {
      active = false;
      stop?.();
    };
  }, [isLoggedIn, queryClient, userId]);
  useEffect(() => {
    setNotificationGateDismissed(false);
  }, [userId]);
  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    let active = true;
    const syncToken = async () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      try {
        const token = await requestWebPushToken();
        if (active && token) {
          await NotificationService.registerToken({
            userId,
            fcmToken: token,
            platform: 'web',
            authToken: authToken ?? undefined,
          });
        }
      } catch (error) {
        console.warn('[notifications] Web push token sync skipped', error);
      }
    };
    const reconcile = () => {
      void NotificationService.reconcileFromServer({ userId, authToken: authToken ?? undefined });
      void queryClient.invalidateQueries({ queryKey: ['fixtureUnreadCount'] });
      void syncToken();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', handleVisibility);
    reconcile();
    return () => {
      active = false;
      window.removeEventListener('focus', reconcile);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [authToken, isLoggedIn, queryClient, userId]);
  // The setup gate is only useful while the browser still has an undecided
  // permission request. A granted permission must never trigger another gate;
  // denied or unsupported environments should remain usable without a prompt.
  const notificationGateVisible = isLoggedIn && !notificationGateDismissed
    && typeof Notification !== 'undefined'
    && Notification.permission === 'default';
  const continueWithoutNotifications = async () => setNotificationGateDismissed(true);
  if (!isInitialized) return <div className="loading-screen" role="status" aria-label="Loading"><span className="spinner" /></div>;
  return <>
    <RootNavigator />
    <NotificationGate visible={notificationGateVisible} onRetry={continueWithoutNotifications} onSkip={continueWithoutNotifications} />
    {notice && <button className="toast" onClick={() => {
      const target = window.FunspotNotificationUrl?.normalize(notice.data?.url) ?? '/app/';
      window.location.assign(target);
      setNotice(null);
    }} aria-label="Open notification"><strong>{notice.title}</strong>{notice.body && <span>{notice.body}</span>}</button>}
  </>;
}

export default function App() {
  return <AuthProvider><ToastProvider><LoginModalProvider><AppRoutes /></LoginModalProvider></ToastProvider></AuthProvider>;
}
