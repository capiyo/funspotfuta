import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { LoginModalProvider } from '@/modals/Login-modal-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import RootNavigator from '@/navigation/RootNavigator';
import { listenForForegroundMessages, type ForegroundNotice } from '@/lib/api/notification-service';
import { firebaseApp, webFirebaseConfig } from '@/lib/firebase';

function AppRoutes() {
  const { isInitialized } = useAuth();
  const [notice, setNotice] = useState<ForegroundNotice | null>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    listenForForegroundMessages(setNotice).then((unsubscribe) => { stop = unsubscribe; }).catch(() => undefined);
    return () => stop?.();
  }, []);
  useEffect(() => {
    if (!firebaseApp || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then(async (registration) => {
      await navigator.serviceWorker.ready;
      (registration.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'FUNSPOT_FIREBASE_CONFIG', config: webFirebaseConfig });
    }).catch(() => undefined);
  }, []);
  if (!isInitialized) return <div className="loading-screen" role="status" aria-label="Loading"><span className="spinner" /></div>;
  return <>
    <RootNavigator />
    {notice && <button className="toast" onClick={() => setNotice(null)} aria-label="Dismiss notification"><strong>{notice.title}</strong>{notice.body && <span>{notice.body}</span>}</button>}
  </>;
}

export default function App() {
  return <AuthProvider><ToastProvider><LoginModalProvider><AppRoutes /></LoginModalProvider></ToastProvider></AuthProvider>;
}
