import type {
  BuyerChatTab,
  OrderStatus,
  PostCategory,
  ProductStatus,
  SellerType,
  TabType,
  HomeFeedChip,
  TradeMethod,
} from '@/types';
import {
  BUYER_CHAT_TAB_VALUE,
  ORDER_STATUS_VALUE,
  POST_CATEGORY_VALUE,
  PRODUCT_STATUS_VALUE,
  SELLER_TYPE_VALUE,
  HOME_FEED_CHIP_VALUE,
  TRADE_METHOD_VALUE,
} from '@/types';
import { accountT } from '@/i18n/accountMessages';
import { communityT } from '@/i18n/communityMessages';
import { homeT } from '@/i18n/homeMessages';
import { productT } from '@/i18n/productMessages';
import { getAppLanguage } from '@/utils/languageStorage';

export {
  displayChatMessageContent,
  isMeetupCanceledMessage,
  isChatSystemKey,
} from '@/utils/chatDisplay';

/** UI strings are English-first; Korean literals in `types/` are persisted data keys only. */
const pick = (en: string, _ko?: string) => en;

export function labelProductStatus(s: ProductStatus): string {
  const lang = getAppLanguage();
  const map: Record<ProductStatus, string> = {
    [PRODUCT_STATUS_VALUE.FOR_SALE]: homeT(lang, 'forSale'),
    [PRODUCT_STATUS_VALUE.RESERVED]: homeT(lang, 'trading'),
    [PRODUCT_STATUS_VALUE.SOLD]: homeT(lang, 'sold'),
  };
  return map[s];
}

/** Listing cards: show trade-complete instead of raw status for completed listings */
export function labelProductStatusListing(s: ProductStatus): string {
  return s === PRODUCT_STATUS_VALUE.SOLD ? homeT(getAppLanguage(), 'sold') : labelProductStatus(s);
}

export function isFreeShareListing(product: { isFreeShare?: boolean; price?: number }): boolean {
  return Boolean(product.isFreeShare || product.price === 0);
}

/** Free listings still for sale show "Free"; trading/sold keep status labels */
export function labelProductAvailability(product: {
  status: ProductStatus;
  isFreeShare?: boolean;
  price?: number;
}): string {
  if (isFreeShareListing(product) && product.status === PRODUCT_STATUS_VALUE.FOR_SALE) {
    return homeT(getAppLanguage(), 'free');
  }
  return labelProductStatusListing(product.status);
}

export function labelFreeShareMenu(): string {
  return homeT(getAppLanguage(), 'free');
}

export function labelCommentReply(): string {
  return pick('Reply', '답글달기');
}

export function labelProfileStatTrades(): string {
  return pick('Trades', '거래');
}

export function labelProfileStatShares(): string {
  return pick('Shares', '나눔');
}

export function labelProfileStatDisputes(): string {
  return pick('Disputes', '분쟁');
}

export function labelInDispute(): string {
  return homeT(getAppLanguage(), 'inDispute');
}

export function labelOrderStatus(s: OrderStatus): string {
  const lang = getAppLanguage();
  const map: Record<OrderStatus, string> = {
    [ORDER_STATUS_VALUE.PENDING_OFFER]: accountT(lang, 'orderStatusPendingOffer'),
    [ORDER_STATUS_VALUE.ACCEPTED]: accountT(lang, 'orderStatusAccepted'),
    [ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO]: accountT(lang, 'orderStatusAwaitingShipping'),
    [ORDER_STATUS_VALUE.MEETUP_SET]: accountT(lang, 'orderStatusMeetupSet'),
    [ORDER_STATUS_VALUE.SHIPPED]: accountT(lang, 'orderStatusShipped'),
    [ORDER_STATUS_VALUE.DELIVERED]: accountT(lang, 'orderStatusDelivered'),
    [ORDER_STATUS_VALUE.RECEIVED]: accountT(lang, 'orderStatusReceived'),
    [ORDER_STATUS_VALUE.COMPLETE]: accountT(lang, 'orderStatusComplete'),
    [ORDER_STATUS_VALUE.DISPUTE]: accountT(lang, 'orderStatusDispute'),
  };
  return map[s];
}

export function labelTradeMethod(method: TradeMethod): string {
  const lang = getAppLanguage();
  const map: Record<TradeMethod, string> = {
    [TRADE_METHOD_VALUE.IN_PERSON]: productT(lang, 'inPerson'),
    [TRADE_METHOD_VALUE.SHIPPING]: productT(lang, 'shipping'),
  };
  return map[method];
}

export function labelTabType(t: TabType): string {
  return labelHomeFeedChip(t);
}

export function labelHomeFeedChip(chip: HomeFeedChip): string {
  const map: Record<HomeFeedChip, string> = {
    [HOME_FEED_CHIP_VALUE.ALL]: pick('All', '전체'),
    [HOME_FEED_CHIP_VALUE.LATEST]: pick('Latest', '최신순'),
    [HOME_FEED_CHIP_VALUE.FREE]: pick('Free', '나눔'),
    [HOME_FEED_CHIP_VALUE.FOR_SALE]: pick('For sale', '판매중'),
    [HOME_FEED_CHIP_VALUE.POPULAR]: pick('Popular', '인기순'),
    [HOME_FEED_CHIP_VALUE.PRICE_LOW]: pick('Price low', '가격 낮은순'),
    [HOME_FEED_CHIP_VALUE.PRICE_HIGH]: pick('Price high', '가격 높은순'),
    [HOME_FEED_CHIP_VALUE.OLDEST]: pick('Oldest', '오래된순'),
  };
  return map[chip];
}

export function labelSellerType(t: SellerType): string {
  const map: Record<SellerType, string> = {
    [SELLER_TYPE_VALUE.INDIVIDUAL]: pick('Individual', '개인'),
    [SELLER_TYPE_VALUE.BUSINESS]: pick('Business', '사업자'),
  };
  return map[t];
}

export function labelPostCategory(c: PostCategory): string {
  const lang = getAppLanguage();
  const map: Record<PostCategory, string> = {
    [POST_CATEGORY_VALUE.QUESTION]: communityT(lang, 'catQuestion'),
    [POST_CATEGORY_VALUE.INFO]: communityT(lang, 'catInfo'),
    [POST_CATEGORY_VALUE.LOOKING_FOR]: communityT(lang, 'catLookingFor'),
    [POST_CATEGORY_VALUE.DISPUTE]: communityT(lang, 'catDispute'),
    [POST_CATEGORY_VALUE.SWAP]: communityT(lang, 'catSwap'),
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
  const lang = getAppLanguage();
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return homeT(lang, 'justNow');
  if (diff < 60) return homeT(lang, 'minutesAgo', { n: diff });
  if (diff < 1440) return homeT(lang, 'hoursAgo', { n: Math.floor(diff / 60) });
  return homeT(lang, 'daysAgo', { n: Math.floor(diff / 1440) });
}

/** Timeline / storage descriptions for order status transitions (always English; localize at display). */
export function descriptionForOrderStatusForTimeline(s: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    [ORDER_STATUS_VALUE.PENDING_OFFER]: 'Purchase offer created',
    [ORDER_STATUS_VALUE.ACCEPTED]: 'Offer accepted',
    [ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO]: 'Awaiting shipping details',
    [ORDER_STATUS_VALUE.MEETUP_SET]: 'Meetup confirmed',
    [ORDER_STATUS_VALUE.SHIPPED]: 'Marked as shipped',
    [ORDER_STATUS_VALUE.DELIVERED]: 'Marked as delivered',
    [ORDER_STATUS_VALUE.RECEIVED]: 'Receipt confirmed',
    [ORDER_STATUS_VALUE.COMPLETE]: 'Trade completed',
    [ORDER_STATUS_VALUE.DISPUTE]: 'Dispute opened',
  };
  return map[s] ?? s;
}

// --- Persisted chat system bodies (English) ---
export const CHAT_MSG_PRODUCT_RESERVED = pick('This item has been reserved!', '상품이 예약되었습니다!');
export const CHAT_MSG_MEETUP_UPDATED = pick('Meetup details were updated.', '약속 정보가 업데이트되었습니다.');
export const CHAT_MSG_MEETUP_CANCELED = pick('The meetup was canceled.', '약속이 취소되었습니다.');
export const CHAT_MSG_SELLER_MEETUP_STARTED = pick('The seller started scheduling a meetup.', '판매자가 약속 잡기를 시작했어요.');
export const CHAT_MSG_TRADE_COMPLETED = pick('The trade is complete.', '\uAC70\uB798\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
export const CHAT_BANNER_TRADE_COMPLETE = pick('Trade complete for this order.', 'This trade is complete.');
export const CHAT_BANNER_LISTING_SOLD = pick('This listing has been sold.', 'This item has been sold.');
export const CHAT_BANNER_YOUR_DISPUTE = pick('You opened a dispute', 'You filed a dispute');
export const CHAT_BANNER_THEIR_DISPUTE = pick('The other party opened a dispute', 'The other party filed a dispute');
export const CHAT_BANNER_DISPUTE_GENERIC = pick('This item is in a dispute', 'This item is in dispute');
export const CHAT_BANNER_DISPUTE_RESOLVED = pick('Dispute resolved for this item.', 'Dispute resolved for this item.');
export const DISPUTE_VIEW_OTHER_READONLY = pick(
  'You are viewing the other party\'s dispute (read-only).',
  'You are viewing the other party\'s dispute (read-only).',
);
export const DISPUTE_LIST_SENT = pick('Sent', 'Sent');
export const DISPUTE_LIST_RECEIVED = pick('Received', 'Received');
export const DISPUTE_STATUS_ACTIVE = pick('Active', 'Active');
export const DISPUTE_STATUS_RESOLVED = pick('Resolved', 'Resolved');
export const DISPUTE_OTHER_PARTY = pick('Other party', 'Other party');
export const DISPUTE_FILED_BY = pick('Filed by', 'Filed by');
export const DISPUTE_WITH = pick('Dispute with', 'Dispute with');
export const DISPUTE_VIEW = pick('View dispute', 'View dispute');
export const DISPUTE_POST_SHARE_VIEW = pick(
  'Share your view in the comments.',
  'Share your view in the comments.',
);
export const DISPUTE_POST_RESOLVED = pick('This dispute is resolved.', 'This dispute is resolved.');
export const DISPUTE_REASON_LABEL = pick('Reason', 'Reason');
export const DISPUTE_DETAILS_LABEL = pick('Details', 'Details');
export const DISPUTE_LINKED_LISTING = pick('Listing', 'Listing');
export const CHAT_MSG_RECEIPT_CONFIRMED = pick('The buyer confirmed receipt.', '\uAD6C\uB9E4\uC790\uAC00 \uC218\uB839\uC744 \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4.');
export const CHAT_MSG_REVIEW_WRITTEN = pick('A review has been posted.', '\uB9AC\uBDF0\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
export const CHAT_MSG_BUYER_SHARE_REQUEST = pick('The buyer requested a free share.', '구매자가 나눔을 요청했습니다.');
export const CHAT_MSG_BUYER_PRICE_OFFER = pick('The buyer sent a price offer.', '구매자가 가격 제안을 보냈습니다.');
export const CHAT_MSG_ACCEPT_SHARE = pick('The free share request was accepted.', '나눔 요청이 수락되었습니다.');
export const CHAT_MSG_REJECT_SHARE = pick('The free share request was declined.', '나눔 요청이 거절되었습니다.');
export const chatMsgAcceptOffer = (amount: string) => pick(`The offer of ${amount} Pi was accepted.`, `${amount} Pi 제안을 수락했습니다.`);
export const chatMsgRejectOffer = (amount: string) => pick(`The offer of ${amount} Pi was declined.`, `${amount} Pi 제안을 거절했습니다.`);
export const chatMsgUserLeft = (nickname: string) => pick(`${nickname} left the chat.`, `${nickname} 님이 채팅방을 나갔습니다.`);
export const CHAT_LEAVE_ROOM = pick('Leave chat', '채팅방 나가기');
export const CHAT_LEAVE_ROOM_CONFIRM = pick(
  'Leave this chat?\nThe chat will end for both of you. You can start a new chat from the listing.',
  '채팅방을 나가시겠습니까?\n채팅이 양쪽 모두 종료됩니다. 상품에서 다시 새 채팅을 시작할 수 있습니다.',
);
export const CHAT_ROOM_ENDED = pick(
  'This chat has ended. Start a new chat from the listing.',
  '이 채팅은 종료되었습니다. 상품에서 새 채팅을 시작해 주세요.',
);
export const CHAT_ROOM_ENDED_INPUT = pick(
  'This chat has ended; you cannot send messages.',
  '종료된 채팅방에서는 메시지를 보낼 수 없습니다.',
);
export const CHAT_ROOM_ENDED_BADGE = pick('Ended', '종료됨');
export const CHAT_LASTMSG_PHOTO = pick('Sent a photo', '사진을 보냈습니다');
export const CHAT_NEW_MESSAGES = pick('New messages', '새 메시지');
export const CHAT_UNREAD_FROM_HERE = pick('Unread from here', '여기부터 안 읽음');
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
export const NOTIFY_BADGE_UNLOCKED = pick('New activity badge unlocked!', '새로운 활동 배지가 획득되었습니다!');
export const MEETUP_STARTED_SNIPPET = pick('started scheduling a meetup', '약속 잡기를 시작');

export const MEETUP_TITLE_SET = new Set<string>([
  NOTIFY_MEETUP_CONFIRMED,
  NOTIFY_MEETUP_UPDATED,
  NOTIFY_MEETUP_CANCELED,
]);

export function isMeetupNotificationTitle(title: string): boolean {
  return (
    MEETUP_TITLE_SET.has(title)
    || title.includes(MEETUP_STARTED_SNIPPET)
    || title.includes('약속 잡기를 시작')
  );
}

export const COMPLETION_TITLE_SET = new Set<string>([NOTIFY_TRADE_COMPLETE_CHECK, NOTIFY_TRADE_COMPLETED]);

export function notifyTitleSellerStartedMeetup(sellerNickname: string): string {
  return `${sellerNickname} ${MEETUP_STARTED_SNIPPET}`;
}

/** Map legacy Korean notification titles (stored in DB/localStorage) to English for display/routing. */
const LEGACY_NOTIFY_TITLE_TO_EN: Record<string, string> = {
  '새로운 활동 배지가 획득되었습니다!': NOTIFY_BADGE_UNLOCKED,
  '새 채팅이 시작되었습니다': NOTIFY_NEW_CHAT,
  '채팅방이 열렸습니다': NOTIFY_CHAT_ROOM_CREATED,
  '제안이 수락되었습니다': NOTIFY_OFFER_ACCEPTED,
  '제안이 거절되었습니다': NOTIFY_OFFER_DECLINED,
  '리뷰가 등록되었습니다': NOTIFY_REVIEW_WRITTEN,
  '수령이 확인되었습니다': NOTIFY_RECEIVE_CONFIRM,
  '거래 완료 확인': NOTIFY_TRADE_COMPLETE_CHECK,
  '거래가 완료되었습니다': NOTIFY_TRADE_COMPLETED,
  '약속이 확정되었습니다': NOTIFY_MEETUP_CONFIRMED,
  '약속 정보가 변경되었습니다': NOTIFY_MEETUP_UPDATED,
  '약속이 취소되었습니다': NOTIFY_MEETUP_CANCELED,
  '새 구매 제안이 도착했습니다': NOTIFY_PURCHASE_OFFER_ARRIVED,
  '새 나눔 요청이 도착했습니다': NOTIFY_FREE_SHARE_REQUEST_ARRIVED,
};

export function normalizeNotificationTitle(title: string): string {
  if (!title) return title;
  const exact = LEGACY_NOTIFY_TITLE_TO_EN[title.trim()];
  if (exact) return exact;
  const meetupLegacy = title.match(/^(.+)\s님이\s약속\s잡기를\s시작했습니다\.?$/);
  if (meetupLegacy) return notifyTitleSellerStartedMeetup(meetupLegacy[1].trim());
  return title;
}

export function displayNotificationTitle(title: string): string {
  return normalizeNotificationTitle(title);
}

/** Order quota / storage user message */
export const MSG_ORDER_QUOTA_EXCEEDED =
  pick('Not enough storage to save this order. Free space in Settings, then try again.', '저장 공간이 부족하여 주문을 저장할 수 없습니다. 설정에서 공간을 비운 뒤 다시 시도해 주세요.');

/** Region picker placeholder when none saved */
export const UI_REGION_PLACEHOLDER = pick('Choose region', '지역 선택');

