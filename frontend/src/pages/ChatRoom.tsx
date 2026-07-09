import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import type { ChatRoom as ChatRoomType } from '@/types';
import {
  ChatMessage,
  BarterOrder,
  Order,
  OrderStatus,
  ORDER_STATUS_VALUE,
  TRADE_METHOD_VALUE,
} from '@/types';
import { BarterOrderPanel } from '@/components/common/BarterOrderPanel';
import { getChatRoom, getMessages, addMessage, markAsRead, markAsReadUpTo, markAsReadByOther, getOtherUser, leaveChatRoom, addPriceOfferResultToChat, ensureChatRoomForOrder, addRemoteMessage, addTradeCompletedToChat } from '@/utils/chatStorage';
import { getOrderById, getOrders, ensureOrderById, updateOrderStatus, deleteOrder, createOrderBySeller, confirmOrderCompletion, acceptOrderMeetup, ORDER_QUOTA_EXCEEDED_MESSAGE, mergeRemoteOrder } from '@/utils/orderStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { connectChatSocket, joinRoom as wsJoinRoom, leaveRoom as wsLeaveRoom, onNewMessage, emitReadReceipt, onReadReceipt } from '@/utils/chatSocket';
import { addNotification } from '@/utils/notificationStorage';
import { getProductById } from '@/utils/productStorage';
import { getDisputeByOrderId } from '@/utils/disputeStorage';
import { getMyReviewForOrder } from '@/utils/reviewStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { uploadImagesToR2 } from '@/utils/imageUpload';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { resolveProfileAvatarUrl, resolveDisplayNickname } from '@/utils/profileStorage';
import { API_BASE } from '@/utils/apiConfig';
import { syncRoomMessagesFromDB } from '@/utils/dbSync';
import {
  CHAT_MSG_PRODUCT_RESERVED,
  CHAT_MSG_SELLER_MEETUP_STARTED,
  CHAT_LEAVE_ROOM,
  CHAT_LEAVE_ROOM_CONFIRM,
  CHAT_NEW_MESSAGES,
  CHAT_UNREAD_FROM_HERE,
  displayChatMessageContent,
  isMeetupCanceledMessage,
  NOTIFY_OFFER_DECLINED,
} from '@/locale/enUI';

const DIRECT_RECEIVE_OK = new Set<OrderStatus>([
  ORDER_STATUS_VALUE.ACCEPTED,
  ORDER_STATUS_VALUE.MEETUP_SET,
]);
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
    if (displayChatMessageContent(msg.content) === CHAT_MSG_SELLER_MEETUP_STARTED) continue;
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
  if (order.meetupPlace && order.meetupDate && order.meetupTime) return false;
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

export const ChatRoom: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: roomId } = useParams();
  const [searchParams] = useSearchParams();
  const orderIdFromQuery = searchParams.get('order');

  const [room, setRoom] = useState<ChatRoomType | null>(() => (roomId ? getChatRoom(roomId) : null));

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showBarterPanel, setShowBarterPanel] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [meetupDetailMessage, setMeetupDetailMessage] = useState<ChatMessage | null>(null);
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
  /** Show deleted-listing alert once, then leave */
  const deletedProductPopupShownRef = useRef(false);

  const mockBarterOrder: BarterOrder | null = null;

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
        checkNewMeetupFromOther([data.message]);
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
    alert('This listing was removed.');
    navigate('/chat', { replace: true });
  }, [isProductDeleted, roomId, navigate]);

  // On enter: load messages, check listing exists (read when user actually views messages)
  useEffect(() => {
    if (roomId) {
      const r = getChatRoom(roomId);
      if (r && (r.leftUserIds || []).includes(getCurrentUserId() || '')) {
        navigate('/chat', { replace: true });
        return;
      }
      setMessages(getMessages(roomId));
      checkProductDeleted();
    }
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
  const checkNewMeetupFromOther = (updatedMessages: ChatMessage[]) => {
    const myId = getCurrentUserId();
    if (!myId) return;
    for (const msg of updatedMessages) {
      if (msg.type === 'meetup_confirmed' && msg.senderId !== myId && !shownMeetupPopupIdsRef.current.has(msg.id)) {
        shownMeetupPopupIdsRef.current.add(msg.id);
        setShowMeetupStartedPopup(true);
        break;
      }
    }
  };

  useEffect(() => {
    if (!roomId) return;
    console.log('[ChatRoom] listeners registered', roomId);

    // Existing meetup messages on load: no popup
    const initial = getMessages(roomId);
    const myId = getCurrentUserId();
    initial.forEach((msg) => {
      if (msg.type === 'meetup_confirmed' && msg.senderId !== myId) shownMeetupPopupIdsRef.current.add(msg.id);
    });

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
      checkNewMeetupFromOther(updated);
    };

    const handleProductChange = () => checkProductDeleted();
    window.addEventListener('productsChanged', handleProductChange);
    const handleOrdersChanged = () => {
      if (!roomId) return;
      setRoom(getChatRoom(roomId));
      setMessages(getMessages(roomId));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('chatRoomsChanged', handleSameTab);
    window.addEventListener('ordersChanged', handleOrdersChanged);
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
          const orderRes = await fetch(`${API_BASE}/api/orders?user_id=${uid}`);
          console.log('[ORDERSYNC] poll response', { ok: orderRes.ok, status: orderRes.status, uid });
          if (orderRes.ok) {
            const rows = await orderRes.json();
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
                const dbMeetupPlace = row.meetup_place || row.meetup_location || '';
                const dbMeetupDate = row.meetup_date || '';
                const dbMeetupTime = row.meetup_time || '';
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
                  const statusOrder: OrderStatus[] = [
                    ORDER_STATUS_VALUE.PENDING_OFFER,
                    ORDER_STATUS_VALUE.ACCEPTED,
                    ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO,
                    ORDER_STATUS_VALUE.MEETUP_SET,
                    ORDER_STATUS_VALUE.SHIPPED,
                    ORDER_STATUS_VALUE.DELIVERED,
                    ORDER_STATUS_VALUE.RECEIVED,
                    ORDER_STATUS_VALUE.COMPLETE,
                  ];
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
                  } else if (
                    statusOrder.includes(dbOrderStatus)
                    && statusOrder.indexOf(dbOrderStatus) > statusOrder.indexOf(local.status)
                  ) {
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
      window.removeEventListener('productRegistered', handleProductChange);
      window.removeEventListener('productsChanged', handleProductChange);
    };
  }, [roomId]);

  // Resolve order: query param -> room.order id -> pair+product
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
    if (room.buyerId && room.sellerId) {
      const forPair = myOrders.filter(
        (o) => o.buyer.id === room.buyerId && o.seller.id === room.sellerId
      );
      const withMeetup = forPair.find(
        (o) =>
          o.status === ORDER_STATUS_VALUE.MEETUP_SET ||
          o.status === ORDER_STATUS_VALUE.RECEIVED ||
          o.status === ORDER_STATUS_VALUE.COMPLETE
      );
      if (withMeetup) return withMeetup;
      if (forPair.length > 0) return forPair.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }
    const active = myOrders.filter(
      (o) => o.status !== ORDER_STATUS_VALUE.COMPLETE && o.status !== ORDER_STATUS_VALUE.DISPUTE
    );
    const list = active.length > 0 ? active : myOrders;
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list[0] ?? null;
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
  const meetupBannerInfo = resolveMeetupBannerInfo(currentOrder, displayMessages);
  const meetupCanceled = isMeetupCanceledState(currentOrder, displayMessages);

  const canReceiveConfirm = (order: Order | null): boolean => {
    if (!order) return false;
    if (order.status === ORDER_STATUS_VALUE.DISPUTE) return false;
    if (order.status === ORDER_STATUS_VALUE.MEETUP_SET && !order.meetupAccepted) return false;
    const isDirect = order.tradeMethod !== TRADE_METHOD_VALUE.SHIPPING;
    if (isDirect) return DIRECT_RECEIVE_OK.has(order.status);
    return SHIPPING_RECEIVE_OK.has(order.status);
  };
  const receiveEnabled = canReceiveConfirm(currentOrder) && !meetupCanceled;
  const needsMeetupAccept = !!(currentOrder && currentOrder.status === ORDER_STATUS_VALUE.MEETUP_SET && !currentOrder.meetupAccepted);

  const canOpenDispute = (order: Order | null): boolean => {
    if (!order) return false;
    const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
    if (isShare) return false;
    return DISPUTE_ELIGIBLE.has(order.status);
  };
  /** Listing allows offers (reflect latest product from storage) */
  const productForOffer = room?.product ? getProductById(room.product.id) || room.product : null;
  const canOfferPrice = !!(
    productForOffer &&
    productForOffer.allowOffer !== false &&
    !productForOffer.isFreeShare &&
    (productForOffer.price ?? 0) > 0
  );
  // Hide dispute tab for free-share chats
  const isShareOrder = !!(
    (currentOrder && (currentOrder.proposedPrice === 0 || currentOrder?.product?.isFreeShare || currentOrder?.product?.price === 0)) ||
    (room?.product && (room.product.isFreeShare || room.product.price === 0))
  );

  const handleSellerStartMeetup = () => {
    if (!room?.product) {
      alert('Could not load listing.');
      return;
    }
    const product = room.product;
    const buyer = getOtherUser(room);
    if (!buyer?.id) {
      alert('Could not load chat partner. Try again.');
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
          alert('Could not start meetup. Check your connection and try again.');
          return;
        }
        await ensureChatRoomForOrder(order, getCurrentUserId() ?? undefined);
        navigate(`/meetup/${order.id}`);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          alert(ORDER_QUOTA_EXCEEDED_MESSAGE);
        } else {
          console.error(e);
          alert('Could not start meetup scheduling. Try again.');
        }
      }
    })();
  };

  const buyerChips: ChatChipAction[] = (() => {
    if (!isBuyer || !room?.product || isProductDeleted) return [];
    if (!currentOrder || !shouldShowTradeActionChips(currentOrder, meetupCanceled)) {
      return canOfferPrice
        ? [{ key: 'offer', label: 'Send offer', onClick: () => navigate(`/offer/${room.product!.id}`), primary: true }]
        : [];
    }
    if (currentOrder.status === ORDER_STATUS_VALUE.COMPLETE) {
      const chips: ChatChipAction[] = [];
      if (getMyReviewForOrder(currentOrder.id)) {
        chips.push({ key: 'review-done', label: 'Review submitted', disabled: true });
      } else {
        chips.push({
          key: 'review',
          label: 'Write review',
          primary: true,
          onClick: () => navigate(`/review/${currentOrder.id}`),
        });
      }
      if (!isShareOrder) {
        chips.push({
          key: 'dispute',
          label: 'Open dispute',
          onClick: () => navigate(`/dispute/${currentOrder.id}`),
          disabled: !canOpenDispute(currentOrder),
        });
      }
      return chips;
    }
    const chips: ChatChipAction[] = [];
    if (needsMeetupAccept) {
      chips.push({
        key: 'accept-meetup',
        label: 'Accept meetup',
        primary: true,
        onClick: () => {
          if (!confirm('Accept the scheduled meetup?')) return;
          void acceptOrderMeetup(currentOrder.id).then(() => {
            if (roomId) setRoom(getChatRoom(roomId));
            setOrdersRevision((n) => n + 1);
          });
        },
      });
    } else {
      chips.push({
        key: 'receive',
        label: 'Confirm receipt',
        onClick: () => navigate(`/receive/${currentOrder.id}`),
        disabled: !receiveEnabled,
      });
    }
    if (!isShareOrder) {
      chips.push({
        key: 'dispute',
        label: 'Open dispute',
        onClick: () => navigate(`/dispute/${currentOrder.id}`),
        disabled: !canOpenDispute(currentOrder),
      });
    }
    return chips;
  })();

  const sellerChips: ChatChipAction[] = (() => {
    if (!isSeller || !room?.product || isProductDeleted) return [];
    if (!currentOrder || !shouldShowTradeActionChips(currentOrder, meetupCanceled)) {
      return [{ key: 'meetup', label: 'Schedule meetup', onClick: handleSellerStartMeetup }];
    }
    const chips: ChatChipAction[] = [];
    if (currentOrder.status === ORDER_STATUS_VALUE.RECEIVED && !currentOrder.sellerCompleted) {
      chips.push({
        key: 'complete',
        label: 'Confirm complete',
        primary: true,
        onClick: () => {
          void (async () => {
            if (!confirm('Confirm trade completion?')) return;
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
    }
    if (currentOrder.status === ORDER_STATUS_VALUE.COMPLETE && !getMyReviewForOrder(currentOrder.id)) {
      chips.push({
        key: 'review',
        label: 'Write review',
        onClick: () => navigate(`/review/${currentOrder.id}`),
      });
    }
    chips.push({
      key: 'meetup',
      label: 'Schedule meetup',
      onClick: handleSellerStartMeetup,
    });
    if (!isShareOrder) {
      chips.push({
        key: 'dispute',
        label: 'Open dispute',
        onClick: () => navigate(`/dispute/${currentOrder.id}`),
        disabled: !canOpenDispute(currentOrder),
      });
    }
    return chips;
  })();

  useEffect(() => {
    if (!roomId) return;
  }, [roomId, userId, isBuyer, isSeller, currentOrder, isShareOrder, receiveEnabled]);

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
      alert('Could not upload image.');
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
        alert('Could not send photos. Check your connection and try again.');
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
      alert('Message could not be sent. Check your connection and try again.');
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
            {room &&
              (() => {
                const other = getOtherUser(room);
                const avatarUrl = resolveProfileAvatarUrl(other.id, other.profileImage);
                return (
                  <AvatarWithBadgeOverlay userId={other.id} sizePx={40}>
                    <UserAvatarImage src={avatarUrl} />
                  </AvatarWithBadgeOverlay>
                );
              })()}
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {room ? resolveDisplayNickname(getOtherUser(room).id, getOtherUser(room).nickname) : 'Chat'}
              </h1>
              {room && getOtherUser(room).kycStatus === 'verified' && (
                <img src="/check_1.svg" alt="Verified" className="w-3.5 h-3.5 flex-shrink-0" />
              )}
            </div>
          </div>
          
          {/* Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-2 -mr-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    if (roomId && confirm(CHAT_LEAVE_ROOM_CONFIRM)) {
                      void leaveChatRoom(roomId).then((ok) => {
                        if (ok) navigate('/chat', { replace: true });
                      });
                    }
                  }}
                  className="w-full px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50 rounded-lg"
                >
                  {CHAT_LEAVE_ROOM}
                </button>
              </div>
            )}
          </div>
        </div>

        {currentOrder && currentOrder.status === ORDER_STATUS_VALUE.DISPUTE && (() => {
          const dispute = getDisputeByOrderId(currentOrder.id);
          const isResolved = dispute?.status === 'RESOLVED';
          if (isResolved) {
            return (
              <div className="bg-green-50 border-t border-green-200 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-green-800 flex-1">Dispute resolved for this item.</p>
                  <button
                    onClick={() => navigate(`/dispute/${currentOrder.id}`)}
                    className="text-xs font-medium text-green-600 underline hover:text-green-700 whitespace-nowrap"
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div className="bg-red-50 border-t border-red-200 px-4 py-2.5">
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
                <p className="text-sm font-medium text-red-800 flex-1">
                  This item is in a dispute
                </p>
                <button
                  onClick={() => navigate(`/dispute/${currentOrder.id}`)}
                  className="text-xs font-medium text-red-600 underline hover:text-red-700 whitespace-nowrap"
                >
                  Details
                </button>
              </div>
            </div>
          );
        })()}

        {meetupBannerInfo && (
          <div className="bg-teal-50 border-t border-teal-200 px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <img src="/h.svg" alt="" className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium text-teal-800 flex-1 truncate">
                {CHAT_MSG_PRODUCT_RESERVED}
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
                    content: CHAT_MSG_PRODUCT_RESERVED,
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
                Details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Partner started meetup (realtime popup) */}
      {showMeetupStartedPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label="Meetup started">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center">
            <p className="text-base font-semibold text-gray-900 mb-1">The other person started scheduling a meetup</p>
            <p className="text-sm text-gray-600 mb-5">Check the chat for meetup details.</p>
            <button
              type="button"
              onClick={() => setShowMeetupStartedPopup(false)}
              className="w-full px-4 py-3 text-white rounded-lg font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Barter Order Panel */}
      {showBarterPanel && mockBarterOrder && (
        <BarterOrderPanel
          order={mockBarterOrder}
          isUserA={true}
          onClose={() => setShowBarterPanel(false)}
        />
      )}

      {/* Listing + buyer/seller actions */}
      {room?.product && !mockBarterOrder && (
        <div className="bg-white px-4 py-2.5 shrink-0">
          {isProductDeleted ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">Listing removed</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate(`/product/${room.product!.id}`)}
                className="flex gap-3 items-center w-full text-left pb-2.5"
                aria-label="View listing"
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
                      ? 'Free share'
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
                {CHAT_UNREAD_FROM_HERE}
              </span>
            </div>
          ) : null;
          if (msg.type === 'system') {
            return (
              <div key={msgKey} data-msg-index={msgIndex} data-msg-timestamp={msg.timestamp}>
                {unreadDivider}
                <div className="flex justify-center">
                <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                  {displayChatMessageContent(msg.content)}
                </span>
                </div>
              </div>
            );
          }
          if (msg.type === 'meetup_confirmed') {
            const isSeller = room && getCurrentUserId() === room.sellerId;
            const contentLabel = displayChatMessageContent(msg.content);
            const isSellerScheduling = contentLabel === CHAT_MSG_SELLER_MEETUP_STARTED;
            const orderHasMeetup = !!(
              currentOrder?.meetupPlace &&
              currentOrder?.meetupDate &&
              currentOrder?.meetupTime
            );
            const useOrderMeetup =
              orderHasMeetup &&
              !isSellerScheduling &&
              contentLabel === CHAT_MSG_PRODUCT_RESERVED;
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
                      {displayChatMessageContent(msg.content)}
                    </p>
                    {meetupPlace && (
                      <p className="mb-0.5 text-white/95">
                        Meetup place
                        <br />
                        <span className="font-bold text-base text-white">{meetupPlace}</span>
                      </p>
                    )}
                    {meetupDate && meetupTime && (
                      <p className="mt-2 text-white/95">
                        Date {meetupDate} {meetupTime}
                      </p>
                    )}
                    {!hasDetail && !isSellerScheduling && (
                      <p className="mt-2 text-white/80 text-xs">Place and time not set yet</p>
                    )}
                  </div>
                  <p className={`text-xs mt-1 px-1 text-gray-500 ${isSeller ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', {
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
            const showActions = isSeller && offerOrder && offerOrder.status === ORDER_STATUS_VALUE.PENDING_OFFER;
            // Offer from buyer: align to buyer side
            const isOfferFromMe = getCurrentUserId() === room?.buyerId;
            const d = new Date(msg.timestamp);
            const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString('en-US', {
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
                    <p className="font-semibold mb-2">{displayChatMessageContent(msg.content)}</p>
                    {isShareOffer ? (
                      <p className="text-white font-bold text-base mt-0.5">{'\u{1F381}'} Free share request</p>
                    ) : (
                      <>
                        <p className="text-white/95 text-xs">Was {msg.originalPrice?.toLocaleString() ?? '-'}</p>
                        <p className="text-white font-bold text-base mt-0.5">
                          Offer {msg.proposedPrice?.toLocaleString() ?? '-'}
                        </p>
                      </>
                    )}
                    <p className="text-white/95 text-xs mt-2">
                      Date {dateStr} {timeStr}
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
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!msg.orderId) return;
                          const order = getOrderById(msg.orderId);
                          if (!order?.product) return;
                          const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
                          if (!confirm(isShare ? `Decline the free share request for "${order.product.title}"?` : `Decline the purchase offer for "${order.product.title}"?`)) return;
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
                              alert('Could not decline this offer. Check your connection and try again.');
                              return;
                            }
                            setMessages(getMessages(roomId!));
                          });
                        }}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  <p className={`text-xs mt-1 px-1 text-gray-500 ${isOfferFromMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', {
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
                    {displayChatMessageContent(msg.content)}
                  </div>
                  <p className={`text-xs mt-1 px-1 text-gray-500 ${isResultFromMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', {
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
                    <p className="text-sm leading-relaxed">{displayChatMessageContent(msg.content)}</p>
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
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', {
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
            {CHAT_NEW_MESSAGES}
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
                Uploading...
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
            <p className="text-sm text-gray-400">This listing was removed; you cannot send messages.</p>
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
              placeholder="Type a message"
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

      {/* Full-screen Image Viewer */}
      {viewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setViewImage(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white text-2xl z-10"
            onClick={() => setViewImage(null)}
          >
            ??          </button>
          <img
            src={viewImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {meetupDetailMessage && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setMeetupDetailMessage(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 mb-3">
              {displayChatMessageContent(meetupDetailMessage.content)}
            </h3>
            {(() => {
              const place = currentOrder?.meetupPlace ?? meetupDetailMessage.meetupPlace;
              const date = currentOrder?.meetupDate ?? meetupDetailMessage.meetupDate;
              const time = currentOrder?.meetupTime ?? meetupDetailMessage.meetupTime;
              const hasAny = !!(place || date || time);
              return (
                <>
                  {place ? (
                    <>
                      <p className="text-sm text-gray-600 mb-1">Meetup place</p>
                      <p className="text-gray-900 font-medium mb-3">{place}</p>
                    </>
                  ) : null}
                  {date || time ? (
                    <>
                      <p className="text-sm text-gray-600 mb-1">Date & time</p>
                      <p className="text-gray-900 font-medium">
                        {[date, time].filter(Boolean).join(' ')}
                      </p>
                    </>
                  ) : null}
                  {!hasAny && (
                    <p className="text-sm text-gray-500">Place and time are not set yet.</p>
                  )}
                </>
              );
            })()}
            <button
              type="button"
              className="mt-4 w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
              onClick={() => setMeetupDetailMessage(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


