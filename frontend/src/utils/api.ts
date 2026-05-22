/**
 * API 클라이언트
 * 개발: http://localhost:4000
 * 프로덕션: VITE_API_URL 환경변수로 설정
 */

import { getSessionToken } from '@/utils/authStorage';

const raw = import.meta.env.VITE_API_URL;
let _base = raw === undefined ? 'http://localhost:4000' : raw;
/** Dev: same-origin `/api` → Vite proxy (see vite.config). Avoids browser CORS when opening the app from LAN / Pi Browser while `dev-login` already uses relative `/api`. */
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  _base = '';
}
if (typeof window !== 'undefined' && window.location.protocol === 'https:' && _base.startsWith('http:')) {
  _base = '';
}
export const API_BASE = _base;

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  status: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const authHeaders: Record<string, string> = {};
    const token = getSessionToken();
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      // Spread options first so caller-provided body/method/etc. apply,
      // then overwrite headers with the merged set (otherwise spreading
      // options after would clobber Content-Type when caller passes headers).
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    });

    const data = await res.json().catch(() => null);

    return {
      ok: res.ok,
      data: res.ok ? (data as T) : undefined,
      error: !res.ok ? (data?.error ?? `HTTP ${res.status}`) : undefined,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
      status: 0,
    };
  }
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'DELETE' }),

  /** 서버 연결 상태 확인 */
  health: () =>
    request<{ ok: boolean; service: string; db: string }>('/api/health'),
};
