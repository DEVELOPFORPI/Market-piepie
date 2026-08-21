/**
 * DB 동기화 레이어
 * - 앱 시작 시 API에서 데이터를 가져와 localStorage를 최신화
 * - 데이터 저장 시 localStorage + API 동시에 저장
 */
import { api } from '@/utils/api';
import { Product, Post, User, Order, ChatRoom, ChatMessage, PRODUCT_STATUS_VALUE, Review } from '@/types';
import { setItem, getItem } from '@/utils/heavyStorage';
import { getMyUser, cacheUserProfileFromRow, applyProfileCacheToUser } from '@/utils/profileStorage';
import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { isOnboardingExemptPath } from '@/utils/onboardingStorage';
import { seedPostViewCounts } from '@/utils/postViewStorage';
import { seedPostCommentCounts, syncPostCommentCountFromDB } from '@/utils/postCommentCountStorage';

// ─── 유저 동기화 ──────────────────────────────────────────────

const _userSyncedCache = new Map<string, string>();

function cacheEmbeddedUser(user: Record<string, unknown> | undefined | null): void {
  if (!user?.id) return;
  cacheUserProfileFromRow(String(user.id), user);
}

/** DB에 아직 없는 로컬 데이터를 유지해 주는 유예 시간 (저장 직후 동기화 경합 대비) */
const LOCAL_ONLY_GRACE_MS = 10 * 60 * 1000;

function isWithinGraceWindow(isoOrMs: string | number | undefined): boolean {
  if (isoOrMs === undefined || isoOrMs === null || isoOrMs === '') return false;
  const t = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < LOCAL_ONLY_GRACE_MS;
}

/** `chat_1783473530324` 같은 id에서 생성 시각 추출 */
function timestampFromGeneratedId(id: string): number | undefined {
  const m = id.match(/_(\d{12,})$/);
  return m ? Number(m[1]) : undefined;
}

function getFavoriteProductIds(): Set<string> {
  const uid = getCurrentUserId() || '';
  if (!uid) return new Set();
  try {
    const raw = localStorage.getItem(userKey('myFavorites'));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((p: { id?: string }) => p?.id).filter(Boolean) as string[]);
  } catch {
    return new Set();
  }
}

function lookupOrderById(orderId: string | undefined | null): Order | undefined {
  if (!orderId) return undefined;
  try {
    const orders: Order[] = JSON.parse(getItem('all_orders') || '[]');
    return orders.find((o) => o.id === orderId);
  } catch {
    return undefined;
  }
}

/** 단일 사용자 프로필을 DB에서 받아 로컬 캐시 갱신 */
export async function syncUserProfileFromDB(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const res = await api.get<Record<string, unknown>>(`/api/users/${userId}`);
    if (res.ok && res.data) {
      cacheUserProfileFromRow(userId, res.data);
      window.dispatchEvent(new Event('userProfilesChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}

/** 여러 사용자 프로필 일괄 갱신 */
export async function syncUserProfilesFromDB(userIds: string[]): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.all(unique.map((id) => syncUserProfileFromDB(id)));
}
export async function syncUserToDB(user: User): Promise<void> {
  if (!user.id || user.id.startsWith('guest_')) return;
  const payload = {
    id: user.id,
    nickname: (user.nickname && user.nickname !== user.id && !user.nickname.startsWith('guest_') && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(user.nickname)) ? user.nickname : undefined,
    profile_image: user.profileImage,
    bio: user.bio,
    kyc_status: user.kycStatus || 'unverified',
    trust_score: user.trustScore || 0,
    rating: user.rating || 0,
    trade_count: user.tradeCount || 0,
    activity_region: user.activityRegion,
    verified_region: user.verifiedRegion,
    display_activity_badge_id: user.displayActivityBadgeId,
    seller_type: user.sellerType,
  };
  const cacheKey = JSON.stringify(payload);
  if (_userSyncedCache.get(user.id) === cacheKey) return;
  try {
    const res = await api.post('/api/users', payload);
    if (res.ok) {
      _userSyncedCache.set(user.id, cacheKey);
    }
  } catch {
    // 오프라인 시 무시
  }
}

// ─── 상품 동기화 ──────────────────────────────────────────────

/** API에서 상품 목록을 가져와 localStorage 갱신 */
const DELETED_PRODUCTS_KEY = 'deleted_product_ids';

export function markProductDeletedLocally(productId: string): void {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(DELETED_PRODUCTS_KEY) || '[]');
    if (!ids.includes(productId)) ids.push(productId);
    localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
}

export function clearDeletedProductId(productId: string): void {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(DELETED_PRODUCTS_KEY) || '[]');
    localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(ids.filter((id) => id !== productId)));
  } catch { /* ignore */ }
}

export async function syncProductsFromDB(): Promise<void> {
  try {
    const res = await api.get<Product[]>('/api/products');
    if (res.ok && res.data) {
      const deletedIds: string[] = (() => {
        try { return JSON.parse(localStorage.getItem(DELETED_PRODUCTS_KEY) || '[]'); } catch { return []; }
      })();
      const deletedSet = new Set(deletedIds);
      const favoriteIds = getFavoriteProductIds();
      const dbProducts = (res.data as unknown as Record<string, unknown>[])
        .map((row) => mapProductFromDB(row, favoriteIds))
        .filter((p) => !deletedSet.has(p.id));
      const local: Product[] = (() => {
        try { return JSON.parse(getItem('all_products') || '[]'); } catch { return []; }
      })();
      const dbIds = new Set(dbProducts.map((p) => p.id));
      const mergedMap = new Map<string, Product>();
      dbProducts.forEach((p) => mergedMap.set(p.id, p));
      const myUserId = sessionStorage.getItem('currentUserId') || '';
      // 내 상품이라도 방금 등록한 것만 로컬 유지 — DB에서 지운 상품이 계속 남지 않게
      local.forEach((p) => {
        if (
          !dbIds.has(p.id) &&
          !deletedSet.has(p.id) &&
          p.seller?.id === myUserId &&
          (isWithinGraceWindow(p.createdAt) || isWithinGraceWindow(timestampFromGeneratedId(p.id)))
        ) {
          mergedMap.set(p.id, p);
        }
      });
      setItem('all_products', JSON.stringify(Array.from(mergedMap.values())));
      window.dispatchEvent(new Event('productsChanged'));
    }
  } catch {
    // 오프라인 시 localStorage 그대로 사용
  }
}

/** 상품을 DB에 저장 — 성공 여부 반환 */
export async function syncProductToDB(product: Product): Promise<boolean> {
  try {
    await syncUserToDB(product.seller);
    const res = await api.post<unknown>('/api/products', {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.category,
      region: product.region,
      status: product.status,
      images: product.images,
      seller_id: product.seller.id,
      trade_methods: product.tradeMethods,
      today_trade_available: product.todayTradeAvailable,
      is_free_share: product.isFreeShare,
      allow_offer: product.allowOffer,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 상품 상태 업데이트 */
export async function syncProductStatusToDB(productId: string, status: string): Promise<boolean> {
  try {
    const res = await api.patch(`/api/products/${productId}/status`, { status });
    return res.ok;
  } catch {
    return false;
  }
}

/** 상품 삭제 */
export async function syncProductDeleteToDB(productId: string): Promise<boolean> {
  try {
    const res = await api.delete(`/api/products/${productId}`);
    if (res.ok) clearDeletedProductId(productId);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── DB → 앱 타입 변환 ────────────────────────────────────────

function mapProductFromDB(row: Record<string, unknown>, favoriteIds?: Set<string>): Product {
  const seller = (row.seller as Record<string, unknown>) || {};
  cacheEmbeddedUser(seller.id ? seller : null);
  const product: Product = {
    id: String(row.id),
    title: String(row.title || ''),
    price: Number(row.price || 0),
    images: (row.images as string[]) || [],
    category: String(row.category || ''),
    region: String(row.region || ''),
    status: (row.status as Product['status']),
    description: String(row.description || ''),
    createdAt: String(row.created_at || new Date().toISOString()),
    seller: applyProfileCacheToUser({
      id: String(seller.id || row.seller_id || ''),
      nickname: String(seller.nickname || ''),
      profileImage: seller.profile_image as string | undefined,
      kycStatus: (seller.kyc_status as 'verified' | 'unverified') || 'unverified',
      trustScore: Number(seller.trust_score || 0),
      rating: Number(seller.rating || 0),
      tradeCount: Number(seller.trade_count || 0),
      activityRegion: seller.activity_region as string | undefined,
      bio: seller.bio as string | undefined,
    }),
    tradeMethods: (row.trade_methods as Product['tradeMethods']) || [],
    todayTradeAvailable: Boolean(row.today_trade_available),
    liked: favoriteIds?.has(String(row.id)) ?? false,
    isFreeShare: Boolean(row.is_free_share),
    allowOffer: Boolean(row.allow_offer),
    adminHidden: Boolean(row.admin_hidden),
    adminHiddenReason: row.admin_hidden_reason
      ? String(row.admin_hidden_reason)
      : undefined,
  };
  return product;
}

// ─── 커뮤니티 게시물 동기화 ──────────────────────────────────

/** 내가 쓴 게시물만 DB에서 로드 */
export async function syncMyPostsFromDB(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const res = await api.get<Post[]>(`/api/posts?author_id=${encodeURIComponent(userId)}`);
    if (!res.ok || !res.data) return;
    const favoriteIds = getFavoriteProductIds();
    const myPosts = (res.data as unknown as Record<string, unknown>[]).map((row) =>
      mapPostFromDB(row, favoriteIds),
    );
    setItem('community_user_posts', JSON.stringify(myPosts));
    window.dispatchEvent(new Event('postsChanged'));
  } catch {
    // ignore
  }
}

/** API에서 게시물 목록을 가져와 localStorage 갱신 */
export async function syncPostsFromDB(): Promise<void> {
  try {
    const res = await api.get<Post[]>('/api/posts');
    if (!res.ok) return;
    if (res.data) {
      const favoriteIds = getFavoriteProductIds();
      const dbPosts = (res.data as unknown as Record<string, unknown>[]).map((row) =>
        mapPostFromDB(row, favoriteIds),
      );
      seedPostViewCounts(
        dbPosts.map((p) => ({ postId: p.id, count: p.viewCount ?? 0 })),
      );
      seedPostCommentCounts(
        dbPosts.map((p) => ({ postId: p.id, count: p.commentCount ?? 0 })),
      );
      setItem('community_feed_posts', JSON.stringify(dbPosts));
      cleanupLocalPostLeftovers(dbPosts);
      window.dispatchEvent(new Event('postsChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}

/** DB 게시물 목록 기준으로 레거시 분쟁글·삭제된 글의 댓글 정리 */
function cleanupLocalPostLeftovers(dbPosts: Post[]): void {
  const validIds = new Set(dbPosts.map((p) => p.id));
  // 레거시 분쟁 게시글(로컬 전용 저장소): 방금 쓴 글이 아니면 DB 기준으로 제거
  try {
    const raw = getItem('community_dispute_posts');
    if (raw) {
      const legacy: Post[] = JSON.parse(raw);
      if (Array.isArray(legacy) && legacy.length > 0) {
        const kept = legacy.filter(
          (p) => validIds.has(p.id) || isWithinGraceWindow(p.createdAt),
        );
        kept.forEach((p) => validIds.add(p.id));
        if (kept.length !== legacy.length) {
          setItem('community_dispute_posts', JSON.stringify(kept));
        }
      }
    }
  } catch { /* ignore */ }
  // 존재하지 않는 게시글의 댓글 제거
  try {
    const raw = getItem('community_comments');
    if (raw) {
      const all: Record<string, unknown> = JSON.parse(raw);
      let changed = false;
      Object.keys(all).forEach((postId) => {
        if (!validIds.has(postId)) {
          delete all[postId];
          changed = true;
        }
      });
      if (changed) setItem('community_comments', JSON.stringify(all));
    }
  } catch { /* ignore */ }
}

/** 단일 게시물을 DB에서 로드해 로컬 캐시에 병합 */
export async function syncPostFromDB(postId: string): Promise<Post | undefined> {
  if (!postId) return undefined;
  try {
    const res = await api.get<Record<string, unknown>>(`/api/posts/${postId}`);
    if (!res.ok || !res.data) return undefined;
    const favoriteIds = getFavoriteProductIds();
    const mapped = mapPostFromDB(res.data, favoriteIds);
    seedPostViewCounts([{ postId: mapped.id, count: mapped.viewCount ?? 0 }]);
    seedPostCommentCounts([{ postId: mapped.id, count: mapped.commentCount ?? 0 }]);
    const posts: Post[] = (() => {
      try {
        const raw = getItem('community_feed_posts');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx >= 0) posts[idx] = mapped;
    else posts.unshift(mapped);
    setItem('community_feed_posts', JSON.stringify(posts));
    window.dispatchEvent(new Event('postsChanged'));
    return mapped;
  } catch {
    return undefined;
  }
}

/** 게시물을 DB에 저장 — 성공 여부 반환 */
export async function syncPostToDB(post: Post): Promise<boolean> {
  try {
    await api.post('/api/users', {
      id: post.author.id,
      nickname: post.author.nickname || undefined,
      profile_image: post.author.profileImage,
      bio: post.author.bio,
      kyc_status: post.author.kycStatus || 'unverified',
      trust_score: post.author.trustScore || 0,
      rating: post.author.rating || 0,
      trade_count: post.author.tradeCount || 0,
      activity_region: post.author.activityRegion,
    });
    const res = await api.post('/api/posts', {
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category,
      author_id: post.author.id,
      images: post.images,
      tags: post.tags,
      region: post.region,
      latitude: post.latitude,
      longitude: post.longitude,
      order_id: post.orderId,
      attached_product_id: post.attachedProduct?.id,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 게시물 삭제 */
export async function syncPostDeleteToDB(postId: string): Promise<boolean> {
  try {
    const res = await api.delete(`/api/posts/${postId}`);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── DB → Post 타입 변환 ──────────────────────────────────

export function mapPostFromDB(row: Record<string, unknown>, favoriteIds?: Set<string>): Post {
  const author = (row.author as Record<string, unknown>) || {};
  cacheEmbeddedUser(author.id ? author : null);
  const attachedRaw = row.attached_product as Record<string, unknown> | undefined;
  const attachedProduct =
    attachedRaw?.id
      ? mapProductFromDB({ ...attachedRaw, seller: author }, favoriteIds)
      : undefined;
  return {
    id: String(row.id),
    title: String(row.title || ''),
    content: String(row.content || ''),
    category: String(row.category || '') as Post['category'],
    commentCount: Number(row.comment_count || 0),
    viewCount: Number(row.view_count || 0),
    createdAt: String(row.created_at || new Date().toISOString()),
    images: (row.images as string[]) || [],
    tags: (row.tags as string[]) || [],
    region: row.region as string | undefined,
    latitude: row.latitude as number | undefined,
    longitude: row.longitude as number | undefined,
    orderId: row.order_id as string | undefined,
    attachedProduct,
    author: applyProfileCacheToUser({
      id: String(author.id || ''),
      nickname: String(author.nickname || ''),
      profileImage: author.profile_image as string | undefined,
      kycStatus: (author.kyc_status as 'verified' | 'unverified') || 'unverified',
      trustScore: Number(author.trust_score || 0),
      rating: Number(author.rating || 0),
      tradeCount: Number(author.trade_count || 0),
      activityRegion: author.activity_region as string | undefined,
      bio: author.bio as string | undefined,
    }),
  };
}

// ─── 주문 동기화 ──────────────────────────────────────────────

/** 주문을 DB에 저장 (upsert) — 성공 여부 반환 */
export async function syncOrderToDB(order: Order): Promise<boolean> {
  try {
    await Promise.all([syncUserToDB(order.buyer), syncUserToDB(order.seller)]);
    const res = await api.post('/api/orders', {
      id: order.id,
      product_id: order.product.id,
      buyer_id: order.buyer.id,
      seller_id: order.seller.id,
      status: order.status,
      proposed_price: order.proposedPrice,
      trade_method: order.tradeMethod,
      meetup_place: order.meetupPlace,
      meetup_date: order.meetupDate,
      meetup_time: order.meetupTime,
      memo: order.memo,
      receipt_condition: order.receiptCondition || null,
      receipt_notes: order.receiptNotes || null,
      buyer_completed: order.buyerCompleted,
      seller_completed: order.sellerCompleted,
      meetup_accepted: order.meetupAccepted || false,
      shipping_address: order.shippingInfo?.address,
      shipping_name: order.shippingInfo?.recipientName,
      shipping_phone: order.shippingInfo?.recipientPhone,
      tracking_number: order.trackingNumber,
      shipping_company: order.shippingCompany,
      shipping_proof_images: order.shippingProofImages || [],
    });
    if (!res.ok) return false;
    missingOrderIds.delete(order.id);
    if (order.timeline?.length) {
      const last = order.timeline[order.timeline.length - 1];
      await api.post(`/api/orders/${order.id}/timeline`, {
        id: last.id,
        event_type: last.type,
        description: last.description,
      });
    }
    return true;
  } catch {
    return false;
  }
}

export type OrderStatusSyncExtra = {
  buyer_completed?: boolean;
  seller_completed?: boolean;
  meetup_location?: string;
  meetup_date?: string;
  meetup_time?: string;
  meetup_accepted?: boolean;
  shipping_address?: string;
  shipping_name?: string;
  shipping_phone?: string;
  tracking_number?: string;
  shipping_company?: string;
  shipping_proof_images?: string[];
  receipt_condition?: string | null;
  receipt_notes?: string | null;
};

/** 주문 상태 업데이트 — 성공 여부 반환 */
export async function syncOrderStatusToDB(
  orderId: string,
  status: string,
  timelineEvent?: { id: string; type: string; description: string },
  extra?: OrderStatusSyncExtra,
): Promise<boolean> {
  try {
    const res = await api.put(`/api/orders/${orderId}`, { status, ...extra });
    if (!res.ok) return false;
    if (timelineEvent) {
      await api.post(`/api/orders/${orderId}/timeline`, {
        id: timelineEvent.id,
        event_type: timelineEvent.type,
        description: timelineEvent.description,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** DB row + 로컬 캐시 병합 — 주문 필드는 DB 우선 */
function mergeOrderDbPreferred(dbOrder: Order, local?: Order): Order {
  if (!local) return dbOrder;
  return {
    ...dbOrder,
    timeline: dbOrder.timeline?.length ? dbOrder.timeline : local.timeline,
  };
}

/**
 * 서버에 없는 주문(404) 재조회 억제.
 * 오래된 채팅 메시지가 삭제된 주문을 가리키면 화면 진입마다 404가 반복되므로,
 * 일정 시간 동안은 다시 묻지 않는다.
 */
const missingOrderIds = new Map<string, number>();
const MISSING_ORDER_TTL_MS = 5 * 60 * 1000;

/** 단일 주문을 DB에서 로드해 로컬 캐시에 병합 */
export async function syncOrderFromDB(orderId: string): Promise<Order | undefined> {
  if (!orderId) return undefined;
  const missingAt = missingOrderIds.get(orderId);
  if (missingAt !== undefined) {
    if (Date.now() - missingAt < MISSING_ORDER_TTL_MS) return undefined;
    missingOrderIds.delete(orderId);
  }
  try {
    const res = await api.get<Record<string, unknown>>(`/api/orders/${orderId}`);
    if (res.status === 404) {
      missingOrderIds.set(orderId, Date.now());
      return undefined;
    }
    if (!res.ok || !res.data) return undefined;
    const row = res.data as Record<string, unknown>;
    const existing = lookupOrderById(orderId);
    const mapped = mergeOrderDbPreferred(mapOrderFromDB(row), existing);
    const orders: Order[] = (() => {
      try {
        const raw = getItem('all_orders');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx >= 0) orders[idx] = mapped;
    else orders.push(mapped);
    setItem('all_orders', JSON.stringify(orders));
    window.dispatchEvent(new Event('ordersChanged'));
    return mapped;
  } catch {
    return undefined;
  }
}

/** 주문을 DB에서 삭제 — 거절/취소 시 localStorage 재동기화로 되살아나지 않게 함 */
export async function syncOrderDeleteToDB(orderId: string): Promise<boolean> {
  if (!orderId) return false;
  try {
    const res = await api.delete<{ ok: boolean }>(`/api/orders/${orderId}`);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/** DB에서 내 주문 목록을 로드해 localStorage 갱신 (DB-first) */
export async function syncOrdersFromDB(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const res = await api.get<Order[]>(`/api/orders?user_id=${userId}`);
    if (res.ok && res.data) {
      const rows = res.data as unknown as Record<string, unknown>[];
      const existing: Order[] = (() => {
        try {
          const raw = getItem('all_orders');
          return raw ? JSON.parse(raw) : [];
        } catch { return []; }
      })();
      const existingMap = new Map(existing.map((o) => [o.id, o]));
      const mergedMap = new Map<string, Order>();
      rows.forEach((row) => {
        cacheEmbeddedUser(row.buyer as Record<string, unknown> | undefined);
        cacheEmbeddedUser(row.seller as Record<string, unknown> | undefined);
        const id = String(row.id);
        mergedMap.set(id, mergeOrderDbPreferred(mapOrderFromDB(row), existingMap.get(id)));
      });
      existing.forEach((o) => {
        const isMine = o.buyer?.id === userId || o.seller?.id === userId;
        if (!isMine && !mergedMap.has(o.id)) mergedMap.set(o.id, o);
      });
      setItem('all_orders', JSON.stringify(Array.from(mergedMap.values())));
      window.dispatchEvent(new Event('ordersChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}

function parseMeetupFromOrderRow(row: Record<string, unknown>) {
  let meetupDate = row.meetup_date ? String(row.meetup_date) : undefined;
  let meetupTime = row.meetup_time ? String(row.meetup_time) : undefined;
  if (meetupTime && /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(meetupTime)) {
    const [datePart, timePart] = meetupTime.split(/\s+/);
    meetupDate = meetupDate || datePart;
    meetupTime = timePart;
  }
  return {
    meetupPlace: row.meetup_place ? String(row.meetup_place) : undefined,
    meetupDate,
    meetupTime,
  };
}

function parseTimelineFromDB(raw: unknown): Order['timeline'] {
  if (!raw) return [];
  let items: unknown[] = [];
  if (Array.isArray(raw)) items = raw;
  else if (typeof raw === 'string') {
    try { items = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(items)) return [];
  return items
    .filter((e) => e && typeof e === 'object')
    .map((e) => {
      const ev = e as Record<string, unknown>;
      return {
        id: String(ev.id || ''),
        type: String(ev.type || ''),
        timestamp: String(ev.timestamp || ev.created_at || new Date().toISOString()),
        description: String(ev.description || ''),
      };
    });
}

function mapOrderFromDB(row: Record<string, unknown>): Order {
  const buyer = (row.buyer as Record<string, unknown>) || {};
  const seller = (row.seller as Record<string, unknown>) || {};
  const product = (row.product as Record<string, unknown>) || {};
  cacheEmbeddedUser(buyer.id ? buyer : null);
  cacheEmbeddedUser(seller.id ? seller : null);
  const meetup = parseMeetupFromOrderRow(row);
  const timeline = parseTimelineFromDB(row.timeline);
  const meetupAcceptedFromDb = Boolean(row.meetup_accepted);
  const meetupAcceptedFromTimeline = timeline.some((e) => e.type === 'meetup_accepted');
  const shippingName = row.shipping_name ? String(row.shipping_name) : undefined;
  const shippingPhone = row.shipping_phone ? String(row.shipping_phone) : undefined;
  const shippingAddress = row.shipping_address ? String(row.shipping_address) : undefined;
  return {
    id: String(row.id),
    status: String(row.status || '') as Order['status'],
    proposedPrice: Number(row.proposed_price || 0),
    tradeMethod: String(row.trade_method || '') as Order['tradeMethod'],
    meetupPlace: meetup.meetupPlace,
    meetupDate: meetup.meetupDate,
    meetupTime: meetup.meetupTime,
    memo: row.memo as string | undefined,
    receiptCondition: (() => {
      const c = row.receipt_condition ? String(row.receipt_condition) : '';
      return c === 'good' || c === 'normal' || c === 'bad' ? c : undefined;
    })(),
    receiptNotes: row.receipt_notes ? String(row.receipt_notes) : undefined,
    buyerCompleted: Boolean(row.buyer_completed),
    sellerCompleted: Boolean(row.seller_completed),
    meetupAccepted: meetupAcceptedFromDb || meetupAcceptedFromTimeline,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : undefined,
    shippingCompany: row.shipping_company ? String(row.shipping_company) : undefined,
    shippingProofImages: Array.isArray(row.shipping_proof_images)
      ? (row.shipping_proof_images as string[])
      : undefined,
    shippingInfo:
      shippingName || shippingPhone || shippingAddress
        ? {
            recipientName: shippingName,
            recipientPhone: shippingPhone,
            address: shippingAddress,
            requestNote: row.memo ? String(row.memo) : undefined,
          }
        : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    timeline,
    buyer: applyProfileCacheToUser({
      id: String(buyer.id || row.buyer_id || ''),
      nickname: String(buyer.nickname || ''),
      profileImage: buyer.profile_image as string | undefined,
      kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,
    }),
    seller: applyProfileCacheToUser({
      id: String(seller.id || row.seller_id || ''),
      nickname: String(seller.nickname || ''),
      profileImage: seller.profile_image as string | undefined,
      kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,
    }),
    product: {
      id: String(product.id || row.product_id || ''),
      title: String(product.title || ''),
      price: Number(product.price || 0),
      images: Array.isArray(product.images) ? (product.images as string[]) : [],
      category: String(product.category || ''),
      region: String(product.region || ''),
      status: (product.status as Product['status']) || PRODUCT_STATUS_VALUE.FOR_SALE,
      description: String(product.description || ''),
      createdAt: String(product.created_at || ''),
      liked: false,
      isFreeShare: Boolean(product.is_free_share),
      allowOffer: Boolean(product.allow_offer),
      tradeMethods: Array.isArray(product.trade_methods) ? (product.trade_methods as Product['tradeMethods']) : [],
      todayTradeAvailable: Boolean(product.today_trade_available),
      seller: applyProfileCacheToUser({
        id: String(seller.id || row.seller_id || ''),
        nickname: String(seller.nickname || ''),
        kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,
      }),
    },
  };
}

// ─── 채팅 동기화 ──────────────────────────────────────────────

/** 채팅방을 DB에 저장 — 성공 여부 반환 (DB-first) */
export async function syncChatRoomToDB(
  room: ChatRoom,
  options?: { rejoin?: boolean },
): Promise<boolean> {
  try {
    const syncUsers: Promise<void>[] = [];
    if (room.buyerInfo) syncUsers.push(syncUserToDB(room.buyerInfo));
    if (room.sellerInfo) syncUsers.push(syncUserToDB(room.sellerInfo));
    if (syncUsers.length) await Promise.all(syncUsers);

    const res = await api.post('/api/chat-rooms', {
      id: room.id,
      buyer_id: room.buyerId,
      seller_id: room.sellerId,
      product_id: room.product?.id,
      order_id: room.order?.id,
      left_user_ids: room.leftUserIds || [],
      rejoin: options?.rejoin || false,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 채팅방 메타(나가기·읽음·주문 연결) DB 저장 */
export async function syncChatRoomMetaToDB(
  roomId: string,
  patch: {
    left_user_ids?: string[];
    order_id?: string | null;
    read_state?: Record<string, { read?: boolean; lastReadAt?: string }>;
  },
): Promise<boolean> {
  try {
    const res = await api.patch(`/api/chat-rooms/${roomId}`, patch);
    return res.ok;
  } catch {
    return false;
  }
}

function parseReadStateFromDB(raw: unknown): { readStatus: Record<string, boolean>; lastReadAt: Record<string, string> } {
  const readStatus: Record<string, boolean> = {};
  const lastReadAt: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return { readStatus, lastReadAt };
  for (const [userId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    if (v.read != null) readStatus[userId] = Boolean(v.read);
    if (v.lastReadAt) lastReadAt[userId] = String(v.lastReadAt);
  }
  return { readStatus, lastReadAt };
}

/**
 * 방 하나의 읽음 상태만 DB에서 받아 로컬에 반영.
 * Realtime 읽음 수신이 실패해도 "1" 표시가 사라지도록 채팅방에서 주기적으로 호출한다.
 * 각 사용자의 lastReadAt은 더 최신 값만 반영해 내 로컬 상태를 되돌리지 않는다.
 */
export async function syncRoomReadStateFromDB(roomId: string): Promise<boolean> {
  if (!roomId) return false;
  try {
    const res = await api.get<{ read_state?: unknown }>(`/api/chat-rooms/${roomId}/read-state`);
    if (!res.ok || !res.data) return false;
    const { readStatus, lastReadAt } = parseReadStateFromDB(res.data.read_state);

    const rooms: ChatRoom[] = (() => {
      try { return JSON.parse(getItem('all_chatrooms') || '[]'); } catch { return []; }
    })();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return false;

    if (!room.readStatus) room.readStatus = {};
    if (!room.lastReadAt) room.lastReadAt = {};
    let changed = false;
    for (const [uid, ts] of Object.entries(lastReadAt)) {
      if ((room.lastReadAt[uid] || '') < ts) {
        room.lastReadAt[uid] = ts;
        changed = true;
      }
    }
    for (const [uid, read] of Object.entries(readStatus)) {
      if (read && room.readStatus[uid] !== true) {
        room.readStatus[uid] = true;
        changed = true;
      }
    }
    if (!changed) return false;

    setItem('all_chatrooms', JSON.stringify(rooms));
    window.dispatchEvent(new Event('chatRoomsChanged'));
    return true;
  } catch {
    return false;
  }
}

/** 메시지를 DB에 저장 — 성공 여부 반환 (DB-first) */
export async function syncMessageToDB(roomId: string, message: ChatMessage): Promise<boolean> {
  try {
    if (message.senderId && message.senderId !== 'system') {
      const myUser = getMyUser();
      if (myUser?.id === message.senderId) {
        await syncUserToDB(myUser);
      }
    }
    const res = await api.post(`/api/chat-rooms/${roomId}/messages`, {
      id: message.id,
      sender_id: message.senderId,
      content: message.content,
      type: message.type || 'text',
      images: message.images,
      order_id: message.orderId,
      original_price: message.originalPrice,
      proposed_price: message.proposedPrice,
      offer_result: message.offerResult,
      meetup_place: message.meetupPlace,
      meetup_date: message.meetupDate,
      meetup_time: message.meetupTime,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** DB row + 로컬 캐시 병합 — 메타데이터는 DB 우선 */
function mergeRoomDbPreferred(dbRoom: ChatRoom, local?: ChatRoom): ChatRoom {
  if (!local) return dbRoom;

  let buyerInfo = local.buyerInfo;
  let sellerInfo = local.sellerInfo;
  const freshOther = dbRoom.otherUser;
  if (freshOther?.id && freshOther.nickname) {
    if (freshOther.id === local.sellerId) {
      sellerInfo = applyProfileCacheToUser({ ...(local.sellerInfo || freshOther), ...freshOther });
    }
    if (freshOther.id === local.buyerId) {
      buyerInfo = applyProfileCacheToUser({ ...(local.buyerInfo || freshOther), ...freshOther });
    }
  }

  const lastMessageChanged =
    !!local.lastMessage &&
    !!dbRoom.lastMessage &&
    local.lastMessage !== dbRoom.lastMessage;
  const messages = lastMessageChanged
    ? []
    : (dbRoom.messages?.length ? dbRoom.messages : local.messages);

  const dbRs = dbRoom.readStatus || {};
  const localRs = local.readStatus || {};
  const readStatus = Object.keys(dbRs).length ? { ...localRs, ...dbRs } : localRs;
  const dbLra = dbRoom.lastReadAt || {};
  const localLra = local.lastReadAt || {};
  const lastReadAt = Object.keys(dbLra).length ? { ...localLra, ...dbLra } : localLra;

  return {
    ...dbRoom,
    messages: messages || [],
    readStatus,
    lastReadAt,
    leftUserIds: Array.from(new Set([
      ...(dbRoom.leftUserIds || []),
      ...(local.leftUserIds || []),
    ])),
    order: dbRoom.order ?? local.order,
    otherUser: freshOther?.nickname
      ? applyProfileCacheToUser(freshOther)
      : applyProfileCacheToUser(local.otherUser ?? dbRoom.otherUser),
    buyerInfo,
    sellerInfo,
  };
}

function isViewingChatRoom(roomId: string): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path === `/chat/${roomId}` || path.startsWith(`/chat/${roomId}/`);
}

function applyUnreadFromMessages(room: ChatRoom, userId: string): void {
  if (!userId || isViewingChatRoom(room.id)) return;
  const lastRead = room.lastReadAt?.[userId] || '';
  const hasUnread = (room.messages || []).some(
    (m) => m.senderId !== userId && m.timestamp > lastRead,
  );
  if (!hasUnread) return;
  if (!room.readStatus) room.readStatus = {};
  room.readStatus[userId] = false;
  room.unreadCount = Math.max(room.unreadCount || 0, 1);
}

function markUnreadForNewLastMessage(
  room: ChatRoom,
  userId: string,
  dbReadStatus: Record<string, boolean> | undefined,
): void {
  if (!userId || isViewingChatRoom(room.id)) return;
  if (!room.readStatus) room.readStatus = {};
  if (dbReadStatus?.[userId] === true) return;
  room.readStatus[userId] = false;
  room.unreadCount = Math.max(room.unreadCount || 0, 1);
}

/** DB에서 내 채팅방 목록을 로드해 localStorage 갱신 (DB-first) */
export async function syncChatRoomsFromDB(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const res = await api.get<ChatRoom[]>(`/api/chat-rooms?user_id=${userId}`);
    if (res.ok && res.data) {
      const rows = res.data as unknown as Record<string, unknown>[];
      const existing: ChatRoom[] = (() => {
        try { return JSON.parse(getItem('all_chatrooms') || '[]'); } catch { return []; }
      })();
      const existingMap = new Map(existing.map((r) => [r.id, r]));
      const mergedMap = new Map<string, ChatRoom>();
      const messageResyncIds: string[] = [];
      rows.forEach((row) => {
        cacheEmbeddedUser(row.other_user as Record<string, unknown> | undefined);
        const id = String(row.id);
        const local = existingMap.get(id);
        const dbRoom = mapChatRoomFromDB(row);
        const merged = mergeRoomDbPreferred(dbRoom, local);
        const dbLast = String(row.last_message || '');
        if (local && dbLast && local.lastMessage !== dbLast) {
          messageResyncIds.push(id);
          markUnreadForNewLastMessage(merged, userId, dbRoom.readStatus);
        }
        mergedMap.set(id, merged);
      });
      // 생성 직후라 DB에 아직 없는 방만 잠시 유지 — DB에서 삭제된 방은 로컬에서도 제거
      const pendingIds: string[] = [];
      existing.forEach((room) => {
        if (mergedMap.has(room.id)) return;
        const createdTs = timestampFromGeneratedId(room.id);
        if (isWithinGraceWindow(createdTs) || isWithinGraceWindow(room.lastMessageTime)) {
          mergedMap.set(room.id, room);
          pendingIds.push(room.id);
        }
      });
      // 유예로 남긴 방 중 서버가 이미 아는 방은 숨김·삭제된 것이므로 로컬에서도 뺀다.
      if (pendingIds.length > 0) {
        const known = await api.post<{ ids?: string[] }>('/api/chat-rooms/known', { ids: pendingIds });
        if (known.ok && Array.isArray(known.data?.ids)) {
          known.data.ids.forEach((id) => mergedMap.delete(String(id)));
        }
      }
      setItem('all_chatrooms', JSON.stringify(Array.from(mergedMap.values())));
      window.dispatchEvent(new Event('chatRoomsChanged'));
      window.dispatchEvent(new Event('userProfilesChanged'));
      messageResyncIds.forEach((roomId) => {
        void syncRoomMessagesFromDB(roomId, userId);
      });
    }
  } catch {
    // 오프라인 시 무시
  }
}



/** DB meetup_location / meetup_time → 프론트 meetupPlace·Date·Time */
function parseMeetupFieldsFromDB(row: Record<string, unknown>): Pick<ChatMessage, 'meetupPlace' | 'meetupDate' | 'meetupTime'> {
  const placeRaw = row.meetup_place ?? row.meetup_location;
  const meetupPlace = placeRaw ? String(placeRaw) : undefined;

  let meetupDate = row.meetup_date ? String(row.meetup_date) : undefined;
  let meetupTime = row.meetup_time ? String(row.meetup_time) : undefined;

  if (meetupTime && /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(meetupTime)) {
    const [datePart, timePart] = meetupTime.split(/\s+/);
    meetupDate = meetupDate || datePart;
    meetupTime = timePart;
  }

  return { meetupPlace, meetupDate, meetupTime };
}

/** DB 메시지 row → ChatMessage */
function mapChatMessageFromDB(row: Record<string, unknown>): ChatMessage {
  const rawType = String(row.type || 'user');
  // 서버 기본값 'text'는 프론트 타입 'user'에 해당
  const type = (rawType === 'text' ? 'user' : rawType) as ChatMessage['type'];
  return {
    id: String(row.id),
    senderId: String(row.sender_id || ''),
    content: String(row.content || ''),
    timestamp: String(row.created_at || new Date().toISOString()),
    type,
    images: Array.isArray(row.images) ? (row.images as string[]) : undefined,
    orderId: row.order_id ? String(row.order_id) : undefined,
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    proposedPrice: row.proposed_price != null ? Number(row.proposed_price) : undefined,
    offerResult: (row.offer_result as ChatMessage['offerResult']) || undefined,
    ...parseMeetupFieldsFromDB(row),
  };
}

/**
 * 특정 채팅방의 메시지를 DB에서 받아 로컬(localStorage)에 반영.
 * DB가 원본, 로컬은 캐시.
 */
export async function syncRoomMessagesFromDB(roomId: string, userId?: string): Promise<void> {
  if (!roomId) return;
  try {
    const readRooms = (): ChatRoom[] => {
      try { return JSON.parse(getItem('all_chatrooms') || '[]'); } catch { return []; }
    };

    if (userId && !readRooms().some((r) => r.id === roomId)) {
      await syncChatRoomsFromDB(userId);
    }

    const res = await api.get<Record<string, unknown>[]>(`/api/chat-rooms/${roomId}/messages`);
    if (!res.ok || !Array.isArray(res.data)) return;

    const rooms = readRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const localById = new Map((room.messages || []).map((m) => [m.id, m]));
    const dbMessages = res.data.map((row) => {
      const dbMsg = mapChatMessageFromDB(row);
      if (dbMsg.type === 'receipt_confirmed' || dbMsg.content.includes('confirmed receipt')) {
        const meta = (() => {
          const idx = dbMsg.content.indexOf('\n§');
          if (idx < 0) return {} as { condition?: 'good' | 'normal' | 'bad'; notes?: string };
          const parts = dbMsg.content.slice(idx + 2).split('§');
          const raw = (parts[0] || '').trim();
          return {
            condition: (raw === 'good' || raw === 'normal' || raw === 'bad' ? raw : undefined) as
              | 'good'
              | 'normal'
              | 'bad'
              | undefined,
            notes: (parts[1] || '').trim() || undefined,
          };
        })();
        if (meta.condition) dbMsg.receiptCondition = meta.condition;
        if (meta.notes) dbMsg.receiptNotes = meta.notes;
        if (dbMsg.type === 'system') dbMsg.type = 'receipt_confirmed';
      }
      const local = localById.get(dbMsg.id);
      if (!local) return dbMsg;
      const dbHasMeetup = !!(dbMsg.meetupPlace || dbMsg.meetupDate || dbMsg.meetupTime);
      if (dbHasMeetup) return dbMsg;
      return {
        ...dbMsg,
        meetupPlace: local.meetupPlace,
        meetupDate: local.meetupDate,
        meetupTime: local.meetupTime,
      };
    });
    dbMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    room.messages = dbMessages;

    const last = dbMessages[dbMessages.length - 1];
    if (last) {
      room.lastMessage = last.images && last.images.length > 0 ? (last.content || 'Photo') : last.content;
      room.lastMessageTime = last.timestamp;
    }

    const uid = userId || getCurrentUserId();
    if (uid) applyUnreadFromMessages(room, uid);

    setItem('all_chatrooms', JSON.stringify(rooms));
    window.dispatchEvent(new Event('chatRoomsChanged'));
  } catch {
    // 오프라인 시 무시
  }
}

function mapChatRoomFromDB(row: Record<string, unknown>): ChatRoom {

  const otherUser = row.other_user as Record<string, unknown> | undefined;
  const pd = row.product_data as Record<string, unknown> | undefined;
  const sellerUser = (row.seller_user ?? row.other_user) as Record<string, unknown> | undefined;
  const { readStatus, lastReadAt } = parseReadStateFromDB(row.read_state);
  const leftRaw = row.left_user_ids;
  const leftUserIds = Array.isArray(leftRaw)
    ? leftRaw.map((id) => String(id))
    : [];
  const orderId = row.order_id ? String(row.order_id) : undefined;
  const linkedOrder = lookupOrderById(orderId);

  const product = pd && pd.id ? {
    id: String(pd.id),
    title: String(pd.title || ''),
    price: Number(pd.price || 0),
    images: Array.isArray(pd.images) ? (pd.images as string[]) : [],
    category: String(pd.category || ''),
    region: String(pd.region || ''),
    status: String(pd.status || 'active') as import('@/types').ProductStatus,
    description: String(pd.description || ''),
    createdAt: String(pd.created_at || new Date().toISOString()),
    seller: {
      id: String(pd.seller_id || ''),
      nickname: sellerUser ? String(sellerUser.nickname || '') : '',
      profileImage: sellerUser ? String(sellerUser.profile_image || '') : '',
      kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,
    },
    tradeMethods: Array.isArray(pd.trade_methods) ? (pd.trade_methods as import('@/types').TradeMethod[]) : [],
    todayTradeAvailable: !!pd.today_trade_available,
    liked: false,
    isFreeShare: !!pd.is_free_share,
    allowOffer: !!pd.allow_offer,
  } : undefined;

  return {

    id: String(row.id),

    buyerId: String(row.buyer_id || ''),

    sellerId: String(row.seller_id || ''),

    lastMessage: String(row.last_message || ''),

    lastMessageTime: String(row.last_message_time || row.created_at || new Date().toISOString()),

    unreadCount: Number(row.unread_count || 0),

    isRead: false,

    messages: [],

    readStatus,

    lastReadAt,

    leftUserIds,
    adminHidden: !!row.admin_hidden,
    productAdminHidden: !!row.product_admin_hidden,

    product,

    order: linkedOrder,

    otherUser: otherUser ? applyProfileCacheToUser({

      id: String(otherUser.id || ''),

      nickname: String(otherUser.nickname || ''),

      profileImage: String(otherUser.profile_image || ''),

      kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,

    }) : { id: '', nickname: '', kycStatus: 'unverified' as const, trustScore: 0, rating: 0, tradeCount: 0 },

  };

}


// ─── 댓글 동기화 ──────────────────────────────────────────────

/** 댓글을 DB에 저장 — 성공 시 갱신된 댓글 수 반환 */
export async function syncCommentToDB(
  postId: string,
  comment: { id: string; authorId: string; content: string; parentId?: string }
): Promise<{ ok: boolean; count?: number }> {
  try {
    const res = await api.post<{ count: number }>(`/api/posts/${postId}/comments`, {
      id: comment.id,
      author_id: comment.authorId,
      content: comment.content,
      parent_id: comment.parentId,
    });
    return { ok: res.ok, count: res.ok ? res.data?.count : undefined };
  } catch {
    return { ok: false };
  }
}

/** 댓글 삭제 — 성공 시 갱신된 댓글 수 반환 */
export async function syncCommentDeleteToDB(commentId: string): Promise<{ ok: boolean; count?: number }> {
  try {
    const res = await api.delete<{ count: number }>(`/api/comments/${commentId}`);
    return { ok: res.ok, count: res.ok ? res.data?.count : undefined };
  } catch {
    return { ok: false };
  }
}

/** DB에서 게시물의 댓글을 로드 (DB-first) */
export async function syncCommentsFromDB(postId: string): Promise<void> {
  try {
    const res = await api.get<Record<string, unknown>[]>(`/api/posts/${postId}/comments`);
    if (res.ok && res.data) {
      const rows = res.data as unknown as Record<string, unknown>[];
      const authorRow = (row: Record<string, unknown>) => {
        const a = (row.author as Record<string, unknown> | undefined) || undefined;
        if (a && typeof a === 'object' && a.id) {
          cacheEmbeddedUser(a);
          return applyProfileCacheToUser({
            id: String(a.id || ''),
            nickname: String(a.nickname || ''),
            profileImage: (a.profile_image as string | undefined) || '',
            kycStatus: ((a.kyc_status as string | undefined) || 'unverified') as 'verified' | 'unverified',
            trustScore: 0,
            rating: 0,
            tradeCount: 0,
          });
        }
        const authorId = String(row.author_id || '');
        return { id: authorId, nickname: authorId, profileImage: '', kycStatus: 'unverified' };
      };
      const dbComments = rows.map((row) => ({
        id: String(row.id),
        postId,
        author: authorRow(row),
        content: String(row.content || ''),
        parentId: (row.parent_id as string | undefined) || undefined,
        createdAt: String(row.created_at || new Date().toISOString()),
      }));
      const raw = getItem('community_comments');
      const all: Record<string, unknown[]> = raw ? JSON.parse(raw) : {};
      all[postId] = dbComments.sort((a, b) => {
        const ta = new Date(String((a as { createdAt?: string }).createdAt || 0)).getTime();
        const tb = new Date(String((b as { createdAt?: string }).createdAt || 0)).getTime();
        return ta - tb;
      });
      setItem('community_comments', JSON.stringify(all));
      window.dispatchEvent(new Event('commentsChanged'));
      await syncPostCommentCountFromDB(postId);
    }
  } catch {
    // 오프라인 시 무시
  }
}

// ─── 리뷰 동기화 ─────────────────────────────────────────────

/** 리뷰를 DB에 저장 — 성공 여부 반환 (호출처에서 navigate 분기용) */
export async function syncReviewToDB(review: {
  id: string; reviewerId: string; revieweeId: string; orderId: string;
  rating: number; tags?: string[]; comment?: string;
  productTitle?: string; productImage?: string;
}): Promise<boolean> {
  try {
    const userSyncs: Promise<void>[] = [];
    if (review.reviewerId && !_userSyncedCache.has(review.reviewerId)) userSyncs.push(
      api.post('/api/users', { id: review.reviewerId, kyc_status: 'unverified' }).then((r) => { if (r.ok) _userSyncedCache.set(review.reviewerId, JSON.stringify({ id: review.reviewerId, kyc_status: 'unverified' })); }).catch(() => {})
    );
    if (review.revieweeId && !_userSyncedCache.has(review.revieweeId)) userSyncs.push(
      api.post('/api/users', { id: review.revieweeId, kyc_status: 'unverified' }).then((r) => { if (r.ok) _userSyncedCache.set(review.revieweeId, JSON.stringify({ id: review.revieweeId, kyc_status: 'unverified' })); }).catch(() => {})
    );
    if (userSyncs.length) await Promise.all(userSyncs);
    const res = await api.post('/api/reviews', {
      id: review.id,
      reviewer_id: review.reviewerId,
      reviewee_id: review.revieweeId,
      order_id: review.orderId,
      rating: review.rating,
      tags: review.tags || [],
      comment: review.comment,
      product_title: review.productTitle,
      product_image: review.productImage,
    });
    return !!res.ok;
  } catch {
    return false;
  }
}

function mapReviewRowFromDB(row: Record<string, unknown>): Review {
  const reviewer = (row.reviewer as Record<string, unknown>) || {};
  return {
    id: String(row.id),
    orderId: String(row.order_id || ''),
    rating: Number(row.rating || 0),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    comment: String(row.comment || ''),
    productTitle: String(row.product_title || ''),
    productImage: String(row.product_image || ''),
    createdAt: String(row.created_at || new Date().toISOString()),
    reviewer: {
      id: String(reviewer.id || row.reviewer_id || ''),
      nickname: String(reviewer.nickname || ''),
      profileImage: reviewer.profile_image as string | undefined,
      kycStatus: 'verified',
      trustScore: 0,
      rating: 0,
      tradeCount: 0,
    },
  };
}

/** DB에서 받은·쓴 리뷰 로드 (DB-first) */
export async function syncReviewsFromDB(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const [receivedRes, writtenRes] = await Promise.all([
      api.get<Record<string, unknown>[]>(`/api/reviews?reviewee_id=${userId}`),
      api.get<Record<string, unknown>[]>(`/api/reviews?reviewer_id=${userId}`),
    ]);
    if (receivedRes.ok && Array.isArray(receivedRes.data)) {
      const reviews = receivedRes.data.map(mapReviewRowFromDB);
      const map: Record<string, unknown[]> = (() => {
        try { return JSON.parse(getItem('all_received_reviews') || '{}'); } catch { return {}; }
      })();
      map[userId] = reviews;
      setItem('all_received_reviews', JSON.stringify(map));
    }
    if (writtenRes.ok && Array.isArray(writtenRes.data)) {
      const written = writtenRes.data.map(mapReviewRowFromDB);
      setItem(`my_written_reviews_${userId}`, JSON.stringify(written));
    }
    window.dispatchEvent(new Event('reviewsChanged'));
  } catch {
    // ignore
  }
}

// ─── 분쟁 동기화 ─────────────────────────────────────────────

/** 분쟁을 DB에 저장 — 성공 여부 반환 */
export async function syncDisputeToDB(dispute: {
  id: string; orderId: string; productTitle: string; productImage: string;
  proposedPrice: number; tradeMethod: string; buyerId: string;
  sellerId: string; openedByUserId?: string; reason: string; action: string; description: string;
  evidence: string[];
}): Promise<boolean> {
  try {
    const res = await api.post('/api/disputes', {
      id: dispute.id,
      order_id: dispute.orderId,
      product_title: dispute.productTitle,
      product_image: dispute.productImage,
      proposed_price: dispute.proposedPrice,
      trade_method: dispute.tradeMethod,
      buyer_id: dispute.buyerId,
      seller_id: dispute.sellerId,
      opened_by_user_id: dispute.openedByUserId,
      reason: dispute.reason,
      action: dispute.action,
      description: dispute.description,
      evidence: dispute.evidence,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 분쟁 상태 변경 — 당사자 합의 해결 / 중재 요청 */
export async function syncDisputeStatusToDB(
  disputeId: string,
  status: 'IN_REVIEW' | 'RESOLVED',
  adminResponse?: string,
): Promise<boolean> {
  try {
    const res = await api.put(`/api/disputes/${disputeId}`, {
      status,
      admin_response: adminResponse,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function mapDisputeFromDB(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    orderId: String(row.order_id || ''),
    productTitle: String(row.product_title || ''),
    productImage: String(row.product_image || ''),
    proposedPrice: Number(row.proposed_price || 0),
    tradeMethod: String(row.trade_method || ''),
    buyerId: String(row.buyer_id || ''),
    buyerNickname: String(row.buyer_nickname || ''),
    sellerId: String(row.seller_id || ''),
    sellerNickname: String(row.seller_nickname || ''),
    openedByUserId: row.opened_by_user_id ? String(row.opened_by_user_id) : undefined,
    reason: String(row.reason || ''),
    action: String(row.action || ''),
    description: String(row.description || ''),
    evidence: Array.isArray(row.evidence)
      ? (row.evidence as string[])
      : typeof row.evidence === 'string' && row.evidence.trim()
        ? (() => {
            try {
              const parsed = JSON.parse(row.evidence);
              return Array.isArray(parsed) ? parsed.map(String) : [];
            } catch {
              return [];
            }
          })()
        : [],
    status: String(row.status || 'OPEN') as 'OPEN' | 'IN_REVIEW' | 'RESOLVED',
    createdAt: String(row.created_at || new Date().toISOString()),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    adminResponse: row.admin_response ? String(row.admin_response) : undefined,
  };
}

/** DB에서 내 분쟁 목록 로드 (DB-first) */
export async function syncDisputesFromDB(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const [buyerRes, sellerRes] = await Promise.all([
      api.get<Record<string, unknown>[]>(`/api/disputes?buyer_id=${userId}`),
      api.get<Record<string, unknown>[]>(`/api/disputes?seller_id=${userId}`),
    ]);
    const rows = [
      ...(buyerRes.ok && Array.isArray(buyerRes.data) ? buyerRes.data : []),
      ...(sellerRes.ok && Array.isArray(sellerRes.data) ? sellerRes.data : []),
    ] as Record<string, unknown>[];
    if (!buyerRes.ok && !sellerRes.ok) return;
    const byId = new Map<string, ReturnType<typeof mapDisputeFromDB>>();
    try {
      const localRaw = getItem('myDisputes');
      const local = localRaw ? JSON.parse(localRaw) : [];
      if (Array.isArray(local)) {
        for (const d of local) {
          if (!d?.id) continue;
          const mine = d.buyerId === userId || d.sellerId === userId;
          if (mine && !isWithinGraceWindow(d.createdAt)) continue;
          byId.set(String(d.id), d);
        }
      }
    } catch {
      /* keep going with DB rows */
    }
    rows.forEach((row) => {
      const d = mapDisputeFromDB(row);
      byId.set(d.id, d);
    });
    setItem('myDisputes', JSON.stringify(Array.from(byId.values())));
    window.dispatchEvent(new Event('disputesChanged'));
  } catch {
    // ignore
  }
}

// ─── 즐겨찾기 동기화 ─────────────────────────────────────────

/** 즐겨찾기 추가 — 성공 여부 반환 */
export async function syncFavoriteAddToDB(userId: string, productId: string): Promise<boolean> {
  try {
    if (!_userSyncedCache.has(userId)) {
      const uRes = await api.post('/api/users', { id: userId, kyc_status: 'unverified' }).catch(() => null);
      if (uRes && uRes.ok) _userSyncedCache.set(userId, JSON.stringify({ id: userId, kyc_status: 'unverified' }));
    }
    const res = await api.post('/api/favorites', { user_id: userId, product_id: productId });
    return res.ok;
  } catch {
    return false;
  }
}

/** 즐겨찾기 삭제 */
export async function syncFavoriteRemoveFromDB(userId: string, productId: string): Promise<boolean> {
  try {
    const res = await api.delete(`/api/favorites?user_id=${userId}&product_id=${productId}`);
    return res.ok;
  } catch {
    return false;
  }
}

/** DB에서 즐겨찾기 목록 로드 */
export async function syncFavoritesFromDB(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const res = await api.get<Record<string, unknown>[]>(`/api/favorites?user_id=${userId}`);
    if (res.ok && res.data) {
      const rows = res.data as unknown as Record<string, unknown>[];
      const products = rows
        .map((r) => r.product as Record<string, unknown> | null)
        .filter(Boolean)
        .map((p) => p!);
      const key = `myFavorites_${userId}`;
      localStorage.setItem(key, JSON.stringify(products));
      window.dispatchEvent(new Event('favoritesChanged'));
      window.dispatchEvent(new Event('productsChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}

// ─── 알림 동기화 ─────────────────────────────────────────────

/** 알림을 DB에 저장 */
export async function syncNotificationToDB(notification: {
  id: string; targetUserId: string; type: string;
  title: string; content: string; link?: string;
}): Promise<boolean> {
  try {
    if (!_userSyncedCache.has(notification.targetUserId)) {
      const uRes = await api.post('/api/users', { id: notification.targetUserId, kyc_status: 'unverified' }).catch(() => null);
      if (uRes && uRes.ok) _userSyncedCache.set(notification.targetUserId, JSON.stringify({ id: notification.targetUserId, kyc_status: 'unverified' }));
    }
    const res = await api.post('/api/notifications', {
      id: notification.id,
      target_user_id: notification.targetUserId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      link: notification.link,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 알림 삭제 DB 반영 */
export async function syncNotificationsDeleteToDB(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const res = await api.post('/api/notifications/bulk-delete', { ids });
    return res.ok;
  } catch {
    return false;
  }
}

/** 알림 읽음 처리 DB 반영 */
export async function syncNotificationReadToDB(notifId: string): Promise<boolean> {
  try {
    const res = await api.put(`/api/notifications/${notifId}/read`, {});
    return res.ok;
  } catch {
    return false;
  }
}

/** DB에서 알림 목록 로드 */
export async function syncNotificationsFromDB(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const res = await api.get<Record<string, unknown>[]>(`/api/notifications?target_user_id=${userId}`);
    if (res.ok && res.data) {
      const rows = res.data as unknown as Record<string, unknown>[];
      const dbNotifs = rows.map((row) => ({
        id: String(row.id),
        targetUserId: String(row.target_user_id || ''),
        type: String(row.type || 'order'),
        title: String(row.title || ''),
        content: String(row.content || ''),
        timestamp: String(row.created_at || new Date().toISOString()),
        read: Boolean(row.read),
        link: row.link as string | undefined,
      }));
      // all_notifications는 heavyStorage(IndexedDB)에 저장됨 - 반드시 heavyStorage를 사용할 것
      const raw = getItem('all_notifications');
      const existing: { id: string; read?: boolean; targetUserId?: string; [k: string]: unknown }[] = raw ? JSON.parse(raw) : [];
      // 현재 사용자 것만 DB에서 가져온 dbNotifs로 교체, 다른 사용자 것은 유지
      const otherUsersNotifs = existing.filter((n) => n.targetUserId !== userId);
      const all = [...dbNotifs, ...otherUsersNotifs];
      setItem('all_notifications', JSON.stringify(all));
      window.dispatchEvent(new Event('notificationsChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}

// ─── 앱 시작 시 전체 동기화 ──────────────────────────────────

/** DB 닉네임이 "실제 사용자가 정한 닉네임"인지 (uid/게스트/UUID 값 제외) */
function isRealDbNickname(nickname: string, userId: string): boolean {
  return Boolean(
    nickname &&
    nickname !== userId &&
    !nickname.startsWith('guest_') &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(nickname)
  );
}

/** DB에 프로필이 없을 때, 예전 로컬 캐시(닉네임·거래·분쟁·뱃지)를 버린다. */
export function resetLocalCacheForIncompleteProfile(userId: string): void {
  if (!userId) return;

  const keys = [
    `marketpiepie_onboarding_v1_${userId}`,
    'marketpiepie_device_profile_once_v1',
    `user_profile_${userId}`,
    `userRegion_${userId}`,
    `unlocked_activity_badges_${userId}`,
    `purchased_activity_badges_${userId}`,
    `notified_badge_ids_${userId}`,
    `myFavorites_${userId}`,
    `my_written_reviews_${userId}`,
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  const stripMine = (raw: string | null, keep: (row: Record<string, unknown>) => boolean): string => {
    try {
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return raw || '[]';
      return JSON.stringify(list.filter(keep));
    } catch {
      return raw || '[]';
    }
  };

  setItem(
    'all_orders',
    stripMine(getItem('all_orders'), (o) => {
      const buyerId = (o.buyer as { id?: string } | undefined)?.id;
      const sellerId = (o.seller as { id?: string } | undefined)?.id;
      return buyerId !== userId && sellerId !== userId;
    }),
  );
  setItem(
    'myDisputes',
    stripMine(getItem('myDisputes'), (d) => d.buyerId !== userId && d.sellerId !== userId),
  );
  for (const key of ['community_user_posts', 'community_feed_posts', 'community_dispute_posts'] as const) {
    setItem(
      key,
      stripMine(getItem(key), (p) => (p.author as { id?: string } | undefined)?.id !== userId),
    );
  }
  try {
    const map = JSON.parse(getItem('all_received_reviews') || '{}') as Record<string, unknown>;
    if (map && typeof map === 'object') {
      delete map[userId];
      setItem('all_received_reviews', JSON.stringify(map));
    }
  } catch {
    /* ignore */
  }

  window.dispatchEvent(new Event('profileSaved'));
  window.dispatchEvent(new Event('ordersChanged'));
  window.dispatchEvent(new Event('disputesChanged'));
  window.dispatchEvent(new Event('reviewsChanged'));
  window.dispatchEvent(new Event('postsChanged'));
  window.dispatchEvent(new Event('activityBadgesChanged'));
  window.dispatchEvent(new Event('regionChanged'));
}

/**
 * DB 프로필 상태 확인 (로그인 라우팅용).
 * - complete: users에 실제 닉네임 있음 → 홈으로
 * - incomplete: 없거나 미완성 → /signup 으로
 * - unknown: 네트워크 오류 → 로컬 기준으로 폴백
 */
export async function checkMyProfileInDB(
  userId: string,
): Promise<'complete' | 'incomplete' | 'unknown'> {
  try {
    const res = await api.get<Record<string, unknown>>(`/api/users/${userId}`);
    if (res.status === 404) return 'incomplete';
    if (!res.ok || !res.data) return 'unknown';
    return isRealDbNickname(String(res.data.nickname || ''), userId)
      ? 'complete'
      : 'incomplete';
  } catch {
    return 'unknown';
  }
}

/** 프로필을 DB에 저장하고 성공 여부 반환 (가입 완료 시 필수 경로) */
export async function saveMyProfileToDB(
  userId: string,
  profile: {
    nickname: string;
    bio?: string;
    profileImage?: string;
    activityRegion?: string;
    displayActivityBadgeId?: string | null;
  },
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {
      id: userId,
      nickname: profile.nickname,
      profile_image: profile.profileImage,
      bio: profile.bio,
      activity_region: profile.activityRegion,
      kyc_status: 'unverified',
    };
    if ('displayActivityBadgeId' in profile) {
      payload.display_activity_badge_id = profile.displayActivityBadgeId || '';
    }
    const res = await api.post('/api/users', payload);
    return res.ok;
  } catch {
    return false;
  }
}

/** 앱 초기화 시 호출 - DB 프로필을 원본으로 로컬 캐시 갱신 */
export async function syncMyProfileFromDB(userId: string): Promise<void> {
  try {
    const res = await api.get<Record<string, unknown>>(`/api/users/${userId}`);
    if (res.ok && res.data) {
      const u = res.data;
      const profileKey = `user_profile_${userId}`;
      const dbNickname = String(u.nickname || '');

      let existing: Record<string, unknown> | null = null;
      try { existing = JSON.parse(localStorage.getItem(profileKey) || 'null'); } catch { /* ignore */ }

      // DB가 원본: 실제 닉네임이 있으면 DB 값으로 로컬 캐시를 덮어쓴다
      if (isRealDbNickname(dbNickname, userId)) {
        const profile = {
          ...(existing || {}),
          nickname: dbNickname,
          profileImage: String(u.profile_image || '') || (existing?.profileImage as string) || '/default-avatar.jpg',
          bio: String(u.bio || '') || (existing?.bio as string) || '',
          activityRegion: String(u.activity_region || '') || (existing?.activityRegion as string) || '',
          displayActivityBadgeId:
            u.display_activity_badge_id != null
              ? String(u.display_activity_badge_id).trim() || undefined
              : (existing?.displayActivityBadgeId as string | undefined),
        };
        localStorage.setItem(profileKey, JSON.stringify(profile));
        const dbRegion = String(u.activity_region || '').trim();
        if (dbRegion) {
          try { localStorage.setItem(`userRegion_${userId}`, dbRegion); } catch { /* ignore */ }
        }
        window.dispatchEvent(new Event('profileSaved'));
        if (dbRegion) window.dispatchEvent(new Event('regionChanged'));
      } else if (!existing) {
        const profile = {
          nickname: 'My nickname',
          profileImage: String(u.profile_image || '/default-avatar.jpg'),
          bio: String(u.bio || ''),
          activityRegion: String(u.activity_region || ''),
        };
        localStorage.setItem(profileKey, JSON.stringify(profile));
        const dbRegion = String(u.activity_region || '').trim();
        if (dbRegion) {
          try { localStorage.setItem(`userRegion_${userId}`, dbRegion); } catch { /* ignore */ }
        }
        window.dispatchEvent(new Event('profileSaved'));
        if (dbRegion) window.dispatchEvent(new Event('regionChanged'));
      } else if (existing && !isOnboardingExemptPath(window.location.pathname)) {
        // 가입/지역 선택 중에는 지우지 않는다
        resetLocalCacheForIncompleteProfile(userId);
      }
    }
  } catch { /* ignore */ }
}

export async function initDBSync(userId?: string): Promise<void> {
  // 목록 먼저(홈/커뮤니티), 나머지는 순차 — 동시 다발 요청으로 429 나는 것 완화
  await syncProductsFromDB();
  await syncPostsFromDB();
  if (userId) {
    await syncMyPostsFromDB(userId);
    await syncMyProfileFromDB(userId);
    await syncFavoritesFromDB(userId);
    await syncOrdersFromDB(userId);
    await syncChatRoomsFromDB(userId);
    await syncNotificationsFromDB(userId);
    await syncReviewsFromDB(userId);
    await syncDisputesFromDB(userId);
  }
}
