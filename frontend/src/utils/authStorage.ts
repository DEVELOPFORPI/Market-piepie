/**
 * Session-based auth: sessionStorage per tab; shared localStorage for seller/buyer demo data.
 * Pi-verified users are persisted in localStorage so sessions survive tab close.
 */

const AUTH_KEY = 'currentUserId';
const SESSION_TOKEN_KEY = 'marketpiepie_session_token';
/** After explicit log out: skip auto guest login until user taps Log in on welcome. */
const SKIP_IMPLICIT_SESSION_KEY = 'marketpiepie_skip_implicit_session';
/** Production: anonymous device id in localStorage (shared across tabs) */
const GUEST_USER_STORAGE_KEY = 'marketpiepie_guest_user_id';
/** Pi-verified user: persisted across sessions in localStorage */
const PI_USER_KEY = 'marketpiepie_pi_user_id';
const PI_SESSION_TOKEN_KEY = 'marketpiepie_pi_session_token';

/** Current logged-in user id */
export const getCurrentUserId = (): string | null => {
  return sessionStorage.getItem(AUTH_KEY);
};

/** Log in */
export const login = (userId: string, isPiUser = false) => {
  sessionStorage.setItem(AUTH_KEY, userId);
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

/**
 * Full document load: drop tab session only so every app open starts at Welcome.
 * Pi/guest device hints stay in localStorage until the user chooses Pi / Guest / local test again.
 */
export function resetSessionOnAppLoad(): void {
  try {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

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

async function requestDevSessionToken(userId: string): Promise<void> {
  try {
    const r = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, nickname: 'Guest' }),
    });
    const data = await r.json();
    if (data.sessionToken) {
      setSessionToken(data.sessionToken);
      console.log('[auth] dev session token acquired for', userId);
    }
  } catch {
    console.warn('[auth] dev-login failed');
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

/** Test bar: user1 / user2 presets only */
export const isTestPresetUser = (userId: string | null): boolean => {
  return userId === 'user1' || userId === 'user2';
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
};
