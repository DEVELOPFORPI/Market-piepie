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
    'Purchase offer created': 'tlPurchaseOfferCreated',
    'Offer accepted': 'tlOfferAccepted',
    'Awaiting shipping details': 'tlAwaitingShipping',
    'Marked as shipped': 'tlMarkedShipped',
    'Marked as delivered': 'tlMarkedDelivered',
    'Dispute opened': 'tlDisputeOpened',
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
  if (inPersonEn) return { key: 'tlInPersonTradeAt', vars: { n: inPersonEn[1].replace(/,/g, '') } };
  const inPersonKo = t.match(/^([\d,]+)\s*Pi\s*직거래$/);
  if (inPersonKo) return { key: 'tlInPersonTradeAt', vars: { n: inPersonKo[1].replace(/,/g, '') } };

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

export function displayOrderTimelineDescription(
  description: string,
  lang: AppLanguage = getAppLanguage(),
): string {
  const matched = orderTimelineMessageMatch(description);
  if (!matched) return description;
  return orderDetailT(lang, matched.key, matched.vars);
}
