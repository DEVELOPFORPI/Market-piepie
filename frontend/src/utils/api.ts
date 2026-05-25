/**
 * API client
 * - Dev: same-origin `/api` through Vite proxy.
 * - Production: `VITE_API_URL` / `VITE_API_BASE_URL`, falling back to pie.blindlounge.xyz.
 */

import { getSessionToken } from '@/utils/authStorage';
import { API_BASE } from '@/utils/apiConfig';

export { API_BASE };

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
