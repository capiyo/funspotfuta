import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

  const login = useCallback((userId: string, username: string, authToken: string, phone?: string) => {
    localStorage.setItem('usertoken', authToken);
    localStorage.setItem('user', JSON.stringify({ id: userId, username, phone: phone ?? '' }));
    localStorage.setItem('isLoggedIn', 'true');
    if (phone) localStorage.setItem('phone', phone);
    setState({ isInitialized: true, isLoggedIn: true, userId, username, phone: phone ?? null, authToken });
  }, []);

  const logout = useCallback(() => {
    ['usertoken','user','isLoggedIn','userId','username','phone','refreshToken','userBets','userProfile','availableGames','notifications','notificationCount','cachedPosts','cachedFixtures','lastCarouselFetch','forceNewUser','comrades','channels','votes','messages'].forEach((key) => localStorage.removeItem(key));
    setState({ isInitialized: true, isLoggedIn: false, userId: null, username: null, phone: null, authToken: null });
  }, []);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
