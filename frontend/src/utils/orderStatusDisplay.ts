import { ORDER_STATUS_VALUE, type Order, type OrderStatus } from '@/types';
import { getDisputesByOrderId } from '@/utils/disputeStorage';
import { orderTimelineMessageMatch } from '@/utils/orderTimelineDisplay';

export const DISPLAY_IN_PROGRESS = 'IN_PROGRESS';

export type DisplayOrderStatus = OrderStatus | typeof DISPLAY_IN_PROGRESS;

function orderHasOfferAccepted(order: Order): boolean {
  return (order.timeline || []).some((event) => {
    const key = orderTimelineMessageMatch(event.description || '')?.key;
    return key === 'tlOfferAccepted';
  });
}

/**
 * Badge status:
 * - open dispute → 분쟁중
 * - meetup set → 약속확정
 * - offer accepted, no meetup yet → 수락됨
 * - chat-started / leftover accepted → 거래 중
 */
export function getDisplayOrderStatus(order: Order): DisplayOrderStatus {
  const hasOpenDispute = getDisputesByOrderId(order.id).some((d) => d.status !== 'RESOLVED');
  if (hasOpenDispute) return ORDER_STATUS_VALUE.DISPUTE;
  if (
    (order.status === ORDER_STATUS_VALUE.ACCEPTED || order.status === ORDER_STATUS_VALUE.MEETUP_SET)
    && order.meetupPlace
    && order.meetupDate
    && order.meetupTime
  ) {
    return ORDER_STATUS_VALUE.MEETUP_SET;
  }
  if (order.status === ORDER_STATUS_VALUE.ACCEPTED) {
    return orderHasOfferAccepted(order) ? ORDER_STATUS_VALUE.ACCEPTED : DISPLAY_IN_PROGRESS;
  }
  return order.status;
}
