import { useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from 'react-router-dom';

/**
 * Compatibility layer for the subset of next/navigation used by existing
 * client screens. Keep the returned router object stable between renders,
 * as Next's useRouter result is effectively stable for consumers.
 */
export function useRouter() {
  const navigate = useNavigate();
  return useMemo(() => ({
    push: (to: string, _options?: { scroll?: boolean }) => navigate(to),
    replace: (to: string, _options?: { scroll?: boolean }) => navigate(to, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
    // Vite serves the SPA shell directly; there is no route prefetch step.
    prefetch: async (_to: string) => undefined,
  }), [navigate]);
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  const [params] = useRouterSearchParams();
  return params;
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  return useRouterParams() as T;
}

/** Compatibility for synchronous redirects in legacy client-side code. */
export function redirect(to: string): never {
  window.location.replace(to);
  throw new Error('Navigation redirected');
}
