// lib/auth/login-modal-context.tsx
//
// Global login gate — mirrors main.dart's _onAuthStateChanged flow:
//   - logged out (and auth has finished initializing) -> check notification
//     permission -> if missing, block with a gate (caller must grant) ->
//     then auto-open LoginModal
//   - any screen can also call `requireLogin(after?)` on-demand:
//       - already logged in -> runs `after` immediately, returns true
//       - not logged in -> opens LoginModal, remembers `after`, returns false
//   - after a successful login, the remembered action re-runs, and we
//     request/register the FCM token (mirrors initializeFCM's post-login
//     registerToken call)
//
// LoginModal is mounted once, here, so it can render over any screen.
import { Platform } from 'react-native';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    ReactNode,
} from 'react';
import LoginModal from '@/modals/LoginModal';
import NotificationGate from '@/modals/NotificationGate';
import { useAuth } from '@/lib/auth/auth-context';
import { requestNotificationPermission, requestFcmToken } from '@/lib/firebase';
import { registerToken } from '@funspot/core';

type LoginModalCtx = {
    requireLogin: (after?: () => void) => boolean;
};

const Ctx = createContext<LoginModalCtx>({
    requireLogin: () => false,
});

export function LoginModalProvider({ children }: { children: ReactNode }) {
    const { isLoggedIn, isInitialized, userId, authToken } = useAuth();
    const [open, setOpen] = useState(false);
    const [gated, setGated] = useState(false); // true while waiting on notification permission
    const pending = useRef<(() => void) | undefined>(undefined);
    const autoPromptedRef = useRef(false); // avoid re-triggering the gate every render

    // ── On-demand gate (called by screens) ─────────────────────
    const requireLogin = useCallback(
        (after?: () => void): boolean => {
            if (isLoggedIn) {
                after?.();
                return true;
            }
            pending.current = after;
            setOpen(true);
            return false;
        },
        [isLoggedIn],
    );

    // ── Auto-open on logout, gated behind notification permission ──
    // Mirrors _onAuthStateChanged -> _showLoginModalAsOverlay in main.dart.
    useEffect(() => {
        if (!isInitialized) return; // wait for AsyncStorage hydration
        if (isLoggedIn) {
            autoPromptedRef.current = false;
            setGated(false);
            return;
        }
        if (open || autoPromptedRef.current) return;

        autoPromptedRef.current = true;

        (async () => {
            const granted = await requestNotificationPermission();
            if (granted) {
                setOpen(true);
            } else {
                // Block here rather than silently skipping — matches the Dart
                // gate dialog that requires the user to grant before proceeding.
                setGated(true);
            }
        })();
    }, [isLoggedIn, isInitialized, open]);

    async function handleRetryPermission() {
        const granted = await requestNotificationPermission();
        if (granted) {
            setGated(false);
            setOpen(true);
        }
    }

    // ── Post-login: register FCM token, then run pending action ──
    async function handleSuccess() {
        setOpen(false);
        setGated(false);

        if (userId) {
            const token = await requestFcmToken();
            if (token) {
                const fcmToken = token; // narrows string | null -> string
                try {
                    await registerToken({
                        userId,
                        fcmToken,
                        platform: Platform.OS === 'ios' ? 'ios' : 'android',
                        authToken: authToken ?? undefined,
                    });
                } catch (e) {
                    console.error('FCM token registration failed:', e);
                }
            }
        }

        const fn = pending.current;
        pending.current = undefined;
        // defer so state settles before the action runs
        if (fn) setTimeout(fn, 0);
    }

    function handleClose() {
        setOpen(false);
        pending.current = undefined;
    }

    return (
        <Ctx.Provider value={{ requireLogin }}>
            {children}
            <LoginModal visible={open} onClose={handleClose} onSuccess={handleSuccess} />
            <NotificationGate visible={gated} onRetry={handleRetryPermission} />
        </Ctx.Provider>
    );
}

export function useLoginModal() {
    return useContext(Ctx);
}