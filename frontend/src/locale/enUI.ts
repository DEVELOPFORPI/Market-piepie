import type {
  BuyerChatTab,
  OrderStatus,
  PostCategory,
  ProductStatus,
  SellerType,
  TabType,
  TradeMethod,
} from '@/types';
import {
  BUYER_CHAT_TAB_VALUE,
  ORDER_STATUS_VALUE,
  POST_CATEGORY_VALUE,
  PRODUCT_STATUS_VALUE,
  SELLER_TYPE_VALUE,
  TAB_TYPE_VALUE,
  TRADE_METHOD_VALUE,
} from '@/types';

const DEV_KO = import.meta.env.DEV;
const pick = (en: string, ko: string) => (DEV_KO ? ko : en);

export function labelProductStatus(s: ProductStatus): string {
  const map: Record<ProductStatus, string> = {
    [PRODUCT_STATUS_VALUE.FOR_SALE]: pick('For sale', '\uD310\uB9E4\uC911'),
    [PRODUCT_STATUS_VALUE.RESERVED]: pick('Trading', '\uAC70\uB798\uC911'),
    [PRODUCT_STATUS_VALUE.SOLD]: pick('Trade complete', '\uAC70\uB798\uC644\uB8CC'),
  };
  return map[s];
}

/** Listing cards: show trade-complete instead of raw status for completed listings */
export function labelProductStatusListing(s: ProductStatus): string {
  return s === PRODUCT_STATUS_VALUE.SOLD ? pick('Trade complete', '\uAC70\uB798\uC644\uB8CC') : labelProductStatus(s);
}

export function labelOrderStatus(s: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    [ORDER_STATUS_VALUE.PENDING_OFFER]: pick('Offer pending', '제안중'),
    [ORDER_STATUS_VALUE.ACCEPTED]: pick('Accepted', '수락됨'),
    [ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO]: pick('Awaiting shipping info', '배송정보대기'),
    [ORDER_STATUS_VALUE.MEETUP_SET]: pick('Meetup set', '약속확정'),
    [ORDER_STATUS_VALUE.SHIPPED]: pick('Shipped', '발송완료'),
    [ORDER_STATUS_VALUE.DELIVERED]: pick('Delivered', '배송완료'),
    [ORDER_STATUS_VALUE.RECEIVED]: pick('Received', '수령완료'),
    [ORDER_STATUS_VALUE.COMPLETE]: pick('Completed', '완료'),
    [ORDER_STATUS_VALUE.DISPUTE]: pick('Dispute', '분쟁'),
  };
  return map[s];
}

export function labelTradeMethod(t: TradeMethod): string {
  const map: Record<TradeMethod, string> = {
    [TRADE_METHOD_VALUE.IN_PERSON]: pick('In person', '직거래'),
    [TRADE_METHOD_VALUE.SHIPPING]: pick('Shipping', '택배'),
  };
  return map[t];
}

export function labelTabType(t: TabType): string {
  const map: Record<TabType, string> = {
    [TAB_TYPE_VALUE.LATEST]: pick('Latest', '최신'),
    [TAB_TYPE_VALUE.FREE]: pick('Free', '나눔'),
  };
  return map[t];
}

export function labelSellerType(t: SellerType): string {
  const map: Record<SellerType, string> = {
    [SELLER_TYPE_VALUE.INDIVIDUAL]: pick('Individual', '개인'),
    [SELLER_TYPE_VALUE.BUSINESS]: pick('Business', '사업자'),
  };
  return map[t];
}

export function labelPostCategory(c: PostCategory): string {
  const map: Record<PostCategory, string> = {
    [POST_CATEGORY_VALUE.QUESTION]: pick('Question', '질문'),
    [POST_CATEGORY_VALUE.INFO]: pick('Info', '정보'),
    [POST_CATEGORY_VALUE.LOOKING_FOR]: pick('Looking for', '이거 찾아요'),
    [POST_CATEGORY_VALUE.DISPUTE]: pick('Dispute', '분쟁'),
    [POST_CATEGORY_VALUE.SWAP]: pick('Swap', '교환'),
  };
  return map[c];
}

export type { BuyerChatTab };

export function labelBuyerChatTab(tab: BuyerChatTab): string {
  const map: Record<BuyerChatTab, string> = {
    [BUYER_CHAT_TAB_VALUE.RECEIVE]: pick('Receive', '수령확인'),
    [BUYER_CHAT_TAB_VALUE.OFFER]: pick('Offer', '가격제안'),
    [BUYER_CHAT_TAB_VALUE.OPEN_DISPUTE]: pick('Dispute', '분쟁열기'),
  };
  return map[tab];
}

export function relativeTimeShort(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return pick('Just now', '방금 전');
  if (diff < 60) return DEV_KO ? `${diff}분 전` : `${diff}m ago`;
  if (diff < 1440) return DEV_KO ? `${Math.floor(diff / 60)}시간 전` : `${Math.floor(diff / 60)}h ago`;
  return DEV_KO ? `${Math.floor(diff / 1440)}일 전` : `${Math.floor(diff / 1440)}d ago`;
}

/** Timeline / storage descriptions for order status transitions (English) */
export function descriptionForOrderStatusForTimeline(s: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    [ORDER_STATUS_VALUE.PENDING_OFFER]: pick('Purchase offer created', '구매 제안 생성'),
    [ORDER_STATUS_VALUE.ACCEPTED]: pick('Offer accepted', '제안 수락'),
    [ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO]: pick('Awaiting shipping details', '배송정보 대기'),
    [ORDER_STATUS_VALUE.MEETUP_SET]: pick('Meetup confirmed', '약속 확정'),
    [ORDER_STATUS_VALUE.SHIPPED]: pick('Marked as shipped', '발송 처리됨'),
    [ORDER_STATUS_VALUE.DELIVERED]: pick('Marked as delivered', '배송 완료 처리됨'),
    [ORDER_STATUS_VALUE.RECEIVED]: pick('Receipt confirmed', '수령 확인됨'),
    [ORDER_STATUS_VALUE.COMPLETE]: pick('Trade completed', '거래 완료'),
    [ORDER_STATUS_VALUE.DISPUTE]: pick('Dispute opened', '분쟁 접수'),
  };
  return map[s] ?? s;
}

// --- Persisted chat system bodies (English) ---
export const CHAT_MSG_PRODUCT_RESERVED = pick('This item has been reserved!', '상품이 예약되었습니다!');
export const CHAT_MSG_MEETUP_UPDATED = pick('Meetup details were updated.', '약속 정보가 업데이트되었습니다.');
export const CHAT_MSG_MEETUP_CANCELED = pick('The meetup was canceled.', '약속이 취소되었습니다.');
export const CHAT_MSG_SELLER_MEETUP_STARTED = pick('The seller started scheduling a meetup.', '판매자가 약속 잡기를 시작했어요.');
export const CHAT_MSG_TRADE_COMPLETED = pick('The trade is complete.', '\uAC70\uB798\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
export const CHAT_MSG_RECEIPT_CONFIRMED = pick('The buyer confirmed receipt.', '\uAD6C\uB9E4\uC790\uAC00 \uC218\uB839\uC744 \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4.');
export const CHAT_MSG_REVIEW_WRITTEN = pick('A review has been posted.', '\uB9AC\uBDF0\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
export const CHAT_MSG_BUYER_SHARE_REQUEST = pick('The buyer requested a free share.', '구매자가 나눔을 요청했습니다.');
export const CHAT_MSG_BUYER_PRICE_OFFER = pick('The buyer sent a price offer.', '구매자가 가격 제안을 보냈습니다.');
export const CHAT_MSG_ACCEPT_SHARE = pick('The free share request was accepted.', '나눔 요청이 수락되었습니다.');
export const CHAT_MSG_REJECT_SHARE = pick('The free share request was declined.', '나눔 요청이 거절되었습니다.');
export const chatMsgAcceptOffer = (amount: string) => pick(`The offer of ${amount} Pi was accepted.`, `${amount} Pi 제안을 수락했습니다.`);
export const chatMsgRejectOffer = (amount: string) => pick(`The offer of ${amount} Pi was declined.`, `${amount} Pi 제안을 거절했습니다.`);
export const chatMsgUserLeft = (nickname: string) => pick(`${nickname} left the chat.`, `${nickname} 님이 채팅방을 나갔습니다.`);
export const CHAT_LASTMSG_PHOTO = pick('Sent a photo', '사진을 보냈습니다');
export const CHAT_FALLBACK_NICKNAME = pick('Someone', '알 수 없음');

// --- Notification titles (persisted; match across app) ---
export const NOTIFY_NEW_CHAT = pick('New chat started', '새 채팅이 시작되었습니다');
export const NOTIFY_CHAT_ROOM_CREATED = pick('Chat room opened', '채팅방이 열렸습니다');
export const NOTIFY_OFFER_ACCEPTED = pick('Offer accepted', '제안이 수락되었습니다');
export const NOTIFY_OFFER_DECLINED = pick('Offer declined', '제안이 거절되었습니다');
export const NOTIFY_REVIEW_WRITTEN = pick('Review posted', '리뷰가 등록되었습니다');
export const NOTIFY_RECEIVE_CONFIRM = pick('Receipt confirmed', '수령이 확인되었습니다');
export const NOTIFY_TRADE_COMPLETE_CHECK = pick('Trade completion check', '거래 완료 확인');
export const NOTIFY_TRADE_COMPLETED = pick('Trade completed', '거래가 완료되었습니다');
export const NOTIFY_MEETUP_CONFIRMED = pick('Meetup confirmed', '약속이 확정되었습니다');
export const NOTIFY_MEETUP_UPDATED = pick('Meetup updated', '약속 정보가 변경되었습니다');
export const NOTIFY_MEETUP_CANCELED = pick('Meetup canceled', '약속이 취소되었습니다');
export const NOTIFY_PURCHASE_OFFER_ARRIVED = pick('New purchase offer', '새 구매 제안이 도착했습니다');
export const NOTIFY_FREE_SHARE_REQUEST_ARRIVED = pick('New free share request', '새 나눔 요청이 도착했습니다');
export const MEETUP_STARTED_SNIPPET = pick('started scheduling a meetup', '약속 잡기를 시작');

export const MEETUP_TITLE_SET = new Set<string>([
  NOTIFY_MEETUP_CONFIRMED,
  NOTIFY_MEETUP_UPDATED,
  NOTIFY_MEETUP_CANCELED,
]);

export function isMeetupNotificationTitle(title: string): boolean {
  return MEETUP_TITLE_SET.has(title) || title.includes(MEETUP_STARTED_SNIPPET);
}

export const COMPLETION_TITLE_SET = new Set<string>([NOTIFY_TRADE_COMPLETE_CHECK, NOTIFY_TRADE_COMPLETED]);

export function notifyTitleSellerStartedMeetup(sellerNickname: string): string {
  return DEV_KO ? `${sellerNickname} 님이 약속 잡기를 시작했습니다` : `${sellerNickname} ${MEETUP_STARTED_SNIPPET}`;
}

/** Order quota / storage user message */
export const MSG_ORDER_QUOTA_EXCEEDED =
  pick('Not enough storage to save this order. Free space in Settings, then try again.', '저장 공간이 부족하여 주문을 저장할 수 없습니다. 설정에서 공간을 비운 뒤 다시 시도해 주세요.');

/** Region picker placeholder when none saved */
export const UI_REGION_PLACEHOLDER = pick('Choose region', '지역 선택');

/**
 * Older builds stored Korean system text in chat messages. Map to current English for display
 * without migrating localStorage. User-typed text is unchanged unless it exactly matches a key.
 */
export function displayChatMessageContent(content: string): string {
  if (content == null || typeof content !== 'string') return content;
  const raw = content;
  const t = raw.trim().replace(/\s+/g, ' ');

  const exact: Record<string, string> = {
    '! 판매자가 약속 잡기를 시작했어요.': `! ${CHAT_MSG_SELLER_MEETUP_STARTED}`,
    '!판매자가 약속 잡기를 시작했어요.': `!${CHAT_MSG_SELLER_MEETUP_STARTED}`,
    '판매자가 약속 잡기를 시작했어요.': CHAT_MSG_SELLER_MEETUP_STARTED,
    '판매자가 약속 잡기를 시작했어요': CHAT_MSG_SELLER_MEETUP_STARTED,
    '! 상품이 예약되었습니다!': CHAT_MSG_PRODUCT_RESERVED,
    '!상품이 예약되었습니다!': CHAT_MSG_PRODUCT_RESERVED,
    '상품이 예약되었습니다!': CHAT_MSG_PRODUCT_RESERVED,
    '상품이 예약되었습니다.': CHAT_MSG_PRODUCT_RESERVED,
    '이 상품이 예약되었습니다!': CHAT_MSG_PRODUCT_RESERVED,
    '약속 정보가 업데이트되었습니다.': CHAT_MSG_MEETUP_UPDATED,
    '약속이 취소되었습니다.': CHAT_MSG_MEETUP_CANCELED,
    '미팅이 취소되었습니다.': CHAT_MSG_MEETUP_CANCELED,
    '만남이 취소되었습니다.': CHAT_MSG_MEETUP_CANCELED,
    '거래가 완료되었습니다.': CHAT_MSG_TRADE_COMPLETED,
    '구매자가 나눔을 요청했습니다.': CHAT_MSG_BUYER_SHARE_REQUEST,
    '구매자가 무료 나눔을 요청했습니다.': CHAT_MSG_BUYER_SHARE_REQUEST,
    '구매자가 가격 제안을 보냈습니다.': CHAT_MSG_BUYER_PRICE_OFFER,
    '나눔 요청이 수락되었습니다.': CHAT_MSG_ACCEPT_SHARE,
    '무료 나눔 요청이 수락되었습니다.': CHAT_MSG_ACCEPT_SHARE,
    '나눔 요청이 거절되었습니다.': CHAT_MSG_REJECT_SHARE,
    '무료 나눔 요청이 거절되었습니다.': CHAT_MSG_REJECT_SHARE,
  };

  if (exact[raw] != null) return exact[raw];
  if (exact[t] != null) return exact[t];

  const acceptPi = t.match(/^([\d,]+)\s*Pi\s*제안을\s*수락했습니다\.?$/i);
  if (acceptPi) return chatMsgAcceptOffer(acceptPi[1].replace(/,/g, ''));

  const rejectPi = t.match(/^([\d,]+)\s*Pi\s*제안을\s*거절했습니다\.?$/i);
  if (rejectPi) return chatMsgRejectOffer(rejectPi[1].replace(/,/g, ''));

  return raw;
}

/** System line stored in Korean before i18n pass */
export function isMeetupCanceledMessage(content: string): boolean {
  const c = content.trim();
  if (c === CHAT_MSG_MEETUP_CANCELED) return true;
  return ['약속이 취소되었습니다.', '미팅이 취소되었습니다.', '만남이 취소되었습니다.'].includes(c);
}
