import { ORDER_STATUS_VALUE, isPlaceholderNickname } from '@/types';
import { getCurrentUserId, userKey } from '@/utils/authStorage';
import { getItem } from '@/utils/heavyStorage';
import { saveMyProfileToDB } from '@/utils/dbSync';
import { getReceivedReviews } from '@/utils/reviewStorage';
import { getUnlockedBadgeIds } from '@/utils/activityBadgeStorage';
import { computeUnlockedActivityBadgeIds } from '@/utils/activityBadgeRules';

const BASE_KEY = 'user_profile';

export interface StoredProfile {
  profileImage?: string;
  nickname?: string;
  bio?: string;
  activityRegion?: string;
  /** Featured activity badge id (01–14) for profile card; must be unlocked */
  displayActivityBadgeId?: string;
  /** Last real photo, restored when a badge avatar is cleared */
  lastProfilePhoto?: string;
}

const defaultProfile: StoredProfile = {
  profileImage: '/default-avatar.jpg',
  nickname: 'My nickname',
  bio: 'I value safe, quick trades.',
  activityRegion: '',
};

export const getProfile = (): StoredProfile => {
  try {
    const key = userKey(BASE_KEY);
    const raw = localStorage.getItem(key);
    if (!raw) return { ...defaultProfile };
    const parsed = JSON.parse(raw) as StoredProfile;
    return { ...defaultProfile, ...parsed };
  } catch {
    return { ...defaultProfile };
  }
};

/** Stored profile by user id (e.g. seller avatar on listing) */
export const getProfileByUserId = (userId: string): StoredProfile | null => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${BASE_KEY}_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProfile;
    return { ...defaultProfile, ...parsed };
  } catch {
    return null;
  }
};

export function activityBadgeAvatarUrl(badgeId: string): string {
  return `/Batch/${badgeId}.svg`;
}

/** Stored/embedded photo only — overlay badge is separate */
export function resolveProfileAvatarUrl(
  userId: string | undefined | null,
  embeddedProfileImage: string | undefined | null
): string {
  if (userId) {
    const stored = getProfileByUserId(userId)?.profileImage;
    if (stored != null && String(stored).trim() !== '') return stored;
  }
  if (embeddedProfileImage != null && String(embeddedProfileImage).trim() !== '') {
    return embeddedProfileImage;
  }
  return '/default-avatar.jpg';
}

/** Keep a usable photo so clearing a badge avatar can restore it */
export function rememberLastProfilePhoto(url: string | undefined | null): string | undefined {
  if (!url || isProfileImageActivityBadge(url)) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed || trimmed === '/default-avatar.jpg') return undefined;
  return trimmed;
}

/** Badge id if the profile image itself is an activity badge SVG */
export function profileImageToBadgeId(url: string | undefined | null): string | null {
  if (typeof url !== 'string') return null;
  const match = url.match(/^\/Batch\/(0[1-9]|1[0-4])\.svg$/i);
  return match ? match[1] : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/** DB에서 받은 사용자 row → 로컬 프로필 캐시 (닉네임·아바타 최신화) */
export function cacheUserProfileFromRow(
  userId: string,
  row: Record<string, unknown> | undefined | null,
): void {
  if (!userId || !row) return;
  const nickname = String(row.nickname || '');
  const isUsable =
    nickname.trim() !== '' &&
    nickname !== userId &&
    !isPlaceholderNickname(nickname) &&
    !nickname.startsWith('guest_') &&
    !UUID_RE.test(nickname);
  if (!isUsable) return;

  const existing = getProfileByUserId(userId) || {};
  try {
    localStorage.setItem(
      `${BASE_KEY}_${userId}`,
      JSON.stringify({
        ...existing,
        nickname,
        profileImage:
          row.profile_image != null && String(row.profile_image).trim() !== ''
            ? String(row.profile_image)
            : existing.profileImage,
        bio: row.bio != null ? String(row.bio) : existing.bio,
        activityRegion:
          row.activity_region != null ? String(row.activity_region) : existing.activityRegion,
        displayActivityBadgeId:
          row.display_activity_badge_id != null
            ? String(row.display_activity_badge_id).trim() || undefined
            : existing.displayActivityBadgeId,
      }),
    );
  } catch {
    // quota 등 무시
  }
}

/** DB 프로필 캐시로 사용자 스냅샷 보강 (닉네임·아바타) */
export function applyProfileCacheToUser<T extends { id: string; nickname?: string; profileImage?: string }>(
  user: T,
): T {
  if (!user.id) return user;
  const cached = getProfileByUserId(user.id);
  return {
    ...user,
    nickname: cached?.nickname || user.nickname,
    profileImage: resolveProfileAvatarUrl(user.id, user.profileImage),
  };
}

/** Resolve a human-friendly nickname: DB 캐시 우선, embedded 스냅샷은 폴백 */
export function resolveDisplayNickname(
  userId: string | undefined | null,
  embeddedNickname: string | undefined | null
): string {
  const isUsable = (s: string | undefined | null): s is string =>
    typeof s === 'string' && s.trim() !== '' && !UUID_RE.test(s) && !s.startsWith('guest_');

  if (userId) {
    const stored = getProfileByUserId(userId)?.nickname;
    if (isUsable(stored)) return stored;
  }

  if (isUsable(embeddedNickname)) return embeddedNickname;

  const raw = String(embeddedNickname ?? '');
  if (raw.trim() !== '') {
    return raw.slice(0, 8) + '…';
  }
  return 'User';
}

export const saveProfile = async (profile: StoredProfile): Promise<boolean> => {
  const userId = getCurrentUserId();
  if (!userId) return false;
  const merged = { ...getProfile(), ...profile };
  const ok = await saveMyProfileToDB(userId, {
    nickname: isPlaceholderNickname(merged.nickname) ? undefined : merged.nickname,
    bio: merged.bio,
    profileImage: merged.profileImage,
    activityRegion: merged.activityRegion,
    displayActivityBadgeId: merged.displayActivityBadgeId ?? '',
  });
  if (!ok) return false;
  const key = userKey(BASE_KEY);
  localStorage.setItem(key, JSON.stringify(merged));
  localStorage.setItem(`${BASE_KEY}_${userId}`, JSON.stringify(merged));
  window.dispatchEvent(new Event('profileSaved'));
  window.dispatchEvent(new Event('userProfilesChanged'));
  return true;
};

/** True if profile image is activity badge SVG (`/Batch/xx.svg`) */
export function isProfileImageActivityBadge(url: string | undefined | null): boolean {
  return typeof url === 'string' && url.startsWith('/Batch/') && /\.svg$/i.test(url);
}

/** Keep overlay when unlocked store drifts from recomputed stats (local testing) */
function isUnlockedActivityBadgeForUser(userId: string, id: string): boolean {
  if (computeUnlockedActivityBadgeIds(userId).includes(id)) return true;
  if (getCurrentUserId() === userId && getUnlockedBadgeIds().has(id)) return true;
  return false;
}

/** Avatar img class: badge = contain + white bg; photos = cover */
export function profileAvatarObjectClass(url: string | undefined | null): string {
  return isProfileImageActivityBadge(url)
    ? 'w-full h-full object-contain bg-white'
    : 'w-full h-full object-cover';
}

/** Featured activity badge for profile card, or null */
export function getDisplayActivityBadgeId(): string | null {
  const v = getProfile().displayActivityBadgeId;
  return v && typeof v === 'string' && v.length > 0 ? v : null;
}

/** Overlay only when user set featured badge in Activity badges (not just using badge as photo) */
export function getEffectiveDisplayActivityBadgeIdForUser(
  userId: string | null | undefined
): string | null {
  if (!userId) return null;

  const prof = getProfileByUserId(userId);
  const mine = getCurrentUserId() === userId;
  const displayStored =
    prof?.displayActivityBadgeId ?? (mine ? getProfile().displayActivityBadgeId : undefined);

  if (typeof displayStored !== 'string' || displayStored.length === 0) return null;
  if (mine && !isUnlockedActivityBadgeForUser(userId, displayStored)) return null;
  return displayStored;
}

/** Set featured badge; ignores locked ids. Tap same id again to clear. */
export function setDisplayActivityBadgeId(next: string | null): void {
  const profile = getProfile();
  if (next) {
    if (!getUnlockedBadgeIds().has(next)) return;
    const same = profile.displayActivityBadgeId === next;
    void saveProfile({
      ...profile,
      displayActivityBadgeId: same ? undefined : next,
    });
  } else {
    void saveProfile({ ...profile, displayActivityBadgeId: undefined });
  }
  window.dispatchEvent(new Event('profileDisplayBadgeChanged'));
}

/** Clear featured badge if it is no longer unlocked */
export function pruneInvalidDisplayActivityBadge(): void {
  const id = getProfile().displayActivityBadgeId;
  if (!id || typeof id !== 'string') return;
  if (!getUnlockedBadgeIds().has(id)) {
    const profile = getProfile();
    void saveProfile({ ...profile, displayActivityBadgeId: undefined });
    window.dispatchEvent(new Event('profileDisplayBadgeChanged'));
  }
}

/** Trust score from received reviews */
const getReviewStats = () => {
  try {
    const reviews = getReceivedReviews();
    if (reviews.length === 0) {
      return { trustScore: 50, rating: 0, reviewCount: 0 };
    }
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalRating / reviews.length;
    const trustScore = Math.round((avgRating / 5) * 100);
    return {
      trustScore: Math.max(0, Math.min(100, trustScore)),
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
    };
  } catch {
    return { trustScore: 50, rating: 0, reviewCount: 0 };
  }
};

/** Completed paid-trade count (excludes free share) */
const getTradeCount = () => {
  try {
    const raw = getItem('all_orders');
    const orders: {
      status: string;
      proposedPrice?: number;
      buyer?: { id: string };
      seller?: { id: string };
      product?: { isFreeShare?: boolean; price?: number };
    }[] = raw ? JSON.parse(raw) : [];
    const userId = getCurrentUserId();
    if (!userId) return 0;
    return orders.filter((o) => {
      if (o.status !== ORDER_STATUS_VALUE.COMPLETE) return false;
      const isParticipant = o.buyer?.id === userId || o.seller?.id === userId;
      const isShare = Boolean(o.product?.isFreeShare || o.proposedPrice === 0 || o.product?.price === 0);
      return isParticipant && !isShare;
    }).length;
  } catch {
    return 0;
  }
};

/** Current user object for the app */
export const getMyUser = () => {
  const p = getProfile();
  const userId = getCurrentUserId() || 'me';
  const stats = getReviewStats();
  const tradeCount = getTradeCount();
  const isGuest = userId.startsWith('guest_');
  return {
    id: userId,
    nickname: p.nickname || 'My nickname',
    profileImage: resolveProfileAvatarUrl(userId, p.profileImage),
    kycStatus: (isGuest ? 'unverified' : 'verified') as 'verified' | 'unverified',
    trustScore: stats.trustScore,
    rating: stats.rating,
    tradeCount,
    activityRegion: p.activityRegion,
    bio: p.bio,
    displayActivityBadgeId: getDisplayActivityBadgeId(),
  };
};
