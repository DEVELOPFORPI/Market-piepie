import { getAdminToken } from '@/utils/adminAccessStorage';

/** Backend admin gate: short-lived token issued by /api/admin/login. */
export function adminPasswordHeaders(): Record<string, string> {
  return { 'x-admin-token': getAdminToken() };
}
