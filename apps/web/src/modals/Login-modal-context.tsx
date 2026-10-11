import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import LoginModal from '@/modals/LoginModal';
import { useAuth } from '@/lib/auth/auth-context';

type LoginModalCtx = { requireLogin: (after?: () => void) => boolean };
const Ctx = createContext<LoginModalCtx>({ requireLogin: () => false });

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | undefined>(undefined);

  const requireLogin = useCallback((after?: () => void): boolean => {
    if (isLoggedIn) {
      after?.();
      return true;
    }
    pending.current = after;
    setOpen(true);
    return false;
  }, [isLoggedIn]);

  function handleSuccess() {
    setOpen(false);
    const action = pending.current;
    pending.current = undefined;
    if (action) queueMicrotask(action);
  }

  function handleClose() {
    setOpen(false);
    pending.current = undefined;
  }

  return <Ctx.Provider value={{ requireLogin }}>
    {children}
    <LoginModal visible={open} onClose={handleClose} onSuccess={handleSuccess} />
  </Ctx.Provider>;
}

export function useLoginModal() {
  return useContext(Ctx);
}
