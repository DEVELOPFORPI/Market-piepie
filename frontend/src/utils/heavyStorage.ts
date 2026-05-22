/**
 * IndexedDB-backed store — separate quota from localStorage.
 * Large payloads (chat, orders, products, posts) use this "other bucket".
 */

import localforage from 'localforage';

let _store: ReturnType<typeof localforage.createInstance> | null = null;
let _storeFailed = false;
/** Null if IDB unavailable — fall back to localStorage (privacy mode / some WebViews) */
function getStore(): ReturnType<typeof localforage.createInstance> | null {
  if (_storeFailed) return null;
  if (!_store) {
    try {
      _store = localforage.createInstance({
        name: 'marketpiepie',
        storeName: 'heavy',
      });
    } catch {
      _storeFailed = true;
      return null;
    }
  }
  return _store;
}

/** Keys stored in IndexedDB (not plain localStorage) */
export const HEAVY_KEYS = [
  'all_products',
  'all_orders',
  'all_chatrooms',
  'myDisputes',
  'community_user_posts',
  'community_dispute_posts',
  'community_comments',
  'all_received_reviews',
  'all_notifications',
] as const;

const cache: Record<string, string> = {};
let preloadDone = false;

function isHeavyKey(key: string): boolean {
  return (HEAVY_KEYS as readonly string[]).includes(key);
}

/** Missing in some in-app browsers — avoid crashing on construction */
let syncChannel: BroadcastChannel | null = null;
let readyChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel('heavy_storage_sync');
    readyChannel = new BroadcastChannel('heavy_storage_ready');
    syncChannel.onmessage = async (e: MessageEvent) => {
      const key = e.data?.key;
      if (key && isHeavyKey(key)) {
        try {
          const store = getStore();
          const value = store ? await store.getItem<string>(key) : null;
          if (value != null) cache[key] = value;
          else delete cache[key];
        } catch {
          delete cache[key];
        }
        try {
          readyChannel?.postMessage({ key });
        } catch {
          // ignore
        }
        if (key === 'all_orders') {
          window.dispatchEvent(new Event('ordersChanged'));
        }
        if (key === 'all_notifications') {
          window.dispatchEvent(new Event('notificationsChanged'));
        }
        if (key === 'all_chatrooms') {
          window.dispatchEvent(new Event('chatRoomsChanged'));
        }
      }
    };
  }
} catch {
  syncChannel = null;
  readyChannel = null;
}

/** Sync read: cache first, then localStorage if IDB unavailable */
export function getItem(key: string): string | null {
  if (!isHeavyKey(key)) return localStorage.getItem(key);
  if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key] as string;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Write: update cache + async persist to IndexedDB */
export function setItem(key: string, value: string): void {
  if (!isHeavyKey(key)) {
    localStorage.setItem(key, value);
    return;
  }
  cache[key] = value;
  const store = getStore();
  if (store) {
    store.setItem(key, value).catch(() => {});
  } else {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
  try {
    syncChannel?.postMessage({ key });
  } catch {
    // ignore
  }
}

/** Remove key */
export function removeItem(key: string): void {
  if (!isHeavyKey(key)) {
    localStorage.removeItem(key);
    return;
  }
  delete cache[key];
  const store = getStore();
  if (store) {
    store.removeItem(key).catch(() => {});
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Call once on startup: load IDB into cache; migrate legacy localStorage once */
export async function preloadHeavyStorage(): Promise<void> {
  if (preloadDone) return;
  try {
    const store = getStore();
    if (store) {
      for (const key of HEAVY_KEYS) {
        try {
          let value = await store.getItem<string>(key);
          if (value == null) {
            const fromLocal = localStorage.getItem(key);
            if (fromLocal != null) {
              value = fromLocal;
              await store.setItem(key, value);
              try {
                localStorage.removeItem(key);
              } catch {
                // ignore
              }
            }
          }
          if (value != null) cache[key] = value;
        } catch {
          // ignore
        }
      }
    } else {
      for (const key of HEAVY_KEYS) {
        try {
          const fromLocal = localStorage.getItem(key);
          if (fromLocal != null) cache[key] = fromLocal;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    for (const key of HEAVY_KEYS) {
      try {
        const fromLocal = localStorage.getItem(key);
        if (fromLocal != null) cache[key] = fromLocal;
      } catch {
        // ignore
      }
    }
  } finally {
    preloadDone = true;
  }
}

/** Clear user data: remove heavy keys from IDB and localStorage */
export async function clearHeavyStorage(): Promise<void> {
  const store = getStore();
  for (const key of HEAVY_KEYS) {
    delete cache[key];
    try {
      if (store) await store.removeItem(key);
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
