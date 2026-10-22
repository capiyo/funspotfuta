import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import LoginModal from '@/modals/LoginModal';
import NotificationGate from '@/modals/NotificationGate';
import { useAuth } from '@/lib/auth/auth-context';

type LoginModalCtx = { requireLogin: (after?: () => void) => boolean };
const Ctx = createContext<LoginModalCtx>({ requireLogin: () => false });

/**
 * Global browser equivalent of the mobile login gate.
 * Auth must be initialized before the notification gate appears; the login
 * modal and notification gate are mounted here so any screen can request login.
 */
export function LoginModalProvider({ children }: { children: ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [gated, setGated] = useState(false);
  const pending = useRef<(() => void) | undefined>(undefined);
  const wasLoggedIn = useRef(isLoggedIn);
  const autoPrompted = useRef(false);

  const requireLogin = useCallback((after?: () => void): boolean => {
    if (isLoggedIn) {
      after?.();
      return true;
    }
    pending.current = after;
    setOpen(true);
    setGated(false);
    return false;
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isInitialized) return;
    if (isLoggedIn) {
      autoPrompted.current = false;
      setGated(false);
      setOpen(false);
      return;
    }
    if (autoPrompted.current || open) return;
    autoPrompted.current = true;

    // Browser permission persists across launches. Never show the gate again
    // when the browser already reports notifications as granted.
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setGated(false);
      setOpen(true);
      return;
    }
    setGated(true);
  }, [isInitialized, isLoggedIn, open]);

  useEffect(() => {
    if (isLoggedIn && !wasLoggedIn.current) {
      setOpen(false);
      setGated(false);
      const action = pending.current;
      pending.current = undefined;
      if (action) queueMicrotask(action);
    }
    wasLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  const handleGateContinue = useCallback(async () => {
    setGated(false);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    pending.current = undefined;
  }, []);

  return (
    <Ctx.Provider value={{ requireLogin }}>
      {children}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Sign in" className="login-modal-overlay">
          <button type="button" aria-label="Close sign in" className="login-modal-backdrop" onClick={handleClose} />
          <div className="login-modal-content"><LoginModal /></div>
        </div>
      )}
      <NotificationGate visible={gated} onRetry={handleGateContinue} />
    </Ctx.Provider>
  );
}

export function useLoginModal() {
  return useContext(Ctx);
}
