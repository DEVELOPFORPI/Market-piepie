import { notifyT, type NotifyMessageKey } from '@/i18n/notifyMessages';
import { labelDisputeStoredValue } from '@/utils/disputeLabels';
import type { AppLanguage } from '@/utils/languageStorage';
import type { StoredNotification } from '@/utils/notificationStorage';
import {
  NOTIFY_BADGE_UNLOCKED,
  NOTIFY_CHAT_ROOM_CREATED,
  NOTIFY_FREE_SHARE_REQUEST_ARRIVED,
  NOTIFY_MEETUP_CANCELED,
  NOTIFY_MEETUP_CONFIRMED,
  NOTIFY_MEETUP_UPDATED,
  NOTIFY_NEW_CHAT,
  NOTIFY_OFFER_ACCEPTED,
  NOTIFY_OFFER_DECLINED,
  NOTIFY_PURCHASE_OFFER_ARRIVED,
  NOTIFY_RECEIVE_CONFIRM,
  NOTIFY_REVIEW_WRITTEN,
  NOTIFY_TRADE_COMPLETE_CHECK,
  NOTIFY_TRADE_COMPLETED,
  NOTIFY_POST_COMMENT,
  NOTIFY_INQUIRY_REPLY,
  NOTIFY_DISPUTE_RESOLVED,
  normalizeNotificationTitle,
} from '@/locale/enUI';

const TITLE_KEY: Record<string, NotifyMessageKey> = {
  [NOTIFY_BADGE_UNLOCKED]: 'titleBadge',
  [NOTIFY_NEW_CHAT]: 'titleNewChat',
  [NOTIFY_CHAT_ROOM_CREATED]: 'titleChatOpened',
  [NOTIFY_PURCHASE_OFFER_ARRIVED]: 'titlePurchaseOffer',
  [NOTIFY_FREE_SHARE_REQUEST_ARRIVED]: 'titleFreeShare',
  [NOTIFY_OFFER_ACCEPTED]: 'titleOfferAccepted',
  [NOTIFY_OFFER_DECLINED]: 'titleOfferDeclined',
  [NOTIFY_MEETUP_CONFIRMED]: 'titleMeetupConfirmed',
  [NOTIFY_MEETUP_UPDATED]: 'titleMeetupUpdated',
  [NOTIFY_MEETUP_CANCELED]: 'titleMeetupCanceled',
  'Shipping details needed': 'titleShipping',
  [NOTIFY_RECEIVE_CONFIRM]: 'titleReceipt',
  [NOTIFY_TRADE_COMPLETE_CHECK]: 'titleTradeCheck',
  [NOTIFY_TRADE_COMPLETED]: 'titleTradeCompleted',
  [NOTIFY_REVIEW_WRITTEN]: 'titleReview',
  'Dispute filed': 'titleDisputeFiled',
  'Dispute post published': 'titleDisputePost',
  [NOTIFY_POST_COMMENT]: 'titlePostComment',
  [NOTIFY_INQUIRY_REPLY]: 'titleInquiryReply',
  [NOTIFY_DISPUTE_RESOLVED]: 'titleDisputeResolved',
};

const BADGE_KEY: Record<string, NotifyMessageKey> = {
  '01': 'badge01',
  '02': 'badge02',
  '03': 'badge03',
  '04': 'badge04',
  '05': 'badge05',
  '06': 'badge06',
  '07': 'badge07',
  '08': 'badge08',
  '09': 'badge09',
  '10': 'badge10',
  '11': 'badge11',
  '12': 'badge12',
  '13': 'badge13',
  '14': 'badge14',
};

const EN_BADGE_LABEL_TO_ID: Record<string, string> = {
  'First deal': '01',
  'Chat starter': '02',
  'Word of mouth': '03',
  'First stroke': '04',
  Wordsmith: '05',
  'Power writer': '06',
  'Sharing newbie': '07',
  'Warm hands': '08',
  'Kind neighbor': '09',
  'Sharing angel': '10',
  'Giveaway champ': '11',
  'Badge rookie': '12',
  'Badge fan': '13',
  'Excitement alert': '14',
};

type BodyRule = {
  re: RegExp;
  key: NotifyMessageKey;
  map: (m: RegExpMatchArray, lang: AppLanguage) => Record<string, string | number>;
};

const BODY_RULES: BodyRule[] = [
  {
    re: /^(.+?) started a chat about "(.+?)"\.$/,
    key: 'bodyNewChat',
    map: (m) => ({ name: m[1], title: m[2] }),
  },
  {
    re: /^A chat was opened for "(.+?)"\.$/,
    key: 'bodyChatOpened',
    map: (m) => ({ title: m[1] }),
  },
  {
    re: /^(.+?) declined your offer for "(.+?)"\.$/,
    key: 'bodyOfferDeclined',
    map: (m) => ({ name: m[1], title: m[2] }),
  },
  {
    re: /^(.+?) accepted your offer for "(.+?)"\.$/,
    key: 'bodyOfferAccepted',
    map: (m) => ({ name: m[1], title: m[2] }),
  },
  {
    re: /^(.+?) confirmed receipt for "(.+?)"\. The trade is complete\.$/,
    key: 'bodyReceiptShare',
    map: (m) => ({ name: m[1], title: m[2] }),
  },
  {
    re: /^(.+?) confirmed receipt for "(.+?)"\. Please complete your side of the trade check\.$/,
    key: 'bodyReceiptPaid',
    map: (m) => ({ name: m[1], title: m[2] }),
  },
  {
    re: /^(.+?) confirmed trade completion for "(.+?)"\. Both sides confirmed; the trade is complete\.$/,
    key: 'bodyTradeCheckBoth',
    map: (m) => ({ name: m[1], title: m[2] }),
  },
  {
    re: /^(.+?) confirmed trade completion for "(.+?)"\.$/,
    key: 'bodyTradeCheck',
    map: (m) => ({ name: m[1], title: m[2] }),
  },
  {
    re: /^The free share for "(.+?)" is complete\. You can leave a review!$/,
    key: 'bodyShareCompleted',
    map: (m) => ({ title: m[1] }),
  },
  {
    re: /^The trade for "(.+?)" is complete after both sides confirmed\.$/,
    key: 'bodyTradeCompleted',
    map: (m) => ({ title: m[1] }),
  },
  {
    re: /^(.+?) sent a (.+?) Pi offer for "(.+?)"\.$/,
    key: 'bodyPurchaseOffer',
    map: (m) => ({ name: m[1], amount: m[2], title: m[3] }),
  },
  {
    re: /^(.+?) left a (\d+)-star review for "(.+?)"\.$/,
    key: 'bodyReview',
    map: (m) => ({ name: m[1], rating: m[2], title: m[3] }),
  },
  {
    re: /^Meetup for "(.+?)" is set: (.+?), (.+)$/,
    key: 'bodyMeetupSet',
    map: (m) => ({ title: m[1], place: m[2], when: m[3] }),
  },
  {
    re: /^Meetup for "(.+?)" was updated: (.+?), (.+)$/,
    key: 'bodyMeetupUpdated',
    map: (m) => ({ title: m[1], place: m[2], when: m[3] }),
  },
  {
    re: /^The meetup for "(.+?)" was canceled\.$/,
    key: 'bodyMeetupCanceled',
    map: (m) => ({ title: m[1] }),
  },
  {
    re: /^Please enter shipping details for "(.+?)"\.$/,
    key: 'bodyShipping',
    map: (m) => ({ title: m[1] }),
  },
  {
    re: /^(.+?) filed a dispute for "(.+?)"\. \(Reason: (.+?)\)$/,
    key: 'bodyDisputeFiled',
    map: (m, lang) => ({
      name: m[1],
      title: m[2],
      reason: labelDisputeStoredValue(lang, m[3]),
    }),
  },
  {
    re: /^A community post was created for the dispute on "(.+?)"\. You can leave comments there\.$/,
    key: 'bodyDisputePost',
    map: (m) => ({ title: m[1] }),
  },
  {
    re: /^(.+?) commented on "(.+?)"\.$/,
    key: 'bodyPostComment',
    map: (m) => ({ name: m[1], title: m[2] }),
  },
  {
    re: /^We replied to your inquiry "(.+?)"\.$/,
    key: 'bodyInquiryReply',
    map: (m) => ({ title: m[1] }),
  },
  {
    re: /^The dispute for "(.+?)" has been resolved\.$/,
    key: 'bodyDisputeResolved',
    map: (m) => ({ title: m[1] }),
  },
];

function localizeTitle(lang: AppLanguage, rawTitle: string): string {
  const title = normalizeNotificationTitle(rawTitle);
  const key = TITLE_KEY[title];
  if (key) return notifyT(lang, key);

  const meetup = title.match(/^(.+?)\s+started scheduling a meetup$/);
  if (meetup) return notifyT(lang, 'bodySellerMeetup', { name: meetup[1] });

  return title;
}

function localizeBadgeContent(lang: AppLanguage, content: string): string {
  const trimmed = content.trim();
  const byLabel = EN_BADGE_LABEL_TO_ID[trimmed];
  if (byLabel) return notifyT(lang, BADGE_KEY[byLabel]);
  const m = trimmed.match(/^Badge\s*(\d{2})$/i);
  if (m && BADGE_KEY[m[1]]) return notifyT(lang, BADGE_KEY[m[1]]);
  return trimmed;
}

function localizeBody(lang: AppLanguage, content: string): string {
  const text = content.trim();
  if (!text) return '';
  for (const rule of BODY_RULES) {
    const m = text.match(rule.re);
    if (m) return notifyT(lang, rule.key, rule.map(m, lang));
  }
  return text;
}

/** Display-time localization for stored English (or legacy KO title) notifications. */
export function localizeNotification(
  lang: AppLanguage,
  notification: StoredNotification,
): { title: string; content: string } {
  const canonicalTitle = normalizeNotificationTitle(notification.title);

  if (notification.type === 'badge') {
    const legacyText = `${notification.title} ${notification.content}`;
    const m = legacyText.match(/Badge\s*(\d{2})/i);
    const badgeContent = m?.[1]
      ? notifyT(lang, BADGE_KEY[m[1]] ?? 'badge01')
      : localizeBadgeContent(lang, notification.content);
    return {
      title: notifyT(lang, 'titleBadge'),
      content: badgeContent,
    };
  }

  return {
    title: localizeTitle(lang, canonicalTitle),
    content: localizeBody(lang, notification.content),
  };
}

export { TITLE_KEY };
