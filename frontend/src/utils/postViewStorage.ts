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

export const getPostViewCount = (postId: string): number => {
  return getCounts()[postId] ?? 0;
};

/** Call when opening post detail (increment view count) */
export const incrementPostViewCount = (postId: string): void => {
  const counts = getCounts();
  counts[postId] = (counts[postId] ?? 0) + 1;
  saveCounts(counts);
  window.dispatchEvent(new Event('postViewCountsChanged'));
};
