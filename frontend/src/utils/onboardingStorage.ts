import { PROFILE_LEGACY_DEFAULT_NICKNAME } from '@/types';
import { getCurrentUserId, isTestPresetUser } from '@/utils/authStorage';
import { isTestLoginEnabled } from '@/config/features';

const ONBOARDING_KEY_PREFIX = 'marketpiepie_onboarding_v1_';
/** Set when this browser has completed signup once; cleared on account withdrawal. */
const DEVICE_PROFILE_ONCE_KEY = 'marketpiepie_device_profile_once_v1';

// ─── Safe localStorage helpers (privacy mode / disabled storage) ────────
function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * Production: whether signup / profile setup is done.
 * Test login mode and user1/user2 presets always count as complete.
 * When logged out (no uid), returns false so welcome/login flows behave correctly.
 */
export function isOnboardingComplete(): boolean {
  if (isTestLoginEnabled()) return true;
  const uid = getCurrentUserId();
  if (!uid) return false;
  if (isTestPresetUser(uid)) return true;
  if (uid.startsWith('guest_')) return true;
  if (safeGet(`${ONBOARDING_KEY_PREFIX}${uid}`) === '1') return true;

  // Users who customized profile before onboarding flag existed
  const raw = safeGet(`user_profile_${uid}`);
  if (raw) {
    try {
      const p = JSON.parse(raw) as { nickname?: string };
      const n = typeof p.nickname === 'string' ? p.nickname.trim() : '';
      if (n && n !== PROFILE_LEGACY_DEFAULT_NICKNAME && n !== 'My nickname') return true;
    } catch { /* ignore parse error */ }
  }
  return false;
}

export function setOnboardingComplete(): void {
  const uid = getCurrentUserId();
  if (!uid) return;
  safeSet(`${ONBOARDING_KEY_PREFIX}${uid}`, '1');
  safeSet(DEVICE_PROFILE_ONCE_KEY, '1');
}

/** True after a profile was created on this device (signup complete). */
export function isDeviceProfileOnce(): boolean {
  return safeGet(DEVICE_PROFILE_ONCE_KEY) === '1';
}

export function clearDeviceProfileOnce(): void {
  safeRemove(DEVICE_PROFILE_ONCE_KEY);
}

/** Legacy: mark device as used if onboarding already complete but flag predates DEVICE_PROFILE_ONCE_KEY. */
export function syncDeviceProfileOnceFromLegacyOnboarding(): void {
  if (isTestLoginEnabled()) return;
  const uid = getCurrentUserId();
  if (!uid || !isOnboardingComplete() || isDeviceProfileOnce()) return;
  safeSet(DEVICE_PROFILE_ONCE_KEY, '1');
}

// ─── Path policies ──────────────────────────────────────────────────────

/** Routes that don't force a redirect to /welcome when onboarding is incomplete. */
const ONBOARDING_EXEMPT_PATHS = new Set([
  '/signup',
  '/welcome',
  '/login-app',
  '/login',
  '/admin-auth',
  '/region/select',
  '/terms',
  '/privacy',
]);

export function isOnboardingExemptPath(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PATHS.has(pathname);
}

/** Exact paths reachable with no user session. */
const UNAUTH_ALLOWED_EXACT = new Set([
  '/welcome',
  '/signup',
  '/login-app',
  '/login',
  '/admin-auth',
  '/terms',
  '/privacy',
]);

/**
 * Routes reachable with no session (after explicit log out).
 * `/admin/*` is allowed because admin pages use a separate password gate (isAdminVerified)
 * independent of the user session.
 */
export function isUnauthenticatedAllowedPath(pathname: string): boolean {
  if (UNAUTH_ALLOWED_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/region')) return true;
  if (pathname.startsWith('/admin')) return true;
  return false;
}
