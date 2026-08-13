import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import type { ChatRoom as ChatRoomType } from '@/types';
import {
  ChatMessage,
  Order,
  OrderStatus,
  ORDER_STATUS_VALUE,
  PRODUCT_STATUS_VALUE,
  TRADE_METHOD_VALUE,
} from '@/types';
import { getChatRoom, getMessages, addMessage, markAsRead, markAsReadUpTo, markAsReadByOther, getOtherUser, leaveChatRoom, addPriceOfferResultToChat, ensureChatRoomForOrder, addRemoteMessage, addTradeCompletedToChat, isChatRoomEnded, parseReceiptMessageMeta } from '@/utils/chatStorage';
import { getOrderById, getOrders, ensureOrderById, updateOrderStatus, deleteOrder, createOrderBySeller, confirmOrderCompletion, ORDER_QUOTA_EXCEEDED_MESSAGE, mergeRemoteOrder } from '@/utils/orderStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { connectChatSocket, joinRoom as wsJoinRoom, leaveRoom as wsLeaveRoom, onNewMessage, emitReadReceipt, onReadReceipt } from '@/utils/chatSocket';
import { addNotification } from '@/utils/notificationStorage';
import { getProductById } from '@/utils/productStorage';
import { getDisputesByOrderId } from '@/utils/disputeStorage';
import { getMyReviewForOrder } from '@/utils/reviewStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { uploadImagesToR2 } from '@/utils/imageUpload';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { ModalShell } from '@/components/common/ModalShell';
import { ImageLightbox } from '@/components/common/ImageLightbox';
import { resolveProfileAvatarUrl, resolveDisplayNickname } from '@/utils/profileStorage';
import { api } from '@/utils/api';
import { syncRoomMessagesFromDB } from '@/utils/dbSync';
import {
  displayChatMessageContent,
  isMeetupCanceledMessage,
  isChatSystemKey,
  NOTIFY_OFFER_DECLINED,
} from '@/locale/enUI';
import { useDismissOnClickOutside } from '@/hooks/useDismissOnClickOutside';
import { useLanguage } from '@/hooks/useLanguage';
import type { AppMessageKey } from '@/hooks/useLanguage';
import { localeForAppLanguage } from '@/utils/languageStorage';

const SHIPPING_RECEIVE_OK = new Set<OrderStatus>([
  ORDER_STATUS_VALUE.SHIPPED,
  ORDER_STATUS_VALUE.DELIVERED,
]);
const DISPUTE_ELIGIBLE = new Set<OrderStatus>([
  ORDER_STATUS_VALUE.ACCEPTED,
  ORDER_STATUS_VALUE.MEETUP_SET,
  ORDER_STATUS_VALUE.SHIPPED,
  ORDER_STATUS_VALUE.DELIVERED,
  ORDER_STATUS_VALUE.RECEIVED,
  ORDER_STATUS_VALUE.DISPUTE,
]);

const NEAR_BOTTOM_PX = 80;

/** Price-offer accept/decline needs order rows in local cache (often missing until DB sync). */
async function syncChatOfferOrders(roomId: string, extraOrderId?: string | null): Promise<void> {
  const msgs = getMessages(roomId);
  const r = getChatRoom(roomId);
  const orderIds = new Set<string>();
  for (const msg of msgs) {
    if (msg.type === 'price_offer' && msg.orderId) orderIds.add(msg.orderId);
  }
  if (r?.order?.id) orderIds.add(r.order.id);
  if (extraOrderId) orderIds.add(extraOrderId);
  if (orderIds.size === 0) return;
  await Promise.all([...orderIds].map((id) => ensureOrderById(id)));
}

function findFirstUnreadIndex(
  msgs: ChatMessage[],
  lastReadAt: string | undefined,
  myId: string | undefined,
): number {
  if (lastReadAt) {
    return msgs.findIndex((m) => m.timestamp > lastReadAt);
  }
  if (myId) {
    return msgs.findIndex((m) => m.senderId !== myId);
  }
  return msgs.length > 0 ? 0 : -1;
}

/**
 * Accept/Decline only on the chronologically newest price_offer, and only while
 * that offer's order is still PENDING_OFFER.
 * Previously we picked the newest among *pending* orders only — so an orphan
 * old pending offer kept showing buttons after a newer offer was already accepted.
 */
function getActionablePriceOfferMessageId(msgs: ChatMessage[]): string | null {
  let newest: ChatMessage | null = null;
  let newestTs = Number.NEGATIVE_INFINITY;
  for (const m of msgs) {
    if (m.type !== 'price_offer' || !m.orderId) continue;
    const ts = new Date(m.timestamp).getTime();
    if (Number.isNaN(ts)) continue;
    if (ts >= newestTs) {
      newestTs = ts;
      newest = m;
    }
  }
  if (!newest?.orderId) return null;
  const order = getOrderById(newest.orderId);
  if (!order || order.status !== ORDER_STATUS_VALUE.PENDING_OFFER) return null;
  return newest.id;
}

function resolveMeetupBannerInfo(
  order: Order | null,
  msgs: ChatMessage[],
): { place: string; date: string; time: string; sellerId: string } | null {
  let latestCancelTs = 0;
  for (const m of msgs) {
    if (m.type === 'system' && isMeetupCanceledMessage(m.content)) {
      latestCancelTs = Math.max(latestCancelTs, new Date(m.timestamp).getTime());
    }
  }

  if (order?.meetupPlace && order?.meetupDate && order?.meetupTime) {
    return {
      place: order.meetupPlace,
      date: order.meetupDate,
      time: order.meetupTime,
      sellerId: order.seller.id,
    };
  }
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
    if (msg.type !== 'meetup_confirmed') continue;
    if (new Date(msg.timestamp).getTime() <= latestCancelTs) continue;
    if (isChatSystemKey(msg.content, 'msgSellerMeetupStarted')) continue;
    if (msg.meetupPlace && msg.meetupDate && msg.meetupTime) {
      return {
        place: msg.meetupPlace,
        date: msg.meetupDate,
        time: msg.meetupTime,
        sellerId: msg.senderId,
      };
    }
  }
  return null;
}

function shouldShowTradeActionChips(order: Order, meetupCanceled: boolean): boolean {
  const progressed: OrderStatus[] = [
    ORDER_STATUS_VALUE.MEETUP_SET,
    ORDER_STATUS_VALUE.RECEIVED,
    ORDER_STATUS_VALUE.COMPLETE,
    ORDER_STATUS_VALUE.DISPUTE,
    ORDER_STATUS_VALUE.SHIPPED,
    ORDER_STATUS_VALUE.DELIVERED,
    ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO,
  ];
  if (progressed.includes(order.status)) return true;
  if (order.status === ORDER_STATUS_VALUE.ACCEPTED) {
    if (meetupCanceled) return false;
    if (order.tradeMethod === TRADE_METHOD_VALUE.SHIPPING) return true;
    return !!(order.meetupPlace && order.meetupDate && order.meetupTime);
  }
  return false;
}

function isMeetupCanceledState(order: Order | null, msgs: ChatMessage[]): boolean {
  if (!order) return false;
  if (order.status === ORDER_STATUS_VALUE.MEETUP_SET) return false;
  if (resolveMeetupBannerInfo(order, msgs)) return false;
  return msgs.some((m) => m.type === 'system' && isMeetupCanceledMessage(m.content));
}

interface ChatChipAction {
  key: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}

function ChatActionChipRow({ chips }: { chips: ChatChipAction[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          disabled={chip.disabled || !chip.onClick}
          onClick={chip.onClick}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
            chip.disabled || !chip.onClick
              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              : chip.primary
                ? 'border-[#00A8A3] bg-[#00A8A3] text-white'
                : 'border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

function buildOrderDisputeBannerRows(
  order: Order,
  t: (key: AppMessageKey, vars?: Record<string, string | number>) => string,
): { label: string; to: string }[] {
  const myId = getCurrentUserId();
  if (!myId) return [];
  const open = getDisputesByOrderId(order.id).filter((d) => d.status !== 'RESOLVED');
  if (open.length === 0) {
    return [{ label: t('bannerDisputeGeneric'), to: `/dispute/${order.id}` }];
  }
  const myDispute = open.find((d) => d.openedByUserId === myId);
  const theirDispute = open.find((d) => d.openedByUserId && d.openedByUserId !== myId);
  const rows: { label: string; to: string }[] = [];
  if (myDispute) {
    rows.push({ label: t('bannerYourDispute'), to: `/dispute/${order.id}` });
  }
  if (theirDispute) {
    rows.push({ label: t('bannerTheirDispute'), to: `/dispute/${order.id}?view=other` });
  }
  if (rows.length === 0) {
    rows.push({ label: t('bannerDisputeGeneric'), to: `/dispute/${order.id}` });
  }
  return rows;
}

export const ChatRoom: React.FC = () => {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const timeLocale = localeForAppLanguage(lang);
  const location = useLocation();
  const { id: roomId } = useParams();
  const [searchParams] = useSearchParams();
  const orderIdFromQuery = searchParams.get('order');

  const [room, setRoom] = useState<ChatRoomType | null>(() => (roomId ? getChatRoom(roomId) : null));

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  useDismissOnClickOutside(chatMenuRef, showMenu, () => setShowMenu(false));
  const [meetupDetailMessage, setMeetupDetailMessage] = useState<ChatMessage | null>(null);
  const meetupDetailHeldRef = useRef<ChatMessage | null>(null);
  if (meetupDetailMessage) meetupDetailHeldRef.current = meetupDetailMessage;
  const meetupDetailShown = meetupDetailMessage ?? meetupDetailHeldRef.current;
  const [showMeetupStartedPopup, setShowMeetupStartedPopup] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [ordersRevision, setOrdersRevision] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const prevMessageCountRef = useRef(0);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  /** Message ids for which we already showed the "meetup started" popup */
  const shownMeetupPopupIdsRef = useRef<Set<string>>(new Set());
  /** Message ids already present when room was entered (for delta-only popup checks) */
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  /** First bulk message sync for this room visit — old meetups must not popup */
  const initialMessageSeedDoneRef = useRef(false);
  /** Show deleted-listing alert once, then leave */
  const deletedProductPopupShownRef = useRef(false);

  // Whether listing was deleted
  const [isProductDeleted, setIsProductDeleted] = useState(false);

  const checkProductDeleted = () => {
    if (room?.product?.id) {
      const exists = getProductById(room.product.id);
      setIsProductDeleted(!exists);
    }
  };

  // Sync room when roomId changes; reset deleted-listing ref
  useEffect(() => {
    initialScrollDoneRef.current = false;
    prevMessageCountRef.current = 0;
    setNewMessageCount(0);
    setRoom(roomId ? getChatRoom(roomId) : null);
    deletedProductPopupShownRef.current = false;
    shownMeetupPopupIdsRef.current = new Set();
    knownMessageIdsRef.current = new Set();
    initialMessageSeedDoneRef.current = false;
  }, [roomId]);

  // WebSocket: connect, join room, listen for messages + read receipts
  useEffect(() => {
    if (!roomId) return;
    connectChatSocket();
    wsJoinRoom(roomId);

    const unsub = onNewMessage((data) => {
      if (data.roomId === roomId) {
        addRemoteMessage(roomId, data.message);
        setMessages(getMessages(roomId));
        knownMessageIdsRef.current.add(data.message.id);
        checkNewMeetupFromOther([data.message], 'websocket');
      }
    });

    const unsubRead = onReadReceipt((data) => {
      if (data.roomId === roomId && data.userId !== getCurrentUserId()) {
        markAsReadByOther(roomId, data.userId);
        setRoom(getChatRoom(roomId));
      }
    });

    return () => {
      wsLeaveRoom(roomId);
      unsub();
      unsubRead();
    };
  }, [roomId]);

  // Partner deleted listing: alert once and leave
  useEffect(() => {
    if (!roomId || !isProductDeleted) return;
    if (deletedProductPopupShownRef.current) return;
    deletedProductPopupShownRef.current = true;
    alert(t('listingRemovedAlert'));
    navigate('/chat', { replace: true });
  }, [isProductDeleted, roomId, navigate]);

  // On enter / room updates: load messages; ended rooms stay read-only (no rejoin)
  useEffect(() => {
    if (!roomId) return;
    const refresh = () => {
      const r = getChatRoom(roomId);
      setRoom(r);
      if (r) setMessages(getMessages(roomId));
      checkProductDeleted();
    };
    refresh();
    window.addEventListener('chatRoomsChanged', refresh);
    return () => window.removeEventListener('chatRoomsChanged', refresh);
  }, [roomId, navigate]);

  // Sync orders linked to price-offer messages so seller accept/decline buttons render
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    void syncChatOfferOrders(roomId, orderIdFromQuery).then(() => {
      if (!cancelled) setOrdersRevision((n) => n + 1);
    });
    return () => { cancelled = true; };
  }, [roomId, messages, orderIdFromQuery]);

  // Linked order: DB에서 최신 약속/상태 동기화 (구매자 기기에 meetup 필드 없던 문제)
  useEffect(() => {
    if (!roomId) return;
    const r = getChatRoom(roomId);
    const oid = orderIdFromQuery || r?.order?.id;
    if (!oid) return;
    void ensureOrderById(oid).then(() => {
      setRoom(getChatRoom(roomId));
      setOrdersRevision((n) => n + 1);
    });
  }, [roomId, orderIdFromQuery]);

  // After meetup flow: refresh room and messages
  useEffect(() => {
    if (roomId && location.pathname === `/chat/${roomId}`) {
      setRoom(getChatRoom(roomId));
      setMessages(getMessages(roomId));
    }
  }, [location.pathname, roomId]);

  // Realtime: partner sent meetup card -> popup for buyer
  const checkNewMeetupFromOther = (updatedMessages: ChatMessage[], source = 'unknown') => {
    const myId = getCurrentUserId();
    if (!myId) return;
    for (const msg of updatedMessages) {
      if (msg.type === 'meetup_confirmed' && msg.senderId !== myId && !shownMeetupPopupIdsRef.current.has(msg.id)) {
        // #region agent log
        fetch('http://127.0.0.1:7863/ingest/715ac1de-3796-4756-9d9b-57f74ad3b63b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0a2150'},body:JSON.stringify({sessionId:'0a2150',location:'ChatRoom.tsx:checkNewMeetupFromOther',message:'meetup popup triggered',data:{source,msgId:msg.id,wasKnown:knownMessageIdsRef.current.has(msg.id),shownCount:shownMeetupPopupIdsRef.current.size,knownCount:knownMessageIdsRef.current.size,batchSize:updatedMessages.length},timestamp:Date.now(),hypothesisId:'A-C'})}).catch(()=>{});
        // #endregion
        shownMeetupPopupIdsRef.current.add(msg.id);
        setShowMeetupStartedPopup(true);
        break;
      }
    }
  };

  const seedKnownMeetupMessages = (messages: ChatMessage[], source: string) => {
    const myId = getCurrentUserId();
    let meetupMarked = 0;
    for (const msg of messages) {
      knownMessageIdsRef.current.add(msg.id);
      if (myId && msg.type === 'meetup_confirmed' && msg.senderId !== myId) {
        shownMeetupPopupIdsRef.current.add(msg.id);
        meetupMarked += 1;
      }
    }
    // #region agent log
    fetch('http://127.0.0.1:7863/ingest/715ac1de-3796-4756-9d9b-57f74ad3b63b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0a2150'},body:JSON.stringify({sessionId:'0a2150',location:'ChatRoom.tsx:seedKnownMeetupMessages',message:'seed meetup messages',data:{source,total:messages.length,meetupMarked,knownCount:knownMessageIdsRef.current.size},timestamp:Date.now(),hypothesisId:'A-B'})}).catch(()=>{});
    // #endregion
  };

  useEffect(() => {
    if (!roomId) return;
    console.log('[ChatRoom] listeners registered', roomId);

    // Existing meetup messages on load: no popup
    const initial = getMessages(roomId);
    if (initial.length > 0) {
      seedKnownMeetupMessages(initial, 'initial-load');
      initialMessageSeedDoneRef.current = true;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'all_products') {
        checkProductDeleted();
      }
    };

    const handleSameTab = () => {
      if (!roomId) return;
      setRoom(getChatRoom(roomId));
      const updated = getMessages(roomId);
      setMessages(updated);

      if (!initialMessageSeedDoneRef.current) {
        seedKnownMeetupMessages(updated, 'first-bulk-sync');
        for (const m of updated) knownMessageIdsRef.current.add(m.id);
        initialMessageSeedDoneRef.current = true;
        // #region agent log
        fetch('http://127.0.0.1:7863/ingest/715ac1de-3796-4756-9d9b-57f74ad3b63b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0a2150'},body:JSON.stringify({sessionId:'0a2150',location:'ChatRoom.tsx:handleSameTab',message:'first bulk sync seeded',data:{total:updated.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return;
      }

      const newOnly = updated.filter((m) => !knownMessageIdsRef.current.has(m.id));
      // #region agent log
      fetch('http://127.0.0.1:7863/ingest/715ac1de-3796-4756-9d9b-57f74ad3b63b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0a2150'},body:JSON.stringify({sessionId:'0a2150',location:'ChatRoom.tsx:handleSameTab',message:'chatRoomsChanged',data:{total:updated.length,newOnly:newOnly.length,knownBefore:knownMessageIdsRef.current.size},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      for (const m of newOnly) knownMessageIdsRef.current.add(m.id);
      if (newOnly.length > 0) checkNewMeetupFromOther(newOnly, 'chatRoomsChanged');
    };

    const handleProductChange = () => {
      checkProductDeleted();
      setOrdersRevision((n) => n + 1);
    };
    window.addEventListener('productsChanged', handleProductChange);
    const handleOrdersChanged = () => {
      if (!roomId) return;
      setRoom(getChatRoom(roomId));
      setMessages(getMessages(roomId));
      setOrdersRevision((n) => n + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('chatRoomsChanged', handleSameTab);
    window.addEventListener('ordersChanged', handleOrdersChanged);
    window.addEventListener('disputesChanged', handleOrdersChanged);
    window.addEventListener('productRegistered', handleProductChange);


    // DB 폴링: 5초마다 새 메시지 + 주문 상태 확인
    const pollInterval = setInterval(async () => {
      if (!roomId) return;
      try {
        const before = getMessages(roomId).length;
        await syncRoomMessagesFromDB(roomId, getCurrentUserId() || undefined);
        const after = getMessages(roomId);
        if (after.length !== before) {
          setRoom(getChatRoom(roomId));
          setMessages(after);
          void syncChatOfferOrders(roomId, orderIdFromQuery).then(() => {
            setOrdersRevision((n) => n + 1);
          });
        }
      } catch { /* polling error ignored */ }
      // 주문 상태 DB 폴링
      try {
        const uid = getCurrentUserId();
        if (uid) {
          const orderRes = await api.get<Record<string, unknown>[]>(`/api/orders?user_id=${uid}`);
          console.log('[ORDERSYNC] poll response', { ok: orderRes.ok, status: orderRes.status, uid });
          if (orderRes.ok) {
            const rows = orderRes.data;
            if (Array.isArray(rows)) {
              let ordersUpdated = false;
              for (const row of rows) {
                const orderId = String(row.id);
                let local = getOrderById(orderId);
                if (!local) {
                  await ensureOrderById(orderId);
                  local = getOrderById(orderId);
                  ordersUpdated = true;
                  if (!local) continue;
                }
                const dbStatus = String(row.status || '');
                const dbMeetupPlace = String(row.meetup_place || row.meetup_location || '');
                const dbMeetupDate = String(row.meetup_date || '');
                const dbMeetupTime = String(row.meetup_time || '');
                const changed = dbStatus !== local.status
                  || Boolean(row.buyer_completed) !== Boolean(local.buyerCompleted)
                  || Boolean(row.seller_completed) !== Boolean(local.sellerCompleted)
                  || Boolean(row.meetup_accepted) !== Boolean(local.meetupAccepted)
                  || dbMeetupPlace !== (local.meetupPlace || '')
                  || dbMeetupDate !== (local.meetupDate || '')
                  || dbMeetupTime !== (local.meetupTime || '');
                console.log('[ORDERSYNC] compare', { orderId: row.id, dbStatus, localStatus: local.status, dbMeetupPlace, localMeetupPlace: local.meetupPlace, dbBuyerCompleted: row.buyer_completed, dbSellerCompleted: row.seller_completed, changed });
                if (changed) {
                  const updated = { ...local };
                  const dbOrderStatus = dbStatus as OrderStatus;
                  if (row.buyer_completed) updated.buyerCompleted = true;
                  if (row.seller_completed) updated.sellerCompleted = true;
                  updated.meetupAccepted = Boolean(row.meetup_accepted);
                  updated.meetupPlace = dbMeetupPlace || undefined;
                  updated.meetupDate = dbMeetupDate || undefined;
                  updated.meetupTime = dbMeetupTime || undefined;
                  if (
                    dbStatus === ORDER_STATUS_VALUE.ACCEPTED
                    && !dbMeetupPlace
                    && local.status === ORDER_STATUS_VALUE.MEETUP_SET
                  ) {
                    updated.status = ORDER_STATUS_VALUE.ACCEPTED;
                  } else if (dbStatus !== local.status) {
                    updated.status = dbOrderStatus;
                  }
                  console.log('[ORDERSYNC] merging', { orderId: row.id, newStatus: updated.status, meetupPlace: updated.meetupPlace });
                  mergeRemoteOrder(updated);
                  ordersUpdated = true;
                }
              }
              if (ordersUpdated) setOrdersRevision((n) => n + 1);
            }
          }
        }
      } catch (e) { console.log('[ORDERSYNC] poll error', e); }
    }, 5000);



    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('chatRoomsChanged', handleSameTab);
      window.removeEventListener('ordersChanged', handleOrdersChanged);
      window.removeEventListener('disputesChanged', handleOrdersChanged);
      window.removeEventListener('productRegistered', handleProductChange);
      window.removeEventListener('productsChanged', handleProductChange);
    };
  }, [roomId]);

  // Resolve order: query param -> room.order id -> active pair+product order (never orphan COMPLETE onto fresh chat)
  const currentOrder = (() => {
    if (orderIdFromQuery) {
      const o = getOrderById(orderIdFromQuery);
      if (o) return o;
    }
    if (room?.order?.id) {
      const o = getOrderById(room.order.id);
      if (o) return o;
    }
    if (room?.order) return room.order;
    if (!room?.product?.id) return null;
    const myOrders = getOrders().filter((o) => o.product.id === room.product!.id);
    const isActiveOrder = (o: import('@/types').Order) =>
      o.status !== ORDER_STATUS_VALUE.COMPLETE &&
      o.status !== ORDER_STATUS_VALUE.DISPUTE &&
      !(o.buyerCompleted && o.sellerCompleted);

    if (room.buyerId && room.sellerId) {
      const forPair = myOrders.filter(
        (o) => o.buyer.id === room.buyerId && o.seller.id === room.sellerId
      );
      const activeForPair = forPair.filter(isActiveOrder);
      if (activeForPair.length > 0) {
        const withMeetup = activeForPair.find(
          (o) =>
            o.status === ORDER_STATUS_VALUE.MEETUP_SET ||
            o.status === ORDER_STATUS_VALUE.RECEIVED
        );
        if (withMeetup) return withMeetup;
        return activeForPair.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
      }
      return null;
    }
    const active = myOrders.filter(isActiveOrder);
    if (active.length === 0) return null;
    active.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return active[0] ?? null;
  })();

  const userId = getCurrentUserId();
  const isSeller = !!(
    (room?.sellerId && userId === room.sellerId) ||
    (currentOrder && userId === currentOrder.seller.id)
  );
  const isBuyer = !!(
    (room?.buyerId && userId === room.buyerId) ||
    (currentOrder && userId === currentOrder.buyer.id)
  );

  const displayMessages = messages;
  void ordersRevision;
  const actionablePriceOfferMessageId = getActionablePriceOfferMessageId(displayMessages);
  const meetupBannerInfo = resolveMeetupBannerInfo(currentOrder, displayMessages);
  const meetupCanceled = isMeetupCanceledState(currentOrder, displayMessages);
  const listingProduct = room?.product?.id ? getProductById(room.product.id) : null;
  const isTradeCompleteForThisChat = !!(
    currentOrder
    && (
      currentOrder.status === ORDER_STATUS_VALUE.COMPLETE
      || (currentOrder.buyerCompleted && currentOrder.sellerCompleted)
    )
  );
  const isListingSold = listingProduct?.status === PRODUCT_STATUS_VALUE.SOLD;
  const isSoldToOtherParty = !!(isListingSold && !isTradeCompleteForThisChat);
  const roomEnded = isChatRoomEnded(room);

  const completedTradeReviewChips = (orderId: string): ChatChipAction[] => {
    if (getMyReviewForOrder(orderId)) {
      return [{ key: 'review-done', label: t('reviewSubmitted'), disabled: true }];
    }
    return [{
      key: 'review',
      label: t('writeReview'),
      primary: true,
      onClick: () => navigate(`/review/${orderId}`),
    }];
  };

  const canReceiveConfirm = (order: Order | null, msgs: ChatMessage[]): boolean => {
    if (!order) return false;
    if (order.status === ORDER_STATUS_VALUE.DISPUTE) return false;
    if (order.status === ORDER_STATUS_VALUE.COMPLETE || order.status === ORDER_STATUS_VALUE.RECEIVED) {
      return false;
    }
    const isDirect = order.tradeMethod !== TRADE_METHOD_VALUE.SHIPPING;
    if (isDirect) {
      return !!resolveMeetupBannerInfo(order, msgs);
    }
    return SHIPPING_RECEIVE_OK.has(order.status);
  };
  const receiveEnabled = canReceiveConfirm(currentOrder, displayMessages) && !meetupCanceled;

  const canOpenDispute = (order: Order | null): boolean => {
    if (!order) return false;
    if (order.status === ORDER_STATUS_VALUE.COMPLETE) return false;
    if (order.buyerCompleted && order.sellerCompleted) return false;
    const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
    if (isShare) return false;
    const productId = order.product?.id;
    if (productId) {
      const listing = getProductById(productId);
      if (listing?.status === PRODUCT_STATUS_VALUE.SOLD) return false;
    }
    return DISPUTE_ELIGIBLE.has(order.status);
  };
  const disputeEnabled = canOpenDispute(currentOrder);
  const scheduleMeetupEnabled = (() => {
    if (currentOrder?.status === ORDER_STATUS_VALUE.COMPLETE) return false;
    if (currentOrder?.buyerCompleted && currentOrder?.sellerCompleted) return false;
    const productId = room?.product?.id || currentOrder?.product?.id;
    if (productId) {
      const listing = getProductById(productId);
      if (listing?.status === PRODUCT_STATUS_VALUE.SOLD) return false;
    }
    return true;
  })();
  /** Listing allows offers (reflect latest product from storage) */
  const productForOffer = room?.product ? getProductById(room.product.id) || room.product : null;
  const canOfferPrice = !!(
    !isSoldToOtherParty
    && !isTradeCompleteForThisChat
    && productForOffer
    && productForOffer.allowOffer !== false
    && !productForOffer.isFreeShare
    && (productForOffer.price ?? 0) > 0
    && productForOffer.status !== PRODUCT_STATUS_VALUE.SOLD
  );
  // Hide dispute tab for free-share chats
  const isShareOrder = !!(
    (currentOrder && (currentOrder.proposedPrice === 0 || currentOrder?.product?.isFreeShare || currentOrder?.product?.price === 0)) ||
    (room?.product && (room.product.isFreeShare || room.product.price === 0))
  );

  const handleSellerStartMeetup = () => {
    if (!room?.product) {
      alert(t('couldNotLoadListing'));
      return;
    }
    const product = room.product;
    const buyer = getOtherUser(room);
    if (!buyer?.id) {
      alert(t('couldNotLoadPartner'));
      return;
    }
    void (async () => {
      try {
        if (currentOrder?.id) {
          navigate(`/meetup/${currentOrder.id}`);
          return;
        }
        const order = await createOrderBySeller({ product, buyer });
        if (!order) {
          alert(t('couldNotStartMeetup'));
          return;
        }
        await ensureChatRoomForOrder(order, getCurrentUserId() ?? undefined);
        navigate(`/meetup/${order.id}`);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          alert(ORDER_QUOTA_EXCEEDED_MESSAGE);
        } else {
          console.error(e);
          alert(t('couldNotStartMeetupScheduling'));
        }
      }
    })();
  };

  const buyerChips: ChatChipAction[] = (() => {
    if (!isBuyer || !room?.product || isProductDeleted || roomEnded) return [];
    if (isSoldToOtherParty) return [];
    if (isTradeCompleteForThisChat && currentOrder) {
      return completedTradeReviewChips(currentOrder.id);
    }
    if (!currentOrder || !shouldShowTradeActionChips(currentOrder, meetupCanceled)) {
      return canOfferPrice
        ? [{ key: 'offer', label: t('sendOffer'), onClick: () => navigate(`/offer/${room.product!.id}`), primary: true }]
        : [];
    }
    const chips: ChatChipAction[] = [
      {
        key: 'receive',
        label: t('confirmReceipt'),
        onClick: () => navigate(`/receive/${currentOrder.id}`),
        disabled: !receiveEnabled,
      },
    ];
    if (!isShareOrder) {
      chips.push({
        key: 'dispute',
        label: t('openDispute'),
        onClick: () => navigate(`/dispute/${currentOrder.id}`),
        disabled: !disputeEnabled,
      });
    }
    return chips;
  })();

  const sellerChips: ChatChipAction[] = (() => {
    if (!isSeller || !room?.product || isProductDeleted || roomEnded) return [];
    if (isSoldToOtherParty) return [];
    if (isTradeCompleteForThisChat && currentOrder) {
      return completedTradeReviewChips(currentOrder.id);
    }
    if (!currentOrder || !shouldShowTradeActionChips(currentOrder, meetupCanceled)) {
      return [{
        key: 'meetup',
        label: t('scheduleMeetup'),
        onClick: handleSellerStartMeetup,
        disabled: !scheduleMeetupEnabled,
      }];
    }
    const chips: ChatChipAction[] = [];
    if (currentOrder.status === ORDER_STATUS_VALUE.RECEIVED && !currentOrder.sellerCompleted) {
      chips.push({
        key: 'complete',
        label: t('confirmComplete'),
        primary: true,
        onClick: () => {
          void (async () => {
            if (!confirm(t('confirmTradeCompletion'))) return;
            const updated = await confirmOrderCompletion(currentOrder.id, 'seller');
            if (updated?.status === ORDER_STATUS_VALUE.COMPLETE) {
              void addTradeCompletedToChat(updated);
              navigate(`/review/${currentOrder.id}`);
            }
            if (roomId) setRoom(getChatRoom(roomId));
            setOrdersRevision((n) => n + 1);
          })();
        },
      });
    } else {
      chips.push({
        key: 'meetup',
        label: t('scheduleMeetup'),
        onClick: handleSellerStartMeetup,
        disabled: !scheduleMeetupEnabled,
      });
    }
    if (!isShareOrder) {
      chips.push({
        key: 'dispute',
        label: t('openDispute'),
        onClick: () => navigate(`/dispute/${currentOrder.id}`),
        disabled: !disputeEnabled,
      });
    }
    return chips;
  })();

  useEffect(() => {
    if (!roomId) return;
  }, [roomId, userId, isBuyer, isSeller, currentOrder, isShareOrder, receiveEnabled, disputeEnabled]);

  const firstUnreadIndex = findFirstUnreadIndex(
    displayMessages,
    userId ? room?.lastReadAt?.[userId] : undefined,
    userId || undefined,
  );

  const isNearBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const scrollToMessageIndex = (index: number) => {
    const el = messagesContainerRef.current?.querySelector(`[data-msg-index="${index}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  const scrollToBottomInstant = () => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const markReadFromViewport = () => {
    if (!roomId) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isNearBottom()) {
      markAsRead(roomId);
      emitReadReceipt(roomId);
      setRoom(getChatRoom(roomId));
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const nodes = container.querySelectorAll('[data-msg-timestamp]');
    let latestVisible = '';
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.top < containerRect.bottom - 20 && rect.bottom > containerRect.top) {
        const ts = node.getAttribute('data-msg-timestamp') || '';
        if (ts > latestVisible) latestVisible = ts;
      }
    });
    if (latestVisible && markAsReadUpTo(roomId, latestVisible)) {
      emitReadReceipt(roomId);
      setRoom(getChatRoom(roomId));
    }
  };

  const handleMessagesScroll = () => {
    if (isNearBottom()) {
      setNewMessageCount(0);
    }
    markReadFromViewport();
  };

  const handleJumpToNewMessages = () => {
    scrollToBottomInstant();
    setNewMessageCount(0);
    if (roomId) {
      markAsRead(roomId);
      emitReadReceipt(roomId);
      setRoom(getChatRoom(roomId));
    }
  };

  const scrollToInitialPosition = (msgs: ChatMessage[]) => {
    if (initialScrollDoneRef.current || msgs.length === 0) return;
    initialScrollDoneRef.current = true;
    prevMessageCountRef.current = msgs.length;
    requestAnimationFrame(() => {
      const r = roomId ? getChatRoom(roomId) : null;
      const uid = getCurrentUserId();
      const lastRead = uid ? r?.lastReadAt?.[uid] : undefined;
      const idx = findFirstUnreadIndex(msgs, lastRead, uid || undefined);
      if (idx >= 0) scrollToMessageIndex(idx);
      else scrollToBottomInstant();
    });
  };

  useEffect(() => {
    if (!roomId) return;

    const count = messages.length;
    const prev = prevMessageCountRef.current;

    if (!initialScrollDoneRef.current && count > 0) {
      scrollToInitialPosition(messages);
    } else if (count > prev && initialScrollDoneRef.current) {
      if (isNearBottom()) {
        setNewMessageCount(0);
        markAsRead(roomId);
        emitReadReceipt(roomId);
        setRoom(getChatRoom(roomId));
      } else {
        setNewMessageCount((c) => c + (count - prev));
      }
    }

    prevMessageCountRef.current = count;
  }, [messages, roomId]);

  // DB가 원본: 진입 시 방+메시지를 서버에서 받아 로컬에 병합
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      const uid = getCurrentUserId();
      await syncRoomMessagesFromDB(roomId, uid || undefined);
      if (cancelled) return;
      const r = getChatRoom(roomId);
      if (r) {
        setRoom(r);
        const synced = getMessages(roomId);
        setMessages(synced);
        initialScrollDoneRef.current = false;
        scrollToInitialPosition(synced);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploadingImages(true);
    try {
      const urls = await uploadImagesToR2(fileArray, { folder: 'chat' });
      setPreviewImages((prev) => [...prev, ...urls]);
    } catch {
      alert(t('couldNotUpload'));
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const removePreviewImage = (idx: number) => {
    setPreviewImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (uploadingImages) return;
    if (roomEnded) return;
    if (!input.trim() && previewImages.length === 0) return;
    if (!roomId) return;

    const scrollAfterSend = () => {
      requestAnimationFrame(() => {
        scrollToBottomInstant();
        markAsRead(roomId);
        emitReadReceipt(roomId);
        setRoom(getChatRoom(roomId));
        setNewMessageCount(0);
      });
    };

    // Image message (random suffix avoids duplicate keys in same ms)
    if (previewImages.length > 0) {
      const imgMessage: ChatMessage = {
        id: `m${Date.now()}_${Math.random().toString(36).slice(2, 9)}_img`,
        senderId: getCurrentUserId() || 'me',
        content: input.trim() || '',
        timestamp: new Date().toISOString(),
        type: 'user',
        images: [...previewImages],
      };
      const saved = await addMessage(roomId, imgMessage);
      if (saved) {
        setPreviewImages([]);
        setInput('');
        scrollAfterSend();
      } else {
        alert(t('couldNotSendPhotos'));
      }
      return;
    }

    // Text-only message
    const newMessage: ChatMessage = {
      id: `m${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      senderId: getCurrentUserId() || 'me',
      content: input,
      timestamp: new Date().toISOString(),
      type: 'user',
    };
    const saved = await addMessage(roomId, newMessage);
    if (saved) {
      setInput('');
      scrollAfterSend();
    } else {
      alert(t('messageSendFailed'));
    }
  };


  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Sticky header + dispute banner */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between px-4 py-3 h-14">
          {/* Back Button */}
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* Avatar, nickname, KYC */}
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            {room && (() => {
              const other = getOtherUser(room);
              const avatarUrl = resolveProfileAvatarUrl(other.id, other.profileImage);
              const displayName = resolveDisplayNickname(other.id, other.nickname);
              const goToOtherProfile = () => navigate(`/seller/${other.id}`);
              return (
                <>
                  <button
                    type="button"
                    onClick={goToOtherProfile}
                    className="flex-shrink-0 rounded-full"
                    aria-label={t('viewProfileAria', { name: displayName })}
                  >
                    <AvatarWithBadgeOverlay userId={other.id} sizePx={40}>
                      <UserAvatarImage src={avatarUrl} />
                    </AvatarWithBadgeOverlay>
                  </button>
                  <button
                    type="button"
                    onClick={goToOtherProfile}
                    className="flex items-center gap-1.5 min-w-0"
                  >
                    <h1 className="text-lg font-bold text-gray-900 truncate hover:underline">
                      {displayName}
                    </h1>
                    {other.kycStatus === 'verified' && (
                      <img src="/check_1.svg" alt={t('verified')} className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                  </button>
                </>
              );
            })()}
          </div>
          
          {/* Menu Button */}
          <div ref={chatMenuRef} className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-2 -mr-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showMenu && !roomEnded && (
              <div className="absolute right-0 top-10 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    if (roomId && confirm(t('leaveChatConfirm'))) {
                      void leaveChatRoom(roomId).then((ok) => {
                        if (ok) navigate('/chat', { replace: true });
                      });
                    }
                  }}
                  className="w-full px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50 rounded-lg"
                >
                  {t('leaveChat')}
                </button>
              </div>
            )}
          </div>
        </div>

        {currentOrder && currentOrder.status === ORDER_STATUS_VALUE.DISPUTE && (() => {
          const disputes = getDisputesByOrderId(currentOrder.id);
          const isResolved =
            disputes.length > 0 && disputes.every((dispute) => dispute.status === 'RESOLVED');
          if (isResolved) {
            return (
              <div className="bg-green-50 border-t border-green-200 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-green-800 flex-1">{t('bannerDisputeResolved')}</p>
                  <button
                    onClick={() => navigate(`/dispute/${currentOrder.id}`)}
                    className="text-xs font-medium text-green-600 underline hover:text-green-700 whitespace-nowrap"
                  >
                    {t('details')}
                  </button>
                </div>
              </div>
            );
          }
          return buildOrderDisputeBannerRows(currentOrder, t).map((row) => (
            <div key={row.to} className="bg-red-50 border-t border-red-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-red-600 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-sm font-medium text-red-800 flex-1">{row.label}</p>
                <button
                  onClick={() => navigate(row.to)}
                  className="text-xs font-medium text-red-600 underline hover:text-red-700 whitespace-nowrap"
                >
                  {t('details')}
                </button>
              </div>
            </div>
          ));
        })()}

        {isTradeCompleteForThisChat && (
          <div className="bg-green-50 border-t border-green-200 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-green-800 flex-1">{t('bannerTradeComplete')}</p>
            </div>
          </div>
        )}

        {roomEnded && (
          <div className="bg-gray-100 border-t border-gray-200 px-4 py-2.5">
            <p className="text-sm font-medium text-gray-600">{t('roomEnded')}</p>
          </div>
        )}

        {isSoldToOtherParty && (
          <div className="bg-gray-100 border-t border-gray-200 px-4 py-2.5">
            <p className="text-sm font-medium text-gray-600">{t('bannerListingSold')}</p>
          </div>
        )}

        {meetupBannerInfo
          && !isTradeCompleteForThisChat
          && !isSoldToOtherParty
          && currentOrder?.status !== ORDER_STATUS_VALUE.DISPUTE
          && currentOrder?.status !== ORDER_STATUS_VALUE.RECEIVED && (
          <div className="bg-teal-50 border-t border-teal-200 px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <img src="/h.svg" alt="" className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium text-teal-800 flex-1 truncate">
                {t('msgProductReserved')}
                {' · '}
                {meetupBannerInfo.place}
                {' · '}
                {[meetupBannerInfo.date, meetupBannerInfo.time].filter(Boolean).join(' ')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMeetupDetailMessage({
                    id: 'banner',
                    content: 'This item has been reserved!',
                    senderId: meetupBannerInfo.sellerId,
                    timestamp: new Date().toISOString(),
                    type: 'meetup_confirmed',
                    meetupPlace: meetupBannerInfo.place,
                    meetupDate: meetupBannerInfo.date,
                    meetupTime: meetupBannerInfo.time,
                  });
                }}
                className="text-xs font-medium text-teal-600 underline hover:text-teal-700 whitespace-nowrap"
              >
                {t('details')}
              </button>
            </div>
          </div>
        )}
      </div>

      <ModalShell
        open={showMeetupStartedPopup}
        onClose={() => setShowMeetupStartedPopup(false)}
        zIndex={100}
        labelledBy="meetup-started-title"
        panelClassName="max-w-sm w-full p-6 text-center"
      >
        <p id="meetup-started-title" className="text-base font-semibold text-gray-900 mb-1">{t('meetupStartedTitle')}</p>
        <p className="text-sm text-gray-600 mb-5">{t('meetupStartedHint')}</p>
        <button
          type="button"
          onClick={() => setShowMeetupStartedPopup(false)}
          className="w-full px-4 py-3 text-white rounded-lg font-medium"
          style={{ backgroundColor: '#00A8A3' }}
        >
          {t('ok')}
        </button>
      </ModalShell>

      {/* Listing + buyer/seller actions */}
      {room?.product && (
        <div className="bg-white px-4 py-2.5 shrink-0">
          {isProductDeleted ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">{t('listingRemoved')}</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate(`/product/${room.product!.id}`)}
                className="flex gap-3 items-center w-full text-left pb-2.5"
                aria-label={t('viewListing')}
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img
                    src={room.product.images?.[0] || '/placeholder.jpg'}
                    alt={room.product.title}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{room.product.title}</p>
                  <p className="text-sm font-bold text-gray-900 shrink-0">
                    {room.product.isFreeShare || room.product.price === 0
                      ? t('freeShare')
                      : `${room.product.price.toLocaleString()} PI`}
                  </p>
                </div>
              </button>
              <div className="border-t border-gray-200 pt-2">
                {isBuyer && <ChatActionChipRow chips={buyerChips} />}
                {isSeller && <ChatActionChipRow chips={sellerChips} />}
              </div>
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
        {displayMessages.map((msg, msgIndex) => {
          const isMe = msg.senderId === getCurrentUserId();
          const msgKey = `${msg.id}-${msgIndex}`;
          const showUnreadDivider = msgIndex === firstUnreadIndex && firstUnreadIndex >= 0;
          const unreadDivider = showUnreadDivider ? (
            <div className="flex justify-center py-1">
              <span className="text-xs font-medium text-[#00A8A3] px-3 py-1 bg-teal-50 rounded-full">
                {t('unreadFromHere')}
              </span>
            </div>
          ) : null;
          if (msg.type === 'system' && !isChatSystemKey(msg.content, 'msgReceiptConfirmed')) {
            return (
              <div key={msgKey} data-msg-index={msgIndex} data-msg-timestamp={msg.timestamp}>
                {unreadDivider}
                <div className="flex justify-center">
                <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                  {displayChatMessageContent(msg.content, lang)}
                </span>
                </div>
              </div>
            );
          }
          if (msg.type === 'meetup_confirmed') {
            const isSeller = room && getCurrentUserId() === room.sellerId;
            const isSellerScheduling = isChatSystemKey(msg.content, 'msgSellerMeetupStarted');
            const orderHasMeetup = !!(
              currentOrder?.meetupPlace &&
              currentOrder?.meetupDate &&
              currentOrder?.meetupTime
            );
            const useOrderMeetup =
              orderHasMeetup &&
              !isSellerScheduling &&
              isChatSystemKey(msg.content, 'msgProductReserved');
            const meetupPlace = msg.meetupPlace ?? (useOrderMeetup ? currentOrder!.meetupPlace : undefined);
            const meetupDate = msg.meetupDate ?? (useOrderMeetup ? currentOrder!.meetupDate : undefined);
            const meetupTime = msg.meetupTime ?? (useOrderMeetup ? currentOrder!.meetupTime : undefined);
            const hasDetail = !!(meetupPlace || meetupDate || meetupTime);
            return (
              <div key={msgKey} data-msg-index={msgIndex} data-msg-timestamp={msg.timestamp}>
                {unreadDivider}
                <div className={`flex ${isSeller ? 'justify-end' : 'justify-start'}`}>
                <div className="flex flex-col max-w-[85%]">
                  <div
                    role="button"
                    onClick={() => setMeetupDetailMessage(msg)}
                    className="rounded-lg px-4 py-3 text-white text-sm shadow-sm cursor-pointer active:opacity-90"
                    style={{
                      background: 'linear-gradient(90deg, #00A8A3 0%, #27AE60 100%)',
                    }}
                  >
                    <p className="font-semibold mb-2 flex items-center gap-1">
                      {msg.type === 'meetup_confirmed' && <img src="/h.svg" alt="" className="w-4 h-4 inline-block" />}
                      {displayChatMessageContent(msg.content, lang)}
                    </p>
                    {meetupPlace && (
                      <p className="mb-0.5 text-white/95">
                        {t('meetupPlace')}
                        <br />
                        <span className="font-bold text-base text-white">{meetupPlace}</span>
                      </p>
                    )}
                    {meetupDate && meetupTime && (
                      <p className="mt-2 text-white/95">
                        {t('dateLine', { when: `${meetupDate} ${meetupTime}` })}
                      </p>
                    )}
                    {!hasDetail && !isSellerScheduling && (
                      <p className="mt-2 text-white/80 text-xs">{t('placeTimeNotSetYet')}</p>
                    )}
                  </div>
                  <p className={`text-xs mt-1 px-1 text-gray-500 ${isSeller ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString(timeLocale, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                </div>
              </div>
            );
          }
          if (msg.type === 'receipt_confirmed' || isChatSystemKey(msg.content, 'msgReceiptConfirmed')) {
            const isMine = !!userId && msg.senderId === userId;
            const meta = parseReceiptMessageMeta(msg.content);
            const condition =
              msg.receiptCondition ||
              meta.condition ||
              (msg.orderId ? getOrderById(msg.orderId)?.receiptCondition : undefined) ||
              currentOrder?.receiptCondition;
            const notes =
              msg.receiptNotes ||
              meta.notes ||
              (msg.orderId ? getOrderById(msg.orderId)?.receiptNotes : undefined) ||
              currentOrder?.receiptNotes;
            const conditionLabel =
              condition === 'good'
                ? t('conditionGood')
                : condition === 'normal'
                  ? t('conditionOk')
                  : condition === 'bad'
                    ? t('conditionPoor')
                    : '';
            const conditionIcon =
              condition === 'good'
                ? '/3 ICON/1.svg'
                : condition === 'normal'
                  ? '/3 ICON/2.svg'
                  : condition === 'bad'
                    ? '/3 ICON/3.svg'
                    : '/h.svg';
            return (
              <div key={msgKey} data-msg-index={msgIndex} data-msg-timestamp={msg.timestamp}>
                {unreadDivider}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex flex-col max-w-[85%]">
                    <div
                      className="rounded-lg px-4 py-3 text-white text-sm shadow-sm"
                      style={{
                        background: 'linear-gradient(90deg, #00A8A3 0%, #27AE60 100%)',
                      }}
                    >
                      <p className="font-semibold mb-2 flex items-center gap-1">
                        <img src={conditionIcon} alt="" className="w-4 h-4 inline-block" />
                        {displayChatMessageContent(msg.content, lang)}
                      </p>
                      {conditionLabel ? (
                        <p className="mb-0.5 text-white/95">
                          {t('itemCondition')}
                          <br />
                          <span className="font-bold text-base text-white">{conditionLabel}</span>
                        </p>
                      ) : null}
                      {notes ? (
                        <p className="mt-2 text-white/95 text-xs whitespace-pre-wrap">{notes}</p>
                      ) : null}
                    </div>
                    <p className={`text-xs mt-1 px-1 text-gray-500 ${isMine ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString(timeLocale, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          if (msg.type === 'price_offer') {
            const offerOrder = msg.orderId ? getOrderById(msg.orderId) : null;
            const isSeller = room && getCurrentUserId() === room.sellerId;
            const showActions =
              isSeller
              && offerOrder
              && offerOrder.status === ORDER_STATUS_VALUE.PENDING_OFFER
              && msg.id === actionablePriceOfferMessageId
              && !meetupBannerInfo
              && !(
                currentOrder
                && currentOrder.status !== ORDER_STATUS_VALUE.PENDING_OFFER
                && currentOrder.id !== offerOrder.id
              );
            // Offer from buyer: align to buyer side
            const isOfferFromMe = getCurrentUserId() === room?.buyerId;
            const d = new Date(msg.timestamp);
            const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString(timeLocale, {
              hour: 'numeric',
              minute: '2-digit',
            });
            const isShareOffer = msg.originalPrice === 0 && msg.proposedPrice === 0;
            return (
              <div key={msgKey} data-msg-index={msgIndex} data-msg-timestamp={msg.timestamp}>
                {unreadDivider}
                <div className={`flex ${isOfferFromMe ? 'justify-end' : 'justify-start'}`}>
                <div className="flex flex-col max-w-[85%]">
                  <div
                    className="rounded-lg px-4 py-3 text-white text-sm shadow-sm"
                    style={
                      isShareOffer
                        ? { background: 'linear-gradient(135deg, #FD6F56 0%, #EEB506 100%)' }
                        : { backgroundColor: '#27AE60' }
                    }
                  >
                    <p className="font-semibold mb-2">{displayChatMessageContent(msg.content, lang)}</p>
                    {isShareOffer ? (
                      <p className="text-white font-bold text-base mt-0.5">{'\u{1F381}'} {t('freeShareRequest')}</p>
                    ) : (
                      <>
                        <p className="text-white/95 text-xs">{t('wasPrice', { n: msg.originalPrice?.toLocaleString() ?? '-' })}</p>
                        <p className="text-white font-bold text-base mt-0.5">
                          {t('offerAmount', { n: msg.proposedPrice?.toLocaleString() ?? '-' })}
                        </p>
                      </>
                    )}
                    <p className="text-white/95 text-xs mt-2">
                      {t('dateLine', { when: `${dateStr} ${timeStr}` })}
                    </p>
                  </div>
                  {showActions && (
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!msg.orderId) return;
                          updateOrderStatus(msg.orderId, ORDER_STATUS_VALUE.ACCEPTED, 'Offer accepted');
                          setMessages(getMessages(roomId!));
                        }}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
                      >
                        {t('accept')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!msg.orderId) return;
                          const order = getOrderById(msg.orderId);
                          if (!order?.product) return;
                          const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
                          if (!confirm(isShare
                            ? t('declineShareConfirm', { title: order.product.title })
                            : t('declineOfferConfirm', { title: order.product.title }))) return;
                          addNotification({
                            targetUserId: order.buyer.id,
                            type: 'chat',
                            title: NOTIFY_OFFER_DECLINED,
                            content: `${order.seller.nickname} declined your offer for "${order.product.title}".`,
                            link: `/product/${order.product.id}`,
                          });
                          void addPriceOfferResultToChat(order, 'rejected').then(async () => {
                            const ok = await deleteOrder(order.id);
                            if (!ok) {
                              alert(t('couldNotDeclineOffer'));
                              return;
                            }
                            setMessages(getMessages(roomId!));
                          });
                        }}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
                      >
                        {t('decline')}
                      </button>
                    </div>
                  )}
                  <p className={`text-xs mt-1 px-1 text-gray-500 ${isOfferFromMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString(timeLocale, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                </div>
              </div>
            );
          }
          if (msg.type === 'price_offer_result') {
            const isAccepted = msg.offerResult === 'accepted';
            const isShareResult = msg.proposedPrice === 0;
            // Seller sent accept/decline: align to seller when me
            const isResultFromMe = getCurrentUserId() === room?.sellerId;
            return (
              <div key={msgKey} data-msg-index={msgIndex} data-msg-timestamp={msg.timestamp}>
                {unreadDivider}
                <div className={`flex ${isResultFromMe ? 'justify-end' : 'justify-start'}`}>
                <div className="flex flex-col max-w-[85%]">
                  <div
                    className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
                      isAccepted ? 'text-white' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                    style={
                      isAccepted
                        ? isShareResult
                          ? { background: 'linear-gradient(135deg, #FD6F56 0%, #EEB506 100%)' }
                          : { backgroundColor: '#27AE60' }
                        : undefined
                    }
                  >
                    {displayChatMessageContent(msg.content, lang)}
                  </div>
                  <p className={`text-xs mt-1 px-1 text-gray-500 ${isResultFromMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString(timeLocale, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                </div>
              </div>
            );
          }
          return (
            <div key={msgKey} data-msg-index={msgIndex} data-msg-timestamp={msg.timestamp}>
              {unreadDivider}
              <div
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
              <div className="flex flex-col max-w-[70%]">
                {/* Images */}
                {msg.images && msg.images.length > 0 && (
                  <div className={`mb-1 ${msg.images.length === 1 ? '' : 'grid grid-cols-2 gap-1'} rounded-lg overflow-hidden`}>
                    {msg.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={getDisplayImageUrl(img)}
                        alt="Attachment"
                        className="w-full max-w-[240px] rounded-lg object-cover cursor-pointer hover:opacity-90"
                        style={{ maxHeight: msg.images!.length === 1 ? '240px' : '120px' }}
                        onClick={(e) => { e.stopPropagation(); setViewImage(getDisplayImageUrl(img)); }}
                      />
                    ))}
                  </div>
                )}
                {/* Text */}
                {msg.content && (
                  <div
                    className={`rounded-lg px-4 py-2.5 ${
                      isMe 
                        ? 'text-white rounded-br-sm' 
                        : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                    }`}
                    style={isMe ? { backgroundColor: '#00A8A3' } : undefined}
                  >
                    <p className="text-sm leading-relaxed">{displayChatMessageContent(msg.content, lang)}</p>
                  </div>
                )}
                <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {isMe && room && (() => {
                    const otherUserId = room.buyerId === getCurrentUserId() ? room.sellerId : room.buyerId;
                    const otherLastRead = otherUserId ? room.lastReadAt?.[otherUserId] : undefined;
                    const isUnread = otherLastRead ? msg.timestamp > otherLastRead : !(room.readStatus?.[otherUserId || '']);
                    return isUnread ? (
                      <span className="text-[11px] font-bold" style={{ color: '#00A8A3' }}>1</span>
                    ) : null;
                  })()}
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString(timeLocale, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
          );
        })}
        <div ref={messagesEndRef} />
        </div>
        {newMessageCount > 0 && (
          <button
            type="button"
            onClick={handleJumpToNewMessages}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white shadow-lg active:opacity-90"
            style={{ backgroundColor: '#00A8A3' }}
          >
            <span aria-hidden>↓</span>
            {t('newMessages')}
            {newMessageCount > 1 ? ` (${newMessageCount})` : ''}
          </button>
        )}
      </div>

      {/* Image Preview */}
      {(previewImages.length > 0 || uploadingImages) && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {uploadingImages && (
              <div className="w-16 h-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-[10px] text-gray-500">
                {t('uploading')}
              </div>
            )}
            {previewImages.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0">
                <img
                  src={img}
                  alt={`Preview ${idx + 1}`}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <button
                  onClick={() => removePreviewImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      {isProductDeleted ? (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-center justify-center px-4 py-4">
            <p className="text-sm text-gray-400">{t('listingRemovedCannotMessage')}</p>
          </div>
        </div>
      ) : roomEnded ? (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-center justify-center px-4 py-4">
            <p className="text-sm text-gray-400">{t('roomEndedInput')}</p>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom,0px)]">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />

          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-800 rounded-lg shrink-0">
              <button
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploadingImages}
                className="p-1.5 text-white hover:bg-gray-700 rounded active:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploadingImages}
                className="p-1.5 text-white hover:bg-gray-700 rounded active:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !uploadingImages && handleSend()}
              placeholder={t('typeMessage')}
              className="flex-1 min-w-0 px-3 py-2.5 bg-white border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3] focus:border-transparent"
            />

            <button
              onClick={handleSend}
              disabled={uploadingImages || (!input.trim() && previewImages.length === 0)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white shrink-0 disabled:opacity-40"
              style={{ backgroundColor: '#00A8A3' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <ImageLightbox src={viewImage} onClose={() => setViewImage(null)} />

      <ModalShell
        open={!!meetupDetailMessage}
        onClose={() => setMeetupDetailMessage(null)}
        zIndex={100}
        panelClassName="max-w-sm w-full p-5"
      >
        {meetupDetailShown ? (
          <>
            <h3 className="font-semibold text-gray-900 mb-3">
              {displayChatMessageContent(meetupDetailShown.content, lang)}
            </h3>
            {(() => {
              const place = currentOrder?.meetupPlace ?? meetupDetailShown.meetupPlace;
              const date = currentOrder?.meetupDate ?? meetupDetailShown.meetupDate;
              const time = currentOrder?.meetupTime ?? meetupDetailShown.meetupTime;
              const hasAny = !!(place || date || time);
              return (
                <>
                  {place ? (
                    <>
                      <p className="text-sm text-gray-600 mb-1">{t('meetupPlace')}</p>
                      <p className="text-gray-900 font-medium mb-3">{place}</p>
                    </>
                  ) : null}
                  {date || time ? (
                    <>
                      <p className="text-sm text-gray-600 mb-1">{t('dateAndTime')}</p>
                      <p className="text-gray-900 font-medium">
                        {[date, time].filter(Boolean).join(' ')}
                      </p>
                    </>
                  ) : null}
                  {!hasAny && (
                    <p className="text-sm text-gray-500">{t('placeTimeNotSetYetModal')}</p>
                  )}
                </>
              );
            })()}
            <button
              type="button"
              className="mt-4 w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
              onClick={() => setMeetupDetailMessage(null)}
            >
              {t('close')}
            </button>
          </>
        ) : null}
      </ModalShell>
    </div>
  );
};


