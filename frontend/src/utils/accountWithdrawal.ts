/**
 * Local account withdrawal (client-only).
 * Clears this browser’s stored account and app data (no server DB).
 */

import { getCurrentUserId, clearStoredGuestId, clearPersistedPiUser } from '@/utils/authStorage';
import { clearAppStorage } from '@/utils/storageClear';
import { clearDeviceProfileOnce } from '@/utils/onboardingStorage';

const ONBOARDING_PREFIX = 'marketpiepie_onboarding_v1_';

/** Remove localStorage keys scoped to this user id */
function removeUserScopedKeys(userId: string): void {
  const keys = [
    `user_profile_${userId}`,
    `userRegion_${userId}`,
    `${ONBOARDING_PREFIX}${userId}`,
    `unlocked_activity_badges_${userId}`,
  ];
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

/** Withdraw: session, guest id, profile, onboarding, and app data */
export async function withdrawLocalAccount(): Promise<void> {
  const uid = getCurrentUserId();
  if (uid) {
    removeUserScopedKeys(uid);
  }
  clearStoredGuestId();
  clearPersistedPiUser();
  clearDeviceProfileOnce();
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  await clearAppStorage();
}
