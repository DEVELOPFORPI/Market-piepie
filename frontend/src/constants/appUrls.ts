/** Vercel 프론트 — 메인넷 */
export const MAINNET_APP_URL = 'https://marketpiepie.vercel.app';
export const MAINNET_APP_HOST = 'marketpiepie.vercel.app';

/** Vercel 프론트 — 테스트넷 */
export const TESTNET_APP_URL = 'https://marketpiepietest.vercel.app';
export const TESTNET_APP_HOST = 'marketpiepietest.vercel.app';

export function isTestnetAppHost(hostname?: string): boolean {
  const host =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  return host === TESTNET_APP_HOST;
}

export function isMainnetAppHost(hostname?: string): boolean {
  const host =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  return host === MAINNET_APP_HOST;
}

export function isKnownAppHost(hostname?: string): boolean {
  return isTestnetAppHost(hostname) || isMainnetAppHost(hostname);
}
