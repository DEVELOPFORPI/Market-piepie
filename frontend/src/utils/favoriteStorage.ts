import { Product } from '@/types';
import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { syncFavoriteAddToDB, syncFavoriteRemoveFromDB } from '@/utils/dbSync';

const BASE_FAVORITES = 'myFavorites';
const LIKE_COUNTS_KEY = 'productLikeCounts'; // global like counts

/* --- Like counts (shared) --- */

const getLikeCounts = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(LIKE_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveLikeCounts = (counts: Record<string, number>) => {
  localStorage.setItem(LIKE_COUNTS_KEY, JSON.stringify(counts));
};

export const getLikeCount = (productId: string): number => {
  return getLikeCounts()[productId] || 0;
};

const incrementLikeCount = (productId: string) => {
  const counts = getLikeCounts();
  counts[productId] = (counts[productId] || 0) + 1;
  saveLikeCounts(counts);
};

const decrementLikeCount = (productId: string) => {
  const counts = getLikeCounts();
  counts[productId] = Math.max((counts[productId] || 0) - 1, 0);
  saveLikeCounts(counts);
};

/* --- Favorites per user --- */

export const getFavorites = (): Product[] => {
  const data = localStorage.getItem(userKey(BASE_FAVORITES));
  return data ? JSON.parse(data) : [];
};

/** Favorite count for a user id (badge stats; same key pattern as userKey) */
export const getFavoritesCountForUserId = (userId: string): number => {
  if (!userId) return 0;
  try {
    const data = localStorage.getItem(`${BASE_FAVORITES}_${userId}`);
    if (!data) return 0;
    const arr = JSON.parse(data) as unknown;
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
};

export const isFavorite = (productId: string): boolean => {
  return getFavorites().some((p) => p.id === productId);
};

export const addFavorite = (product: Product) => {
  const favorites = getFavorites();
  if (!favorites.some((p) => p.id === product.id)) {
    favorites.push({ ...product, liked: true });
    localStorage.setItem(userKey(BASE_FAVORITES), JSON.stringify(favorites));
    incrementLikeCount(product.id);
    window.dispatchEvent(new Event('favoritesChanged'));
    const userId = getCurrentUserId();
    if (userId) syncFavoriteAddToDB(userId, product.id);
  }
};

export const removeFavorite = (productId: string) => {
  const favorites = getFavorites().filter((p) => p.id !== productId);
  localStorage.setItem(userKey(BASE_FAVORITES), JSON.stringify(favorites));
  decrementLikeCount(productId);
  window.dispatchEvent(new Event('favoritesChanged'));
  const userId = getCurrentUserId();
  if (userId) syncFavoriteRemoveFromDB(userId, productId);
};

export const toggleFavorite = (product: Product): boolean => {
  if (isFavorite(product.id)) {
    removeFavorite(product.id);
    return false;
  } else {
    addFavorite(product);
    return true;
  }
};
