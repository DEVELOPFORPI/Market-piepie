import { useCallback, useEffect, useState } from 'react';
import { commonT, type CommonMessageKey } from '@/i18n/commonMessages';
import { communityT, type CommunityMessageKey } from '@/i18n/communityMessages';
import { homeT, type HomeMessageKey } from '@/i18n/homeMessages';
import { chatT, type ChatMessageKey } from '@/i18n/chatMessages';
import { chatRoomT, type ChatRoomMessageKey } from '@/i18n/chatRoomMessages';
import { listingT, type ListingMessageKey } from '@/i18n/listingMessages';
import { accountT, type AccountMessageKey } from '@/i18n/accountMessages';
import { inquiryWriteT, type InquiryWriteMessageKey } from '@/i18n/inquiryWriteMessages';
import { disputePageT, type DisputePageMessageKey } from '@/i18n/disputePageMessages';
import { productT, type ProductMessageKey } from '@/i18n/productMessages';
import { profileT, type ProfileMessageKey } from '@/i18n/profileMessages';
import { profileEditT, type ProfileEditMessageKey } from '@/i18n/profileEditMessages';
import { badgeNameT, type BadgeNameMessageKey } from '@/i18n/badgeNameMessages';
import { orderDetailT, type OrderDetailMessageKey } from '@/i18n/orderDetailMessages';
import { signupProfileT, type SignupProfileMessageKey } from '@/i18n/signupProfileMessages';
import { searchT, type SearchMessageKey } from '@/i18n/searchMessages';
import { offerT, type OfferMessageKey } from '@/i18n/offerMessages';
import { sellerProfileT, type SellerProfileMessageKey } from '@/i18n/sellerProfileMessages';
import { registerCompleteT, type RegisterCompleteMessageKey } from '@/i18n/registerCompleteMessages';
import { reviewWriteT, type ReviewWriteMessageKey } from '@/i18n/reviewWriteMessages';
import { meetupScheduleT, type MeetupScheduleMessageKey } from '@/i18n/meetupScheduleMessages';
import { receiveConfirmT, type ReceiveConfirmMessageKey } from '@/i18n/receiveConfirmMessages';
import { noticeT, type NoticeMessageKey } from '@/i18n/noticeMessages';
import { regionT, type RegionMessageKey } from '@/i18n/regionMessages';
import { AppLanguage, getAppLanguage } from '@/utils/languageStorage';

export type AppMessageKey =
  | HomeMessageKey
  | RegionMessageKey
  | CommonMessageKey
  | CommunityMessageKey
  | ListingMessageKey
  | ChatMessageKey
  | ChatRoomMessageKey
  | ProductMessageKey
  | ProfileMessageKey
  | ProfileEditMessageKey
  | AccountMessageKey
  | InquiryWriteMessageKey
  | DisputePageMessageKey
  | BadgeNameMessageKey
  | OrderDetailMessageKey
  | SignupProfileMessageKey
  | SearchMessageKey
  | OfferMessageKey
  | SellerProfileMessageKey
  | RegisterCompleteMessageKey
  | ReviewWriteMessageKey
  | MeetupScheduleMessageKey
  | ReceiveConfirmMessageKey
  | NoticeMessageKey;

const REGION_KEYS = new Set<string>([
  'useCurrentLocation',
  'detectingLocation',
  'gpsHint',
  'enterManually',
  'regionPlaceholder',
  'regionHint',
  'saveRegionFailed',
  'detectLocationFailed',
  'locationPermissionDenied',
  'locationConsentTitle',
  'locationConsentBody',
  'locationConsentNote',
  'locationConsentAgree',
  'locationConsentCancel',
  'regionUnset',
]);

const COMMON_KEYS = new Set<string>([
  'disputeBanner',
  'ok',
  'statTrades',
  'statShares',
  'statDisputes',
]);

const COMMUNITY_KEYS = new Set<string>([
  'catQuestion',
  'catInfo',
  'catLookingFor',
  'catDispute',
  'catSwap',
  'noPostsYet',
  'beFirstToShare',
  'writeAPost',
  'writePostAria',
  'newPost',
  'editPost',
  'categoryLabel',
  'titleLabel',
  'bodyLabel',
  'imagesOptional',
  'titlePlaceholder',
  'bodyPlaceholder',
  'publish',
  'saveChanges',
  'saving',
  'publishing',
  'uploading',
  'upTo5Images',
  'attachListingOptional',
  'attachListingHint',
  'attachedListing',
  'remove',
  'attachListing',
  'skipAttach',
  'chooseYourListing',
  'createListing',
  'disputePostResolved',
  'lookingForThisItem',
  'cannotEditDispute',
  'postNotFound',
  'upTo5ImagesAlert',
  'couldNotUpload',
  'enterTitleBody',
  'sensitiveConfirm',
  'postPublished',
  'postUpdated',
  'couldNotSave',
  'postDetailTitle',
  'loading',
  'edit',
  'delete',
  'report',
  'cancel',
  'reply',
  'commentsCount',
  'noCommentsYet',
  'writeComment',
  'replyingTo',
  'replyToPlaceholder',
  'postComment',
  'deleteCommentConfirm',
  'cannotDeleteDispute',
  'deletePostConfirm',
  'viewsCount',
  'disputeFiledBy',
  'disputeOtherParty',
  'disputeWith',
  'disputeView',
  'disputeShareView',
  'disputeReason',
  'disputeDetails',
  'disputeLinkedListing',
  'requestedAction',
  'commentOptions',
  'likeAria',
]);

const LISTING_KEYS = new Set<string>([
  'newListing',
  'editListing',
  'tradeArea',
  'change',
  'setRegion',
  'photos',
  'listingTitle',
  'listingTitlePlaceholder',
  'listingType',
  'freeShare',
  'pricePi',
  'description',
  'optional',
  'describeItem',
  'allowOffers',
  'allowOffersHint',
  'freeShareNoOffers',
  'publishListing',
  'soldCannotEdit',
  'cannotEditDispute',
  'upToPhotos',
  'fillRequired',
  'addOnePhoto',
  'couldNotSaveListing',
  'listingUpdated',
  'chooseRegion',
]);

/** Omit `cancel` — shared with communityKeys / communityT. */
const CHAT_KEYS = new Set<string>([
  'chatsTitle',
  'selectAll',
  'unselectAll',
  'deleteAria',
  'selectAria',
  'sayHello',
  'noChatsYet',
  'listingUnavailable',
  'ended',
  'inDispute',
  'leaveChat',
  'leaveChatConfirm',
  'leaveNChats',
  'leaveNChatsConfirm',
  'msgProductReserved',
  'msgMeetupUpdated',
  'msgMeetupCanceled',
  'msgSellerMeetupStarted',
  'msgTradeCompleted',
  'msgReceiptConfirmed',
  'msgReviewWritten',
  'msgBuyerShareRequest',
  'msgBuyerPriceOffer',
  'msgAcceptShare',
  'msgRejectShare',
  'msgAcceptOffer',
  'msgRejectOffer',
  'msgSentPhoto',
  'msgUserLeft',
]);

const CHAT_ROOM_KEYS = new Set<string>([
  'reviewSubmitted',
  'writeReview',
  'sendOffer',
  'confirmReceipt',
  'openDispute',
  'viewDispute',
  'scheduleMeetup',
  'confirmComplete',
  'confirmTradeCompletion',
  'couldNotLoadListing',
  'couldNotLoadPartner',
  'couldNotStartMeetup',
  'couldNotStartMeetupScheduling',
  'details',
  'meetupStartedAria',
  'meetupStartedTitle',
  'meetupStartedHint',
  'listingRemoved',
  'viewListing',
  'meetupPlace',
  'dateLine',
  'placeTimeNotSetYet',
  'freeShareRequest',
  'wasPrice',
  'offerAmount',
  'accept',
  'decline',
  'declineShareConfirm',
  'declineOfferConfirm',
  'couldNotDeclineOffer',
  'typeMessage',
  'listingRemovedCannotMessage',
  'dateAndTime',
  'placeTimeNotSetYetModal',
  'close',
  'viewProfileAria',
  'verified',
  'newMessages',
  'unreadFromHere',
  'bannerTradeComplete',
  'bannerListingSold',
  'bannerListingOtherDispute',
  'bannerYourDispute',
  'bannerTheirDispute',
  'bannerDisputeGeneric',
  'bannerDisputeResolved',
  'roomEnded',
  'roomEndedInput',
  'couldNotSendPhotos',
  'messageSendFailed',
  'listingRemovedAlert',
]);

const PRODUCT_KEYS = new Set<string>([
  'priceLabel',
  'makeOffer',
  'offerSent',
  'chatsCount',
  'sameDayOk',
  'showMore',
  'showLess',
  'noDescription',
  'deleteConfirm',
  'couldNotUpdateListing',
  'setPriceBeforeForSale',
  'couldNotUpdateStatus',
  'loading',
  'productNotFound',
  'listingRemovedOrInvalid',
  'goHome',
  'goBack',
  'moreOptions',
  'adminHidden',
  'adminHiddenContinue',
  'cannotEditDeleteDispute',
  'listingSold',
  'itemReserved',
  'listingOpenDispute',
  'inPerson',
  'shipping',
]);

const PROFILE_KEYS = new Set<string>([
  'myTitle',
  'editProfile',
  'profileTab',
  'badgesTab',
  'activityBadges',
  'back',
  'guest',
  'myListings',
  'saved',
  'orders',
  'myPosts',
  'reviews',
  'inquiries',
  'disputes',
  'settings',
  'badgesEarnHint',
  'badgesTapHint',
  'badgeMain',
  'badgeEarnFree',
  'badgeUnlockNow',
  'close',
  'payPi',
  'processing',
  'paymentCancelled',
  'paymentFailed',
  'ariaBadgeFeatured',
  'ariaBadgeSet',
  'ariaBadgeLocked',
  'noSavedListings',
  'browseListings',
  'removeFromSavedConfirm',
  'noSavedMatchFilter',
  'listingWasRemoved',
  'removeFromList',
  'removeFromSavedAria',
]);

const ACCOUNT_KEYS = new Set<string>([
  'buying',
  'selling',
  'noOrdersYet',
  'removedListing',
  'listingFallback',
  'orderStatusPendingOffer',
  'orderStatusAccepted',
  'orderStatusInProgress',
  'orderStatusAwaitingShipping',
  'orderStatusMeetupSet',
  'orderStatusShipped',
  'orderStatusDelivered',
  'orderStatusReceived',
  'orderStatusComplete',
  'orderStatusDispute',
  'noPostsInCategory',
  'writePost',
  'reviewsReceived',
  'reviewsWritten',
  'noReviewsReceived',
  'noReviewsReceivedHint',
  'noReviewsWritten',
  'noReviewsWrittenHint',
  'viewOrders',
  'tagQuickResponse',
  'tagOnTime',
  'tagKind',
  'tagAsDescribed',
  'tagRecommend',
  'myInquiriesTitle',
  'newInquiry',
  'inqCatGeneral',
  'inqCatBugReport',
  'inqCatAccount',
  'inqCatTrade',
  'inqCatSuggestion',
  'inqCatOther',
  'inqStatusPending',
  'inqStatusReplied',
  'inqStatusClosed',
  'replyReceived',
  'loadInquiriesFailed',
  'retry',
  'noInquiriesYet',
  'noInquiriesHint',
  'noInquiriesInCategory',
  'inquiryDetail',
  'labelCategory',
  'labelSubmitted',
  'labelTitle',
  'labelContent',
  'labelImages',
  'labelAdminReply',
  'awaitingAdmin',
  'reasonLabel',
  'noDisputes',
  'noDisputesHint',
  'orderButton',
  'disputeActive',
  'disputeResolved',
  'disputeSent',
  'disputeReceived',
  'settingsTitle',
  'regionMenu',
  'inquiryMenu',
  'inquiryMenuHint',
  'switchAccountLogout',
]);

const INQUIRY_WRITE_KEYS = new Set<string>([
  'inquiryFormTitle',
  'inquiryTitlePh',
  'inquiryContentPh',
  'emailOptional',
  'emailPlaceholder',
  'imagesCount',
  'add',
  'removeImage',
  'submitInquiry',
  'submitting',
  'inquirySubmitted',
  'inquirySubmittedHint',
  'viewMyInquiries',
  'uploadImageFailed',
  'submitInquiryFailed',
]);

const PROFILE_EDIT_KEYS = new Set<string>([
  'nicknameLabel',
  'bioLabel',
  'regionLabel',
  'nicknamePlaceholder',
  'bioPlaceholder',
  'save',
  'discardUnsavedConfirm',
  'discardUnsaved',
  'couldNotSaveProfile',
  'profileAlt',
]);

const BADGE_NAME_KEYS = new Set<string>([
  'badge01', 'badge02', 'badge03', 'badge04', 'badge05', 'badge06', 'badge07',
  'badge08', 'badge09', 'badge10', 'badge11', 'badge12', 'badge13', 'badge14',
]);

const SIGNUP_PROFILE_KEYS = new Set<string>([
  'createProfile',
  'setupProfileHint',
  'chooseProfilePhoto',
  'profilePhotoOptional',
  'nicknameLengthPh',
  'bioOptionalPh',
  'areaLabel',
  'nicknameMin2',
  'nicknameMax20',
  'getStarted',
  'defaultBio',
]);

const SEARCH_KEYS = new Set<string>([
  'searchTitle',
  'searchQueryPh',
  'filtersTitle',
  'recent',
  'suggested',
  'noResultsFor',
]);

const OFFER_KEYS = new Set<string>([
  'yourOfferPi',
  'listPriceLine',
  'belowListPct',
  'tradeNotes',
  'tradeNoteNoPayment',
  'tradeNoteArrangeDirect',
  'tradeNoteDisputes',
  'cannotOfferSold',
  'couldNotSendOffer',
]);

const SELLER_PROFILE_KEYS = new Set<string>([
  'listingsTab',
  'postsTab',
  'userNotFound',
  'sellerNoListings',
  'noListingsInCategory',
  'noReviewsYet',
  'noDisputesInCategory',
  'reviewCountOne',
  'reviewCountMany',
  'anonymous',
]);

const REGISTER_COMPLETE_KEYS = new Set<string>([
  'publishedTitle',
  'listingPublished',
  'listingVisibleHint',
  'yourListingFallback',
  'tipsHeading',
  'tipClearPhotos',
  'tipAccurateDesc',
  'tipSameDay',
  'doneAlt',
]);

const REVIEW_WRITE_KEYS = new Set<string>([
  'alreadyReviewed',
  'reviewSubmitFailed',
  'couldNotSaveReview',
  'ratingLabel',
  'ratingExcellent',
  'ratingGood',
  'ratingOkay',
  'ratingPoor',
  'ratingBad',
  'tagsOptional',
  'commentLabel',
  'shareExperiencePh',
  'submitReview',
]);

const MEETUP_SCHEDULE_KEYS = new Set<string>([
  'editMeetup',
  'meetupPlacePh',
  'dateLabel',
  'dateCalendarHint',
  'timeLabel',
  'hourLabel',
  'minuteLabel',
  'minOption',
  'amPmLabel',
  'amPmOption',
  'storedAs24h',
  'chooseTimeHint',
  'notifyOtherOnSave',
  'notifyOtherOnConfirm',
  'doubleCheckTimePlace',
  'confirmMeetup',
  'cancelMeetup',
  'fillAllFields',
  'dateFormatHint',
  'timeFormatHint',
  'dateNotPast',
  'meetupUpdatedAlert',
  'meetupConfirmedAlert',
  'cancelMeetupConfirm',
  'meetupCanceledAlert',
  'onlySellerCanMeetup',
]);

const RECEIVE_CONFIRM_KEYS = new Set<string>([
  'cannotConfirmDuringDispute',
  'onlyBuyerCanConfirm',
  'confirmYouReceived',
  'tradeDetails',
  'meetupTimeLabel',
  'itemCondition',
  'conditionGood',
  'conditionGoodHint',
  'conditionOk',
  'conditionOkHint',
  'conditionPoor',
  'conditionPoorHint',
  'notesOptional',
  'notesConditionPh',
  'confirmReceiptCheckbox',
  'freeShareNoDisputeInline',
  'canOpenDisputeInline',
  'headsUp',
  'freeShareUseChat',
  'disputeBeforeConfirmHint',
  'submitReceiptConfirm',
  'receiptConfirmedLeaveReview',
  'receiptConfirmedWaitSeller',
  'sellersCannotConfirm',
]);

const NOTICE_KEYS = new Set<string>([
  'noticesTitle',
  'loadNoticesFailed',
  'loadNoticeFailed',
  'noNotices',
  'popupNoImage',
]);

const ORDER_DETAIL_KEYS = new Set<string>([
  'orderDetailTitle',
  'freePrice',
  'listingSection',
  'listingRemovedBySeller',
  'noteLabel',
  'timelineHeading',
  'partiesHeading',
  'buyerLabel',
  'sellerLabel',
  'methodLabel',
  'offerDateLabel',
  'tlFreeShareRequest',
  'tlPurchaseOffer',
  'tlInPersonFreeShare',
  'tlChatStarted',
  'tlInPersonTradeAt',
  'tlMeetupConfirmed',
  'tlBuyerAcceptedMeetup',
  'tlMeetupCanceled',
  'tlBuyerConfirmedComplete',
  'tlSellerConfirmedComplete',
  'tlTradeCompleted',
  'tlReceiptConfirmed',
  'tlBuyerShippingDetails',
  'tlShippedVia',
  'tlPurchaseOfferCreated',
  'tlOfferAccepted',
  'tlOfferDeclined',
  'offerAlreadyPending',
  'offerAlreadyAccepted',
  'tlAdminResolvedDispute',
  'statusAdminResolved',
  'tlAwaitingShipping',
  'tlMarkedShipped',
  'tlMarkedDelivered',
  'tlDisputeOpened',
  'tlDisputeResolved',
  'tlBuyerDisputeOpened',
  'tlSellerDisputeOpened',
  'tlBuyerDisputeResolved',
  'tlSellerDisputeResolved',
]);

const DISPUTE_PAGE_KEYS = new Set<string>([
  'disputeDetailsTitle',
  'openDisputeTitle',
  'otherParty',
  'statusHeading',
  'yourDispute',
  'theirDispute',
  'filedAt',
  'resolvedAt',
  'orderSection',
  'noDisputeFromOther',
  'orderNotFound',
  'requestedAction',
  'refundNoticeTitle',
  'refundNoticeBody',
  'detailsLabel',
  'detailsPlaceholder',
  'evidence',
  'evidenceAlt',
  'disputeSummary',
  'disputeReceived',
  'resolveHintOpener',
  'resolveHintCounterparty',
  'underReview',
  'reviewResponseDefault',
  'reviewOutcomesHint',
  'disputeResolvedTitle',
  'disputeClosedDefault',
  'submitDispute',
  'markResolved',
  'markResolvedConfirm',
  'backToOrders',
  'freeShareNoDispute',
  'couldNotFileDispute',
  'disputeFiledButPostFailed',
  'onlyOpenerCanResolve',
  'couldNotUpdateDisputeStatus',
]);

export function useLanguage() {
  const [lang, setLang] = useState<AppLanguage>(() => getAppLanguage());

  useEffect(() => {
    const refresh = () => setLang(getAppLanguage());
    window.addEventListener('languageChanged', refresh);
    return () => window.removeEventListener('languageChanged', refresh);
  }, []);

  const t = useCallback(
    (key: AppMessageKey, vars?: Record<string, string | number>) => {
      if (COMMON_KEYS.has(key)) {
        return commonT(lang, key as CommonMessageKey);
      }
      if (REGION_KEYS.has(key)) {
        return regionT(lang, key as RegionMessageKey);
      }
      if (COMMUNITY_KEYS.has(key)) {
        return communityT(lang, key as CommunityMessageKey, vars);
      }
      if (LISTING_KEYS.has(key)) {
        return listingT(lang, key as ListingMessageKey, vars);
      }
      if (CHAT_KEYS.has(key)) {
        return chatT(lang, key as ChatMessageKey, vars);
      }
      if (CHAT_ROOM_KEYS.has(key)) {
        return chatRoomT(lang, key as ChatRoomMessageKey, vars);
      }
      if (PRODUCT_KEYS.has(key)) {
        return productT(lang, key as ProductMessageKey, vars);
      }
      if (PROFILE_KEYS.has(key)) {
        return profileT(lang, key as ProfileMessageKey, vars);
      }
      if (PROFILE_EDIT_KEYS.has(key)) {
        return profileEditT(lang, key as ProfileEditMessageKey, vars);
      }
      if (BADGE_NAME_KEYS.has(key)) {
        return badgeNameT(lang, key as BadgeNameMessageKey);
      }
      if (ORDER_DETAIL_KEYS.has(key)) {
        return orderDetailT(lang, key as OrderDetailMessageKey, vars);
      }
      if (SIGNUP_PROFILE_KEYS.has(key)) {
        return signupProfileT(lang, key as SignupProfileMessageKey, vars);
      }
      if (SEARCH_KEYS.has(key)) {
        return searchT(lang, key as SearchMessageKey, vars);
      }
      if (OFFER_KEYS.has(key)) {
        return offerT(lang, key as OfferMessageKey, vars);
      }
      if (SELLER_PROFILE_KEYS.has(key)) {
        return sellerProfileT(lang, key as SellerProfileMessageKey, vars);
      }
      if (REGISTER_COMPLETE_KEYS.has(key)) {
        return registerCompleteT(lang, key as RegisterCompleteMessageKey, vars);
      }
      if (REVIEW_WRITE_KEYS.has(key)) {
        return reviewWriteT(lang, key as ReviewWriteMessageKey, vars);
      }
      if (MEETUP_SCHEDULE_KEYS.has(key)) {
        return meetupScheduleT(lang, key as MeetupScheduleMessageKey, vars);
      }
      if (RECEIVE_CONFIRM_KEYS.has(key)) {
        return receiveConfirmT(lang, key as ReceiveConfirmMessageKey, vars);
      }
      if (NOTICE_KEYS.has(key)) {
        return noticeT(lang, key as NoticeMessageKey, vars);
      }
      if (ACCOUNT_KEYS.has(key)) {
        return accountT(lang, key as AccountMessageKey, vars);
      }
      if (INQUIRY_WRITE_KEYS.has(key)) {
        return inquiryWriteT(lang, key as InquiryWriteMessageKey, vars);
      }
      if (DISPUTE_PAGE_KEYS.has(key)) {
        return disputePageT(lang, key as DisputePageMessageKey, vars);
      }
      return homeT(lang, key as HomeMessageKey, vars);
    },
    [lang],
  );

  return { lang, t };
}
