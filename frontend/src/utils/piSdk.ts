/**
 * Pi SDK initialization driven by env, never hard-coded in index.html.
 *
 * VITE_PI_SANDBOX:
 *   "true"  → testnet (sandbox = true)   — for `test` branch / dev
 *   "false" → mainnet (sandbox = false)  — for `main` branch
 *   unset   → defaults to true in DEV builds, false in PROD builds (safe default)
 */

type PiInitConfig = { version: string; sandbox?: boolean };

declare global {
  interface Window {
    Pi?: {
      init: (config: PiInitConfig) => void;
      [key: string]: unknown;
    };
  }
}

function resolveSandbox(): boolean {
  const raw = import.meta.env.VITE_PI_SANDBOX;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return import.meta.env.DEV;
}

let initDone = false;

export function initPiSdk(): void {
  if (initDone) return;
  if (typeof window === 'undefined' || !window.Pi || typeof window.Pi.init !== 'function') {
    return;
  }
  const sandbox = resolveSandbox();
  try {
    window.Pi.init({ version: '2.0', sandbox });
    initDone = true;
    console.info(`[Pi SDK] initialized (sandbox=${sandbox})`);
  } catch (e) {
    console.warn('[Pi SDK] init error:', e);
  }
}

/**
 * Some browsers race the SDK <script> tag. Try immediately and again on `load`,
 * so callers can safely do `if (window.Pi)` checks afterwards.
 */
export function bootstrapPiSdk(): void {
  initPiSdk();
  if (initDone) return;
  if (typeof window === 'undefined') return;
  const retry = () => initPiSdk();
  window.addEventListener('load', retry, { once: true });
}
