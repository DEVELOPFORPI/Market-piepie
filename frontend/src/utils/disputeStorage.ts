import { DisputeStatus, ORDER_STATUS_VALUE } from '@/types';
import { getOrderById, getOrdersByProductId, updateOrderStatus, getOrderStatusBeforeDispute } from '@/utils/orderStorage';
import { getItem, setItem } from '@/utils/heavyStorage';
import { syncDisputeToDB, syncDisputeStatusToDB, syncDisputesFromDB } from '@/utils/dbSync';
import { getCurrentUserId } from '@/utils/authStorage';

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

/** DB와 동기화한 뒤 주문·작성자에 연결된 분쟁 반환 */
export const ensureDisputeByOrderId = async (
  orderId: string,
  openedByUserId?: string | null,
): Promise<Dispute | undefined> => {
  const uid = getCurrentUserId();
  if (uid) await syncDisputesFromDB(uid);
  return getDisputeByOrderId(orderId, openedByUserId);
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

/** Disputes linked to a product (for listing cards) */
export const getDisputeCountByProductId = (productId: string): number => {
  return getDisputes().filter((d) => {
    const order = getOrderById(d.orderId);
    return order?.product?.id === productId;
  }).length;
};

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
      const order = getOrderById(dispute.orderId);
      if (order && order.status === ORDER_STATUS_VALUE.DISPUTE) {
        const restoreStatus = getOrderStatusBeforeDispute(order);
        await updateOrderStatus(dispute.orderId, restoreStatus, 'Dispute resolved.');
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
