import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearMobileQueryCache } from '../../../QueryProvider';

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
  login: (userId: string, username: string, authToken: string, opts?: { phone?: string; refreshToken?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  updateAuthToken: (newToken: string, newRefreshToken?: string) => Promise<boolean>;
  updateUserData: (userId: string, username: string, phone?: string) => Promise<void>;
  hasValidSession: () => boolean;
  clearAllAppData: () => Promise<void>;
}

const initialState: AuthState = {
  isLoggedIn: false, isInitialized: false, userId: null, username: null,
  phone: null, authToken: null, refreshToken: null,
};
const AuthContext = createContext<AuthContextValue | null>(null);
const SECURE_KEYS = { token: 'auth.usertoken', user: 'auth.user', refresh: 'auth.refreshToken' } as const;
const LEGACY_KEYS = ['usertoken', 'user', 'isLoggedIn', 'userId', 'username', 'phone', 'refreshToken'] as const;
const LOGOUT_KEYS = [
  ...LEGACY_KEYS, 'userBets', 'userProfile', 'availableGames', 'notifications',
  'notificationCount', 'cachedPosts', 'cachedFixtures', 'lastCarouselFetch',
  'forceNewUser', 'comrades', 'channels', 'votes', 'messages',
];

type StoredUser = { id?: unknown; userId?: unknown; _id?: unknown; username?: unknown; name?: unknown; phone?: unknown };

function parseSession(token: string | null, rawUser: string | null, refreshToken: string | null): AuthState {
  if (!token || !rawUser) return { ...initialState, isInitialized: true };
  try {
    const user: unknown = JSON.parse(rawUser);
    if (!user || typeof user !== 'object') return { ...initialState, isInitialized: true };
    const value = user as StoredUser;
    const rawId = value.id ?? value.userId ?? value._id;
    if (typeof rawId !== 'string' && typeof rawId !== 'number') return { ...initialState, isInitialized: true };
    return {
      isLoggedIn: true, isInitialized: true, userId: String(rawId),
      username: typeof value.username === 'string' ? value.username : typeof value.name === 'string' ? value.name : '',
      phone: value.phone == null ? null : String(value.phone), authToken: token, refreshToken,
    };
  } catch {
    return { ...initialState, isInitialized: true };
  }
}

async function clearSecureSession(): Promise<void> {
  await Promise.all(Object.values(SECURE_KEYS).map((key) => SecureStore.deleteItemAsync(key)));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let [token, user, refresh] = await Promise.all([
          SecureStore.getItemAsync(SECURE_KEYS.token),
          SecureStore.getItemAsync(SECURE_KEYS.user),
          SecureStore.getItemAsync(SECURE_KEYS.refresh),
        ]);

        // One-time migration from the old plaintext stores. Delete legacy
        // copies only after all secure writes have succeeded.
        if (!token || !user) {
          const [legacyToken, legacyUser, legacyRefresh, legacyPhone] = await Promise.all([
            AsyncStorage.getItem('usertoken'),
            AsyncStorage.getItem('user'),
            AsyncStorage.getItem('refreshToken'),
            AsyncStorage.getItem('phone'),
          ]);
          if (legacyToken && legacyUser) {
            let normalizedUser = legacyUser;
            try {
              const parsed: unknown = JSON.parse(legacyUser);
              if (parsed && typeof parsed === 'object') {
                const record = parsed as Record<string, unknown>;
                normalizedUser = JSON.stringify({
                  ...record,
                  ...(legacyPhone ? { phone: legacyPhone } : {}),
                });
              }
            } catch {
              normalizedUser = legacyUser;
            }
            await SecureStore.setItemAsync(SECURE_KEYS.token, legacyToken);
            await SecureStore.setItemAsync(SECURE_KEYS.user, normalizedUser);
            if (legacyRefresh) await SecureStore.setItemAsync(SECURE_KEYS.refresh, legacyRefresh);
            token = legacyToken;
            user = normalizedUser;
            refresh = legacyRefresh;
            await AsyncStorage.multiRemove(LOGOUT_KEYS);
          }
        }

        if (token && user) await AsyncStorage.multiRemove(LOGOUT_KEYS);
        if (!cancelled) setState(parseSession(token, user, refresh));
      } catch (error) {
        if (__DEV__) console.warn('[auth] secure session restore failed', error);
        if (!cancelled) setState({ ...initialState, isInitialized: true });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (
    userId: string, username: string, authToken: string,
    opts?: { phone?: string; refreshToken?: string },
  ): Promise<boolean> => {
    try {
      const user = JSON.stringify({ id: userId, username, phone: opts?.phone ?? '' });
      await SecureStore.setItemAsync(SECURE_KEYS.token, authToken);
      await SecureStore.setItemAsync(SECURE_KEYS.user, user);
      if (opts?.refreshToken) await SecureStore.setItemAsync(SECURE_KEYS.refresh, opts.refreshToken);
      else await SecureStore.deleteItemAsync(SECURE_KEYS.refresh);
      if (state.userId && state.userId !== userId) await clearMobileQueryCache();
      await AsyncStorage.multiRemove(LOGOUT_KEYS);
      setState({
        isLoggedIn: true, isInitialized: true, userId, username,
        phone: opts?.phone ?? null, authToken, refreshToken: opts?.refreshToken ?? null,
      });
      return true;
    } catch (error) {
      if (__DEV__) console.warn('[auth] secure session write failed', error);
      await clearSecureSession().catch(() => undefined);
      setState({ ...initialState, isInitialized: true });
      return false;
    }
  }, [state.userId]);

  const logout = useCallback(async () => {
    try {
      await clearMobileQueryCache();
      await clearSecureSession();
      await AsyncStorage.multiRemove(LOGOUT_KEYS);
    } finally {
      setState({ ...initialState, isInitialized: true });
    }
  }, []);

  const updateAuthToken = useCallback(async (newToken: string, newRefreshToken?: string): Promise<boolean> => {
    if (!state.isLoggedIn) return false;
    try {
      await SecureStore.setItemAsync(SECURE_KEYS.token, newToken);
      if (newRefreshToken) await SecureStore.setItemAsync(SECURE_KEYS.refresh, newRefreshToken);
      setState((current) => ({ ...current, authToken: newToken, refreshToken: newRefreshToken ?? current.refreshToken }));
      return true;
    } catch {
      return false;
    }
  }, [state.isLoggedIn]);

  const updateUserData = useCallback(async (userId: string, username: string, phone?: string) => {
    try {
      const raw = await SecureStore.getItemAsync(SECURE_KEYS.user);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid stored user');
        const next = { ...(parsed as Record<string, unknown>), id: userId, username, ...(phone ? { phone } : {}) };
        await SecureStore.setItemAsync(SECURE_KEYS.user, JSON.stringify(next));
      }
      setState((current) => ({ ...current, userId, username, phone: phone ?? current.phone }));
    } catch (error) {
      if (__DEV__) console.warn('[auth] secure user update failed', error);
    }
  }, []);

  const hasValidSession = useCallback(
    () => Boolean(state.isLoggedIn && state.authToken && state.userId),
    [state.isLoggedIn, state.authToken, state.userId],
  );

  const clearAllAppData = useCallback(async () => {
    try {
      await clearMobileQueryCache();
      await clearSecureSession();
      await AsyncStorage.clear();
    } finally {
      setState({ ...initialState, isInitialized: true });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, updateAuthToken, updateUserData, hasValidSession, clearAllAppData }),
    [state, login, logout, updateAuthToken, updateUserData, hasValidSession, clearAllAppData],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
