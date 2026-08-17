import { orderDetailT, type OrderDetailMessageKey } from '@/i18n/orderDetailMessages';
import { getAppLanguage, type AppLanguage } from '@/utils/languageStorage';

/** Map stored timeline descriptions (EN or legacy KO) → message key + vars. */
export function orderTimelineMessageMatch(
  description: string,
): { key: OrderDetailMessageKey; vars?: Record<string, string | number> } | null {
  const raw = (description ?? '').trim();
  if (!raw) return null;
  const t = raw.replace(/\s+/g, ' ');

  const exact: Record<string, OrderDetailMessageKey> = {
    'Free share request': 'tlFreeShareRequest',
    'In-person free share': 'tlInPersonFreeShare',
    'Meetup confirmed': 'tlMeetupConfirmed',
    'Buyer accepted the meetup': 'tlBuyerAcceptedMeetup',
    'Meetup canceled': 'tlMeetupCanceled',
    'Buyer confirmed trade complete': 'tlBuyerConfirmedComplete',
    'Seller confirmed trade complete': 'tlSellerConfirmedComplete',
    'Trade completed': 'tlTradeCompleted',
    'Receipt confirmed': 'tlReceiptConfirmed',
    'Buyer submitted shipping details': 'tlBuyerShippingDetails',
    'Chat started': 'tlChatStarted',
    '채팅 시작': 'tlChatStarted',
    'Purchase offer created': 'tlPurchaseOfferCreated',
    'Offer accepted': 'tlOfferAccepted',
    'Awaiting shipping details': 'tlAwaitingShipping',
    'Marked as shipped': 'tlMarkedShipped',
    'Marked as delivered': 'tlMarkedDelivered',
    'Dispute opened': 'tlDisputeOpened',
    'Dispute resolved.': 'tlDisputeResolved',
    'Dispute resolved': 'tlDisputeResolved',
    '분쟁 해결': 'tlDisputeResolved',
    'Buyer dispute opened': 'tlBuyerDisputeOpened',
    'Seller dispute opened': 'tlSellerDisputeOpened',
    'Buyer dispute resolved': 'tlBuyerDisputeResolved',
    'Seller dispute resolved': 'tlSellerDisputeResolved',
    '구매자 분쟁': 'tlBuyerDisputeOpened',
    '판매자 분쟁': 'tlSellerDisputeOpened',
    '구매자 분쟁 해결': 'tlBuyerDisputeResolved',
    '판매자 분쟁 해결': 'tlSellerDisputeResolved',
    // Legacy Korean (from pick())
    '나눔 요청': 'tlFreeShareRequest',
    '직거래 나눔': 'tlInPersonFreeShare',
    '약속 확정': 'tlMeetupConfirmed',
    '거래 완료': 'tlTradeCompleted',
    '수령 확인됨': 'tlReceiptConfirmed',
    '수령 확인': 'tlReceiptConfirmed',
    '구매 제안 생성': 'tlPurchaseOfferCreated',
    '제안 수락': 'tlOfferAccepted',
    '배송정보 대기': 'tlAwaitingShipping',
    '발송 처리됨': 'tlMarkedShipped',
    '배송 완료 처리됨': 'tlMarkedDelivered',
    '분쟁 접수': 'tlDisputeOpened',
  };

  if (exact[raw] || exact[t]) return { key: exact[raw] ?? exact[t] };

  const inPersonEn = t.match(/^In-person trade at ([\d,]+)\s*Pi$/i);
  if (inPersonEn) return { key: 'tlChatStarted' };
  const inPersonKo = t.match(/^([\d,]+)\s*Pi\s*직거래$/);
  if (inPersonKo) return { key: 'tlChatStarted' };
  if (t === 'In-person free share' || t === '직거래 나눔') return { key: 'tlChatStarted' };

  const offerEn = t.match(/^([\d,]+)\s*Pi purchase offer$/i);
  if (offerEn) return { key: 'tlPurchaseOffer', vars: { n: offerEn[1].replace(/,/g, '') } };
  const offerKo = t.match(/^([\d,]+)\s*Pi\s*구매 제안$/);
  if (offerKo) return { key: 'tlPurchaseOffer', vars: { n: offerKo[1].replace(/,/g, '') } };

  const shippedEn = t.match(/^Shipped via (.+)$/i);
  if (shippedEn) return { key: 'tlShippedVia', vars: { company: shippedEn[1] } };
  const shippedKo = t.match(/^(.+)\(으\)로 발송$/);
  if (shippedKo) return { key: 'tlShippedVia', vars: { company: shippedKo[1] } };

  const disputeFiled = t.match(/^Dispute filed:\s*(.+)$/i);
  if (disputeFiled) return { key: 'tlDisputeOpened' };

  return null;
}

export type DisputeTimelineParty = 'buyer' | 'seller';

export function disputePartyRole(d: {
  openedByUserId?: string;
  buyerId?: string;
  sellerId?: string;
}): DisputeTimelineParty {
  if (d.openedByUserId && d.sellerId && d.openedByUserId === d.sellerId) return 'seller';
  return 'buyer';
}

export function disputeOpenedTimelineText(role: DisputeTimelineParty): string {
  return role === 'seller' ? 'Seller dispute opened' : 'Buyer dispute opened';
}

export function disputeResolvedTimelineText(role: DisputeTimelineParty): string {
  return role === 'seller' ? 'Seller dispute resolved' : 'Buyer dispute resolved';
}

export function isDisputeOpenedTimeline(description: string): boolean {
  const t = (description ?? '').trim().replace(/\s+/g, ' ');
  return (
    t === 'Dispute opened' ||
    t === '분쟁 접수' ||
    t === 'Buyer dispute opened' ||
    t === 'Seller dispute opened' ||
    t === '구매자 분쟁' ||
    t === '판매자 분쟁' ||
    /^Dispute filed:/i.test(t)
  );
}

export function isDisputeResolvedTimeline(description: string): boolean {
  const t = (description ?? '').trim().replace(/\s+/g, ' ');
  return (
    t === 'Dispute resolved.' ||
    t === 'Dispute resolved' ||
    t === '분쟁 해결' ||
    t === 'Buyer dispute resolved' ||
    t === 'Seller dispute resolved' ||
    t === '구매자 분쟁 해결' ||
    t === '판매자 분쟁 해결'
  );
}

type PartyDisputeRef = {
  id: string;
  status: string;
  createdAt?: string;
  resolvedAt?: string;
  openedByUserId?: string;
  buyerId?: string;
  sellerId?: string;
};

function claimNearest<T>(
  items: T[],
  used: Set<number>,
  eventTime: number,
  timeOf: (item: T) => number,
  windowMs = 180_000,
): T | undefined {
  let best: { i: number; item: T; dist: number } | undefined;
  items.forEach((item, i) => {
    if (used.has(i)) return;
    const t = timeOf(item);
    if (Number.isNaN(t)) return;
    const dist = Math.abs(t - eventTime);
    if (dist > windowMs) return;
    if (!best || dist < best.dist) best = { i, item, dist };
  });
  if (!best) return undefined;
  used.add(best.i);
  return best.item;
}

/** Fill in resolve rows that were skipped when a second party closed their own dispute. */
export function mergeResolvedDisputeTimeline<T extends { id: string; timestamp: string; description: string; type: string }>(
  timeline: T[],
  disputes: PartyDisputeRef[],
): T[] {
  const events = [...timeline];
  const existingResolve = events
    .map((e, i) => ({ i, t: new Date(e.timestamp).getTime(), match: isDisputeResolvedTimeline(e.description) }))
    .filter((e) => e.match && !Number.isNaN(e.t));
  const used = new Set<number>();

  for (const d of disputes) {
    if (d.status !== 'RESOLVED' || !d.resolvedAt) continue;
    const t = new Date(d.resolvedAt).getTime();
    if (Number.isNaN(t)) continue;
    const claimed = existingResolve.find((e) => !used.has(e.i) && Math.abs(e.t - t) < 180_000);
    if (claimed) {
      used.add(claimed.i);
      continue;
    }
    events.push({
      id: `t_dispute_resolved_${d.id}`,
      type: 'RESOLVED',
      timestamp: d.resolvedAt,
      description: disputeResolvedTimelineText(disputePartyRole(d)),
    } as T);
  }

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Rewrite generic dispute rows as buyer/seller using the matching dispute record. */
export function labelDisputeTimelineByParty<T extends { id: string; timestamp: string; description: string; type: string }>(
  timeline: T[],
  disputes: PartyDisputeRef[],
): T[] {
  const openedUsed = new Set<number>();
  const resolvedUsed = new Set<number>();
  const resolvedDisputes = disputes.filter((d) => d.status === 'RESOLVED' && d.resolvedAt);

  return timeline.map((event) => {
    const eventTime = new Date(event.timestamp).getTime();
    if (Number.isNaN(eventTime)) return event;
    if (isDisputeOpenedTimeline(event.description)) {
      const d = claimNearest(
        disputes,
        openedUsed,
        eventTime,
        (item) => new Date(item.createdAt || '').getTime(),
      );
      if (!d) return event;
      return { ...event, description: disputeOpenedTimelineText(disputePartyRole(d)) };
    }
    if (isDisputeResolvedTimeline(event.description)) {
      const d = claimNearest(
        resolvedDisputes,
        resolvedUsed,
        eventTime,
        (item) => new Date(item.resolvedAt || '').getTime(),
      );
      if (!d) return event;
      return { ...event, description: disputeResolvedTimelineText(disputePartyRole(d)) };
    }
    return event;
  });
}

export function timelineWithPartyDisputes<T extends { id: string; timestamp: string; description: string; type: string }>(
  timeline: T[],
  disputes: PartyDisputeRef[],
): T[] {
  return labelDisputeTimelineByParty(mergeResolvedDisputeTimeline(timeline, disputes), disputes);
}

export function displayOrderTimelineDescription(
  description: string,
  lang: AppLanguage = getAppLanguage(),
): string {
  const matched = orderTimelineMessageMatch(description);
  if (!matched) return description;
  return orderDetailT(lang, matched.key, matched.vars);
}
