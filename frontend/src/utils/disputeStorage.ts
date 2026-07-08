import { DisputeStatus, ORDER_STATUS_VALUE } from '@/types';
import { getOrderById, getOrdersByProductId } from '@/utils/orderStorage';
import { deleteProduct } from '@/utils/productStorage';
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

export const getDisputeByOrderId = (orderId: string): Dispute | undefined => {
  return getDisputes().find((d) => d.orderId === orderId);
};

/** 로컬에 없으면 DB에서 분쟁 목록을 동기화한 뒤 반환 */
export const ensureDisputeByOrderId = async (orderId: string): Promise<Dispute | undefined> => {
  const local = getDisputeByOrderId(orderId);
  if (local) return local;
  const uid = getCurrentUserId();
  if (uid) await syncDisputesFromDB(uid);
  return getDisputeByOrderId(orderId);
};

/** True if product has an open dispute order (RESOLVED disputes excluded) */
export const hasProductActiveDispute = (productId: string): boolean => {
  const orders = getOrdersByProductId(productId);
  const disputeOrders = orders.filter((o) => o.status === ORDER_STATUS_VALUE.DISPUTE);
  return disputeOrders.some((o) => {
    const d = getDisputeByOrderId(o.id);
    return d && d.status !== 'RESOLVED';
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
      // Resolved: remove product listing (community dispute posts stay)
      const order = getOrderById(dispute.orderId);
      if (order?.product?.id) {
        void deleteProduct(order.product.id);
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
  const dispute: Dispute = {
    id: `dispute_${Date.now()}`,
    ...params,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };

  const ok = await syncDisputeToDB(dispute);
  if (!ok) return null;
  saveDispute(dispute);
  return dispute;
};
