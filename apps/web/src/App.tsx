import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import HomeScreen from '@/screens/home/HomeScreen';
import LoginModal from '@/modals/LoginModal';
import { listenForForegroundMessages, type ForegroundNotice } from '@/lib/api/notification-service';
import { firebaseApp, webFirebaseConfig } from '@/lib/firebase';

function AppRoutes() {
  const { isInitialized, isLoggedIn } = useAuth();
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
    <Routes>
      <Route path="/" element={isLoggedIn ? <HomeScreen /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <LoginModal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {notice && <button className="toast" onClick={() => setNotice(null)} aria-label="Dismiss notification"><strong>{notice.title}</strong>{notice.body && <span>{notice.body}</span>}</button>}
  </>;
}
export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }