import * as SecureStore from 'expo-secure-store';
import { getFcmTokenIfPermitted } from '@/lib/firebase';
import { NotificationService } from '@/lib/api/notification-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileCache, mobileStorage, mobileStorageReady } from '@funspot/storage';
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
const SESSION_SNAPSHOT_KEY = 'auth.session.snapshot.v1';
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;
const LEGACY_KEYS = ['usertoken', 'user', 'isLoggedIn', 'userId', 'username', 'phone', 'refreshToken'] as const;
const NOTIFICATION_STORAGE_KEYS = [
  'unread_notifications',
  'unread_notification_count',
  'unread_comment_count',
  'pending_join_requests',
  'processed_notification_ids',
] as const;

async function clearNotificationStorage(): Promise<void> {
  await mobileStorageReady;
  for (const key of NOTIFICATION_STORAGE_KEYS) mobileStorage.removeItem(key);
}

const LOGOUT_KEYS = [
  ...LEGACY_KEYS, 'userBets', 'userProfile', 'availableGames', 'notifications',
  'notificationCount', 'cachedPosts', 'cachedFixtures', 'lastCarouselFetch',
  'forceNewUser', 'comrades', 'channels', 'votes', 'messages',
];

type StoredUser = { id?: unknown; userId?: unknown; _id?: unknown; username?: unknown; name?: unknown; phone?: unknown };

function writeSessionSnapshot(state: AuthState): void {
  if (!state.isLoggedIn || !state.authToken || !state.userId) {
    mobileCache.removeItem(SESSION_SNAPSHOT_KEY);
    return;
  }
  mobileCache.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify({
    token: state.authToken,
    refreshToken: state.refreshToken,
    user: {
      id: state.userId,
      username: state.username ?? '',
      ...(state.phone ? { phone: state.phone } : {}),
    },
  }));
}

function readSessionSnapshot(): AuthState | null {
  try {
    const raw = mobileCache.getItem(SESSION_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot: unknown = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object') return null;
    const value = snapshot as { token?: unknown; refreshToken?: unknown; user?: unknown };
    if (typeof value.token !== 'string' || !value.user || typeof value.user !== 'object') return null;
    const restored = parseSession(
      value.token,
      JSON.stringify(value.user),
      typeof value.refreshToken === 'string' ? value.refreshToken : null,
    );
    return restored.isLoggedIn ? restored : null;
  } catch {
    mobileCache.removeItem(SESSION_SNAPSHOT_KEY);
    return null;
  }
}

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
        // Wait until the storage layer has migrated any legacy MMKV session
        // into Keychain/Keystore; otherwise both reads could race at startup.
        await mobileStorageReady;
        const cachedSession = readSessionSnapshot();
        if (cachedSession && !cancelled) {
          setState(cachedSession);
          NotificationService.setActiveUser(cachedSession.userId);
        }
        let [token, user, refresh] = await Promise.all([
          SecureStore.getItemAsync(SECURE_KEYS.token),
          SecureStore.getItemAsync(SECURE_KEYS.user),
          SecureStore.getItemAsync(SECURE_KEYS.refresh),
        ]);

        // One-time migration from the old plaintext stores. Never combine
        // partial secure records with data from a different login attempt.
        if (Boolean(token) !== Boolean(user) || (!token && !user && refresh)) {
          await clearSecureSession();
          token = null;
          user = null;
          refresh = null;
        }
        if (!token && !user) {
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
            await SecureStore.setItemAsync(SECURE_KEYS.token, legacyToken, SECURE_STORE_OPTIONS);
            await SecureStore.setItemAsync(SECURE_KEYS.user, normalizedUser, SECURE_STORE_OPTIONS);
            if (legacyRefresh) await SecureStore.setItemAsync(SECURE_KEYS.refresh, legacyRefresh, SECURE_STORE_OPTIONS);
            token = legacyToken;
            user = normalizedUser;
            refresh = legacyRefresh;
            await AsyncStorage.multiRemove(LOGOUT_KEYS);
          }
        }

        if (token && user) await AsyncStorage.multiRemove(LOGOUT_KEYS);
        if (!cancelled) {
          const restored = parseSession(token, user, refresh);
          writeSessionSnapshot(restored);
          NotificationService.setActiveUser(restored.userId);
          setState(restored);
        }
      } catch (error) {
        if (__DEV__) console.warn('[auth] secure session restore failed', error);
        if (!cancelled) {
          writeSessionSnapshot({ ...initialState, isInitialized: true });
          setState({ ...initialState, isInitialized: true });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (
    userId: string, username: string, authToken: string,
    opts?: { phone?: string; refreshToken?: string },
  ): Promise<boolean> => {
    NotificationService.setActiveUser(userId);
    try {
      const user = JSON.stringify({ id: userId, username, phone: opts?.phone ?? '' });
      await SecureStore.setItemAsync(SECURE_KEYS.token, authToken, SECURE_STORE_OPTIONS);
      await SecureStore.setItemAsync(SECURE_KEYS.user, user, SECURE_STORE_OPTIONS);
      if (opts?.refreshToken) await SecureStore.setItemAsync(SECURE_KEYS.refresh, opts.refreshToken, SECURE_STORE_OPTIONS);
      else await SecureStore.deleteItemAsync(SECURE_KEYS.refresh);
      const nextState: AuthState = {
        isLoggedIn: true, isInitialized: true, userId, username,
        phone: opts?.phone ?? null, authToken, refreshToken: opts?.refreshToken ?? null,
      };
      writeSessionSnapshot(nextState);
      if (state.userId !== userId) {
        setState({ ...initialState, isInitialized: true });
        await Promise.all([clearMobileQueryCache(), clearNotificationStorage()]);
      }
      await AsyncStorage.multiRemove(LOGOUT_KEYS);
      setState(nextState);
      return true;
    } catch (error) {
      if (__DEV__) console.warn('[auth] secure session write failed', error);
      await clearSecureSession().catch(() => undefined);
      writeSessionSnapshot({ ...initialState, isInitialized: true });
      NotificationService.setActiveUser(null);
      setState({ ...initialState, isInitialized: true });
      return false;
    }
  }, [state.userId]);

  const logout = useCallback(async () => {
    NotificationService.setActiveUser(null);
    writeSessionSnapshot({ ...initialState, isInitialized: true });
    // Stop foreground listeners and token refresh registration immediately;
    // network cleanup must not keep the authenticated runtime alive.
    setState({ ...initialState, isInitialized: true });
    try {
      if (state.userId) {
        const fcmToken = await getFcmTokenIfPermitted();
        if (fcmToken) {
          await NotificationService.unregisterToken({
            userId: state.userId,
            fcmToken,
            authToken: state.authToken ?? undefined,
          });
        }
      }
    } catch (error) {
      if (__DEV__) console.warn('[notifications] Logout token cleanup skipped', error);
    }
    const results = await Promise.allSettled([
      clearMobileQueryCache(),
      clearSecureSession(),
      AsyncStorage.multiRemove(LOGOUT_KEYS),
      clearNotificationStorage(),
    ]);
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length && __DEV__) console.warn('[auth] one or more logout cleanup operations failed', failed);
    setState({ ...initialState, isInitialized: true });
  }, [state.authToken, state.userId]);

  const updateAuthToken = useCallback(async (newToken: string, newRefreshToken?: string): Promise<boolean> => {
    if (!state.isLoggedIn) return false;
    try {
      await SecureStore.setItemAsync(SECURE_KEYS.token, newToken, SECURE_STORE_OPTIONS);
      if (newRefreshToken) await SecureStore.setItemAsync(SECURE_KEYS.refresh, newRefreshToken, SECURE_STORE_OPTIONS);
      const nextState = { ...state, authToken: newToken, refreshToken: newRefreshToken ?? state.refreshToken };
      writeSessionSnapshot(nextState);
      setState(nextState);
      return true;
    } catch {
      return false;
    }
  }, [state]);

  const updateUserData = useCallback(async (userId: string, username: string, phone?: string) => {
    try {
      if (state.userId !== userId) {
        NotificationService.setActiveUser(null);
        writeSessionSnapshot({ ...initialState, isInitialized: true });
        await Promise.all([clearMobileQueryCache(), clearNotificationStorage()]);
      }
      const raw = await SecureStore.getItemAsync(SECURE_KEYS.user);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid stored user');
        const next = { ...(parsed as Record<string, unknown>), id: userId, username, ...(phone ? { phone } : {}) };
        await SecureStore.setItemAsync(SECURE_KEYS.user, JSON.stringify(next), SECURE_STORE_OPTIONS);
      }
      NotificationService.setActiveUser(userId);
      const nextState = { ...state, userId, username, phone: phone ?? state.phone };
      writeSessionSnapshot(nextState);
      setState(nextState);
    } catch (error) {
      if (__DEV__) console.warn('[auth] secure user update failed', error);
    }
  }, [state]);

  const hasValidSession = useCallback(
    () => Boolean(state.isLoggedIn && state.authToken && state.userId),
    [state.isLoggedIn, state.authToken, state.userId],
  );

  const clearAllAppData = useCallback(async () => {
    NotificationService.setActiveUser(null);
    writeSessionSnapshot({ ...initialState, isInitialized: true });
    setState({ ...initialState, isInitialized: true });
    const results = await Promise.allSettled([
      clearMobileQueryCache(),
      clearSecureSession(),
      AsyncStorage.clear(),
      clearNotificationStorage(),
    ]);
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length && __DEV__) console.warn('[auth] one or more app-data cleanup operations failed', failed);
    setState({ ...initialState, isInitialized: true });
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
