import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { getProfile } from '@/utils/profileStorage';
import { saveMyProfileToDB } from '@/utils/dbSync';

const BASE_KEY = 'userRegion';
const COORDS_KEY = 'userRegionCoords';

export type RegionCoords = { latitude: number; longitude: number };

/** Last GPS/IP coords — used to re-label region when language changes */
export const getRegionCoords = (): RegionCoords | null => {
  try {
    const raw = localStorage.getItem(userKey(COORDS_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RegionCoords;
    if (
      typeof parsed?.latitude === 'number' &&
      typeof parsed?.longitude === 'number' &&
      Number.isFinite(parsed.latitude) &&
      Number.isFinite(parsed.longitude)
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
};

export const saveRegionCoords = (coords: RegionCoords): void => {
  try {
    localStorage.setItem(userKey(COORDS_KEY), JSON.stringify(coords));
  } catch {
    /* ignore */
  }
};

export const clearRegionCoords = (): void => {
  localStorage.removeItem(userKey(COORDS_KEY));
};

/** Load saved region — DB 프로필(activity_region) 캐시 우선 */
export const getRegion = (): string => {
  const fromProfile = getProfile().activityRegion?.trim();
  if (fromProfile) return fromProfile;
  return localStorage.getItem(userKey(BASE_KEY)) || '';
};

/** Save selected region to DB + local cache */
export const saveRegion = async (
  region: string,
  coords?: RegionCoords | null,
): Promise<boolean> => {
  const trimmed = region.trim();
  if (!trimmed) return false;

  if (coords) {
    saveRegionCoords(coords);
  } else if (coords === null) {
    clearRegionCoords();
  }

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
  clearRegionCoords();
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
