import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import HomeScreen from '@/screens/home/HomeScreen';
import MessageScreen from '@/screens/MessageScreen';
import PostCommentsModal from '@/modals/CommentsModal';

type CommentsRouteState = {
  postUserId?: string;
  postUserName?: string;
  postCaption?: string;
};

function useMobileWebLayout(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 650px)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 650px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

function LoginRoute() {
  const { isInitialized, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  useEffect(() => {
    if (isInitialized && !isLoggedIn) requireLogin();
  }, [isInitialized, isLoggedIn, requireLogin]);
  return <Navigate to="/" replace />;
}

function NotFoundRoute() {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Funspot</p>
    <h1 className="text-2xl font-bold">Page not found</h1>
    <p className="max-w-md text-sm opacity-70">That application page does not exist or may have moved.</p>
    <Link className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black" to="/">Return to Funspot</Link>
  </main>;
}
function ResponsiveMessageRoute() {
  const mobile = useMobileWebLayout();
  const navigate = useNavigate();
  const close = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [navigate]);

  useEffect(() => {
    if (mobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobile, close]);

  return mobile ? <MessageScreen /> : <>
    <HomeScreen />
    <div className="desktop-message-overlay" role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="desktop-message-dialog" role="dialog" aria-modal="true" aria-label="Messaging">
        <MessageScreen />
      </div>
    </div>
  </>;
}

function ResponsiveCommentsRoute() {
  const { postId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as CommentsRouteState;
  const close = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  const comments = <PostCommentsModal
    visible
    postId={postId}
    postUserId={state.postUserId}
    postUserName={state.postUserName}
    postCaption={state.postCaption}
    presentation="modal"
    onClose={close}
  />;
  return <><HomeScreen />{comments}</>;
}

export default function RootNavigator() {
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return <div className="loading-screen" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>;
  }

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/messages/:channelId?" element={<ResponsiveMessageRoute />} />
      <Route path="/comments/:postId" element={<ResponsiveCommentsRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="*" element={<NotFoundRoute />} />
    </Routes>
  );
}
