/* eslint no-undef: "off" */
import { firebaseAuth } from '../firebase';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://clash-api-m5mr.onrender.com/api').replace(/\/$/, '');
const GET_TIMEOUT_MS = 60_000;

export function apiUrl(path: string): string {
  return `${API_BASE_URL}/${path.replace(/^\//, '')}`;
}

export async function apiFetch(path: string, init: RequestInit = {}, authToken?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const isGet = (init.method ?? 'GET').toUpperCase() === 'GET';
  const controller = isGet ? new AbortController() : null;
  const timeout = controller
    ? window.setTimeout(
        () => controller.abort(new DOMException('GET request timed out after 60 seconds', 'TimeoutError')),
        GET_TIMEOUT_MS,
      )
    : null;
  const forwardAbort = () => controller?.abort(init.signal?.reason);
  if (controller && init.signal) {
    if (init.signal.aborted) controller.abort(init.signal.reason);
    else init.signal.addEventListener('abort', forwardAbort, { once: true });
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
    ...(controller ? { signal: controller.signal } : {}),
    cache: init.cache ?? 'no-store',
  };

  try {
    const response = await fetch(apiUrl(path), requestInit);
    if (response.status !== 401 || !firebaseAuth?.currentUser) return response;
    try {
      const refreshedToken = await firebaseAuth.currentUser.getIdToken(true);
      const retryHeaders = new Headers(requestInit.headers);
      retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
      return await fetch(apiUrl(path), { ...requestInit, headers: retryHeaders });
    } catch {
      return response;
    }
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
    init.signal?.removeEventListener('abort', forwardAbort);
  }
}
