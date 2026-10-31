/* eslint no-undef: "off" */
import { firebaseAuth } from '../firebase';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://clash-api-m5mr.onrender.com/api').replace(/\/$/, '');
const GET_TIMEOUT_MS = 60_000;

export function apiUrl(path: string): string {
  return `${API_BASE_URL}/${path.replace(/^\//, '')}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, externalSignal?: AbortSignal): Promise<Response> {
  const isGet = (init.method ?? 'GET').toUpperCase() === 'GET';
  if (!isGet) {
    return fetch(url, {
      ...init,
      ...(externalSignal ? { signal: externalSignal } : {}),
      cache: init.cache ?? 'no-store',
    });
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort(new DOMException('GET request timed out after 60 seconds', 'TimeoutError'));
  }, GET_TIMEOUT_MS);
  const forwardAbort = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) controller.abort(externalSignal.reason);
  else externalSignal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: init.cache ?? 'no-store',
    });
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', forwardAbort);
  }
}

export async function apiFetch(path: string, init: RequestInit = {}, authToken?: string): Promise<Response> {
  const url = apiUrl(path);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  // Public GET endpoints must work for guests; never emit an empty Authorization header.
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
    cache: init.cache ?? 'no-store',
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(url, requestInit, init.signal ?? undefined);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[apiFetch] ${requestInit.method ?? 'GET'} ${url} failed`, {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
    }
    throw error;
  }

  if (response.status !== 401 || !firebaseAuth?.currentUser) return response;

  try {
    const refreshedToken = await firebaseAuth.currentUser.getIdToken(true);
    const retryHeaders = new Headers(headers);
    retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
    // Each attempt gets a fresh timeout controller; a prior abort cannot poison a retry.
    return await fetchWithTimeout(url, { ...requestInit, headers: retryHeaders }, init.signal ?? undefined);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[apiFetch] auth-refresh retry for ${url} failed`, {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
    }
    if (init.signal?.aborted) throw error;
    return response;
  }
}
