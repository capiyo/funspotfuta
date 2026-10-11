/* eslint no-undef: "off" */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { firebaseAuth } from '../firebase';

type AuthState = {
  isInitialized: boolean;
  isLoggedIn: boolean;
  userId: string | null;
  username: string | null;
  phone: string | null;
  authToken: string | null;
  login: (userId: string, username: string, authToken: string, phone?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<Omit<AuthState, 'login' | 'logout'>>({
    isInitialized: false, isLoggedIn: false, userId: null, username: null, phone: null, authToken: null,
  });

  useEffect(() => {
    try {
      const token = localStorage.getItem('usertoken');
      const rawUser = localStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      const userId = user?.id ?? user?.userId ?? user?._id ?? null;
      setState({
        isInitialized: true, isLoggedIn: Boolean(token && userId),
        userId: userId ? String(userId) : null,
        username: user?.username ?? user?.name ?? null,
        phone: localStorage.getItem('phone') ?? user?.phone ?? null,
        authToken: token,
      });
    } catch {
      setState({ isInitialized: true, isLoggedIn: false, userId: null, username: null, phone: null, authToken: null });
    }
  }, []);

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
        // Keep the persisted backend session if Firebase cannot refresh this token.
      }
    });
  }, []);

  const login = useCallback((userId: string, username: string, authToken: string, phone?: string) => {
    localStorage.setItem('usertoken', authToken);
    localStorage.setItem('user', JSON.stringify({ id: userId, username, phone: phone ?? '' }));
    localStorage.setItem('isLoggedIn', 'true');
    if (phone) localStorage.setItem('phone', phone);
    setState({ isInitialized: true, isLoggedIn: true, userId, username, phone: phone ?? null, authToken });
  }, []);

  const logout = useCallback(() => {
    queryClient.clear();
    if (firebaseAuth) void signOut(firebaseAuth).catch(() => undefined);
    ['usertoken','user','isLoggedIn','userId','username','phone','refreshToken','userBets','userProfile','availableGames','notifications','notificationCount','cachedPosts','cachedFixtures','lastCarouselFetch','forceNewUser','comrades','channels','votes','messages'].forEach((key) => localStorage.removeItem(key));
    setState({ isInitialized: true, isLoggedIn: false, userId: null, username: null, phone: null, authToken: null });
  }, [queryClient]);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
