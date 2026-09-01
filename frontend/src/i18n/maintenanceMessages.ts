export const MAINTENANCE_TITLE = 'Under maintenance';
export const MAINTENANCE_SIGN_IN = 'Sign in';
export const MAINTENANCE_TESTER_BANNER = 'Maintenance is on. You can still use the app.';

export function maintenanceUntilLabel(when: string): string {
  return `Until ${when}`;
}
