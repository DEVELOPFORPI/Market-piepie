import { ORDER_STATUS_VALUE } from '@/types';
import { getCurrentUserId, userKey } from '@/utils/authStorage';
import { getItem } from '@/utils/heavyStorage';
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

/** Prefer per-user stored avatar over embedded snapshot on products/posts */
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/** Resolve a human-friendly nickname: skip UUID-like or empty values */
export function resolveDisplayNickname(
  userId: string | undefined | null,
  embeddedNickname: string | undefined | null
): string {
  const isUsable = (s: string | undefined | null): s is string =>
    typeof s === 'string' && s.trim() !== '' && !UUID_RE.test(s) && !s.startsWith('guest_');

  if (isUsable(embeddedNickname)) return embeddedNickname;

  if (userId) {
    const stored = getProfileByUserId(userId)?.nickname;
    if (isUsable(stored)) return stored;
  }

  const raw = String(embeddedNickname ?? '');
  if (raw.trim() !== '') {
    return raw.slice(0, 8) + '…';
  }
  return 'User';
}

export const saveProfile = (profile: StoredProfile): void => {
  const key = userKey(BASE_KEY);
  localStorage.setItem(key, JSON.stringify(profile));
  window.dispatchEvent(new Event('profileSaved'));
  // DB 동기화 (비동기)
  import('@/utils/dbSync').then(({ syncUserToDB }) => {
    const user = getMyUser();
    syncUserToDB({ ...user, ...profile, nickname: profile.nickname || user.nickname });
  }).catch(() => {});
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
  if (!isUnlockedActivityBadgeForUser(userId, displayStored)) return null;
  return displayStored;
}

/** Set featured badge; ignores locked ids. Tap same id again to clear. */
export function setDisplayActivityBadgeId(next: string | null): void {
  const profile = getProfile();
  if (next) {
    if (!getUnlockedBadgeIds().has(next)) return;
    const same = profile.displayActivityBadgeId === next;
    saveProfile({
      ...profile,
      displayActivityBadgeId: same ? undefined : next,
    });
  } else {
    saveProfile({ ...profile, displayActivityBadgeId: undefined });
  }
  window.dispatchEvent(new Event('profileDisplayBadgeChanged'));
}

/** Clear featured badge if it is no longer unlocked */
export function pruneInvalidDisplayActivityBadge(): void {
  const id = getProfile().displayActivityBadgeId;
  if (!id || typeof id !== 'string') return;
  if (!getUnlockedBadgeIds().has(id)) {
    const profile = getProfile();
    saveProfile({ ...profile, displayActivityBadgeId: undefined });
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

/** Completed trade count */
const getTradeCount = () => {
  try {
    const raw = getItem('all_orders');
    const orders: { status: string; buyer?: { id: string }; seller?: { id: string } }[] = raw ? JSON.parse(raw) : [];
    const userId = getCurrentUserId();
    return orders.filter(
      (o) => o.status === ORDER_STATUS_VALUE.COMPLETE && (o.buyer?.id === userId || o.seller?.id === userId)
    ).length;
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
    profileImage: p.profileImage || '/default-avatar.jpg',
    kycStatus: (isGuest ? 'unverified' : 'verified') as 'verified' | 'unverified',
    trustScore: stats.trustScore,
    rating: stats.rating,
    tradeCount,
    activityRegion: p.activityRegion,
    bio: p.bio,
    displayActivityBadgeId: getDisplayActivityBadgeId(),
  };
};
