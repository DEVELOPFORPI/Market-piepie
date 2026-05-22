export type KYCStatus = 'verified' | 'unverified';
export type TrustScore = number; // 0-100

/**
 * Korean literals below are persisted in localStorage / existing user data only.
 * UI copy is English via `locale/enUI.ts` (labelProductStatus, labelOrderStatus, …).
 */
/** Persisted product status strings (localStorage). Reference via these constants only. */
export const PRODUCT_STATUS_VALUE = {
  FOR_SALE: '판매중',
  RESERVED: '예약중',
  SOLD: '판매완료',
} as const;
export type ProductStatus = (typeof PRODUCT_STATUS_VALUE)[keyof typeof PRODUCT_STATUS_VALUE];

/** Persisted order status strings */
export const ORDER_STATUS_VALUE = {
  PENDING_OFFER: '제안중',
  ACCEPTED: '수락됨',
  AWAITING_SHIPPING_INFO: '배송정보대기',
  MEETUP_SET: '약속확정',
  SHIPPED: '발송완료',
  DELIVERED: '배송완료',
  RECEIVED: '수령완료',
  COMPLETE: '완료',
  DISPUTE: '분쟁',
} as const;
export type OrderStatus = (typeof ORDER_STATUS_VALUE)[keyof typeof ORDER_STATUS_VALUE];

/** Non-order timeline row types */
export const TIMELINE_EVENT_TYPE = {
  COMPLETE_CHECK: '완료확인',
} as const;

/** Legacy default nickname from older builds (onboarding completion heuristic) */
export const PROFILE_LEGACY_DEFAULT_NICKNAME = '내 닉네임';

export const SELLER_TYPE_VALUE = {
  INDIVIDUAL: '개인',
  BUSINESS: '사업자',
} as const;
export type SellerType = (typeof SELLER_TYPE_VALUE)[keyof typeof SELLER_TYPE_VALUE];

export type DisputeStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

export const TRADE_METHOD_VALUE = {
  IN_PERSON: '직거래',
  SHIPPING: '택배',
} as const;
export type TradeMethod = (typeof TRADE_METHOD_VALUE)[keyof typeof TRADE_METHOD_VALUE];

export const TAB_TYPE_VALUE = {
  LATEST: '최신',
  FREE: '나눔',
} as const;
export type TabType = (typeof TAB_TYPE_VALUE)[keyof typeof TAB_TYPE_VALUE];

export const POST_CATEGORY_VALUE = {
  QUESTION: '질문',
  INFO: '정보',
  LOOKING_FOR: '이거 찾아요',
  DISPUTE: '분쟁',
  SWAP: '교환',
} as const;
export type PostCategory = (typeof POST_CATEGORY_VALUE)[keyof typeof POST_CATEGORY_VALUE];

/** Chat room buyer sub-tabs (persisted state keys) */
export const BUYER_CHAT_TAB_VALUE = {
  RECEIVE: '수령확인',
  OFFER: '가격제안',
  OPEN_DISPUTE: '분쟁열기',
} as const;
export type BuyerChatTab = (typeof BUYER_CHAT_TAB_VALUE)[keyof typeof BUYER_CHAT_TAB_VALUE];

export interface User {
  id: string;
  nickname: string;
  profileImage?: string;
  kycStatus: KYCStatus;
  trustScore: TrustScore;
  rating: number;
  tradeCount: number;
  responseSpeed?: string;
  activityRegion?: string;
  verifiedRegion?: string;
  activeRegion?: string;
  bio?: string;
  displayActivityBadgeId?: string | null;
  sellerType?: SellerType;
  communityStats?: {
    postCount: number;
    commentCount: number;
    helpfulCount: number;
  };
  businessInfo?: {
    businessName?: string;
    businessNumber?: string;
    businessAddress?: string;
  };
}

export interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  category: string;
  region: string;
  status: ProductStatus;
  description: string;
  createdAt: string;
  seller: User;
  tradeMethods: TradeMethod[];
  todayTradeAvailable: boolean;
  liked: boolean;
  isFreeShare?: boolean;
  allowOffer?: boolean;
}

export interface Order {
  id: string;
  product: Product;
  buyer: User;
  seller: User;
  status: OrderStatus;
  proposedPrice: number;
  tradeMethod: TradeMethod;
  meetupPlace?: string;
  meetupDate?: string;
  meetupTime?: string;
  shippingInfo?: {
    recipientName?: string;
    recipientPhone?: string;
    address?: string;
    requestNote?: string;
  };
  trackingNumber?: string;
  shippingCompany?: string;
  memo?: string;
  createdAt: string;
  timeline: OrderTimelineEvent[];
  sellerCompleted?: boolean;
  buyerCompleted?: boolean;
  meetupAccepted?: boolean;
}

export interface OrderTimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'user' | 'system' | 'meetup_confirmed' | 'price_offer' | 'price_offer_result';
  images?: string[];
  meetupPlace?: string;
  meetupDate?: string;
  meetupTime?: string;
  orderId?: string;
  originalPrice?: number;
  proposedPrice?: number;
  offerResult?: 'accepted' | 'rejected';
}

export interface ChatRoom {
  id: string;
  otherUser: User;
  product?: Product;
  lastMessage: string;
  lastMessageTime: string;
  order?: Order;
  unreadCount: number;
  isRead?: boolean;
  messages?: ChatMessage[];
  buyerId?: string;
  sellerId?: string;
  buyerInfo?: User;
  sellerInfo?: User;
  readStatus?: Record<string, boolean>;
  lastReadAt?: Record<string, string>;
  leftUserIds?: string[];
}

export interface Review {
  id: string;
  reviewer: User;
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string;
  orderId?: string;
  productTitle?: string;
  productImage?: string;
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: string;
  parentId?: string;
  replies?: Comment[];
}

export interface Post {
  id: string;
  title: string;
  content: string;
  category: PostCategory;
  author: User;
  images?: string[];
  attachedProduct?: Product;
  tags?: string[];
  commentCount: number;
  createdAt: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  orderId?: string;
}

export type BarterOfferStatus = 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type BarterOrderStatus = 'AGREED' | 'MEETUP_SET' | 'COMPLETED' | 'DISPUTE' | 'CANCELLED' | 'EXPIRED';

export interface BarterOffer {
  id: string;
  targetListingId: string;
  offerListingId: string;
  fromUserId: string;
  toUserId: string;
  message?: string;
  status: BarterOfferStatus;
  regionCode: string;
  createdAt: string;
  targetListing?: Product;
  offerListing?: Product;
}

export interface BarterOrder {
  id: string;
  listingAId: string;
  listingBId: string;
  userAId: string;
  userBId: string;
  status: BarterOrderStatus;
  meetupPlace?: string;
  meetupDate?: string;
  meetupTime?: string;
  confirmA: boolean;
  confirmB: boolean;
  regionCode: string;
  createdAt: string;
  listingA?: Product;
  listingB?: Product;
}

export interface BarterReview {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string;
}
