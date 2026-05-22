import { Product } from '@/types';
import { getCurrentUserId } from '@/utils/authStorage';
import { getItem, setItem } from '@/utils/heavyStorage';
import { syncProductToDB, syncProductStatusToDB, syncProductDeleteToDB, markProductDeletedLocally } from '@/utils/dbSync';
import { broadcastProductChange } from '@/utils/chatSocket';

/** Shared storage: all users' listings */
const STORAGE_KEY = 'all_products';

/** All listings (home feed) */
export const getAllProducts = (): Product[] => {
  try {
    const raw = getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** Current user's listings only */
export const getMyProducts = (): Product[] => {
  const userId = getCurrentUserId();
  return getAllProducts().filter((p) => p.seller?.id === userId);
};

/** Shown when storage is full and nothing can be trimmed */
export const QUOTA_EXCEEDED_MESSAGE =
  'Not enough storage to save this listing. Free space in Settings, then try again.';

/** Save listing (create/update). On quota error, drops oldest others until save succeeds */
export const saveProduct = (product: Product): void => {
  let products = getAllProducts();
  const existingIndex = products.findIndex((p) => p.id === product.id);
  if (existingIndex >= 0) {
    products[existingIndex] = product;
  } else {
    products = [product, ...products];
  }
  while (true) {
    try {
      setItem(STORAGE_KEY, JSON.stringify(products));
      window.dispatchEvent(new Event('productsChanged'));
      syncProductToDB(product);
      broadcastProductChange('upserted', product.id);
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        if (products.length <= 1) throw new Error(QUOTA_EXCEEDED_MESSAGE);
        const others = products.filter((p) => p.id !== product.id);
        const oldest = [...others].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0];
        if (!oldest) throw new Error(QUOTA_EXCEEDED_MESSAGE);
        products = products.filter((p) => p.id !== oldest.id);
      } else {
        throw e;
      }
    }
  }
};

/** Free space: remove up to maxToRemove oldest listings */
export function trimOldestProducts(maxToRemove: number): void {
  const products = getAllProducts();
  if (products.length <= maxToRemove) return;
  const sorted = [...products].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const toRemoveIds = new Set(sorted.slice(0, maxToRemove).map((p) => p.id));
  const remaining = products.filter((p) => !toRemoveIds.has(p.id));
  try {
    setItem(STORAGE_KEY, JSON.stringify(remaining));
    window.dispatchEvent(new Event('productsChanged'));
  } catch {
    // ignore
  }
}

export const deleteProduct = (productId: string) => {
  markProductDeletedLocally(productId);
  const products = getAllProducts().filter((p) => p.id !== productId);
  setItem(STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event('productsChanged'));
  syncProductDeleteToDB(productId);
  broadcastProductChange('deleted', productId);
};

export const updateProductStatus = (productId: string, status: Product['status']) => {
  const products = getAllProducts();
  const product = products.find((p) => p.id === productId);
  if (product) {
    product.status = status;
    setItem(STORAGE_KEY, JSON.stringify(products));
    window.dispatchEvent(new Event('productsChanged'));
    syncProductStatusToDB(productId, status);
    broadcastProductChange('status_changed', productId);
  }
};

export const getProductById = (productId: string): Product | null => {
  return getAllProducts().find((p) => p.id === productId) || null;
};

export const removeProductLocally = (productId: string): void => {
  const products = getAllProducts().filter((p) => p.id !== productId);
  setItem(STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event('productsChanged'));
};
