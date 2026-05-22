/**
 * DB 동기화 레이어
 * - 앱 시작 시 API에서 데이터를 가져와 localStorage를 최신화
 * - 데이터 저장 시 localStorage + API 동시에 저장
 */
import { api } from '@/utils/api';
import { Product, Post, User, Order, ChatRoom, ChatMessage, ORDER_STATUS_VALUE } from '@/types';
import { setItem, getItem } from '@/utils/heavyStorage';

// ─── 유저 동기화 ──────────────────────────────────────────────

const _userSyncedCache = new Set<string>();

/** 유저를 DB에 upsert */
export async function syncUserToDB(user: User): Promise<void> {
  if (_userSyncedCache.has(user.id)) return;
  try {
    const res = await api.post('/api/users', {
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
    });
    if (res.ok) {
      _userSyncedCache.add(user.id);
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
      const dbProducts = (res.data as unknown as Record<string, unknown>[])
        .map(mapProductFromDB)
        .filter((p) => !deletedSet.has(p.id));
      const local: Product[] = (() => {
        try { return JSON.parse(getItem('all_products') || '[]'); } catch { return []; }
      })();
      const dbIds = new Set(dbProducts.map((p) => p.id));
      const merged: Product[] = [];
      for (const dbP of dbProducts) {
        const localP = local.find((p) => p.id === dbP.id);
        merged.push(localP ? { ...localP, status: dbP.status, seller: dbP.seller } : dbP);
      }
      const myUserId = sessionStorage.getItem('currentUserId') || '';
      const localOnly = local.filter((p) =>
        !dbIds.has(p.id) && !deletedSet.has(p.id) && p.seller?.id === myUserId
      );
      merged.push(...localOnly);
      setItem('all_products', JSON.stringify(merged));
      window.dispatchEvent(new Event('productsChanged'));
    }
  } catch {
    // 오프라인 시 localStorage 그대로 사용
  }
}

/** 상품을 DB에 저장 */
export async function syncProductToDB(product: Product): Promise<void> {
  try {
    // 판매자 먼저 저장 (FK: seller_id → users.id)
    await syncUserToDB(product.seller);
    await api.post<unknown>('/api/products', {
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
  } catch {
    // 오프라인 시 무시
  }
}

/** 상품 상태 업데이트 */
export async function syncProductStatusToDB(productId: string, status: string): Promise<void> {
  try {
    await api.patch(`/api/products/${productId}/status`, { status });
  } catch {
    // 오프라인 시 무시
  }
}

/** 상품 삭제 */
export async function syncProductDeleteToDB(productId: string): Promise<void> {
  try {
    const res = await api.delete(`/api/products/${productId}`);
    if (res.ok) clearDeletedProductId(productId);
  } catch {
    // 오프라인 시 무시 — deleted_product_ids에 남아있어서 다음 sync에서도 필터됨
  }
}

// ─── DB → 앱 타입 변환 ────────────────────────────────────────

function mapProductFromDB(row: Record<string, unknown>): Product {
  const seller = (row.seller as Record<string, unknown>) || {};
  return {
    id: String(row.id),
    title: String(row.title || ''),
    price: Number(row.price || 0),
    images: (row.images as string[]) || [],
    category: String(row.category || ''),
    region: String(row.region || ''),
    status: (row.status as Product['status']),
    description: String(row.description || ''),
    createdAt: String(row.created_at || new Date().toISOString()),
    seller: {
      id: String(seller.id || ''),
      nickname: String(seller.nickname || ''),
      profileImage: seller.profile_image as string | undefined,
      kycStatus: (seller.kyc_status as 'verified' | 'unverified') || 'unverified',
      trustScore: Number(seller.trust_score || 0),
      rating: Number(seller.rating || 0),
      tradeCount: Number(seller.trade_count || 0),
      activityRegion: seller.activity_region as string | undefined,
      bio: seller.bio as string | undefined,
    },
    tradeMethods: (row.trade_methods as Product['tradeMethods']) || [],
    todayTradeAvailable: Boolean(row.today_trade_available),
    liked: false,
    isFreeShare: Boolean(row.is_free_share),
    allowOffer: Boolean(row.allow_offer),
  };
}

// ─── 커뮤니티 게시물 동기화 ──────────────────────────────────

/** API에서 게시물 목록을 가져와 localStorage 갱신 */
export async function syncPostsFromDB(): Promise<void> {
  try {
    const res = await api.get<Post[]>('/api/posts');
    if (!res.ok) return;
    if (res.data) {
      const dbPosts = (res.data as unknown as Record<string, unknown>[]).map(mapPostFromDB);
      setItem('community_user_posts', JSON.stringify(dbPosts));
      const localDispute: unknown[] = (() => { try { return JSON.parse(getItem('community_dispute_posts') || '[]'); } catch { return []; } })();
      if (localDispute.length > 0 && dbPosts.length === 0) {
        setItem('community_dispute_posts', '[]');
      }
      window.dispatchEvent(new Event('postsChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}

/** 게시물을 DB에 저장 */
export async function syncPostToDB(post: Post): Promise<void> {
  try {
    // 작성자 먼저 저장 (FK 제약: author_id → users.id)
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
    await api.post('/api/posts', {
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
  } catch {
    // 오프라인 시 무시
  }
}

/** 게시물 삭제 */
export async function syncPostDeleteToDB(postId: string): Promise<void> {
  try {
    await api.delete(`/api/posts/${postId}`);
  } catch {
    // 오프라인 시 무시
  }
}

// ─── DB → Post 타입 변환 ──────────────────────────────────

function mapPostFromDB(row: Record<string, unknown>): Post {
  const author = (row.author as Record<string, unknown>) || {};
  return {
    id: String(row.id),
    title: String(row.title || ''),
    content: String(row.content || ''),
    category: String(row.category || '') as Post['category'],
    commentCount: Number(row.comment_count || 0),
    createdAt: String(row.created_at || new Date().toISOString()),
    images: (row.images as string[]) || [],
    tags: (row.tags as string[]) || [],
    region: row.region as string | undefined,
    latitude: row.latitude as number | undefined,
    longitude: row.longitude as number | undefined,
    orderId: row.order_id as string | undefined,
    author: {
      id: String(author.id || ''),
      nickname: String(author.nickname || ''),
      profileImage: author.profile_image as string | undefined,
      kycStatus: (author.kyc_status as 'verified' | 'unverified') || 'unverified',
      trustScore: Number(author.trust_score || 0),
      rating: Number(author.rating || 0),
      tradeCount: Number(author.trade_count || 0),
      activityRegion: author.activity_region as string | undefined,
      bio: author.bio as string | undefined,
    },
  };
}

// ─── 주문 동기화 ──────────────────────────────────────────────

/** 주문을 DB에 저장 (upsert) */
export async function syncOrderToDB(order: Order): Promise<void> {
  try {
    await Promise.all([syncUserToDB(order.buyer), syncUserToDB(order.seller)]);
    await api.post('/api/orders', {
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
      buyer_completed: order.buyerCompleted,
      seller_completed: order.sellerCompleted,
    });
    if (order.timeline?.length) {
      const last = order.timeline[order.timeline.length - 1];
      await api.post(`/api/orders/${order.id}/timeline`, {
        id: last.id,
        event_type: last.type,
        description: last.description,
      });
    }
  } catch {
    // 오프라인 시 무시
  }
}

/** 주문 상태 업데이트 */
export async function syncOrderStatusToDB(
  orderId: string,
  status: string,
  timelineEvent?: { id: string; type: string; description: string },
  extra?: { buyer_completed?: boolean; seller_completed?: boolean; meetup_location?: string; meetup_date?: string; meetup_time?: string }
): Promise<void> {
  try {
    await api.put(`/api/orders/${orderId}`, { status, ...extra });
    if (timelineEvent) {
      await api.post(`/api/orders/${orderId}/timeline`, {
        id: timelineEvent.id,
        event_type: timelineEvent.type,
        description: timelineEvent.description,
      });
    }
  } catch {
    // 오프라인 시 무시
  }
}

/** DB에서 내 주문 목록을 로드해 localStorage 갱신 (로컬 전용 주문 보존) */
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
      const mergedMap = new Map(existing.map((o) => [o.id, o]));
      rows.forEach((row) => {
        const id = String(row.id);
        const local = mergedMap.get(id);
        if (local) {
          const dbStatus = String(row.status || '');
          const dbBuyerCompleted = Boolean(row.buyer_completed);
          const dbSellerCompleted = Boolean(row.seller_completed);
          if (dbBuyerCompleted && !local.buyerCompleted) local.buyerCompleted = true;
          if (dbSellerCompleted && !local.sellerCompleted) local.sellerCompleted = true;
          const statusOrder = [
            ORDER_STATUS_VALUE.PENDING_OFFER,
            ORDER_STATUS_VALUE.ACCEPTED,
            ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO,
            ORDER_STATUS_VALUE.MEETUP_SET,
            ORDER_STATUS_VALUE.SHIPPED,
            ORDER_STATUS_VALUE.DELIVERED,
            ORDER_STATUS_VALUE.RECEIVED,
            ORDER_STATUS_VALUE.COMPLETE,
          ];
          if (dbStatus === ORDER_STATUS_VALUE.DISPUTE) {
            local.status = ORDER_STATUS_VALUE.DISPUTE;
          } else {
            const localIdx = statusOrder.indexOf(local.status as any);
            const dbIdx = statusOrder.indexOf(dbStatus as any);
            if (dbIdx > localIdx) local.status = dbStatus as Order['status'];
          }
          if (local.buyerCompleted && local.sellerCompleted && local.status !== ORDER_STATUS_VALUE.COMPLETE) {
            local.status = ORDER_STATUS_VALUE.COMPLETE;
          }
          if (!local.meetupPlace && row.meetup_place) local.meetupPlace = String(row.meetup_place);
          if (!local.meetupDate && row.meetup_date) local.meetupDate = String(row.meetup_date);
          if (!local.meetupTime && row.meetup_time) local.meetupTime = String(row.meetup_time);
          mergedMap.set(id, local);
        } else {
          mergedMap.set(id, mapOrderFromDB(row));
        }
      });
      setItem('all_orders', JSON.stringify(Array.from(mergedMap.values())));
      window.dispatchEvent(new Event('ordersChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}

function mapOrderFromDB(row: Record<string, unknown>): Order {
  const buyer = (row.buyer as Record<string, unknown>) || {};
  const seller = (row.seller as Record<string, unknown>) || {};
  const product = (row.product as Record<string, unknown>) || {};
  return {
    id: String(row.id),
    status: String(row.status || '') as Order['status'],
    proposedPrice: Number(row.proposed_price || 0),
    tradeMethod: String(row.trade_method || '') as Order['tradeMethod'],
    meetupPlace: row.meetup_place as string | undefined,
    meetupDate: row.meetup_date as string | undefined,
    meetupTime: row.meetup_time as string | undefined,
    memo: row.memo as string | undefined,
    buyerCompleted: Boolean(row.buyer_completed),
    sellerCompleted: Boolean(row.seller_completed),
    createdAt: String(row.created_at || new Date().toISOString()),
    timeline: [],
    buyer: {
      id: String(buyer.id || ''), nickname: String(buyer.nickname || ''),
      profileImage: buyer.profile_image as string | undefined,
      kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,
    },
    seller: {
      id: String(seller.id || ''), nickname: String(seller.nickname || ''),
      profileImage: seller.profile_image as string | undefined,
      kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,
    },
    product: {
      id: String(product.id || row.product_id || ''),
      title: String(product.title || ''),
      price: Number(product.price || 0),
      images: Array.isArray(product.images) ? (product.images as string[]) : [],
      category: String(product.category || ''),
      region: String(product.region || ''),
      status: (product.status as Product['status']) || ('판매중' as const),
      description: String(product.description || ''),
      createdAt: String(product.created_at || ''),
      liked: false,
      isFreeShare: Boolean(product.is_free_share),
      allowOffer: Boolean(product.allow_offer),
      tradeMethods: Array.isArray(product.trade_methods) ? (product.trade_methods as Product['tradeMethods']) : [],
      todayTradeAvailable: Boolean(product.today_trade_available),
      seller: {
        id: String(seller.id || ''), nickname: String(seller.nickname || ''),
        kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,
      },
    },
  };
}

// ─── 채팅 동기화 ──────────────────────────────────────────────

/** 채팅방을 DB에 저장 */
export async function syncChatRoomToDB(room: ChatRoom): Promise<void> {
  try {
    // 구매자/판매자 먼저 저장 (FK: buyer_id, seller_id → users.id)
    const syncUsers: Promise<void>[] = [];
    if (room.buyerInfo) { syncUsers.push(syncUserToDB(room.buyerInfo)); }
    if (room.sellerInfo) { syncUsers.push(syncUserToDB(room.sellerInfo)); }


    if (syncUsers.length) await Promise.all(syncUsers);
    await api.post('/api/chat-rooms', {
      id: room.id,
      buyer_id: room.buyerId,
      seller_id: room.sellerId,
      product_id: room.product?.id,
      order_id: room.order?.id,
    });
  } catch {
    // 오프라인 시 무시
  }
}

/** 메시지를 DB에 저장 */
export async function syncMessageToDB(roomId: string, message: ChatMessage): Promise<void> {
  try {
    // 채팅방이 DB에 없으면 메시지도 실패하므로 송신자를 먼저 저장
    // (sender_id → users.id FK)
    await api.post(`/api/chat-rooms/${roomId}/messages`, {
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
  } catch {
    // 오프라인 시 무시
  }
}

/** DB에서 내 채팅방 목록을 로드해 localStorage 갱신 */
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
      // Keep rooms that exist only locally (not yet in API / failed sync) — old logic dropped them entirely
      const mergedMap = new Map<string, ChatRoom>(existingMap);
      rows.forEach((row) => {
        const id = String(row.id);
        const dbRoom = mapChatRoomFromDB(row);
        const local = existingMap.get(id);
        if (local) {
          if (dbRoom.otherUser && dbRoom.otherUser.nickname && (!local.otherUser || !local.otherUser.nickname)) {
            local.otherUser = dbRoom.otherUser;
          }
          if (!local.sellerInfo && dbRoom.otherUser && local.sellerId !== userId) {
            local.sellerInfo = dbRoom.otherUser;
          }
          if (!local.buyerInfo && dbRoom.otherUser && local.buyerId !== userId) {
            local.buyerInfo = dbRoom.otherUser;
          }
          if (!local.product && dbRoom.product) {
            local.product = dbRoom.product;
          }
          if (dbRoom.lastMessage && new Date(dbRoom.lastMessageTime) > new Date(local.lastMessageTime)) {
            local.lastMessage = dbRoom.lastMessage;
            local.lastMessageTime = dbRoom.lastMessageTime;
          }
          mergedMap.set(id, local);
        } else {
          mergedMap.set(id, dbRoom);
        }
      });
      setItem('all_chatrooms', JSON.stringify(Array.from(mergedMap.values())));
      window.dispatchEvent(new Event('chatRoomsChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}



function mapChatRoomFromDB(row: Record<string, unknown>): ChatRoom {

  const otherUser = row.other_user as Record<string, unknown> | undefined;
  const pd = row.product_data as Record<string, unknown> | undefined;
  const sellerUser = (row.seller_user ?? row.other_user) as Record<string, unknown> | undefined;

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

    readStatus: {},

    product,

    order: undefined,

    otherUser: otherUser ? {

      id: String(otherUser.id || ''),

      nickname: String(otherUser.nickname || ''),

      profileImage: String(otherUser.profile_image || ''),

      kycStatus: 'verified' as const, trustScore: 0, rating: 0, tradeCount: 0,

    } : { id: '', nickname: '', kycStatus: 'unverified' as const, trustScore: 0, rating: 0, tradeCount: 0 },

  };

}


// ─── 댓글 동기화 ──────────────────────────────────────────────

/** 댓글을 DB에 저장 */
export async function syncCommentToDB(
  postId: string,
  comment: { id: string; authorId: string; content: string; parentId?: string }
): Promise<void> {
  try {
    await api.post(`/api/posts/${postId}/comments`, {
      id: comment.id,
      author_id: comment.authorId,
      content: comment.content,
      parent_id: comment.parentId,
    });
  } catch {
    // 오프라인 시 무시
  }
}

/** 댓글 삭제 */
export async function syncCommentDeleteToDB(commentId: string): Promise<void> {
  try {
    await api.delete(`/api/comments/${commentId}`);
  } catch {
    // 오프라인 시 무시
  }
}

/** DB에서 게시물의 댓글을 로드 */
export async function syncCommentsFromDB(postId: string): Promise<void> {
  try {
    const res = await api.get<Record<string, unknown>[]>(`/api/posts/${postId}/comments`);
    if (res.ok && res.data) {
      const rows = res.data as unknown as Record<string, unknown>[];
      const authorRow = (row: Record<string, unknown>) => {
        const a = (row.author as Record<string, unknown> | undefined) || undefined;
        if (a && typeof a === 'object' && a.id) {
          return {
            id: String(a.id || ''),
            nickname: String(a.nickname || ''),
            profileImage: (a.profile_image as string | undefined) || '',
            kycStatus: (a.kyc_status as string | undefined) || 'unverified',
          };
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
      // community_comments는 heavyStorage에 저장됨
      const raw = getItem('community_comments');
      const all: Record<string, unknown[]> = raw ? JSON.parse(raw) : {};
      const localList = Array.isArray(all[postId]) ? (all[postId] as Record<string, unknown>[]) : [];
      // 로컬과 DB를 id 기준으로 병합 (DB 데이터를 우선하되 로컬에만 있는 것도 유지)
      const byId = new Map<string, Record<string, unknown>>();
      for (const c of localList) byId.set(String((c as { id: unknown }).id || ''), c);
      for (const c of dbComments) byId.set(c.id, c);
      all[postId] = Array.from(byId.values()).sort((a, b) => {
        const ta = new Date(String((a as { createdAt?: string }).createdAt || 0)).getTime();
        const tb = new Date(String((b as { createdAt?: string }).createdAt || 0)).getTime();
        return ta - tb;
      });
      setItem('community_comments', JSON.stringify(all));
      window.dispatchEvent(new Event('commentsChanged'));
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
      api.post('/api/users', { id: review.reviewerId, kyc_status: 'unverified' }).then((r) => { if (r.ok) _userSyncedCache.add(review.reviewerId); }).catch(() => {})
    );
    if (review.revieweeId && !_userSyncedCache.has(review.revieweeId)) userSyncs.push(
      api.post('/api/users', { id: review.revieweeId, kyc_status: 'unverified' }).then((r) => { if (r.ok) _userSyncedCache.add(review.revieweeId); }).catch(() => {})
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

// ─── 분쟁 동기화 ─────────────────────────────────────────────

/** 분쟁을 DB에 저장 */
export async function syncDisputeToDB(dispute: {
  id: string; orderId: string; productTitle: string; productImage: string;
  proposedPrice: number; tradeMethod: string; buyerId: string;
  sellerId: string; reason: string; action: string; description: string;
  evidence: string[];
}): Promise<void> {
  try {
    await api.post('/api/disputes', {
      id: dispute.id,
      order_id: dispute.orderId,
      product_title: dispute.productTitle,
      product_image: dispute.productImage,
      proposed_price: dispute.proposedPrice,
      trade_method: dispute.tradeMethod,
      buyer_id: dispute.buyerId,
      seller_id: dispute.sellerId,
      reason: dispute.reason,
      action: dispute.action,
      description: dispute.description,
      evidence: dispute.evidence,
    });
  } catch {
    // 오프라인 시 무시
  }
}

// ─── 즐겨찾기 동기화 ─────────────────────────────────────────

/** 즐겨찾기 추가 */
export async function syncFavoriteAddToDB(userId: string, productId: string): Promise<void> {
  try {
    if (!_userSyncedCache.has(userId)) {
      const uRes = await api.post('/api/users', { id: userId, kyc_status: 'unverified' }).catch(() => null);
      if (uRes && uRes.ok) _userSyncedCache.add(userId);
    }
    await api.post('/api/favorites', { user_id: userId, product_id: productId });
  } catch {
    // 오프라인 시 무시
  }
}

/** 즐겨찾기 삭제 */
export async function syncFavoriteRemoveFromDB(userId: string, productId: string): Promise<void> {
  try {
    await api.delete(`/api/favorites?user_id=${userId}&product_id=${productId}`);
  } catch {
    // 오프라인 시 무시
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
}): Promise<void> {
  try {
    if (!_userSyncedCache.has(notification.targetUserId)) {
      const uRes = await api.post('/api/users', { id: notification.targetUserId, kyc_status: 'unverified' }).catch(() => null);
      if (uRes && uRes.ok) _userSyncedCache.add(notification.targetUserId);
    }
    await api.post('/api/notifications', {
      id: notification.id,
      target_user_id: notification.targetUserId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      link: notification.link,
    });
  } catch {
    // 오프라인 시 무시
  }
}

/** 알림 읽음 처리 DB 반영 */
export async function syncNotificationReadToDB(notifId: string): Promise<void> {
  try {
    await api.put(`/api/notifications/${notifId}/read`, {});
  } catch {
    // 오프라인 시 무시
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
      const existingMap = new Map(existing.map((n) => [n.id, n]));
      const merged = dbNotifs.map((n) => {
        const local = existingMap.get(n.id);
        return local?.read ? { ...n, read: true } : n;
      });
      const all = [...merged, ...otherUsersNotifs];
      setItem('all_notifications', JSON.stringify(all));
      window.dispatchEvent(new Event('notificationsChanged'));
    }
  } catch {
    // 오프라인 시 무시
  }
}

// ─── 앱 시작 시 전체 동기화 ──────────────────────────────────

/** 앱 초기화 시 호출 - API에서 최신 데이터 로드 */
export async function syncMyProfileFromDB(userId: string): Promise<void> {
  try {
    const res = await api.get<Record<string, unknown>>(`/api/users/${userId}`);
    if (res.ok && res.data) {
      const u = res.data;
      const profileKey = `user_profile_${userId}`;
      const dbNickname = String(u.nickname || '');
      const isRealNickname = dbNickname && dbNickname !== userId && !dbNickname.startsWith('guest_');

      let existing: Record<string, unknown> | null = null;
      try { existing = JSON.parse(localStorage.getItem(profileKey) || 'null'); } catch { /* ignore */ }

      const needsUpdate = !existing
        || !existing.nickname
        || existing.nickname === 'My nickname'
        || String(existing.nickname).startsWith('guest_')
        || String(existing.nickname).includes('-');

      if (needsUpdate && isRealNickname) {
        const profile = {
          ...(existing || {}),
          nickname: dbNickname,
          profileImage: (existing?.profileImage as string) || String(u.profile_image || '/default-avatar.jpg'),
          bio: (existing?.bio as string) || String(u.bio || ''),
          activityRegion: (existing?.activityRegion as string) || String(u.activity_region || ''),
        };
        localStorage.setItem(profileKey, JSON.stringify(profile));
        window.dispatchEvent(new Event('profileSaved'));
      } else if (!existing) {
        const profile = {
          nickname: isRealNickname ? dbNickname : 'My nickname',
          profileImage: String(u.profile_image || '/default-avatar.jpg'),
          bio: String(u.bio || ''),
          activityRegion: String(u.activity_region || ''),
        };
        localStorage.setItem(profileKey, JSON.stringify(profile));
        window.dispatchEvent(new Event('profileSaved'));
      }
    }
  } catch { /* ignore */ }
}

export async function initDBSync(userId?: string): Promise<void> {
  const tasks: Promise<void>[] = [syncProductsFromDB(), syncPostsFromDB()];
  if (userId) {
    tasks.push(syncMyProfileFromDB(userId));
    tasks.push(syncOrdersFromDB(userId));
    tasks.push(syncChatRoomsFromDB(userId));
    tasks.push(syncFavoritesFromDB(userId));
    tasks.push(syncNotificationsFromDB(userId));
  }
  await Promise.all(tasks);
}
