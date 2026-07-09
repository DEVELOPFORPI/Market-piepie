import { api } from '@/utils/api';

const POST_VIEW_COUNTS_KEY = 'postViewCounts';

const getCounts = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(POST_VIEW_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCounts = (counts: Record<string, number>) => {
  localStorage.setItem(POST_VIEW_COUNTS_KEY, JSON.stringify(counts));
};

const setLocalViewCount = (postId: string, count: number) => {
  const counts = getCounts();
  counts[postId] = Math.max(count, 0);
  saveCounts(counts);
  window.dispatchEvent(new Event('postViewCountsChanged'));
};

export const getPostViewCount = (postId: string): number => {
  return getCounts()[postId] ?? 0;
};

/** DB 동기화 시 로컬 캐시 보정 */
export const seedPostViewCount = (postId: string, count: number): void => {
  setLocalViewCount(postId, count);
};

export const seedPostViewCounts = (entries: Array<{ postId: string; count: number }>): void => {
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
    window.dispatchEvent(new Event('postViewCountsChanged'));
  }
};

/** DB에서 조회수 로드 후 로컬 반영 */
export const syncPostViewFromDB = async (postId: string): Promise<void> => {
  try {
    const res = await api.get<{ count: number }>(`/api/posts/${postId}/views`);
    if (res.ok && res.data) {
      setLocalViewCount(postId, res.data.count);
    }
  } catch {
    // offline
  }
};

/** 게시글 상세 진입 시 조회수 +1 (DB 먼저, 로컬은 응답으로 보정) */
export const incrementPostViewCount = async (postId: string): Promise<number> => {
  const previous = getPostViewCount(postId);
  setLocalViewCount(postId, previous + 1);

  try {
    const res = await api.post<{ count: number }>(`/api/posts/${postId}/view`, {});
    if (res.ok && res.data) {
      setLocalViewCount(postId, res.data.count);
      return res.data.count;
    }
    setLocalViewCount(postId, previous);
    return previous;
  } catch {
    setLocalViewCount(postId, previous);
    return previous;
  }
};
