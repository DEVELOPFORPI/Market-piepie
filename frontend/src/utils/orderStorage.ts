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
import { syncOrderToDB, syncOrderStatusToDB } from '@/utils/dbSync';
import { addNotification } from '@/utils/notificationStorage';
import { updateProductStatus } from '@/utils/productStorage';
import { addPriceOfferToChat, addPriceOfferResultToChat, clearOrderFromRoom } from '@/utils/chatStorage';
import { broadcastOrderUpdate } from '@/utils/chatSocket';
import {
  descriptionForOrderStatusForTimeline,
  MSG_ORDER_QUOTA_EXCEEDED,
  NOTIFY_OFFER_ACCEPTED,
  NOTIFY_PURCHASE_OFFER_ARRIVED,
  NOTIFY_RECEIVE_CONFIRM,
  NOTIFY_TRADE_COMPLETED,
  NOTIFY_TRADE_COMPLETE_CHECK,
  notifyTitleSellerStartedMeetup,
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

/** Completed trade count for a user (buyer or seller) */
export const getCompletedTradeCountForUser = (userId: string): number => {
  if (!userId) return 0;
  return getAllOrders().filter(
    (o) => o.status === ORDER_STATUS_VALUE.COMPLETE && (o.buyer?.id === userId || o.seller?.id === userId)
  ).length;
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
    const isShare = Boolean(o.product?.isFreeShare);
    return isParticipant && isShare;
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

export const saveOrder = (order: Order) => {
  const orders = getAllOrders();
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    orders[idx] = order;
  } else {
    orders.push(order);
  }
  setOrdersWithQuotaRetry(orders, order.id);
  window.dispatchEvent(new Event('ordersChanged'));
  syncOrderToDB(order);
};

export const deleteOrder = (orderId: string) => {
  clearOrderFromRoom(orderId);
  const orders = getAllOrders().filter((o) => o.id !== orderId);
  setOrdersWithQuotaRetry(orders);
  window.dispatchEvent(new Event('ordersChanged'));
};

/** Dev: clear all orders */
export const clearAllOrders = (): void => {
  removeItem(ORDERS_KEY);
  window.dispatchEvent(new Event('ordersChanged'));
};

export const updateOrderStatus = (orderId: string, status: OrderStatus, description?: string) => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    order.status = status;
    const timelineEvent = {
      id: nextTimelineId(),
      type: status,
      timestamp: new Date().toISOString(),
      description: description || descriptionForOrderStatusForTimeline(status),
    };
    order.timeline.push(timelineEvent);
    syncOrderStatusToDB(orderId, status, timelineEvent);
    if (status === ORDER_STATUS_VALUE.ACCEPTED) {
      addNotification({
        targetUserId: order.buyer.id,
        type: 'order',
        title: NOTIFY_OFFER_ACCEPTED,
        content: `${order.seller.nickname} accepted your offer for "${order.product.title}".`,
        link: `/order/${order.id}`,
      });
      addPriceOfferResultToChat(order, 'accepted');
    }
    if (status === ORDER_STATUS_VALUE.RECEIVED) {
      const isShare = isShareOrder(order.proposedPrice ?? 0, order.product);
      addNotification({
        targetUserId: order.seller.id,
        type: 'order',
        title: NOTIFY_RECEIVE_CONFIRM,
        content: isShare
          ? `${order.buyer.nickname} confirmed receipt for "${order.product.title}". The trade is complete.`
          : `${order.buyer.nickname} confirmed receipt for "${order.product.title}". Please complete your side of the trade check.`,
        link: `/order/${order.id}`,
      });
    }
    if (status === ORDER_STATUS_VALUE.COMPLETE) {
      updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.SOLD);
    }
    setOrdersWithQuotaRetry(orders, orderId);
    window.dispatchEvent(new Event('ordersChanged'));
    notifyOrderCounterpart(order);
  }
};

/** Trade completion check (both sides must confirm) */
export const confirmOrderCompletion = (
  orderId: string,
  role: 'buyer' | 'seller'
): Order | undefined => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  if (role === 'buyer') order.buyerCompleted = true;
  if (role === 'seller') order.sellerCompleted = true;

  order.timeline.push({
    id: nextTimelineId(),
    type: TIMELINE_EVENT_TYPE.COMPLETE_CHECK,
    timestamp: new Date().toISOString(),
    description: role === 'buyer' ? 'Buyer confirmed trade complete' : 'Seller confirmed trade complete',
  });

  const otherUser = role === 'buyer' ? order.seller : order.buyer;
  const whoConfirmed = role === 'buyer' ? order.buyer : order.seller;
  addNotification({
    targetUserId: otherUser.id,
    type: 'order',
    title: NOTIFY_TRADE_COMPLETE_CHECK,
    content: `${whoConfirmed.nickname} confirmed trade completion for "${order.product.title}".${order.buyerCompleted && order.sellerCompleted ? ' Both sides confirmed; the trade is complete.' : ''}`,
    link: `/order/${order.id}`,
  });

  if (order.buyerCompleted && order.sellerCompleted) {
    order.status = ORDER_STATUS_VALUE.COMPLETE;
    order.timeline.push({
      id: nextTimelineId(),
      type: ORDER_STATUS_VALUE.COMPLETE,
      timestamp: new Date().toISOString(),
      description: 'Trade completed',
    });

    updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.SOLD);
    const other = role === 'buyer' ? order.seller : order.buyer;
    addNotification({
      targetUserId: other.id,
      type: 'order',
      title: NOTIFY_TRADE_COMPLETED,
      content: `The trade for "${order.product.title}" is complete after both sides confirmed.`,
      link: `/order/${order.id}`,
    });
  }

  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);

  syncOrderStatusToDB(orderId, order.status, undefined, {
    buyer_completed: order.buyerCompleted,
    seller_completed: order.sellerCompleted,
  });

  return order;
};

/** Free share: on receive confirm, complete immediately (no dual completion check) */
export const completeShareOrderOnReceive = (orderId: string): Order | undefined => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order || !isShareOrder(order.proposedPrice ?? 0, order.product)) return undefined;

  order.buyerCompleted = true;
  order.sellerCompleted = true;
  order.status = ORDER_STATUS_VALUE.COMPLETE;
  order.timeline.push({
    id: nextTimelineId(),
    type: ORDER_STATUS_VALUE.COMPLETE,
    timestamp: new Date().toISOString(),
    description: 'Trade completed',
  });
  updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.SOLD);
  addNotification({
    targetUserId: order.seller.id,
    type: 'order',
    title: NOTIFY_TRADE_COMPLETED,
    content: `The free share for "${order.product.title}" is complete. You can leave a review!`,
    link: `/review/${order.id}`,
  });
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);
  return order;
};

/** Save meetup; set status to meetup set */
export const updateOrderMeetup = (
  orderId: string,
  params: { meetupPlace: string; meetupDate: string; meetupTime: string }
): Order | undefined => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;

  order.meetupPlace = params.meetupPlace;
  order.meetupDate = params.meetupDate;
  order.meetupTime = params.meetupTime;
  order.status = ORDER_STATUS_VALUE.MEETUP_SET;
  order.timeline.push({
    id: nextTimelineId(),
    type: ORDER_STATUS_VALUE.MEETUP_SET,
    timestamp: new Date().toISOString(),
    description: 'Meetup confirmed',
  });
  updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.RESERVED);
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);
  syncOrderStatusToDB(orderId, ORDER_STATUS_VALUE.MEETUP_SET,
    order.timeline[order.timeline.length - 1],
    {
      meetup_location: params.meetupPlace,
      meetup_date: params.meetupDate,
      meetup_time: params.meetupTime,
    }
  );
  return order;
};

/** Buyer accepts the scheduled meetup */
export const acceptOrderMeetup = (orderId: string): Order | undefined => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  order.meetupAccepted = true;
  order.timeline.push({
    id: nextTimelineId(),
    type: 'meetup_accepted',
    timestamp: new Date().toISOString(),
    description: 'Buyer accepted the meetup',
  });
  setOrdersWithQuotaRetry(orders, orderId);
  window.dispatchEvent(new Event('ordersChanged'));
  notifyOrderCounterpart(order);
  syncOrderStatusToDB(orderId, order.status);
  return order;
};

/** Cancel meetup: clear fields, revert to accepted */
export const cancelOrderMeetup = (orderId: string): Order | undefined => {
  const orders = getAllOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  order.meetupPlace = undefined;
  order.meetupDate = undefined;
  order.meetupTime = undefined;
  order.status = ORDER_STATUS_VALUE.ACCEPTED;
  order.timeline.push({
    id: nextTimelineId(),
    type: ORDER_STATUS_VALUE.ACCEPTED,
    timestamp: new Date().toISOString(),
    description: 'Meetup canceled',
  });
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

export const createOrder = (params: CreateOrderParams): Order => {
  const myUser = getMyUser();
  const now = new Date().toISOString();
  const isShare = isShareOrder(params.proposedPrice, params.product);
  const timelineDesc = isShare
    ? 'Free share request'
    : `${params.proposedPrice.toLocaleString()} Pi purchase offer`;

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
        description: timelineDesc,
      },
    ],
  };

  saveOrder(order);

  if (!isShare) {
    addNotification({
      targetUserId: order.seller.id,
      type: 'order',
      title: NOTIFY_PURCHASE_OFFER_ARRIVED,
      content: `${order.buyer.nickname} sent a ${order.proposedPrice.toLocaleString()} Pi offer for "${order.product.title}".`,
      link: `/order/${order.id}`,
    });
  }

  addPriceOfferToChat(order);

  return order;
};

/** Seller starts meetup flow without buyer offer (price = listing; free share = 0) */
export const createOrderBySeller = (params: { product: Product; buyer: User }): Order => {
  const seller = getMyUser();
  const now = new Date().toISOString();
  const { product, buyer } = params;
  const proposedPrice = product.price ?? 0;
  const isShare = isShareOrder(proposedPrice, product);
  const timelineDesc = isShare
    ? 'Meetup for free share'
    : `Seller started meetup at ${proposedPrice.toLocaleString()} Pi`;
  const notifContent = isShare
    ? `scheduled a meetup for the free share "${product.title}".`
    : `scheduled a meetup for "${product.title}" at ${proposedPrice.toLocaleString()} Pi.`;

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
        description: timelineDesc,
      },
    ],
  };

  saveOrder(order);
  updateProductStatus(order.product.id, PRODUCT_STATUS_VALUE.RESERVED);

  addNotification({
    targetUserId: buyer.id,
    type: 'order',
    title: notifyTitleSellerStartedMeetup(seller.nickname),
    content: `${seller.nickname} ${notifContent}`,
    link: `/order/${order.id}`,
  });
  notifyOrderCounterpart(order);

  return order;
};
