/**
 * Session-based auth: sessionStorage per tab; shared localStorage for seller/buyer demo data.
 * Pi-verified users are persisted in localStorage so sessions survive tab close.
 */

import { API_BASE } from '@/utils/apiConfig';

const AUTH_KEY = 'currentUserId';
const SESSION_TOKEN_KEY = 'marketpiepie_session_token';
export const HOME_PROMO_SHOWN_SESSION_KEY = 'marketpiepie_home_popup_shown_this_session';
/** After explicit log out: skip auto guest login until user taps Log in on welcome. */
const SKIP_IMPLICIT_SESSION_KEY = 'marketpiepie_skip_implicit_session';
/** Production: anonymous device id in localStorage (shared across tabs) */
const GUEST_USER_STORAGE_KEY = 'marketpiepie_guest_user_id';
/** Pi-verified user: persisted across sessions in localStorage */
const PI_USER_KEY = 'marketpiepie_pi_user_id';
const PI_SESSION_TOKEN_KEY = 'marketpiepie_pi_session_token';
const SUSPENDED_ACCOUNT_KEY = 'marketpiepie_account_suspended';

/** Current logged-in user id */
export const getCurrentUserId = (): string | null => {
  return sessionStorage.getItem(AUTH_KEY);
};

export function isSuspendedAccount(): boolean {
  try {
    return sessionStorage.getItem(SUSPENDED_ACCOUNT_KEY) != null;
  } catch {
    return false;
  }
}

export function getSuspensionReason(): string | null {
  try {
    const raw = sessionStorage.getItem(SUSPENDED_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { reason?: string | null };
    return parsed.reason?.trim() || null;
  } catch {
    return null;
  }
}

export function setSuspendedAccount(reason?: string | null): void {
  try {
    sessionStorage.setItem(SUSPENDED_ACCOUNT_KEY, JSON.stringify({ reason: reason || null }));
  } catch {
    /* ignore */
  }
}

export function clearSuspendedAccount(): void {
  try {
    sessionStorage.removeItem(SUSPENDED_ACCOUNT_KEY);
  } catch {
    /* ignore */
  }
}

/** 정지 계정을 게스트 세션으로 내린다. */
export async function enterSuspendedGuestSession(reason?: string | null): Promise<void> {
  setSuspendedAccount(reason);
  if (isGuestUser(getCurrentUserId())) {
    if (!getSessionToken()) {
      await ensureImplicitSession({ allowAutoGuest: true });
    }
    return;
  }
  logout();
  clearImplicitSessionSkip();
  await ensureImplicitSession({ allowAutoGuest: true });
}

/** Log in */
export const login = (userId: string, isPiUser = false) => {
  if (!userId.startsWith('guest_')) clearSuspendedAccount();
  sessionStorage.setItem(AUTH_KEY, userId);
  // Each successful login starts a new popup-viewing session.
  sessionStorage.removeItem(HOME_PROMO_SHOWN_SESSION_KEY);
  if (isPiUser) {
    try { localStorage.setItem(PI_USER_KEY, userId); } catch { /* ignore */ }
  }
  if (!getSessionToken()) {
    requestDevSessionToken(userId);
  }
  // Seed profile on first login
  const profileKey = `user_profile_${userId}`;
  if (!localStorage.getItem(profileKey)) {
    const preset = USER_PRESETS[userId];
    if (preset) {
      localStorage.setItem(profileKey, JSON.stringify(preset));
    }
  }
};

/** Get server session token */
export const getSessionToken = (): string | null => {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
};

/** Store server session token */
export const setSessionToken = (token: string) => {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  if (localStorage.getItem(PI_USER_KEY)) {
    try { localStorage.setItem(PI_SESSION_TOKEN_KEY, token); } catch { /* ignore */ }
  }
};

/** Log out */
export const logout = () => {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  try { localStorage.removeItem(PI_USER_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(PI_SESSION_TOKEN_KEY); } catch { /* ignore */ }
};

/** Log out and block ensureImplicitSession until clearImplicitSessionSkip() (e.g. Switch account). */
export function markExplicitLogout(): void {
  logout();
  try {
    sessionStorage.setItem(SKIP_IMPLICIT_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearImplicitSessionSkip(): void {
  try {
    sessionStorage.removeItem(SKIP_IMPLICIT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function shouldSkipImplicitSession(): boolean {
  return sessionStorage.getItem(SKIP_IMPLICIT_SESSION_KEY) === '1';
}

/** Whether a user is logged in */
export const isLoggedIn = (): boolean => {
  return !!sessionStorage.getItem(AUTH_KEY);
};

export type EnsureImplicitSessionOptions = {
  /**
   * When true: create or reuse device guest if no Pi session (Welcome / AppLogin "Continue as Guest").
   * Default false: do not auto-guest on app load so users always see Welcome first.
   */
  allowAutoGuest?: boolean;
};

/**
 * Refresh session token for an existing tab session, or create/reuse guest when allowed.
 * Does not restore Pi into session automatically — user must pass through Welcome each load.
 */
export const ensureImplicitSession = async (options?: EnsureImplicitSessionOptions): Promise<void> => {
  const allowAutoGuest = options?.allowAutoGuest ?? false;
  if (shouldSkipImplicitSession()) return;

  const existingUser = sessionStorage.getItem(AUTH_KEY);
  if (existingUser) {
    if (!getSessionToken()) {
      await requestDevSessionToken(existingUser);
    }
    return;
  }

  if (!allowAutoGuest) return;

  // 기존 guest 로직
  let guestId: string | null = null;
  try {
    guestId = localStorage.getItem(GUEST_USER_STORAGE_KEY);
    if (!guestId) {
      guestId =
        typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
          ? `guest_${globalThis.crypto.randomUUID()}`
          : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(GUEST_USER_STORAGE_KEY, guestId);
    }
  } catch {
    guestId = `guest_${Date.now()}`;
  }
  const finalId = guestId || `guest_${Date.now()}`;
  login(finalId);
  await requestDevSessionToken(finalId);
};

export async function requestDevSessionToken(userId: string): Promise<{
  accountStatus?: string;
  suspensionReason?: string | null;
}> {
  try {
    const isGuest = userId.startsWith('guest_');
    const preset = USER_PRESETS[userId];
    const url = isGuest ? `${API_BASE}/api/guests/session` : `${API_BASE}/api/auth/dev-login`;
    const body = isGuest
      ? { guestId: userId, deviceId: userId }
      : { userId, nickname: preset?.nickname || 'Guest' };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (data.sessionToken) {
      setSessionToken(data.sessionToken);
      console.log('[auth] session token acquired for', userId);
    }
    return {
      accountStatus: data.accountStatus,
      suspensionReason: data.suspensionReason ?? null,
    };
  } catch {
    console.warn('[auth] session request failed');
    return {};
  }
}

/** Clear stored guest id (e.g. after account deletion) */
export const clearStoredGuestId = (): void => {
  try {
    localStorage.removeItem(GUEST_USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

/** Clear persisted Pi user (e.g. after account deletion) */
export const clearPersistedPiUser = (): void => {
  try {
    localStorage.removeItem(PI_USER_KEY);
    localStorage.removeItem(PI_SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

/** Test bar: user1 / user2 / user3 presets only */
export const isTestPresetUser = (userId: string | null): boolean => {
  return userId === 'user1' || userId === 'user2' || userId === 'user3';
};

/** 현재 유저가 guest인지 (Pi 인증 안 한 유저) */
export const isGuestUser = (userId?: string | null): boolean => {
  const id = userId ?? getCurrentUserId();
  if (!id) return true;
  return id.startsWith('guest_');
};

/** Per-user localStorage key */
export const userKey = (key: string): string => {
  const userId = getCurrentUserId();
  return userId ? `${key}_${userId}` : key;
};

/** Preset demo user profiles */
export const USER_PRESETS: Record<string, {
  nickname: string;
  profileImage: string;
  bio: string;
  activityRegion: string;
}> = {
  user1: {
    nickname: 'Seller Pingoo',
    profileImage: '/default-avatar.jpg',
    bio: 'I value safe, quick trades.',
    activityRegion: '',
  },
  user2: {
    nickname: 'Buyer Pororo',
    profileImage: '/default-avatar.jpg',
    bio: 'Looking for great listings!',
    activityRegion: '',
  },
  user3: {
    nickname: 'Buyer Crong',
    profileImage: '/default-avatar.jpg',
    bio: 'Checking listings nearby.',
    activityRegion: '',
  },
};
