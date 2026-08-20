import {
  Order,
  OrderStatus,
  Product,
  TradeMethod,
  User,
  ORDER_STATUS_VALUE,
  PRODUCT_STATUS_VALUE,
  TRADE_METHOD_VALUE,
  TIMELINE_EVENT_TYPE,
} from '@/types';
import { getCurrentUserId } from '@/utils/authStorage';
import { getItem, setItem, removeItem } from '@/utils/heavyStorage';
import { getMyUser } from '@/utils/profileStorage';
import { syncOrderToDB, syncOrderStatusToDB, syncOrderFromDB, syncOrderDeleteToDB } from '@/utils/dbSync';
import { addNotification } from '@/utils/notificationStorage';
import { getProductById, updateProductStatus } from '@/utils/productStorage';
import { addPriceOfferToChat, addPriceOfferResultToChat, clearOrderFromRoom } from '@/utils/chatStorage';
import { broadcastOrderUpdate } from '@/utils/chatSocket';
import {
  descriptionForOrderStatusForTimeline,
  MSG_ORDER_QUOTA_EXCEEDED,
  NOTIFY_OFFER_ACCEPTED,
  NOTIFY_PURCHASE_OFFER_ARRIVED,
  NOTIFY_TRADE_COMPLETED,
} from '@/locale/enUI';

/** Shared storage key: all orders */
const ORDERS_KEY = 'all_orders';

export const ORDER_QUOTA_EXCEEDED_MESSAGE = MSG_ORDER_QUOTA_EXCEEDED;

function notifyOrderCounterpart(order: Order): void {
  const myId = getCurrentUserId();
  const otherId = order.buyer.id === myId ? order.seller.id : order.buyer.id;
  if (otherId && otherId !== myId) {
    broadcastOrderUpdate(otherId, order.id, order);
  }
}

/** On QuotaExceededError, drop oldest orders and retry (optionally protect one orderId) */
function setOrdersWithQuotaRetry(orders: Order[], protectOrderId?: string): void {
  let list = orders;
  for (;;) {
    try {
      setItem(ORDERS_KEY, JSON.stringify(list));
      if (list.length !== orders.length) window.dispatchEvent(new Event('ordersChanged'));
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        const byDate = [...list].sort(
          (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
        const toRemove = byDate.find((o) => o.id !== protectOrderId);
        if (!toRemove) throw e;
        list = list.filter((o) => o.id !== toRemove.id);
        continue;
      }
      throw e;
    }
  }
}

/** Unique timeline event id (avoid duplicate keys in same ms) */
const nextTimelineId = () => `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/** Load all orders (skip malformed entries) */
const getAllOrders = (): Order[] => {
  try {
    const data = getItem(ORDERS_KEY);
    const list: Order[] = data ? JSON.parse(data) : [];
    return Array.isArray(list)
      ? list.filter((o) => o && o.id && o.buyer?.id != null && o.seller?.id != null && o.product != null)
      : [];
  } catch {
    return [];
  }
};

/** Orders where current user is buyer or seller */
export const getOrders = (): Order[] => {
  const userId = getCurrentUserId();
  if (!userId) return [];
  return getAllOrders().filter(
    (o) => o.buyer?.id === userId || o.seller?.id === userId
  );
};

const isFreeShareOrder = (order: { product?: { isFreeShare?: boolean; price?: number }; proposedPrice?: number }) =>
  Boolean(order.product?.isFreeShare || order.proposedPrice === 0 || order.product?.price === 0);

/** Completed trade count for a user (buyer or seller), all order types */
export const getCompletedTradeCountForUser = (userId: string): number => {
  if (!userId) return 0;
  return getAllOrders().filter(
    (o) => o.status === ORDER_STATUS_VALUE.COMPLETE && (o.buyer?.id === userId || o.seller?.id === userId)
  ).length;
};

/** Completed paid-trade count (excludes free share) */
export const getPaidTradeCountByUserId = (userId: string): number => {
  if (!userId) return 0;
  return getAllOrders().filter((o) => {
    if (o.status !== ORDER_STATUS_VALUE.COMPLETE) return false;
    const isParticipant = o.buyer?.id === userId || o.seller?.id === userId;
    return isParticipant && !isFreeShareOrder(o);
  }).length;
};

/** Whether product has any in-progress order (not completed) */
export const hasProductActiveTrade = (productId: string): boolean => {
  return getAllOrders().some(
    (o) => o.product?.id === productId && o.status !== ORDER_STATUS_VALUE.COMPLETE,
  );
};

/** Whether product has a reserved order (meetup set). Canceled meetup (accepted but no meetup) does not count. */
export const hasProductReservedOrder = (productId: string): boolean => {
  return getAllOrders().some((o) => {
    if (o.product?.id !== productId || o.status === ORDER_STATUS_VALUE.COMPLETE || o.status === ORDER_STATUS_VALUE.DISPUTE)
      return false;
    if (o.status === ORDER_STATUS_VALUE.MEETUP_SET) return true;
    if (o.meetupPlace && o.meetupDate && o.meetupTime) return true;
    return false;
  });
};

/** Whether an open dispute exists for this product */
export const hasProductDisputeOrder = (productId: string): boolean => {
  return getAllOrders().some(
    (o) => o.product?.id === productId && o.status === ORDER_STATUS_VALUE.DISPUTE
  );
};

/** Orders for a product (for dispute badge on cards) */
export const getOrdersByProductId = (productId: string): Order[] => {
  return getAllOrders().filter((o) => o.product?.id === productId);
};

export const getOrderById = (orderId: string): Order | undefined => {
  return getAllOrders().find((o) => o.id === orderId);
};

/** My offer on this listing that the seller has not answered yet (one offer at a time). */
export const getMyPendingOfferOrder = (productId: string, buyerId?: string | null): Order | undefined => {
  if (!productId || !buyerId) return undefined;
  return getAllOrders().find(
    (o) =>
      o.product?.id === productId
      && o.buyer?.id === buyerId
      && o.status === ORDER_STATUS_VALUE.PENDING_OFFER,
  );
};

const ORDER_STATUS_SET = new Set<string>(Object.values(ORDER_STATUS_VALUE));

/** Order statuses where the listing should show as trading (reserved), not for sale. */
const PRODUCT_TRADING_ORDER_STATUSES = new Set<OrderStatus>([
  ORDER_STATUS_VALUE.ACCEPTED,
  ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO,
  ORDER_STATUS_VALUE.MEETUP_SET,
  ORDER_STATUS_VALUE.SHIPPED,
  ORDER_STATUS_VALUE.DELIVERED,
  ORDER_STATUS_VALUE.RECEIVED,
  ORDER_STATUS_VALUE.DISPUTE,
]);

const syncProductStatusFromOrder = (order: Order): void => {
  const productId = order.product?.id;
  if (!productId) return;
  if (order.status === ORDER_STATUS_VALUE.COMPLETE) {
    void updateProductStatus(productId, PRODUCT_STATUS_VALUE.SOLD);
    return;
  }
  if (PRODUCT_TRADING_ORDER_STATUSES.has(order.status)) {
    void updateProductStatus(productId, PRODUCT_STATUS_VALUE.RESERVED);
  }
};

/** Status to restore when a dispute is resolved (last non-dispute order status in timeline). */
export const getOrderStatusBeforeDispute = (order: Order): OrderStatus => {
  const disputeIndex = order.timeline.map((e) => e.type).lastIndexOf(ORDER_STATUS_VALUE.DISPUTE);
  if (disputeIndex > 0) {
    for (let j = disputeIndex - 1; j >= 0; j--) {
      const t = order.timeline[j].type;
      if (ORDER_STATUS_SET.has(t) && t !== ORDER_STATUS_VALUE.DISPUTE) {
        return t as OrderStatus;
      }
    }
  }
  if (order.meetupPlace && order.meetupDate && order.meetupTime) {
    return ORDER_STATUS_VALUE.MEETUP_SET;
  }
  return ORDER_STATUS_VALUE.ACCEPTED;
};

/** 로컬에 없으면 DB에서 주문 1건을 받아온 뒤 반환 */
export const ensureOrderById = async (orderId: string): Promise<Order | undefined> => {
  const local = getOrderById(orderId);
  if (local) return local;
  const fromDb = await syncOrderFromDB(orderId);
  return fromDb ?? getOrderById(orderId);
};

export const mergeRemoteOrder = (remoteOrder: Order): void => {
  const orders = getAllOrders();
  const idx = orders.findIndex((o) => o.id === remoteOrder.id);
  if (idx >= 0) {
    orders[idx] = remoteOrder;
  } else {
    orders.push(remoteOrder);
  }
  setOrdersWithQuotaRetry(orders, remoteOrder.id);
  window.dispatchEvent(new Event('ordersChanged'));
};

/** Completed free-share count for user */
export const getShareCountByUserId = (userId: string): number => {
  if (!userId) return 0;
  return getAllOrders().filter((o) => {
    if (o.status !== ORDER_STATUS_VALUE.COMPLETE) return false;
    const isParticipant = o.buyer?.id === userId || o.seller?.id === userId;
    return isParticipant && isFreeShareOrder(o);
  }).length;
};

/**
 * Free space: remove the N oldest orders.
 * Guard: keep at least one order to avoid wiping the list entirely.
 */
export function trimOldestOrders(maxToRemove: number): void {
  if (maxToRemove <= 0) return;
  const orders = getAllOrders();
  const removeCount = Math.min(maxToRemove, Math.max(0, orders.length - 1));
  if (removeCount === 0) return;
  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
  const toRemoveIds = new Set(sorted.slice(0, removeCount).map((o) => o.id));
  const remaining = orders.filter((o) => !toRemoveIds.has(o.id));
  setOrdersWithQuotaRetry(remaining);
}

export const saveOrder = async (order: Order): Promise<boolean> => {
  const ok = await syncOrderToDB(order);
  if (!ok) return false;
  const orders = getAllOrders();
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    orders[idx] = order;
  } else {
    orders.push(order);
  }
  setOrdersWithQuotaRetry(orders, order.id);
  window.dispatchEvent(new Event('ordersChanged'));
  return true;
};

export const deleteOrder = async (orderId: string): Promise<boolean> => {
  const ok = await syncOrderDeleteToDB(orderId);
  if (!ok) return false;
  clearOrderFromRoom(orderId);
  const orders = getAllOrders().filter((o) => o.id !== orderId);
  setOrdersWithQuotaRetry(orders);
  window.dispatchEvent(new Event('ordersChanged'));
  return true;
};

/** Dev: clear all orders */
export const clearAllOrders = (): void => {
  removeItem(ORDERS_KEY);
  window.dispatchEvent(new Event('ordersChanged'));
};

export type ReceiptCondition = 'good' | 'normal' | 'bad';

/** Append a timeline row without changing order status. */
export const appendOrderTimeline = async (
  orderId: string,
  description: string,
  type?: string,
): Promise<boolean> => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return false;
  const timelineEvent = {
    id: nextTimelineId(),
    type: type || order.status,
    timestamp: new Date().toISOString(),
    description,
  };
  await syncOrderStatusToDB(orderId, order.status, timelineEvent);
  order.timeline.push(timelineEvent);
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  return true;
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  description?: string,
  receipt?: { condition?: ReceiptCondition; notes?: string },
): Promise<boolean> => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return false;

  if (receipt?.condition) {
    order.receiptCondition = receipt.condition;
    order.receiptNotes = receipt.notes?.trim() || undefined;
  }

  const conditionLabel =
    receipt?.condition === 'good'
      ? 'Good'
      : receipt?.condition === 'normal'
        ? 'OK'
        : receipt?.condition === 'bad'
          ? 'Poor'
          : '';
  const timelineDescription =
    description ||
    (status === ORDER_STATUS_VALUE.RECEIVED && conditionLabel
      ? `Receipt confirmed (${conditionLabel})`
      : descriptionForOrderStatusForTimeline(status));

  const timelineEvent = {
    id: nextTimelineId(),
    type: status,
    timestamp: new Date().toISOString(),
    description: timelineDescription,
  };
  const ok = await syncOrderStatusToDB(orderId, status, timelineEvent, {
    receipt_condition: order.receiptCondition || null,
    receipt_notes: order.receiptNotes || null,
  });
  if (!ok) return false;

  order.status = status;
  order.timeline.push(timelineEvent);
  if (status === ORDER_STATUS_VALUE.ACCEPTED) {
    void addNotification({
      targetUserId: order.buyer.id,
      type: 'order',
      title: NOTIFY_OFFER_ACCEPTED,
      content: `${order.seller.nickname} accepted your offer for "${order.product.title}".`,
      link: `/order/${order.id}`,
    });
    void addPriceOfferResultToChat(order, 'accepted');
  }
  syncProductStatusFromOrder(order);
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);
  return true;
};

/** Trade completion check (both sides must confirm) */
export const confirmOrderCompletion = async (
  orderId: string,
  role: 'buyer' | 'seller'
): Promise<Order | undefined> => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  if (role === 'buyer') order.buyerCompleted = true;
  if (role === 'seller') order.sellerCompleted = true;

  const timelineEvent = {
    id: nextTimelineId(),
    type: TIMELINE_EVENT_TYPE.COMPLETE_CHECK,
    timestamp: new Date().toISOString(),
    description: role === 'buyer' ? 'Buyer confirmed trade complete' : 'Seller confirmed trade complete',
  };
  order.timeline.push(timelineEvent);

  if (order.buyerCompleted && order.sellerCompleted) {
    order.status = ORDER_STATUS_VALUE.COMPLETE;
    order.timeline.push({
      id: nextTimelineId(),
      type: ORDER_STATUS_VALUE.COMPLETE,
      timestamp: new Date().toISOString(),
      description: 'Trade completed',
    });

    void updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.SOLD);
    const other = role === 'buyer' ? order.seller : order.buyer;
    void addNotification({
      targetUserId: other.id,
      type: 'order',
      title: NOTIFY_TRADE_COMPLETED,
      content: `The trade for "${order.product.title}" is complete. You can leave a review!`,
      link: `/review/${order.id}`,
    });
  }

  const ok = await syncOrderStatusToDB(orderId, order.status, timelineEvent, {
    buyer_completed: order.buyerCompleted,
    seller_completed: order.sellerCompleted,
  });
  if (!ok) return undefined;

  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);
  return order;
};

/** Buyer receipt ends the trade (paid and free share). Only the other party is notified. */
export const completeOrderOnReceive = async (orderId: string): Promise<Order | undefined> => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  if (order.status === ORDER_STATUS_VALUE.COMPLETE && order.buyerCompleted && order.sellerCompleted) {
    return order;
  }

  order.buyerCompleted = true;
  order.sellerCompleted = true;
  order.status = ORDER_STATUS_VALUE.COMPLETE;
  const timelineEvent = {
    id: nextTimelineId(),
    type: ORDER_STATUS_VALUE.COMPLETE,
    timestamp: new Date().toISOString(),
    description: 'Trade completed',
  };
  order.timeline.push(timelineEvent);

  const ok = await syncOrderStatusToDB(orderId, order.status, timelineEvent, {
    buyer_completed: true,
    seller_completed: true,
  });
  if (!ok) return undefined;

  void updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.SOLD);
  const actorId = getCurrentUserId();
  const notifyTarget = actorId === order.seller.id ? order.buyer : order.seller;
  addNotification({
    targetUserId: notifyTarget.id,
    type: 'order',
    title: NOTIFY_TRADE_COMPLETED,
    content: `The trade for "${order.product.title}" is complete. You can leave a review!`,
    link: `/review/${order.id}`,
  });
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);
  return order;
};

export const completeShareOrderOnReceive = completeOrderOnReceive;

/** Save meetup; set status to meetup set */
export const updateOrderMeetup = async (
  orderId: string,
  params: { meetupPlace: string; meetupDate: string; meetupTime: string }
): Promise<Order | undefined> => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  const actorId = getCurrentUserId();
  if (!actorId || actorId !== order.seller.id) return undefined;

  const timelineEvent = {
    id: nextTimelineId(),
    type: ORDER_STATUS_VALUE.MEETUP_SET,
    timestamp: new Date().toISOString(),
    description: 'Meetup confirmed',
  };
  const ok = await syncOrderStatusToDB(orderId, ORDER_STATUS_VALUE.MEETUP_SET, timelineEvent, {
    meetup_location: params.meetupPlace,
    meetup_date: params.meetupDate,
    meetup_time: params.meetupTime,
    meetup_accepted: true,
  });
  if (!ok) return undefined;

  order.meetupPlace = params.meetupPlace;
  order.meetupDate = params.meetupDate;
  order.meetupTime = params.meetupTime;
  order.meetupAccepted = true;
  order.status = ORDER_STATUS_VALUE.MEETUP_SET;
  order.timeline.push(timelineEvent);
  void updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.RESERVED);
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);
  return order;
};

/** Buyer accepts the scheduled meetup */
export const acceptOrderMeetup = async (orderId: string): Promise<Order | undefined> => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  const timelineEvent = {
    id: nextTimelineId(),
    type: 'meetup_accepted',
    timestamp: new Date().toISOString(),
    description: 'Buyer accepted the meetup',
  };
  const ok = await syncOrderStatusToDB(orderId, order.status, timelineEvent, {
    meetup_accepted: true,
  });
  if (!ok) return undefined;

  order.meetupAccepted = true;
  order.timeline.push(timelineEvent);
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);
  return order;
};

/** Cancel meetup: clear fields, revert to accepted */
export const cancelOrderMeetup = async (orderId: string): Promise<Order | undefined> => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  const actorId = getCurrentUserId();
  if (!actorId || actorId !== order.seller.id) return undefined;
  const timelineEvent = {
    id: nextTimelineId(),
    type: ORDER_STATUS_VALUE.ACCEPTED,
    timestamp: new Date().toISOString(),
    description: 'Meetup canceled',
  };
  const keepDispute = order.status === ORDER_STATUS_VALUE.DISPUTE;
  const nextStatus = keepDispute ? ORDER_STATUS_VALUE.DISPUTE : ORDER_STATUS_VALUE.ACCEPTED;
  const ok = await syncOrderStatusToDB(orderId, nextStatus, timelineEvent, {
    meetup_location: '',
    meetup_date: '',
    meetup_time: '',
    meetup_accepted: false,
  });
  if (!ok) return undefined;

  order.meetupPlace = undefined;
  order.meetupDate = undefined;
  order.meetupTime = undefined;
  order.meetupAccepted = false;
  order.status = nextStatus;
  order.timeline.push(timelineEvent);
  const product = getProductById(order.product.id);
  if (product?.status === PRODUCT_STATUS_VALUE.RESERVED) {
    void updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.FOR_SALE);
  }
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  return order;
};

interface CreateOrderParams {
  product: Product;
  proposedPrice: number;
  tradeMethod: TradeMethod;
  meetupPlace?: string;
  meetupDate?: string;
  meetupTime?: string;
  memo?: string;
}

const isShareOrder = (price: number, product?: Product) =>
  price === 0 || product?.isFreeShare || product?.price === 0;

const CHAT_STARTED_TIMELINE = 'Chat started';

/** Same listing + same pair, not finished — reuse instead of opening a second order. */
function findOpenOrderForTrade(productId: string, buyerId: string, sellerId: string): Order | undefined {
  return getAllOrders()
    .filter(
      (o) =>
        o.product?.id === productId &&
        o.buyer?.id === buyerId &&
        o.seller?.id === sellerId &&
        o.status !== ORDER_STATUS_VALUE.COMPLETE &&
        !(o.buyerCompleted && o.sellerCompleted),
    )
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
}

export const createOrder = async (params: CreateOrderParams): Promise<Order | null> => {
  const myUser = getMyUser();
  const now = new Date().toISOString();
  const isShare = isShareOrder(params.proposedPrice, params.product);
  if (isShare) return null;
  const offerDesc = `${params.proposedPrice.toLocaleString()} Pi purchase offer`;

  const existing = findOpenOrderForTrade(params.product.id, myUser.id, params.product.seller.id);
  if (existing) {
    existing.proposedPrice = params.proposedPrice;
    existing.tradeMethod = params.tradeMethod;
    // 약속 취소 후 재제안 등: 기존 주문을 다시 쓰더라도 수락 버튼이 뜨려면 대기 상태여야 한다.
    if (existing.status !== ORDER_STATUS_VALUE.DISPUTE) {
      existing.status = ORDER_STATUS_VALUE.PENDING_OFFER;
    }
    if (params.meetupPlace) existing.meetupPlace = params.meetupPlace;
    if (params.meetupDate) existing.meetupDate = params.meetupDate;
    if (params.meetupTime) existing.meetupTime = params.meetupTime;
    if (params.memo) existing.memo = params.memo;
    existing.timeline = [
      ...(existing.timeline || []),
      {
        id: nextTimelineId(),
        type: ORDER_STATUS_VALUE.PENDING_OFFER,
        timestamp: now,
        description: offerDesc,
      },
    ];
    const saved = await saveOrder(existing);
    if (!saved) return null;
    void addNotification({
      targetUserId: existing.seller.id,
      type: 'order',
      title: NOTIFY_PURCHASE_OFFER_ARRIVED,
      content: `${existing.buyer.nickname} sent a ${existing.proposedPrice.toLocaleString()} Pi offer for "${existing.product.title}".`,
      link: `/order/${existing.id}`,
    });
    void addPriceOfferToChat(existing);
    return existing;
  }

  const order: Order = {
    id: `order_${Date.now()}`,
    product: params.product,
    buyer: myUser,
    seller: params.product.seller,
    status: ORDER_STATUS_VALUE.PENDING_OFFER,
    proposedPrice: params.proposedPrice,
    tradeMethod: params.tradeMethod,
    meetupPlace: params.meetupPlace,
    meetupDate: params.meetupDate,
    meetupTime: params.meetupTime,
    memo: params.memo,
    createdAt: now,
    sellerCompleted: false,
    buyerCompleted: false,
    timeline: [
      {
        id: nextTimelineId(),
        type: ORDER_STATUS_VALUE.PENDING_OFFER,
        timestamp: now,
        description: CHAT_STARTED_TIMELINE,
      },
      {
        id: nextTimelineId(),
        type: ORDER_STATUS_VALUE.PENDING_OFFER,
        timestamp: now,
        description: offerDesc,
      },
    ],
  };

  const saved = await saveOrder(order);
  if (!saved) return null;

  void addNotification({
    targetUserId: order.seller.id,
    type: 'order',
    title: NOTIFY_PURCHASE_OFFER_ARRIVED,
    content: `${order.buyer.nickname} sent a ${order.proposedPrice.toLocaleString()} Pi offer for "${order.product.title}".`,
    link: `/order/${order.id}`,
  });

  void addPriceOfferToChat(order);
  return order;
};

/** Seller starts meetup flow without buyer offer (price = listing; free share = 0) */
export const createOrderBySeller = async (params: { product: Product; buyer: User }): Promise<Order | null> => {
  const seller = getMyUser();
  const now = new Date().toISOString();
  const { product, buyer } = params;
  const proposedPrice = product.price ?? 0;
  const existing = findOpenOrderForTrade(product.id, buyer.id, seller.id);
  if (existing) return existing;

  const order: Order = {
    id: `order_${Date.now()}`,
    product,
    buyer,
    seller,
    status: ORDER_STATUS_VALUE.ACCEPTED,
    proposedPrice,
    tradeMethod: TRADE_METHOD_VALUE.IN_PERSON,
    createdAt: now,
    sellerCompleted: false,
    buyerCompleted: false,
    timeline: [
      {
        id: nextTimelineId(),
        type: ORDER_STATUS_VALUE.ACCEPTED,
        timestamp: now,
        description: CHAT_STARTED_TIMELINE,
      },
    ],
  };

  const saved = await saveOrder(order);
  if (!saved) return null;
  return order;
};
