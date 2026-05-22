import { Review } from '@/types';
import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { getItem, setItem } from '@/utils/heavyStorage';
import { syncReviewToDB } from '@/utils/dbSync';

const BASE_WRITTEN = 'my_written_reviews';
/** Map userId → reviews others wrote about them */
const ALL_RECEIVED_KEY = 'all_received_reviews';

// --- Written reviews (current user) ---

export const REVIEW_QUOTA_EXCEEDED_MESSAGE =
  'Not enough storage to save this review. Free space in Settings, then try again.';

const key = () => userKey(BASE_WRITTEN);

/** Save written reviews; on quota error drop oldest until it fits */
function saveWrittenReviews(list: Review[]) {
  let toSave = [...list];
  while (true) {
    try {
      localStorage.setItem(key(), JSON.stringify(toSave));
      window.dispatchEvent(new Event('reviewsChanged'));
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        // Pop oldest (end); newest at front stays
        if (toSave.length <= 1) throw new Error(REVIEW_QUOTA_EXCEEDED_MESSAGE);
        toSave.pop();
      } else {
        throw e;
      }
    }
  }
}

export const saveReview = (review: Review) => {
  const existing = getMyWrittenReviews();
  const idx = existing.findIndex((r) => r.id === review.id);
  let list: Review[];
  if (idx >= 0) {
    list = [...existing];
    list[idx] = review;
  } else {
    list = [review, ...existing];
  }
  saveWrittenReviews(list);
  // DB 동기화는 addReceivedReviewForUser에서만 수행 (revieweeId가 있어야 FK 위반 안 남)
};

export const getMyWrittenReviews = (): Review[] => {
  try {
    const stored = localStorage.getItem(userKey(BASE_WRITTEN));
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
};

export const deleteReview = (reviewId: string) => {
  const existing = getMyWrittenReviews();
  const updated = existing.filter((r) => r.id !== reviewId);
  saveWrittenReviews(updated);
};

export const getReviewByOrderId = (orderId: string): Review | undefined => {
  return getMyWrittenReviews().find((r) => r.orderId === orderId);
};

// --- Received reviews (global map, keyed by reviewee) ---

const getAllReceivedMap = (): Record<string, Review[]> => {
  try {
    const stored = getItem(ALL_RECEIVED_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {};
};

/** Persist received map; on quota trim one user's oldest reviews */
function saveAllReceivedMap(map: Record<string, Review[]>, revieweeUserId?: string) {
  let current = { ...map };
  for (const uid of Object.keys(current)) {
    current[uid] = [...(current[uid] || [])];
  }
  while (true) {
    try {
      setItem(ALL_RECEIVED_KEY, JSON.stringify(current));
      window.dispatchEvent(new Event('reviewsChanged'));
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        const toTrim = revieweeUserId && current[revieweeUserId]?.length > 1
          ? revieweeUserId
          : Object.keys(current).find((uid) => (current[uid]?.length || 0) > 1);
        if (!toTrim || (current[toTrim]?.length || 0) <= 1) throw new Error(REVIEW_QUOTA_EXCEEDED_MESSAGE);
        current[toTrim] = current[toTrim].slice(0, -1);
      } else {
        throw e;
      }
    }
  }
}

/** Reviews others wrote about the current user */
export const getReceivedReviews = (): Review[] => {
  const userId = getCurrentUserId();
  if (!userId) return [];
  const map = getAllReceivedMap();
  const list = map[userId];
  return Array.isArray(list) ? list : [];
};

/** Append a review for reviewee — DB 저장 성공 후에만 로컬 반영; 실패 시 false */
export const addReceivedReviewForUser = async (
  revieweeUserId: string,
  review: Review
): Promise<boolean> => {
  const ok = await syncReviewToDB({
    id: review.id,
    reviewerId: review.reviewer?.id || getCurrentUserId() || '',
    revieweeId: revieweeUserId,
    orderId: review.orderId || '',
    rating: review.rating,
    tags: review.tags,
    comment: review.comment,
    productTitle: review.productTitle,
    productImage: review.productImage,
  });
  if (!ok) return false;
  const map = getAllReceivedMap();
  if (!map[revieweeUserId]) map[revieweeUserId] = [];
  map[revieweeUserId].unshift(review);
  saveAllReceivedMap(map, revieweeUserId);
  return true;
};

/** Legacy: add received review for current user */
export const addReceivedReview = (review: Review) => {
  const userId = getCurrentUserId();
  if (userId) void addReceivedReviewForUser(userId, review);
};
