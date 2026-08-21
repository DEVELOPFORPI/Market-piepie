/**
 * API client
 * - Dev: same-origin `/api` through Vite proxy.
 * - Production: `VITE_API_URL` / `VITE_API_BASE_URL`, or same-origin on Vercel
 *   (marketpiepie.vercel.app / marketpiepietest.vercel.app).
 */

import { getSessionToken } from '@/utils/authStorage';
import { setAdminVerified } from '@/utils/adminAccessStorage';
import { API_BASE } from '@/utils/apiConfig';

export { API_BASE };

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  status: number;
}

/** 429 수신 후 잠시 요청 자제 — 폴링/재시도 폭주 방지 */
let rateLimitedUntil = 0;

export function isApiRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  baseUrl = API_BASE,
): Promise<ApiResponse<T>> {
  if (Date.now() < rateLimitedUntil) {
    return { ok: false, error: 'Rate limited (cooldown)', status: 429 };
  }

  const timeoutController = new AbortController();
  const timeout = window.setTimeout(() => timeoutController.abort(), 20_000);
  try {
    const authHeaders: Record<string, string> = {};
    const token = getSessionToken();
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: options.signal ?? timeoutController.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    });

    if (res.status === 429) {
      rateLimitedUntil = Date.now() + 30_000;
    }

    // Admin tokens expire after a couple of hours; drop the session so the
    // route guard sends the operator back to the admin login screen.
    if (res.status === 401 && path.startsWith('/api/admin/') && path !== '/api/admin/login') {
      setAdminVerified(false);
    }

    const data = await res.json().catch(() => null);

    if (data?.error === 'Account suspended') {
      void import('@/utils/guestGate').then(({ applySuspendedAccess }) => {
        void applySuspendedAccess(undefined, { prompt: false });
      });
    }

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
  } finally {
    window.clearTimeout(timeout);
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

  /** 서버 연결 상태 확인 (캐시 우회 — 모바일에서 옛 실패 응답 붙잡는 것 방지) */
  health: () =>
    request<{ ok: boolean; service: string; db: string }>(
      `/api/health?_=${Date.now()}`,
      { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } },
      '', // Vercel /api rewrite 사용: 직접 백엔드 호출의 IP rate-limit(429) 방지
    ),
};
