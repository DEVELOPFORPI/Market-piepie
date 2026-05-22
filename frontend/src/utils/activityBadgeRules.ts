import { getDisputePosts, getUserPosts } from '@/utils/communityStorage';
import { getFavoritesCountForUserId } from '@/utils/favoriteStorage';
import { getCompletedTradeCountForUser, getShareCountByUserId } from '@/utils/orderStorage';
import { getLikedPostIdsForUserId } from '@/utils/postLikeStorage';

/** 01–11, 14 — tier-1 stats; 12–13 are meta (derived) */
const TIER1_BADGE_IDS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '14',
] as const;

function countUserCommunityPosts(userId: string): number {
  const u = (p: { author?: { id?: string } }) => p.author?.id === userId;
  return getUserPosts().filter(u).length + getDisputePosts().filter(u).length;
}

/**
 * 01–03 completed trades / 04–06 community posts / 07–11 free shares / 14 likes & favorites / 12–13 meta
 */
export function computeUnlockedActivityBadgeIds(userId: string): string[] {
  const completedTrades = getCompletedTradeCountForUser(userId);
  const communityPosts = countUserCommunityPosts(userId);
  const shareCount = getShareCountByUserId(userId);
  const hasHeart =
    getLikedPostIdsForUserId(userId).length >= 1 || getFavoritesCountForUserId(userId) >= 1;

  const ids = new Set<string>();
  if (completedTrades >= 1) ids.add('01');
  if (completedTrades >= 5) ids.add('02');
  if (completedTrades >= 10) ids.add('03');
  if (communityPosts >= 1) ids.add('04');
  if (communityPosts >= 5) ids.add('05');
  if (communityPosts >= 10) ids.add('06');
  if (shareCount >= 1) ids.add('07');
  if (shareCount >= 5) ids.add('08');
  if (shareCount >= 10) ids.add('09');
  if (shareCount >= 15) ids.add('10');
  if (shareCount >= 20) ids.add('11');
  if (hasHeart) ids.add('14');

  const tier1Unlocked = TIER1_BADGE_IDS.filter((id) => ids.has(id)).length;
  if (tier1Unlocked >= 5) ids.add('12');
  if (tier1Unlocked >= 10) ids.add('13');

  return [...ids];
}
