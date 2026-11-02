/* eslint no-undef: "off" */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { firebaseAuth } from '../firebase';
import { indexedDbQueryPersister, secureBrowserSession } from '../query-persistence';
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
  login: (userId: string, username: string, authToken: string, phoneOrOptions?: string | LoginOptions) => Promise<boolean>;
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
const LEGACY_KEYS = [
  'usertoken','user','isLoggedIn','userId','username','phone','refreshToken','userBets','userProfile',
  'availableGames','notifications','notificationCount','cachedPosts','cachedFixtures','lastCarouselFetch',
  'forceNewUser','comrades','channels','votes','messages',
];

async function readStoredState(): Promise<AuthState> {
  try {
    const [token, rawUser, refreshToken] = await Promise.all([
      secureBrowserSession.getToken(),
      secureBrowserSession.getUser(),
      secureBrowserSession.getRefreshToken(),
    ]);
    const user = rawUser ? JSON.parse(rawUser) : null;
    const id = user?.id ?? user?.userId ?? user?._id ?? null;
    return {
      isInitialized: true, isLoggedIn: Boolean(token && id), userId: id ? String(id) : null,
      username: user?.username ?? user?.name ?? null, phone: user?.phone ?? null,
      authToken: token, refreshToken,
    };
  } catch {
    return { ...initialState, isInitialized: true };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(initialState);
  const previousAuthIdentity = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // One-time migration from legacy browser storage. Credentials and
        // profile metadata are encrypted before legacy plaintext is erased.
        const [legacyToken, legacyUser, legacyRefresh] = [
          localStorage.getItem('usertoken'),
          localStorage.getItem('user'),
          localStorage.getItem('refreshToken'),
        ];
        if (legacyToken && legacyUser && !(await secureBrowserSession.getToken())) {
          await secureBrowserSession.setToken(legacyToken);
          await secureBrowserSession.setUser(legacyUser);
          if (legacyRefresh) await secureBrowserSession.setRefreshToken(legacyRefresh);
        }
        LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
        const restored = await readStoredState();
        if (!cancelled) setState(restored);
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[auth] encrypted browser session restore failed', error);
        if (!cancelled) setState({ ...initialState, isInitialized: true });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!state.isInitialized) return;
    const identity = state.isLoggedIn && state.userId ? state.userId : null;
    const previous = previousAuthIdentity.current;
    previousAuthIdentity.current = identity;
    if (previous === null || previous === identity) return;
    queryClient.clear();
    void indexedDbQueryPersister.removeClient();
  }, [state.isInitialized, state.isLoggedIn, state.userId, queryClient]);

  const prefetchedUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!state.isInitialized) return;
    if (!state.isLoggedIn || !state.userId) {
      prefetchedUserId.current = null;
      return;
    }
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
        console.warn('[query-cache] sequential startup prefetch stopped', error);
      }
    })();
    return () => { cancelled = true; };
  }, [state.isInitialized, state.isLoggedIn, state.userId, state.authToken, queryClient]);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) return;
      try {
        const [storedToken, storedUser] = await Promise.all([
          secureBrowserSession.getToken(),
          secureBrowserSession.getUser(),
        ]);
        if (!storedToken || !storedUser) return;
        const token = await user.getIdToken();
        await secureBrowserSession.setToken(token);
        setState((current) => current.isLoggedIn ? { ...current, authToken: token } : current);
      } catch {
        // Keep the backend session if Firebase cannot refresh its ID token.
      }
    });
  }, []);

  const login = useCallback(async (
    userId: string, username: string, authToken: string,
    phoneOrOptions?: string | LoginOptions,
  ): Promise<boolean> => {
    const opts: LoginOptions = typeof phoneOrOptions === 'string' ? { phone: phoneOrOptions } : phoneOrOptions ?? {};
    try {
      const user = { id: userId, username, phone: opts.phone ?? '' };
      await secureBrowserSession.setToken(authToken);
      await secureBrowserSession.setUser(JSON.stringify(user));
      if (opts.refreshToken) await secureBrowserSession.setRefreshToken(opts.refreshToken);
      else await secureBrowserSession.clearRefreshToken();
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      setState({ isInitialized: true, isLoggedIn: true, userId, username, phone: opts.phone ?? null, authToken, refreshToken: opts.refreshToken ?? null });
      return true;
    } catch {
      setState({ ...initialState, isInitialized: true });
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    queryClient.clear();
    const results = await Promise.allSettled([
      indexedDbQueryPersister.removeClient(),
      secureBrowserSession.clear(),
    ]);
    if (results.some((result) => result.status === 'rejected') && import.meta.env.DEV) {
      console.warn('[auth] one or more browser logout cleanup operations failed', results);
    }
    if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    setState({ ...initialState, isInitialized: true });
  }, [queryClient]);

  const updateAuthToken = useCallback(async (newToken: string, newRefreshToken?: string): Promise<boolean> => {
    if (!state.isLoggedIn) return false;
    try {
      await secureBrowserSession.setToken(newToken);
      if (newRefreshToken) await secureBrowserSession.setRefreshToken(newRefreshToken);
      setState((current) => ({ ...current, authToken: newToken, refreshToken: newRefreshToken ?? current.refreshToken }));
      return true;
    } catch { return false; }
  }, [state.isLoggedIn]);

  const updateUserData = useCallback(async (userId: string, username: string, phone?: string) => {
    try {
      const raw = await secureBrowserSession.getUser();
      if (raw) {
        const user = JSON.parse(raw);
        user.id = userId;
        user.username = username;
        if (phone) user.phone = phone;
        await secureBrowserSession.setUser(JSON.stringify(user));
      }
      setState((current) => ({ ...current, userId, username, phone: phone ?? current.phone }));
    } catch {
      // Keep the current in-memory state if encrypted storage is unavailable.
    }
  }, []);

  const hasValidSession = useCallback(() => Boolean(state.isLoggedIn && state.authToken && state.userId), [state.isLoggedIn, state.authToken, state.userId]);
  const clearAllAppData = useCallback(async () => {
    try {
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();
    } finally {
      queryClient.clear();
      await Promise.all([indexedDbQueryPersister.removeClient(), secureBrowserSession.clear()]);
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
