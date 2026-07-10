import {
  isKnownAppHost,
  MAINNET_APP_URL,
} from '@/constants/appUrls';

const LOCAL_API_BASE = 'http://localhost:4000';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function resolveApiBase(): string {
  // Vercel(및 로컬 dev): 항상 same-origin /api — VITE_API_URL 이 있어도 직접 백엔드 호출 금지(429)
  if (typeof window !== 'undefined' && (import.meta.env.DEV || isKnownAppHost())) {
    const configuredBase =
      import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;
    if (configuredBase?.trim()) {
      console.warn(
        '[api] VITE_API_URL is set but ignored on this host; using same-origin /api to avoid rate limits.',
      );
    }
    console.log('API BASE : (same-origin /api)');
    // #region agent log
    fetch('http://127.0.0.1:7863/ingest/715ac1de-3796-4756-9d9b-57f74ad3b63b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0a2150'},body:JSON.stringify({sessionId:'0a2150',hypothesisId:'H1',location:'apiConfig.ts:resolveApiBase',message:'api base resolved',data:{mode:'same-origin',host:window.location.hostname,hadViteApiUrl:!!configuredBase?.trim()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return '';
  }

  const configuredBase =
    import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;

  if (configuredBase?.trim()) {
    const base = normalizeBaseUrl(configuredBase);
    console.log(`API BASE : ${base}`);
    // #region agent log
    fetch('http://127.0.0.1:7863/ingest/715ac1de-3796-4756-9d9b-57f74ad3b63b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0a2150'},body:JSON.stringify({sessionId:'0a2150',hypothesisId:'H1',location:'apiConfig.ts:resolveApiBase',message:'api base resolved',data:{mode:'direct',base},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return base;
  }

  const fallbackBase = import.meta.env.PROD ? MAINNET_APP_URL : LOCAL_API_BASE;
  console.log(`API BASE : ${fallbackBase}`);
  return normalizeBaseUrl(fallbackBase);
}

export const API_BASE = resolveApiBase();
