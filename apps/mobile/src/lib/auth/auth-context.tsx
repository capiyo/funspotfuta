// RN adaptation of funspot/lib/services/auth_service.dart — same storage
// keys, same method names/behavior as the web port
// (funspot-next/lib/auth/auth-context.tsx), but backed by AsyncStorage
// (React Native's persistent key-value store) instead of localStorage,
// which means every storage op is async here.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileStorage } from '@funspot/storage';
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

// Keep auth metadata in the synchronous app-cache store so the last known
// session can be restored during the first render. Namespacing prevents query
// persistence and auth state from overwriting each other.
const AUTH_CACHE_KEYS = {
  token: 'auth:usertoken',
  user: 'auth:user',
  phone: 'auth:phone',
  refreshToken: 'auth:refreshToken',
} as const;

function readCachedSession(): AuthState {
  try {
    const authToken = mobileStorage.getItem(AUTH_CACHE_KEYS.token);
    const userString = mobileStorage.getItem(AUTH_CACHE_KEYS.user);
    const phone = mobileStorage.getItem(AUTH_CACHE_KEYS.phone);
    const refreshToken = mobileStorage.getItem(AUTH_CACHE_KEYS.refreshToken);
    if (!authToken || !userString) return initialState;
    const userData: unknown = JSON.parse(userString);
    if (!userData || typeof userData !== 'object') return initialState;
    const user = userData as { id?: unknown; userId?: unknown; _id?: unknown; username?: unknown; name?: unknown; phone?: unknown };
    const rawUserId = user.id ?? user.userId ?? user._id;
    if (typeof rawUserId !== 'string' && typeof rawUserId !== 'number') return initialState;
    return {
      isLoggedIn: true,
      isInitialized: true,
      userId: String(rawUserId),
      username: typeof user.username === 'string' ? user.username : typeof user.name === 'string' ? user.name : '',
      phone: phone ?? (user.phone == null ? '' : String(user.phone)),
      authToken,
      refreshToken,
    };
  } catch {
    return initialState;
  }
}

function writeCachedSession(values: { authToken: string; user: string; phone?: string; refreshToken?: string }) {
  mobileStorage.setItem(AUTH_CACHE_KEYS.token, values.authToken);
  mobileStorage.setItem(AUTH_CACHE_KEYS.user, values.user);
  if (values.phone) mobileStorage.setItem(AUTH_CACHE_KEYS.phone, values.phone);
  else mobileStorage.removeItem(AUTH_CACHE_KEYS.phone);
  if (values.refreshToken) mobileStorage.setItem(AUTH_CACHE_KEYS.refreshToken, values.refreshToken);
  else mobileStorage.removeItem(AUTH_CACHE_KEYS.refreshToken);
}

function clearCachedSession() {
  Object.values(AUTH_CACHE_KEYS).forEach((key) => mobileStorage.removeItem(key));
}

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
  const [state, setState] = useState<AuthState>(() => readCachedSession());

  useEffect(() => {
    // A cached session is already usable synchronously on first render. Only
    // consult legacy AsyncStorage keys when upgrading an install that predates
    // the app-cache auth namespace.
    if (state.isInitialized) return;

    let cancelled = false;
    (async () => {
      try {
        const [authToken, userString, phone, refreshToken] = await Promise.all([
          AsyncStorage.getItem('usertoken'),
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem('phone'),
          AsyncStorage.getItem('refreshToken'),
        ]);

        if (cancelled) return;
        if (authToken && userString) {
          try {
            const userData: unknown = JSON.parse(userString);
            if (!userData || typeof userData !== 'object') throw new Error('Invalid stored user');
            const user = userData as { id?: unknown; userId?: unknown; _id?: unknown; username?: unknown; name?: unknown; phone?: unknown };
            const rawUserId = user.id ?? user.userId ?? user._id;
            if (typeof rawUserId !== 'string' && typeof rawUserId !== 'number') {
              setState({ ...initialState, isInitialized: true });
              return;
            }
            const normalizedUser = {
              id: String(rawUserId),
              username: typeof user.username === 'string' ? user.username : typeof user.name === 'string' ? user.name : '',
              phone: phone ?? (user.phone == null ? '' : String(user.phone)),
            };
            writeCachedSession({ authToken, user: JSON.stringify(normalizedUser), phone: phone ?? normalizedUser.phone, refreshToken: refreshToken ?? undefined });
            setState({
              isLoggedIn: true,
              isInitialized: true,
              userId: normalizedUser.id,
              username: normalizedUser.username,
              phone: normalizedUser.phone,
              authToken,
              refreshToken,
            });
          } catch {
            setState({ ...initialState, isInitialized: true });
          }
        } else {
          setState({ ...initialState, isInitialized: true });
        }
      } catch {
        if (!cancelled) setState({ ...initialState, isInitialized: true });
      }
    })();

    return () => { cancelled = true; };
  }, [state.isInitialized]);

  const login = useCallback(
    async (
      userId: string,
      username: string,
      authToken: string,
      opts?: { phone?: string; refreshToken?: string }
    ): Promise<boolean> => {
      try {
        const userData = { id: userId, username, phone: opts?.phone ?? '' };
        writeCachedSession({
          authToken,
          user: JSON.stringify(userData),
          phone: opts?.phone,
          refreshToken: opts?.refreshToken,
        });
        // Keep legacy keys in sync for older app code during the migration.
        await Promise.all([
          AsyncStorage.setItem('usertoken', authToken),
          AsyncStorage.setItem('user', JSON.stringify(userData)),
          AsyncStorage.setItem('isLoggedIn', 'true'),
          opts?.phone ? AsyncStorage.setItem('phone', opts.phone) : AsyncStorage.removeItem('phone'),
          opts?.refreshToken ? AsyncStorage.setItem('refreshToken', opts.refreshToken) : AsyncStorage.removeItem('refreshToken'),
        ]);

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
        setState({ ...initialState, isInitialized: true });
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      clearCachedSession();
      await AsyncStorage.multiRemove(LOGOUT_KEYS);
    } finally {
      setState({ ...initialState, isInitialized: true });
    }
  }, []);

  const updateAuthToken = useCallback(
    async (newToken: string, newRefreshToken?: string): Promise<boolean> => {
      if (!state.isLoggedIn) return false;
      try {
        mobileStorage.setItem(AUTH_CACHE_KEYS.token, newToken);
        if (newRefreshToken) mobileStorage.setItem(AUTH_CACHE_KEYS.refreshToken, newRefreshToken);
        await AsyncStorage.setItem('usertoken', newToken);
        if (newRefreshToken) await AsyncStorage.setItem('refreshToken', newRefreshToken);
        setState((s) => ({ ...s, authToken: newToken, refreshToken: newRefreshToken ?? s.refreshToken }));
        return true;
      } catch {
        return false;
      }
    },
    [state.isLoggedIn]
  );

  const updateUserData = useCallback(async (userId: string, username: string, phone?: string) => {
    try {
      const userString = mobileStorage.getItem(AUTH_CACHE_KEYS.user) ?? await AsyncStorage.getItem('user');
      if (userString) {
        const userData: unknown = JSON.parse(userString);
        if (!userData || typeof userData !== 'object') throw new Error('Invalid stored user');
        const nextUser = { ...(userData as Record<string, unknown>), id: userId, username, ...(phone ? { phone } : {}) };
        mobileStorage.setItem(AUTH_CACHE_KEYS.user, JSON.stringify(nextUser));
        await AsyncStorage.setItem('user', JSON.stringify(nextUser));
      }
      if (phone) {
        mobileStorage.setItem(AUTH_CACHE_KEYS.phone, phone);
        await AsyncStorage.setItem('phone', phone);
      }
      setState((s) => ({ ...s, userId, username, phone: phone ?? s.phone }));
    } catch {
      /* matches Dart: swallow and log */
    }
  }, []);

  const hasValidSession = useCallback(
    () => Boolean(state.isLoggedIn && state.authToken && state.userId),
    [state.isLoggedIn, state.authToken, state.userId]
  );

  const clearAllAppData = useCallback(async () => {
    try {
      clearCachedSession();
      await AsyncStorage.clear();
    } finally {
      setState({ ...initialState, isInitialized: true });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, updateAuthToken, updateUserData, hasValidSession, clearAllAppData }),
    [state, login, logout, updateAuthToken, updateUserData, hasValidSession, clearAllAppData]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
