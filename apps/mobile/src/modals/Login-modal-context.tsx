// Global, user-initiated login modal. The app remains usable as a guest;
// screens open this modal only when the user taps a login button or requests
// an action that requires authentication.
import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    ReactNode,
} from 'react';
import LoginModal from '@/modals/LoginModal';
import { useAuth } from '@/lib/auth/auth-context';

type LoginModalCtx = {
    requireLogin: (after?: () => void) => boolean;
};

const Ctx = createContext<LoginModalCtx>({
    requireLogin: () => false,
});

export function LoginModalProvider({ children }: { children: ReactNode }) {
    const { isLoggedIn } = useAuth();
    const [open, setOpen] = useState(false);
    const pending = useRef<(() => void) | undefined>(undefined);

    // Called only from an explicit user action.
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

    function handleSuccess() {
        setOpen(false);
        const fn = pending.current;
        pending.current = undefined;
        // Defer until the authenticated state has settled.
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
        </Ctx.Provider>
    );
}

export function useLoginModal() {
    return useContext(Ctx);
}
