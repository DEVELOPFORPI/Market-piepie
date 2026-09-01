import { api } from '@/utils/api';

export type MaintenancePublic = {
  enabled: boolean;
  allowed: boolean;
  title: string;
  message: string;
  until: string | null;
};

const EMPTY: MaintenancePublic = {
  enabled: false,
  allowed: false,
  title: '',
  message: '',
  until: null,
};

let cached: MaintenancePublic = EMPTY;

export function getCachedMaintenance(): MaintenancePublic {
  return cached;
}

export function setCachedMaintenance(next: Partial<MaintenancePublic>): MaintenancePublic {
  cached = {
    enabled: Boolean(next.enabled),
    allowed: Boolean(next.allowed),
    title: String(next.title || ''),
    message: String(next.message || ''),
    until: next.until ? String(next.until) : null,
  };
  window.dispatchEvent(new CustomEvent('appMaintenance', { detail: cached }));
  return cached;
}

export async function fetchMaintenanceStatus(): Promise<MaintenancePublic> {
  const res = await api.get<MaintenancePublic>('/api/maintenance');
  if (!res.ok || !res.data) return cached;
  return setCachedMaintenance(res.data);
}

export const MAINTENANCE_EXEMPT_PATHS = new Set([
  '/welcome',
  '/login-app',
  '/admin-auth',
  '/terms',
  '/privacy',
]);

export function isMaintenanceExemptPath(pathname: string): boolean {
  if (MAINTENANCE_EXEMPT_PATHS.has(pathname)) return true;
  return pathname === '/admin' || pathname.startsWith('/admin/');
}
