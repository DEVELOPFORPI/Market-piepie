/**
 * Feature flags (Vite env)
 *
 * Test login UI (Welcome 로컬계정, test user bar, etc.) — **never** in production builds.
 *
 * Development only:
 * - VITE_ENABLE_TEST_LOGIN=true  → force ON
 * - VITE_ENABLE_TEST_LOGIN=false → force OFF
 * - unset → ON while `import.meta.env.DEV`
 */
export function isTestLoginEnabled(): boolean {
  if (import.meta.env.PROD) return false;
  const v = import.meta.env.VITE_ENABLE_TEST_LOGIN;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return import.meta.env.DEV;
}
