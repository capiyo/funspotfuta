import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const location = useLocation();

  useEffect(() => {
    if (isInitialized && !isLoggedIn) requireLogin();
  }, [isInitialized, isLoggedIn, requireLogin, location.pathname]);

  if (!isInitialized) {
    return <div className="loading-screen" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>;
  }
  if (!isLoggedIn) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}

function LoginRoute() {
  const { isInitialized, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  useEffect(() => {
    if (isInitialized && !isLoggedIn) requireLogin();
  }, [isInitialized, isLoggedIn, requireLogin]);
  return <Navigate to="/" replace />;
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

  return <ProtectedRoute>
    {mobile ? <MessageScreen /> : <>
      <HomeScreen />
      <div className="desktop-message-overlay" role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="desktop-message-dialog" role="dialog" aria-modal="true" aria-label="Messaging">
          <MessageScreen />
        </div>
      </div>
    </>}
  </ProtectedRoute>;
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
