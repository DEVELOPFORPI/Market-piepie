import { api } from '@/utils/api';

const POST_COMMENT_COUNTS_KEY = 'postCommentCounts';

const getCounts = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(POST_COMMENT_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCounts = (counts: Record<string, number>) => {
  localStorage.setItem(POST_COMMENT_COUNTS_KEY, JSON.stringify(counts));
};

const setLocalCommentCount = (postId: string, count: number) => {
  const counts = getCounts();
  counts[postId] = Math.max(count, 0);
  saveCounts(counts);
  window.dispatchEvent(new Event('postCommentCountsChanged'));
};

export const getPostCommentCount = (postId: string): number => {
  return getCounts()[postId] ?? 0;
};

/** DB 동기화 시 로컬 캐시 보정 */
export const seedPostCommentCount = (postId: string, count: number): void => {
  setLocalCommentCount(postId, count);
};

export const seedPostCommentCounts = (entries: Array<{ postId: string; count: number }>): void => {
  if (entries.length === 0) return;
  const counts = getCounts();
  let changed = false;
  entries.forEach(({ postId, count }) => {
    const next = Math.max(count, 0);
    if (counts[postId] !== next) {
      counts[postId] = next;
      changed = true;
    }
  });
  if (changed) {
    saveCounts(counts);
    window.dispatchEvent(new Event('postCommentCountsChanged'));
  }
};

/** DB에서 댓글 수 로드 후 로컬 반영 */
export const syncPostCommentCountFromDB = async (postId: string): Promise<void> => {
  try {
    const res = await api.get<{ count: number }>(`/api/posts/${postId}/comment-count`);
    if (res.ok && res.data) {
      setLocalCommentCount(postId, res.data.count);
    }
  } catch {
    // offline
  }
};

/** API 응답으로 로컬 댓글 수 보정 */
export const applyPostCommentCount = (postId: string, count: number): void => {
  setLocalCommentCount(postId, count);
};
