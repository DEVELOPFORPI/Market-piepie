const ADMIN_AUTH_KEY = 'pipi_admin_verified_v1';
const ADMIN_PASSWORD_KEY = 'pipi_admin_password_v1';

export function isAdminVerified(): boolean {
  return sessionStorage.getItem(ADMIN_AUTH_KEY) === '1';
}

export function setAdminVerified(verified: boolean): void {
  if (verified) {
    sessionStorage.setItem(ADMIN_AUTH_KEY, '1');
    return;
  }
  sessionStorage.removeItem(ADMIN_AUTH_KEY);
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
}

export function setAdminPassword(password: string): void {
  sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
}

export function getAdminPassword(): string {
  return sessionStorage.getItem(ADMIN_PASSWORD_KEY) || '';
}
