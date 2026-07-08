import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { getProfile } from '@/utils/profileStorage';
import { saveMyProfileToDB } from '@/utils/dbSync';

const BASE_KEY = 'userRegion';

/** Load saved region — DB 프로필(activity_region) 캐시 우선 */
export const getRegion = (): string => {
  const fromProfile = getProfile().activityRegion?.trim();
  if (fromProfile) return fromProfile;
  return localStorage.getItem(userKey(BASE_KEY)) || '';
};

/** Save selected region to DB + local cache */
export const saveRegion = async (region: string): Promise<boolean> => {
  const trimmed = region.trim();
  if (!trimmed) return false;

  try {
    localStorage.setItem(userKey(BASE_KEY), trimmed);
  } catch {
    // ignore quota
  }

  const profile = getProfile();
  const updatedProfile = { ...profile, activityRegion: trimmed };
  try {
    localStorage.setItem(userKey('user_profile'), JSON.stringify(updatedProfile));
  } catch {
    // ignore
  }

  const userId = getCurrentUserId();
  if (userId) {
    const ok = await saveMyProfileToDB(userId, {
      nickname: profile.nickname || 'My nickname',
      bio: profile.bio,
      profileImage: profile.profileImage,
      activityRegion: trimmed,
    });
    if (!ok) return false;
    window.dispatchEvent(new Event('profileSaved'));
  }

  window.dispatchEvent(new Event('regionChanged'));
  return true;
};

/** Clear saved region */
export const clearRegion = () => {
  localStorage.removeItem(userKey(BASE_KEY));
  const profile = getProfile();
  if (profile.activityRegion) {
    try {
      localStorage.setItem(
        userKey('user_profile'),
        JSON.stringify({ ...profile, activityRegion: '' }),
      );
    } catch {
      // ignore
    }
  }
};
