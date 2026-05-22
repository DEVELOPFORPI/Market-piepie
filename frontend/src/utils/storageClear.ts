/**
 * Clear bulky localStorage. Keeps login session, profile, and region.
 */

import { trimOldestOrders } from '@/utils/orderStorage';
import { trimOldestChatRooms } from '@/utils/chatStorage';
import { trimOldestProducts } from '@/utils/productStorage';
import { clearHeavyStorage } from '@/utils/heavyStorage';

/** On save quota error: trim a few old orders, rooms, products */
export function tryFreeSpaceForSave(): void {
  try {
    trimOldestOrders(5);
  } catch { /* ignore */ }
  try {
    trimOldestChatRooms(3);
  } catch { /* ignore */ }
  try {
    trimOldestProducts(3);
  } catch { /* ignore */ }
}

const KEYS_TO_CLEAR = [
  'all_products',
  'all_orders',
  'all_chatrooms',
  'myDisputes',
  'community_user_posts',
  'community_dispute_posts',
  'community_comments',
  'all_received_reviews',
  'all_notifications',
  'productLikeCounts',
  'postViewCounts',
  'postLikeCounts',
  'disputePostVotes',
] as const;

const KEY_PREFIXES_TO_CLEAR = ['my_written_reviews_', 'myFavorites_', 'postLikedByMe_'];

export async function clearAppStorage(): Promise<void> {
  await clearHeavyStorage();
  for (const key of KEYS_TO_CLEAR) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  const toRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && KEY_PREFIXES_TO_CLEAR.some((prefix) => key.startsWith(prefix))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('productsChanged'));
  window.dispatchEvent(new Event('ordersChanged'));
  window.dispatchEvent(new Event('chatRoomsChanged'));
  window.dispatchEvent(new Event('disputesChanged'));
  window.dispatchEvent(new Event('postsChanged'));
  window.dispatchEvent(new Event('commentsChanged'));
  window.dispatchEvent(new Event('reviewsChanged'));
  window.dispatchEvent(new Event('notificationsChanged'));
  window.dispatchEvent(new Event('favoritesChanged'));
}
