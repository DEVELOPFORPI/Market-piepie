import { chatT, type ChatMessageKey } from '@/i18n/chatMessages';
import { getAppLanguage, type AppLanguage } from '@/utils/languageStorage';

/** Korean / English system chat lines → message key (+ vars). */
export function chatSystemMessageKey(
  content: string,
): { key: ChatMessageKey; vars?: Record<string, string | number> } | null {
  const raw = content;
  const t = raw.trim().replace(/\s+/g, ' ');

  const exact: Record<string, ChatMessageKey> = {
    'This item has been reserved!': 'msgProductReserved',
    'Meetup details were updated.': 'msgMeetupUpdated',
    'The meetup was canceled.': 'msgMeetupCanceled',
    'The seller started scheduling a meetup.': 'msgSellerMeetupStarted',
    'The trade is complete.': 'msgTradeCompleted',
    'The buyer confirmed receipt.': 'msgReceiptConfirmed',
    'A review has been posted.': 'msgReviewWritten',
    'The buyer requested a free share.': 'msgBuyerShareRequest',
    'The buyer sent a price offer.': 'msgBuyerPriceOffer',
    'The free share request was accepted.': 'msgAcceptShare',
    'The free share request was declined.': 'msgRejectShare',
    'Sent a photo': 'msgSentPhoto',
    // Legacy Korean stored text
    '상품이 예약되었습니다!': 'msgProductReserved',
    '상품이 예약되었습니다.': 'msgProductReserved',
    '이 상품이 예약되었습니다!': 'msgProductReserved',
    '약속 정보가 업데이트되었습니다.': 'msgMeetupUpdated',
    '약속이 취소되었습니다.': 'msgMeetupCanceled',
    '미팅이 취소되었습니다.': 'msgMeetupCanceled',
    '만남이 취소되었습니다.': 'msgMeetupCanceled',
    '판매자가 약속 잡기를 시작했어요.': 'msgSellerMeetupStarted',
    '판매자가 약속 잡기를 시작했어요': 'msgSellerMeetupStarted',
    '거래가 완료되었습니다.': 'msgTradeCompleted',
    '구매자가 수령을 확인했습니다.': 'msgReceiptConfirmed',
    '리뷰가 등록되었습니다.': 'msgReviewWritten',
    '구매자가 나눔을 요청했습니다.': 'msgBuyerShareRequest',
    '구매자가 무료 나눔을 요청했습니다.': 'msgBuyerShareRequest',
    '구매자가 가격 제안을 보냈습니다.': 'msgBuyerPriceOffer',
    '나눔 요청이 수락되었습니다.': 'msgAcceptShare',
    '무료 나눔 요청이 수락되었습니다.': 'msgAcceptShare',
    '나눔 요청이 거절되었습니다.': 'msgRejectShare',
    '무료 나눔 요청이 거절되었습니다.': 'msgRejectShare',
    '사진을 보냈습니다': 'msgSentPhoto',
  };

  const bangSeller = t.match(/^!\s*(?:The seller started scheduling a meetup\.|판매자가 약속 잡기를 시작했어요\.?)$/);
  if (bangSeller) return { key: 'msgSellerMeetupStarted' };

  const bangReserved = t.match(/^!\s*(?:This item has been reserved!|상품이 예약되었습니다!?)$/);
  if (bangReserved) return { key: 'msgProductReserved' };

  if (exact[raw]) return { key: exact[raw] };
  if (exact[t]) return { key: exact[t] };

  const acceptEn = t.match(/^The offer of ([\d,]+)\s*Pi was accepted\.$/i);
  if (acceptEn) return { key: 'msgAcceptOffer', vars: { amount: acceptEn[1].replace(/,/g, '') } };
  const rejectEn = t.match(/^The offer of ([\d,]+)\s*Pi was declined\.$/i);
  if (rejectEn) return { key: 'msgRejectOffer', vars: { amount: rejectEn[1].replace(/,/g, '') } };

  const acceptKo = t.match(/^([\d,]+)\s*Pi\s*제안을\s*수락했습니다\.?$/i);
  if (acceptKo) return { key: 'msgAcceptOffer', vars: { amount: acceptKo[1].replace(/,/g, '') } };
  const rejectKo = t.match(/^([\d,]+)\s*Pi\s*제안을\s*거절했습니다\.?$/i);
  if (rejectKo) return { key: 'msgRejectOffer', vars: { amount: rejectKo[1].replace(/,/g, '') } };

  const leftEn = t.match(/^(.+?) left the chat\.$/);
  if (leftEn) return { key: 'msgUserLeft', vars: { name: leftEn[1] } };
  const leftKo = t.match(/^(.+?)\s*님이\s*채팅방을\s*나갔습니다\.?$/);
  if (leftKo) return { key: 'msgUserLeft', vars: { name: leftKo[1] } };

  if (
    t.startsWith('The buyer confirmed receipt.') ||
    t.startsWith('구매자가 수령을 확인했습니다.') ||
    /^(.+?) confirmed receipt\./.test(t)
  ) {
    return { key: 'msgReceiptConfirmed' };
  }

  return null;
}

/** Localized display for stored chat system lines; user text returned as-is. */
export function displayChatMessageContent(
  content: string,
  lang: AppLanguage = getAppLanguage(),
): string {
  if (content == null || typeof content !== 'string') return content;
  const matched = chatSystemMessageKey(content);
  if (!matched) return content;
  const label = chatT(lang, matched.key, matched.vars);
  const trimmed = content.trim();
  if (trimmed.startsWith('!') && !label.startsWith('!')) {
    return `! ${label}`;
  }
  return label;
}

export function isChatSystemKey(content: string, key: ChatMessageKey): boolean {
  return chatSystemMessageKey(content)?.key === key;
}

export function isMeetupCanceledMessage(content: string): boolean {
  return isChatSystemKey(content, 'msgMeetupCanceled');
}
