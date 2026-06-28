import {
  isKnownAppHost,
  MAINNET_APP_URL,
} from '@/constants/appUrls';

const LOCAL_API_BASE = 'http://localhost:4000';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function resolveApiBase(): string {
  const configuredBase =
    import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;

  if (configuredBase?.trim()) {
    const base = normalizeBaseUrl(configuredBase);
    console.log(`API BASE : ${base}`);
    return base;
  }

  // 로컬 dev(Vite proxy) · Vercel 배포(vercel.json /api rewrite) → same-origin
  if (typeof window !== 'undefined' && (import.meta.env.DEV || isKnownAppHost())) {
    console.log('API BASE : (same-origin /api)');
    return '';
  }

  const fallbackBase = import.meta.env.PROD ? MAINNET_APP_URL : LOCAL_API_BASE;
  console.log(`API BASE : ${fallbackBase}`);
  return normalizeBaseUrl(fallbackBase);
}

export const API_BASE = resolveApiBase();
