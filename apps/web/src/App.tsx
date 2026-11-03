import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@funspot/core';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { LoginModalProvider } from '@/modals/Login-modal-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import RootNavigator from '@/navigation/RootNavigator';
import NotificationGate from '@/modals/NotificationGate';
import { listenForForegroundMessages, NotificationService, requestWebPushToken, type ForegroundNotice } from '@/lib/api/notification-service';
import { firebaseApp, webFirebaseConfig } from '@/lib/firebase';

function AppRoutes() {
  const { isInitialized, isLoggedIn, userId, authToken } = useAuth();
  const queryClient = useQueryClient();
  const [notificationGateDismissed, setNotificationGateDismissed] = useState(false);
  const [notice, setNotice] = useState<ForegroundNotice | null>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    listenForForegroundMessages((incoming) => {
      setNotice(incoming);
      const data = incoming.data ?? {};
      void NotificationService.pushToStream({ data });
      if (data.channel_id && data.fixture_id && userId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.fixtureUnreadCount(data.channel_id, data.fixture_id, userId),
        });
      }
    }).then((unsubscribe) => { stop = unsubscribe; }).catch(() => undefined);
    return () => stop?.();
  }, [queryClient, userId]);
  useEffect(() => {
    if (!firebaseApp || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then(async (registration) => {
      await navigator.serviceWorker.ready;
      (registration.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'FUNSPOT_FIREBASE_CONFIG', config: webFirebaseConfig });
    }).catch(() => undefined);
  }, []);
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
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', handleVisibility);
    void syncToken();
    reconcile();
    return () => {
      active = false;
      window.removeEventListener('focus', reconcile);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [authToken, isLoggedIn, queryClient, userId]);
  const notificationGateVisible = isLoggedIn && !notificationGateDismissed
    && (typeof Notification === 'undefined' || Notification.permission !== 'granted');
  const continueWithoutNotifications = async () => setNotificationGateDismissed(true);
  if (!isInitialized) return <div className="loading-screen" role="status" aria-label="Loading"><span className="spinner" /></div>;
  return <>
    <RootNavigator />
    <NotificationGate visible={notificationGateVisible} onRetry={continueWithoutNotifications} onSkip={continueWithoutNotifications} />
    {notice && <button className="toast" onClick={() => {
      const target = notice.data?.url;
      if (target) window.location.assign(target);
      setNotice(null);
    }} aria-label="Open notification"><strong>{notice.title}</strong>{notice.body && <span>{notice.body}</span>}</button>}
  </>;
}

export default function App() {
  return <AuthProvider><ToastProvider><LoginModalProvider><AppRoutes /></LoginModalProvider></ToastProvider></AuthProvider>;
}
