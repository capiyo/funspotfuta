import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import LoginModal from '@/modals/LoginModal';
import { useAuth } from '@/lib/auth/auth-context';

type LoginModalCtx = { requireLogin: (after?: () => void) => boolean };
const Ctx = createContext<LoginModalCtx>({ requireLogin: () => false });

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | undefined>(undefined);
  const wasLoggedIn = useRef(isLoggedIn);

  const requireLogin = useCallback((after?: () => void): boolean => {
    if (isLoggedIn) {
      after?.();
      return true;
    }
    pending.current = after;
    setOpen(true);
    return false;
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && !wasLoggedIn.current) {
      setOpen(false);
      const action = pending.current;
      pending.current = undefined;
      if (action) queueMicrotask(action);
    }
    wasLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  return <Ctx.Provider value={{ requireLogin }}>
    {children}
    {open && <div role="dialog" aria-modal="true" aria-label="Sign in" className="login-modal-overlay">
      <button type="button" aria-label="Close sign in" className="login-modal-backdrop" onClick={() => { setOpen(false); pending.current = undefined; }} />
      <div className="login-modal-content"><LoginModal /></div>
    </div>}
  </Ctx.Provider>;
}

export function useLoginModal() {
  return useContext(Ctx);
}
