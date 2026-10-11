/* eslint no-undef: "off" */
import { firebaseAuth } from '../firebase';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://clash-api-m5mr.onrender.com/api').replace(/\/$/, '');

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
  const requestInit = { ...init, headers, cache: init.cache ?? 'no-store' as RequestCache };
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
}
