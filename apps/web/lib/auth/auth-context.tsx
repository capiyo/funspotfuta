// Ported from funspot/lib/services/auth_service.dart.
// Same storage keys (localStorage instead of SharedPreferences — see
// data-layer mapping in the migration plan), same method names/behavior:
// initialize(), login(), logout(), updateAuthToken(), updateUserData(),
// hasValidSession(), clearAllAppData().

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface AuthState {
  isLoggedIn: boolean;
  isInitialized: boolean;
  userId: string | null;
  username: string | null;
  phone: string | null;
  authToken: string | null;
  refreshToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (
    userId: string,
    username: string,
    authToken: string,
    opts?: { phone?: string; refreshToken?: string }
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  updateAuthToken: (newToken: string, newRefreshToken?: string) => Promise<boolean>;
  updateUserData: (userId: string, username: string, phone?: string) => Promise<void>;
  hasValidSession: () => boolean;
  clearAllAppData: () => Promise<void>;
}

const initialState: AuthState = {
  isLoggedIn: false,
  isInitialized: false,
  userId: null,
  username: null,
  phone: null,
  authToken: null,
  refreshToken: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Keys the Flutter app cleared on logout — kept identical so a future shared
// backend session doesn't leave stale local data behind.
const LOGOUT_KEYS = [
  'usertoken',
  'user',
  'isLoggedIn',
  'userId',
  'username',
  'phone',
  'refreshToken',
  'userBets',
  'userProfile',
  'availableGames',
  'notifications',
  'notificationCount',
  'cachedPosts',
  'cachedFixtures',
  'lastCarouselFetch',
  'forceNewUser',
  'comrades',
  'channels',
  'votes',
  'messages',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  // initialize() — restore session from localStorage on mount
  useEffect(() => {
    if (state.isInitialized) return;

    try {
      const authToken = localStorage.getItem('usertoken');
      const userString = localStorage.getItem('user');
      const phone = localStorage.getItem('phone');
      const refreshToken = localStorage.getItem('refreshToken');

      if (authToken && userString) {
        try {
          const userData = JSON.parse(userString);
          const userId = userData.id ?? userData.userId ?? userData._id ?? null;
          const username = userData.username ?? userData.name ?? '';

          if (!userId) {
            setState({ ...initialState, isInitialized: true });
          } else {
            setState({
              isLoggedIn: true,
              isInitialized: true,
              userId,
              username,
              phone: phone ?? userData.phone?.toString() ?? '',
              authToken,
              refreshToken,
            });
          }
        } catch {
          setState({ ...initialState, isInitialized: true });
        }
      } else {
        setState({ ...initialState, isInitialized: true });
      }
    } catch {
      setState({ ...initialState, isInitialized: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (
      userId: string,
      username: string,
      authToken: string,
      opts?: { phone?: string; refreshToken?: string }
    ): Promise<boolean> => {
      try {
        const userData = { id: userId, username, phone: opts?.phone ?? '' };

        localStorage.setItem('usertoken', authToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');
        if (opts?.phone) localStorage.setItem('phone', opts.phone);
        if (opts?.refreshToken) localStorage.setItem('refreshToken', opts.refreshToken);

        setState({
          isLoggedIn: true,
          isInitialized: true,
          userId,
          username,
          phone: opts?.phone ?? null,
          authToken,
          refreshToken: opts?.refreshToken ?? null,
        });
        return true;
      } catch {
        setState((s) => ({ ...initialState, isInitialized: true }));
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      LOGOUT_KEYS.forEach((k) => localStorage.removeItem(k));
    } finally {
      setState((s) => ({ ...initialState, isInitialized: true }));
    }
  }, []);

  const updateAuthToken = useCallback(
    async (newToken: string, newRefreshToken?: string): Promise<boolean> => {
      if (!state.isLoggedIn) return false;
      try {
        localStorage.setItem('usertoken', newToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        setState((s) => ({
          ...s,
          authToken: newToken,
          refreshToken: newRefreshToken ?? s.refreshToken,
        }));
        return true;
      } catch {
        return false;
      }
    },
    [state.isLoggedIn]
  );

  const updateUserData = useCallback(async (userId: string, username: string, phone?: string) => {
    try {
      const userString = localStorage.getItem('user');
      if (userString) {
        const userData = JSON.parse(userString);
        userData.username = username;
        if (phone) userData.phone = phone;
        localStorage.setItem('user', JSON.stringify(userData));
      }
      if (phone) localStorage.setItem('phone', phone);
      setState((s) => ({ ...s, userId, username, phone: phone ?? s.phone }));
    } catch {
      // matches Dart: swallow and log
    }
  }, []);

  const hasValidSession = useCallback(
    () => Boolean(state.isLoggedIn && state.authToken && state.userId),
    [state.isLoggedIn, state.authToken, state.userId]
  );

  const clearAllAppData = useCallback(async () => {
    try {
      localStorage.clear();
    } finally {
      setState({ ...initialState, isInitialized: true });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      updateAuthToken,
      updateUserData,
      hasValidSession,
      clearAllAppData,
    }),
    [state, login, logout, updateAuthToken, updateUserData, hasValidSession, clearAllAppData]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
