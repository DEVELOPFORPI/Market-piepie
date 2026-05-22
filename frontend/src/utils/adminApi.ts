import { getAdminPassword } from '@/utils/adminAccessStorage';

/** Backend admin gate: send the password entered on the admin login screen. */
export function adminPasswordHeaders(): Record<string, string> {
  return { 'x-admin-password': getAdminPassword() };
}
