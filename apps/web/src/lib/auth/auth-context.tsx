/* eslint no-undef: "off" */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { firebaseAuth } from '../firebase';
import { indexedDbQueryPersister } from '../query-persistence';
import { getAllFixtures, getVotesByUserStrict, feedQueryOptions, comradesQueryOptions, profileQueryOptions, queryKeys } from '@funspot/core';

type AuthState = {
  isInitialized: boolean;
  isLoggedIn: boolean;
  userId: string | null;
  username: string | null;
  phone: string | null;
  authToken: string | null;
  refreshToken: string | null;
};
type LoginOptions = { phone?: string; refreshToken?: string };
type AuthContextValue = AuthState & {
  login: (userId: string, username: string, authToken: string, phoneOrOptions?: string | LoginOptions) => boolean;
  logout: () => Promise<void>;
  updateAuthToken: (newToken: string, newRefreshToken?: string) => Promise<boolean>;
  updateUserData: (userId: string, username: string, phone?: string) => Promise<void>;
  hasValidSession: () => boolean;
  clearAllAppData: () => Promise<void>;
};

const initialState: AuthState = {
  isInitialized: false, isLoggedIn: false, userId: null, username: null, phone: null, authToken: null, refreshToken: null,
};
const AuthContext = createContext<AuthContextValue | null>(null);
const LOGOUT_KEYS = [
  'usertoken','user','isLoggedIn','userId','username','phone','refreshToken','userBets','userProfile',
  'availableGames','notifications','notificationCount','cachedPosts','cachedFixtures','lastCarouselFetch',
  'forceNewUser','comrades','channels','votes','messages',
];

function readStoredState(): AuthState {
  try {
    const token = localStorage.getItem('usertoken');
    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    const id = user?.id ?? user?.userId ?? user?._id ?? null;
    return {
      isInitialized: true, isLoggedIn: Boolean(token && id), userId: id ? String(id) : null,
      username: user?.username ?? user?.name ?? null, phone: localStorage.getItem('phone') ?? user?.phone ?? null,
      authToken: token, refreshToken: localStorage.getItem('refreshToken'),
    };
  } catch { return { ...initialState, isInitialized: true }; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(initialState);
  const previousAuthIdentity = useRef<string | null>(null);

  useEffect(() => {
    if (!state.isInitialized) return;
    const identity = state.isLoggedIn && state.userId ? state.userId : null;
    const previous = previousAuthIdentity.current;
    previousAuthIdentity.current = identity;
    if (previous === null || previous === identity) return;

    // Never carry one signed-in user's in-memory or persisted data into a
    // different account (or a logged-out session).
    queryClient.clear();
    void indexedDbQueryPersister.removeClient();
  }, [state.isInitialized, state.isLoggedIn, state.userId, queryClient]);

  // Warm account data sequentially after hydration/auth initialization. Each
  // prefetch uses the same canonical query options as its consuming hook.
  const prefetchedUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!state.isInitialized || !state.isLoggedIn || !state.userId) return;
    const currentUserId = state.userId;
    if (prefetchedUserId.current === currentUserId) return;
    prefetchedUserId.current = currentUserId;
    let cancelled = false;
    void (async () => {
      try {
        await queryClient.prefetchQuery({ queryKey: queryKeys.fixtures(), queryFn: getAllFixtures });
        if (cancelled) return;
        await queryClient.prefetchInfiniteQuery(feedQueryOptions(10));
        if (cancelled) return;
        await queryClient.prefetchQuery({
          queryKey: queryKeys.userVotes(currentUserId),
          queryFn: () => getVotesByUserStrict(currentUserId),
        });
        if (cancelled) return;
        await queryClient.prefetchQuery(comradesQueryOptions(currentUserId, state.authToken));
        if (cancelled) return;
        await queryClient.prefetchQuery(profileQueryOptions(currentUserId, state.authToken));
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[query-cache] sequential startup prefetch stopped', error);
      }
    })();
    return () => { cancelled = true; };
  }, [state.isInitialized, state.isLoggedIn, state.userId, state.authToken, queryClient]);

  useEffect(() => { setState(readStoredState()); }, []);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        if (!localStorage.getItem('usertoken') || !localStorage.getItem('user')) return;
        localStorage.setItem('usertoken', token);
        setState((current) => current.isLoggedIn ? { ...current, authToken: token } : current);
      } catch {
        // Keep the persisted backend session if Firebase cannot refresh its ID token.
      }
    });
  }, []);

  const login = useCallback((userId: string, username: string, authToken: string, phoneOrOptions?: string | LoginOptions): boolean => {
    const opts: LoginOptions = typeof phoneOrOptions === 'string' ? { phone: phoneOrOptions } : phoneOrOptions ?? {};
    try {
      const user = { id: userId, username, phone: opts.phone ?? '' };
      localStorage.setItem('usertoken', authToken);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isLoggedIn', 'true');
      if (opts.phone) localStorage.setItem('phone', opts.phone);
      if (opts.refreshToken) localStorage.setItem('refreshToken', opts.refreshToken);
      setState({ isInitialized: true, isLoggedIn: true, userId, username, phone: opts.phone ?? null, authToken, refreshToken: opts.refreshToken ?? null });
      return true;
    } catch {
      setState({ ...initialState, isInitialized: true });
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    queryClient.clear();
    if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
    LOGOUT_KEYS.forEach((key) => localStorage.removeItem(key));
    setState({ ...initialState, isInitialized: true });
  }, [queryClient]);

  const updateAuthToken = useCallback(async (newToken: string, newRefreshToken?: string): Promise<boolean> => {
    if (!state.isLoggedIn) return false;
    try {
      localStorage.setItem('usertoken', newToken);
      if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
      setState((current) => ({ ...current, authToken: newToken, refreshToken: newRefreshToken ?? current.refreshToken }));
      return true;
    } catch { return false; }
  }, [state.isLoggedIn]);

  const updateUserData = useCallback(async (userId: string, username: string, phone?: string) => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const user = JSON.parse(raw);
        user.username = username;
        if (phone) user.phone = phone;
        localStorage.setItem('user', JSON.stringify(user));
      }
      if (phone) localStorage.setItem('phone', phone);
      setState((current) => ({ ...current, userId, username, phone: phone ?? current.phone }));
    } catch {
      // Match mobile behavior: storage failures do not crash the screen.
    }
  }, []);

  const hasValidSession = useCallback(() => Boolean(state.isLoggedIn && state.authToken && state.userId), [state.isLoggedIn, state.authToken, state.userId]);
  const clearAllAppData = useCallback(async () => {
    try { localStorage.clear(); } finally {
      queryClient.clear();
      setState({ ...initialState, isInitialized: true });
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({ ...state, login, logout, updateAuthToken, updateUserData, hasValidSession, clearAllAppData }), [state, login, logout, updateAuthToken, updateUserData, hasValidSession, clearAllAppData]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
