import { DisputeStatus, ORDER_STATUS_VALUE } from '@/types';
import { getOrderById, getOrdersByProductId, updateOrderStatus, getOrderStatusBeforeDispute, appendOrderTimeline } from '@/utils/orderStorage';
import { disputePartyRole, disputeResolvedTimelineText } from '@/utils/orderTimelineDisplay';
import { getItem, setItem } from '@/utils/heavyStorage';
import { syncDisputeToDB, syncDisputeStatusToDB, syncDisputesFromDB } from '@/utils/dbSync';
import { getCurrentUserId } from '@/utils/authStorage';
import { api } from '@/utils/api';
import { addNotification } from '@/utils/notificationStorage';
import { NOTIFY_DISPUTE_RESOLVED } from '@/locale/enUI';

const DISPUTES_KEY = 'myDisputes';

export interface Dispute {
  id: string;
  orderId: string;
  productTitle: string;
  productImage: string;
  proposedPrice: number;
  tradeMethod: string;
  buyerId: string;
  buyerNickname: string;
  sellerId: string;
  sellerNickname: string;
  openedByUserId?: string;
  reason: string;
  action: string;
  description: string;
  evidence: string[];
  status: DisputeStatus;
  createdAt: string;
  resolvedAt?: string;
  adminResponse?: string;
}

export const getDisputes = (): Dispute[] => {
  const data = getItem(DISPUTES_KEY);
  return data ? JSON.parse(data) : [];
};

export const getDisputeById = (disputeId: string): Dispute | undefined => {
  return getDisputes().find((d) => d.id === disputeId);
};

export const getDisputesByOrderId = (orderId: string): Dispute[] => {
  return getDisputes().filter((d) => d.orderId === orderId);
};

function preferText(next?: string, prev?: string): string {
  const n = (next || '').trim();
  if (n) return next as string;
  return prev || '';
}

function parseEvidence(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function mergeDisputesById(...lists: Dispute[][]): Dispute[] {
  const byId = new Map<string, Dispute>();
  for (const list of lists) {
    for (const d of list) {
      if (!d?.id) continue;
      const prev = byId.get(d.id);
      byId.set(
        d.id,
        prev
          ? {
              ...prev,
              ...d,
              reason: preferText(d.reason, prev.reason),
              action: preferText(d.action, prev.action),
              description: preferText(d.description, prev.description),
              evidence: d.evidence?.length ? d.evidence : prev.evidence || [],
            }
          : d,
      );
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const getDisputeByPostId = (postId: string): Dispute | undefined => {
  const prefix = 'dispute_post_';
  return postId.startsWith(prefix) ? getDisputeById(postId.slice(prefix.length)) : undefined;
};

export const getDisputeByOrderId = (
  orderId: string,
  openedByUserId?: string | null,
): Dispute | undefined => {
  return getDisputes().find(
    (d) => d.orderId === orderId && (!openedByUserId || d.openedByUserId === openedByUserId),
  );
};

export const getOpenDisputeByOrderId = (
  orderId: string,
  openedByUserId?: string | null,
): Dispute | undefined => {
  return getDisputes().find(
    (d) =>
      d.orderId === orderId &&
      d.status !== 'RESOLVED' &&
      (!openedByUserId || d.openedByUserId === openedByUserId),
  );
};

/** Whether this user already filed a dispute on the order (open or resolved). */
export const userHasDisputeOnOrder = (
  orderId: string,
  userId?: string | null,
): boolean => {
  return Boolean(userId && getDisputeByOrderId(orderId, userId));
};

/** Any resolved dispute on this order (banner / history). Does not block the other party from filing. */
export const hasResolvedDisputeOnOrder = (orderId: string): boolean => {
  return getDisputesByOrderId(orderId).some((d) => d.status === 'RESOLVED');
};

/** Newest resolved dispute on an order, optionally limited to one opener */
export const getResolvedDisputeByOrderId = (
  orderId: string,
  openedByUserId?: string | null,
): Dispute | undefined => {
  return getDisputesByOrderId(orderId)
    .filter(
      (d) =>
        d.status === 'RESOLVED' &&
        (!openedByUserId || d.openedByUserId === openedByUserId),
    )
    .sort((a, b) => (a.resolvedAt || a.createdAt).localeCompare(b.resolvedAt || b.createdAt))
    .pop();
};

function mapDisputeRow(row: Record<string, unknown>, orderId?: string): Dispute {
  return {
    id: String(row.id),
    orderId: String(row.order_id || orderId || ''),
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
    evidence: parseEvidence(row.evidence),
    status: String(row.status || 'OPEN') as Dispute['status'],
    createdAt: String(row.created_at || new Date().toISOString()),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    adminResponse: row.admin_response ? String(row.admin_response) : undefined,
  };
}

/** Public party fields for a dispute post — does not write into myDisputes. */
export async function fetchDisputeSummariesForOrder(orderId: string): Promise<Dispute[]> {
  if (!orderId) return [];
  try {
    const res = await api.get<Record<string, unknown>[]>(`/api/orders/${orderId}/dispute-summaries`);
    if (!res.ok || !Array.isArray(res.data)) return [];
    return res.data.map((row) => mapDisputeRow(row, orderId));
  } catch {
    return [];
  }
}

/** Buyer/seller: both parties' full disputes (reason, details, evidence). */
export async function fetchOrderDisputes(orderId: string): Promise<Dispute[]> {
  if (!orderId) return [];
  try {
    const res = await api.get<Record<string, unknown>[]>(`/api/orders/${orderId}/disputes`);
    if (res.ok && Array.isArray(res.data)) {
      return res.data.map((row) => mapDisputeRow(row, orderId));
    }
  } catch {
    /* fall through to public summaries */
  }
  return fetchDisputeSummariesForOrder(orderId);
}

export const ensureDisputeByOrderId = async (
  orderId: string,
  openedByUserId?: string | null,
): Promise<Dispute | undefined> => {
  const uid = getCurrentUserId();
  if (uid) await syncDisputesFromDB(uid);
  return getDisputeByOrderId(orderId, openedByUserId);
};

export const ensureOpenDisputeByOrderId = async (
  orderId: string,
  openedByUserId?: string | null,
): Promise<Dispute | undefined> => {
  const uid = getCurrentUserId();
  if (uid) await syncDisputesFromDB(uid);
  return getOpenDisputeByOrderId(orderId, openedByUserId);
};

/** True if product has an open dispute order (RESOLVED disputes excluded) */
export const hasProductActiveDispute = (productId: string): boolean => {
  const orders = getOrdersByProductId(productId);
  const disputeOrders = orders.filter((o) => o.status === ORDER_STATUS_VALUE.DISPUTE);
  return disputeOrders.some((o) => {
    const disputes = getDisputesByOrderId(o.id);
    return disputes.length === 0 || disputes.some((d) => d.status !== 'RESOLVED');
  });
};

/** Dispute count where user is buyer or seller */
export const getDisputeCountByUserId = (userId: string): number => {
  return getDisputes().filter((d) => d.buyerId === userId || d.sellerId === userId).length;
};

/** Home card: open buyer-filed disputes only (seller-filed and resolved stay hidden). */
export const isHomeVisibleDispute = (dispute: Dispute): boolean => {
  if (dispute.status === 'RESOLVED') return false;
  if (dispute.openedByUserId && dispute.openedByUserId === dispute.sellerId) return false;
  return true;
};

/** Open buyer-filed disputes linked to a product (for listing cards) */
export const getDisputeCountByProductId = (productId: string): number => {
  return getDisputes().filter((d) => {
    if (!isHomeVisibleDispute(d)) return false;
    const order = getOrderById(d.orderId);
    return order?.product?.id === productId;
  }).length;
};

type ChatDisputeRef = {
  order?: { id?: string } | null;
  product?: { id?: string } | null;
  buyerId?: string;
  sellerId?: string;
};

/** Same listing + same pair. Never attach another product's dispute to this chat. */
export function disputeMatchesChat(
  d: Dispute,
  room: ChatDisputeRef | null,
  order?: { id?: string; product?: { id?: string } } | null,
): boolean {
  if (!d) return false;
  const productId = room?.product?.id || order?.product?.id;
  const disputeOrder = getOrderById(d.orderId);
  const disputeProductId = disputeOrder?.product?.id || (order?.id === d.orderId ? order?.product?.id : undefined);
  if (productId && disputeProductId && productId !== disputeProductId) return false;

  const sameOrder =
    (order?.id && d.orderId === order.id) || (room?.order?.id && d.orderId === room.order.id);
  if (sameOrder) return !productId || !disputeProductId || productId === disputeProductId;

  if (!productId || !room?.buyerId || !room?.sellerId) return false;
  if (d.buyerId !== room.buyerId || d.sellerId !== room.sellerId) return false;
  return disputeProductId === productId;
}

/** Open dispute on this chat pair + listing (list badge). */
export function chatRoomHasOpenDispute(room: ChatDisputeRef): boolean {
  return getDisputes().some((d) => d.status !== 'RESOLVED' && disputeMatchesChat(d, room));
}

export const hasHomeVisibleDispute = (productId: string): boolean => {
  return getDisputeCountByProductId(productId) > 0;
};

/** Open buyer-filed dispute on this listing that is not this chat pair. */
export function hasHomeVisibleDisputeOnOtherTrade(
  productId: string,
  opts?: {
    excludeOrderId?: string | null;
    excludeBuyerId?: string | null;
    excludeSellerId?: string | null;
  },
): boolean {
  if (!productId) return false;
  return getDisputes().some((d) => {
    if (!isHomeVisibleDispute(d)) return false;
    if (opts?.excludeOrderId && d.orderId === opts.excludeOrderId) return false;
    if (
      opts?.excludeBuyerId &&
      opts?.excludeSellerId &&
      d.buyerId === opts.excludeBuyerId &&
      d.sellerId === opts.excludeSellerId
    ) {
      return false;
    }
    const order = getOrderById(d.orderId);
    return order?.product?.id === productId;
  });
}

export async function isListingHeldByOtherBuyerDispute(
  productId: string,
  opts?: {
    excludeOrderId?: string | null;
    excludeBuyerId?: string | null;
    excludeSellerId?: string | null;
  },
): Promise<boolean> {
  if (hasHomeVisibleDisputeOnOtherTrade(productId, opts)) return true;
  return fetchProductHasOpenBuyerDisputeOnOtherTrade(productId, opts);
}

export async function fetchProductHasOpenBuyerDisputeOnOtherTrade(
  productId: string,
  opts?: { excludeBuyerId?: string | null; excludeSellerId?: string | null },
): Promise<boolean> {
  if (!productId) return false;
  try {
    const q = new URLSearchParams();
    if (opts?.excludeBuyerId) q.set('exclude_buyer_id', opts.excludeBuyerId);
    if (opts?.excludeSellerId) q.set('exclude_seller_id', opts.excludeSellerId);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    const res = await api.get<{ open?: boolean }>(`/api/products/${productId}/open-buyer-dispute${suffix}`);
    return Boolean(res.ok && res.data?.open);
  } catch {
    return false;
  }
}

export const saveDispute = (dispute: Dispute) => {
  const disputes = getDisputes();
  const idx = disputes.findIndex((d) => d.id === dispute.id);
  if (idx >= 0) {
    disputes[idx] = dispute;
  } else {
    disputes.push(dispute);
  }
  setItem(DISPUTES_KEY, JSON.stringify(disputes));
  window.dispatchEvent(new Event('disputesChanged'));
};

/** Update platform message without changing status (admin console). */
export const setDisputeAdminResponse = (disputeId: string, adminResponse: string) => {
  const disputes = getDisputes();
  const dispute = disputes.find((d) => d.id === disputeId);
  if (!dispute) return;
  dispute.adminResponse = adminResponse;
  setItem(DISPUTES_KEY, JSON.stringify(disputes));
  window.dispatchEvent(new Event('disputesChanged'));
};

export const updateDisputeStatus = async (
  disputeId: string,
  status: DisputeStatus,
  adminResponse?: string,
): Promise<boolean> => {
  if (status === 'IN_REVIEW' || status === 'RESOLVED') {
    const ok = await syncDisputeStatusToDB(disputeId, status, adminResponse);
    if (!ok) return false;
  }

  const disputes = getDisputes();
  const dispute = disputes.find((d) => d.id === disputeId);
  if (dispute) {
    dispute.status = status;
    if (status === 'RESOLVED') {
      dispute.resolvedAt = new Date().toISOString();
      const resolverId = getCurrentUserId();
      const otherId = resolverId === dispute.buyerId ? dispute.sellerId : dispute.buyerId;
      if (otherId && otherId !== resolverId) {
        void addNotification({
          targetUserId: otherId,
          type: 'order',
          title: NOTIFY_DISPUTE_RESOLVED,
          content: `The dispute for "${dispute.productTitle}" has been resolved.`,
          link: `/dispute/${dispute.orderId}?view=other`,
        });
      }
      const order = getOrderById(dispute.orderId);
      const otherStillOpen = getDisputes().some(
        (d) =>
          d.orderId === dispute.orderId &&
          d.id !== dispute.id &&
          d.status !== 'RESOLVED',
      );
      const resolveText = disputeResolvedTimelineText(disputePartyRole(dispute));
      if (order && order.status === ORDER_STATUS_VALUE.DISPUTE && !otherStillOpen) {
        const restoreStatus = getOrderStatusBeforeDispute(order);
        await updateOrderStatus(dispute.orderId, restoreStatus, resolveText);
      } else if (order) {
        await appendOrderTimeline(dispute.orderId, resolveText);
      }
    }
    if (adminResponse) {
      dispute.adminResponse = adminResponse;
    }
    setItem(DISPUTES_KEY, JSON.stringify(disputes));
    window.dispatchEvent(new Event('disputesChanged'));
    return true;
  }
  return false;
};

export const deleteDispute = (disputeId: string) => {
  const disputes = getDisputes().filter((d) => d.id !== disputeId);
  setItem(DISPUTES_KEY, JSON.stringify(disputes));
  window.dispatchEvent(new Event('disputesChanged'));
};

interface CreateDisputeParams {
  orderId: string;
  productTitle: string;
  productImage: string;
  proposedPrice: number;
  tradeMethod: string;
  buyerId: string;
  buyerNickname: string;
  sellerId: string;
  sellerNickname: string;
  reason: string;
  action: string;
  description: string;
  evidence: string[];
}

export const createDispute = async (params: CreateDisputeParams): Promise<Dispute | null> => {
  const openedByUserId = getCurrentUserId();
  if (!openedByUserId) return null;
  if (userHasDisputeOnOrder(params.orderId, openedByUserId)) return null;

  const dispute: Dispute = {
    id: `dispute_${Date.now()}`,
    ...params,
    openedByUserId,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };

  const ok = await syncDisputeToDB(dispute);
  if (!ok) return null;
  saveDispute(dispute);
  return dispute;
};
