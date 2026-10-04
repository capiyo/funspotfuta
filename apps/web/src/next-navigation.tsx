import { useCallback } from 'react';
import {
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: useCallback((to: string, _options?: { scroll?: boolean }) => navigate(to), [navigate]),
    replace: useCallback((to: string, _options?: { scroll?: boolean }) => navigate(to, { replace: true }), [navigate]),
    back: useCallback(() => navigate(-1), [navigate]),
    forward: useCallback(() => navigate(1), [navigate]),
    refresh: useCallback(() => window.location.reload(), []),
    prefetch: useCallback(async (_to: string) => undefined, []),
  };
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

export function redirect(to: string): never {
  window.location.replace(to);
  throw new Error('Navigation redirected');
}
