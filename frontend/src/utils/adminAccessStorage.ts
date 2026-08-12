const ADMIN_AUTH_KEY = 'pipi_admin_verified_v1';
const ADMIN_TOKEN_KEY = 'pipi_admin_token_v1';
/** Older builds kept the raw admin password here; purge it on load. */
const LEGACY_ADMIN_PASSWORD_KEY = 'pipi_admin_password_v1';

try {
  sessionStorage.removeItem(LEGACY_ADMIN_PASSWORD_KEY);
} catch {
  /* sessionStorage unavailable */
}

export function isAdminVerified(): boolean {
  return sessionStorage.getItem(ADMIN_AUTH_KEY) === '1' && !!getAdminToken();
}

export function setAdminVerified(verified: boolean): void {
  if (verified) {
    sessionStorage.setItem(ADMIN_AUTH_KEY, '1');
    return;
  }
  sessionStorage.removeItem(ADMIN_AUTH_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getAdminToken(): string {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}
