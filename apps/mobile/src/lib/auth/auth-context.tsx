// RN adaptation of funspot/lib/services/auth_service.dart — same storage
// keys, same method names/behavior as the web port
// (funspot-next/lib/auth/auth-context.tsx), but backed by AsyncStorage
// (React Native's persistent key-value store) instead of localStorage,
// which means every storage op is async here.

import AsyncStorage from '@react-native-async-storage/async-storage';
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

  useEffect(() => {
    (async () => {
      try {
        const [authToken, userString, phone, refreshToken] = await Promise.all([
          AsyncStorage.getItem('usertoken'),
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem('phone'),
          AsyncStorage.getItem('refreshToken'),
        ]);

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
    })();
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
        await Promise.all([
          AsyncStorage.setItem('usertoken', authToken),
          AsyncStorage.setItem('user', JSON.stringify(userData)),
          AsyncStorage.setItem('isLoggedIn', 'true'),
          opts?.phone ? AsyncStorage.setItem('phone', opts.phone) : Promise.resolve(),
          opts?.refreshToken ? AsyncStorage.setItem('refreshToken', opts.refreshToken) : Promise.resolve(),
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
      await AsyncStorage.multiRemove(LOGOUT_KEYS);
    } finally {
      setState({ ...initialState, isInitialized: true });
    }
  }, []);

  const updateAuthToken = useCallback(
    async (newToken: string, newRefreshToken?: string): Promise<boolean> => {
      if (!state.isLoggedIn) return false;
      try {
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
      const userString = await AsyncStorage.getItem('user');
      if (userString) {
        const userData = JSON.parse(userString);
        userData.username = username;
        if (phone) userData.phone = phone;
        await AsyncStorage.setItem('user', JSON.stringify(userData));
      }
      if (phone) await AsyncStorage.setItem('phone', phone);
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
