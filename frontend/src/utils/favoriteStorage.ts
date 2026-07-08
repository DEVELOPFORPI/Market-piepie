import { Product } from '@/types';
import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { syncFavoriteAddToDB, syncFavoriteRemoveFromDB } from '@/utils/dbSync';

const BASE_FAVORITES = 'myFavorites';
const LIKE_COUNTS_KEY = 'productLikeCounts';

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

export const getFavorites = (): Product[] => {
  const data = localStorage.getItem(userKey(BASE_FAVORITES));
  return data ? JSON.parse(data) : [];
};

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

export const addFavorite = async (product: Product): Promise<boolean> => {
  const userId = getCurrentUserId();
  if (!userId) return false;
  if (getFavorites().some((p) => p.id === product.id)) return true;
  const ok = await syncFavoriteAddToDB(userId, product.id);
  if (!ok) return false;
  const favorites = getFavorites();
  favorites.push({ ...product, liked: true });
  localStorage.setItem(userKey(BASE_FAVORITES), JSON.stringify(favorites));
  incrementLikeCount(product.id);
  window.dispatchEvent(new Event('favoritesChanged'));
  return true;
};

export const removeFavorite = async (productId: string): Promise<boolean> => {
  const userId = getCurrentUserId();
  if (!userId) return false;
  const ok = await syncFavoriteRemoveFromDB(userId, productId);
  if (!ok) return false;
  const favorites = getFavorites().filter((p) => p.id !== productId);
  localStorage.setItem(userKey(BASE_FAVORITES), JSON.stringify(favorites));
  decrementLikeCount(productId);
  window.dispatchEvent(new Event('favoritesChanged'));
  return true;
};

export const toggleFavorite = async (product: Product): Promise<boolean> => {
  if (isFavorite(product.id)) {
    const ok = await removeFavorite(product.id);
    return ok ? false : isFavorite(product.id);
  }
  return addFavorite(product);
};
