import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { api } from '@/utils/api';

const POST_LIKE_COUNTS_KEY = 'postLikeCounts';
const POST_LIKED_BY_ME_KEY = 'postLikedByMe';

const getLikeCounts = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(POST_LIKE_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveLikeCounts = (counts: Record<string, number>) => {
  localStorage.setItem(POST_LIKE_COUNTS_KEY, JSON.stringify(counts));
};

export const getLikedPostIds = (): string[] => {
  try {
    const raw = localStorage.getItem(userKey(POST_LIKED_BY_ME_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** Liked post ids for a user (profile badge stats) */
export const getLikedPostIdsForUserId = (userId: string): string[] => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${POST_LIKED_BY_ME_KEY}_${userId}`);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: unknown): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const saveLikedPostIds = (ids: string[]) => {
  localStorage.setItem(userKey(POST_LIKED_BY_ME_KEY), JSON.stringify(ids));
};

export const getPostLikeCount = (postId: string): number => {
  return getLikeCounts()[postId] || 0;
};

export const isPostLiked = (postId: string): boolean => {
  return getLikedPostIds().includes(postId);
};

const setLocalLiked = (postId: string, liked: boolean, count: number) => {
  const likedList = getLikedPostIds();
  const idx = likedList.indexOf(postId);
  if (liked && idx < 0) likedList.push(postId);
  if (!liked && idx >= 0) likedList.splice(idx, 1);
  saveLikedPostIds(likedList);
  const counts = getLikeCounts();
  counts[postId] = Math.max(count, 0);
  saveLikeCounts(counts);
  window.dispatchEvent(new Event('postLikesChanged'));
};

/** DB에서 특정 게시글 좋아요 상태/개수 로드 후 로컬 반영 */
export const syncPostLikeFromDB = async (postId: string): Promise<void> => {
  const userId = getCurrentUserId() || '';
  try {
    const res = await api.get<{ liked: boolean; count: number }>(
      `/api/posts/${postId}/likes${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`
    );
    if (res.ok && res.data) {
      setLocalLiked(postId, res.data.liked, res.data.count);
    }
  } catch {
    // 오프라인 시 무시
  }
};

/** 여러 게시글 한꺼번에 동기화 */
export const syncPostLikesFromDB = async (postIds: string[]): Promise<void> => {
  await Promise.all(postIds.map((id) => syncPostLikeFromDB(id)));
};

/** 좋아요 토글 (DB 먼저, 로컬은 응답으로 보정) */
export const togglePostLike = async (postId: string): Promise<boolean> => {
  const currentlyLiked = isPostLiked(postId);
  // 낙관적 업데이트
  const optimisticCount = (getLikeCounts()[postId] || 0) + (currentlyLiked ? -1 : 1);
  setLocalLiked(postId, !currentlyLiked, optimisticCount);

  try {
    const res = currentlyLiked
      ? await api.delete<{ liked: boolean; count: number }>(`/api/posts/${postId}/like`)
      : await api.post<{ liked: boolean; count: number }>(`/api/posts/${postId}/like`, {});
    if (res.ok && res.data) {
      setLocalLiked(postId, res.data.liked, res.data.count);
      return res.data.liked;
    }
    // 실패 시 롤백
    setLocalLiked(postId, currentlyLiked, Math.max(optimisticCount + (currentlyLiked ? 1 : -1), 0));
    return currentlyLiked;
  } catch {
    setLocalLiked(postId, currentlyLiked, Math.max(optimisticCount + (currentlyLiked ? 1 : -1), 0));
    return currentlyLiked;
  }
};
