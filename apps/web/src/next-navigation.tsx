import { useCallback } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: useCallback((to: string, options?: { scroll?: boolean }) => navigate(to), [navigate]),
    replace: useCallback((to: string, options?: { scroll?: boolean }) => navigate(to, { replace: true }), [navigate]),
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
  return useSearchParamsSafe();
}

function useSearchParamsSafe() {
  const [params] = useSearchParamsOriginal();
  return params;
}

import { useSearchParams as useSearchParamsOriginal } from 'react-router-dom';

export function useParamsCompat<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  return useParams() as T;
}

export function redirect(to: string): never {
  window.location.replace(to);
  throw new Error('Navigation redirected');
}
