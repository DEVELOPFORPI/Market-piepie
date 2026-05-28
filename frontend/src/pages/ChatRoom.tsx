import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import type { ChatRoom as ChatRoomType, BuyerChatTab } from '@/types';
import {
  ChatMessage,
  BarterOrder,
  Order,
  OrderStatus,
  BUYER_CHAT_TAB_VALUE,
  ORDER_STATUS_VALUE,
  TRADE_METHOD_VALUE,
} from '@/types';
import { BarterOrderPanel } from '@/components/common/BarterOrderPanel';
import { getChatRoom, getMessages, addMessage, markAsRead, markAsReadByOther, getOtherUser, leaveChatRoom, addPriceOfferResultToChat, ensureChatRoomForOrder, addSellerMeetupStartedToChat, addRemoteMessage, addTradeCompletedToChat } from '@/utils/chatStorage';
import { getOrderById, getOrders, updateOrderStatus, deleteOrder, createOrderBySeller, confirmOrderCompletion, acceptOrderMeetup, ORDER_QUOTA_EXCEEDED_MESSAGE, mergeRemoteOrder } from '@/utils/orderStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { connectChatSocket, joinRoom as wsJoinRoom, leaveRoom as wsLeaveRoom, onNewMessage, emitReadReceipt, onReadReceipt } from '@/utils/chatSocket';
import { addNotification } from '@/utils/notificationStorage';
import { getProductById } from '@/utils/productStorage';
import { getDisputeByOrderId } from '@/utils/disputeStorage';
import { getReviewByOrderId } from '@/utils/reviewStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { uploadImagesToR2 } from '@/utils/imageUpload';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { resolveProfileAvatarUrl, resolveDisplayNickname } from '@/utils/profileStorage';
import { API_BASE } from '@/utils/apiConfig';
import {
  CHAT_MSG_MEETUP_CANCELED,
  CHAT_MSG_PRODUCT_RESERVED,
  displayChatMessageContent,
  isMeetupCanceledMessage,
  labelBuyerChatTab,
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
  const [buyerTab, setBuyerTab] = useState<BuyerChatTab>(BUYER_CHAT_TAB_VALUE.RECEIVE);
  const [showMeetupStartedPopup, setShowMeetupStartedPopup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    setRoom(roomId ? getChatRoom(roomId) : null);
    deletedProductPopupShownRef.current = false;
  }, [roomId]);

  // WebSocket: connect, join room, listen for messages + read receipts
  useEffect(() => {
    if (!roomId) return;
    connectChatSocket();
    wsJoinRoom(roomId);
    emitReadReceipt(roomId);

    const unsub = onNewMessage((data) => {
      if (data.roomId === roomId) {
        addRemoteMessage(roomId, data.message);
        setMessages(getMessages(roomId));
        markAsRead(roomId);
        emitReadReceipt(roomId);
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

  // On enter: mark read, load messages, check listing exists
  useEffect(() => {
    if (roomId) {
      const r = getChatRoom(roomId);
      if (r && (r.leftUserIds || []).includes(getCurrentUserId() || '')) {
        navigate('/chat', { replace: true });
        return;
      }
      markAsRead(roomId);
      setMessages(getMessages(roomId));
      checkProductDeleted();
    }
  }, [roomId, navigate]);

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
        const res = await fetch(`${API_BASE}/api/chat-rooms/${roomId}/messages`);
        if (res.ok) {
          const dbMessages = await res.json();
          if (dbMessages.length > 0) {
            const current = getMessages(roomId);
            const currentIds = new Set(current.map((m) => m.id));
            const newMsgs = dbMessages.filter((m: any) => !currentIds.has(m.id));
            if (newMsgs.length > 0) {
              newMsgs.forEach((m: any) => {
                addRemoteMessage(roomId, {
                  id: m.id,
                  senderId: m.sender_id,
                  content: m.content || "",
                  timestamp: m.created_at,
                  type: m.type || "user",
                  images: m.images || [],
                  orderId: m.order_id,
                  originalPrice: m.original_price,
                  proposedPrice: m.proposed_price,
                  offerResult: m.offer_result,
                });
              });
              setMessages(getMessages(roomId));
            }
          }
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
              rows.forEach((row: any) => {
                const local = getOrderById(String(row.id));
                if (!local) return;
                const dbStatus = String(row.status || '');
                const dbMeetupPlace = row.meetup_place || row.meetup_location || '';
                const dbMeetupDate = row.meetup_date || '';
                const dbMeetupTime = row.meetup_time || '';
                const changed = dbStatus !== local.status
                  || Boolean(row.buyer_completed) !== Boolean(local.buyerCompleted)
                  || Boolean(row.seller_completed) !== Boolean(local.sellerCompleted)
                  || Boolean(row.meetup_accepted) !== Boolean(local.meetupAccepted)
                  || (dbMeetupPlace && dbMeetupPlace !== (local.meetupPlace || ''))
                  || (dbMeetupDate && dbMeetupDate !== (local.meetupDate || ''))
                  || (dbMeetupTime && dbMeetupTime !== (local.meetupTime || ''));
                console.log('[ORDERSYNC] compare', { orderId: row.id, dbStatus, localStatus: local.status, dbMeetupPlace, localMeetupPlace: local.meetupPlace, dbBuyerCompleted: row.buyer_completed, dbSellerCompleted: row.seller_completed, changed });
                if (changed) {
                  const updated = { ...local };
                  const statusOrder = ['제안중','수락됨','배송정보대기','약속확정','발송완료','배송완료','수령완료','완료'];
                  if (statusOrder.indexOf(dbStatus) > statusOrder.indexOf(local.status)) {
                    updated.status = dbStatus as Order['status'];
                  }
                  if (row.buyer_completed) updated.buyerCompleted = true;
                  if (row.seller_completed) updated.sellerCompleted = true;
                  if (row.meetup_accepted) updated.meetupAccepted = true;
                  if (dbMeetupPlace) updated.meetupPlace = dbMeetupPlace;
                  if (dbMeetupDate) updated.meetupDate = dbMeetupDate;
                  if (dbMeetupTime) updated.meetupTime = dbMeetupTime;
                  console.log('[ORDERSYNC] merging', { orderId: row.id, newStatus: updated.status, meetupPlace: updated.meetupPlace });
                  mergeRemoteOrder(updated);
                }
              });
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

  const canReceiveConfirm = (order: Order | null): boolean => {
    if (!order) return false;
    if (order.status === ORDER_STATUS_VALUE.DISPUTE) return false;
    if (order.status === ORDER_STATUS_VALUE.MEETUP_SET && !order.meetupAccepted) return false;
    const isDirect = order.tradeMethod !== TRADE_METHOD_VALUE.SHIPPING;
    if (isDirect) return DIRECT_RECEIVE_OK.has(order.status);
    return SHIPPING_RECEIVE_OK.has(order.status);
  };
  const receiveEnabled = canReceiveConfirm(currentOrder);
  const needsMeetupAccept = !!(currentOrder && currentOrder.status === ORDER_STATUS_VALUE.MEETUP_SET && !currentOrder.meetupAccepted);


  // If banner only (no meetup card in thread), synthesize card from order
  const hasMeetupInMessages = messages.some((m) => m.type === 'meetup_confirmed');
  const displayMessages =
    !hasMeetupInMessages &&
    currentOrder?.meetupPlace &&
    currentOrder?.meetupDate &&
    currentOrder?.meetupTime
      ? [
          ...messages,
          {
            id: 'display_meetup_from_order',
            senderId: currentOrder.seller.id,
            content: CHAT_MSG_PRODUCT_RESERVED,
            timestamp: currentOrder.createdAt,
            type: 'meetup_confirmed' as const,
            meetupPlace: currentOrder.meetupPlace,
            meetupDate: currentOrder.meetupDate,
            meetupTime: currentOrder.meetupTime,
          } as ChatMessage,
        ]
      : messages;
  console.log('[ChatRoom] render', messages.length, displayMessages.length);

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
    (currentOrder && (currentOrder.proposedPrice === 0 || currentOrder.product?.isFreeShare || currentOrder.product?.price === 0)) ||
    (room?.product && (room.product.isFreeShare || room.product.price === 0))
  );
  const buyerTabOptions = [
    BUYER_CHAT_TAB_VALUE.RECEIVE,
    ...(canOfferPrice ? [BUYER_CHAT_TAB_VALUE.OFFER] : []),
    ...(isShareOrder ? [] : [BUYER_CHAT_TAB_VALUE.OPEN_DISPUTE]),
  ] as BuyerChatTab[];

  useEffect(() => {
    if (!roomId) return;
  }, [roomId, userId, isBuyer, isSeller, currentOrder, isShareOrder, receiveEnabled, buyerTab, buyerTabOptions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSend = () => {
    if (uploadingImages) return;
    if (!input.trim() && previewImages.length === 0) return;
    if (!roomId) return;

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
      const saved = addMessage(roomId, imgMessage);
      if (saved) {
        setPreviewImages([]);
        setInput('');
      } else {
        alert('Could not save photos. Try fewer images or smaller files.');
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
    addMessage(roomId, newMessage);
    setInput('');
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
                    if (roomId && confirm('\uCC44\uD305\uBC29\uC744 \uB098\uAC00\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\uC0C1\uB300\uBC29\uC5D0\uAC8C \uB098\uAC04 \uAC83\uC774 \uD45C\uC2DC\uB429\uB2C8\uB2E4.')) {
                      leaveChatRoom(roomId);
                      navigate('/chat', { replace: true });
                    }
                  }}
                  className="w-full px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50 rounded-lg"
                >
                  \uCC44\uD305\uBC29 \uB098\uAC00\uAE30
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
        <div className="border-b border-gray-200 bg-white px-4 py-4 shrink-0">
          {isProductDeleted ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-400">Listing removed</p>
                <p className="text-xs text-gray-400 mt-0.5">The seller deleted this listing</p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-base font-medium text-gray-900 mb-1">{room.product.title}</h2>
              <p className="text-2xl font-bold text-gray-900 mb-4">{room.product.price.toLocaleString()} PI</p>
              {!currentOrder ? (
                <div className="space-y-2">
                  {isBuyer && (
                    <div className="w-full space-y-3">
                      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                        {buyerTabOptions.map((tab) => (
                          <button key={tab} type="button" onClick={() => setBuyerTab(tab)} className={`flex-1 py-2 rounded-md text-sm font-medium ${buyerTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
                            {labelBuyerChatTab(tab)}
                          </button>
                        ))}
                      </div>
                      <div className="min-h-[44px] flex items-center justify-center">
                        {buyerTab === BUYER_CHAT_TAB_VALUE.RECEIVE && <p className="text-xs text-gray-500">You can confirm receipt once the trade progresses.</p>}
                        {buyerTab === BUYER_CHAT_TAB_VALUE.OFFER && (canOfferPrice ? <button onClick={() => navigate(`/offer/${room!.product!.id}`)} className="w-full px-4 py-2.5 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: '#00A8A3' }}>Send price offer</button> : <p className="text-xs text-gray-500">This listing does not accept offers.</p>)}
                        {buyerTab === BUYER_CHAT_TAB_VALUE.OPEN_DISPUTE && <p className="text-xs text-gray-500">You can open a dispute after receipt is confirmed.</p>}
                      </div>
                    </div>
                  )}
                  {isSeller && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!room?.product) {
                          alert('Could not load listing.');
                          return;
                        }
                        const buyer = getOtherUser(room);
                        if (!buyer?.id) {
                          alert('Could not load chat partner. Try again.');
                          return;
                        }
                        try {
                          const order = createOrderBySeller({ product: room.product, buyer });
                          ensureChatRoomForOrder(order, getCurrentUserId() ?? undefined);
                          addSellerMeetupStartedToChat(order, roomId);
                          navigate(`/meetup/${order.id}`);
                        } catch (e) {
                          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                            alert(ORDER_QUOTA_EXCEEDED_MESSAGE);
                          } else {
                            console.error(e);
                            alert('Could not start meetup scheduling. Try again.');
                          }
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Schedule meetup
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {isSeller && (
                    <div className="w-full space-y-3">
                      {/* Order status indicator for seller */}
                      {currentOrder.status === ORDER_STATUS_VALUE.MEETUP_SET && !currentOrder.meetupAccepted && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs font-medium text-yellow-800">Waiting for buyer to accept meetup</p>
                        </div>
                      )}
                      {currentOrder.status === ORDER_STATUS_VALUE.MEETUP_SET && currentOrder.meetupAccepted && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-medium text-green-800">Buyer accepted meetup. Waiting for receipt confirmation.</p>
                        </div>
                      )}
                      {currentOrder.status === ORDER_STATUS_VALUE.RECEIVED && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-medium text-green-800">
                            Buyer confirmed receipt
                            {currentOrder.sellerCompleted
                              ? ' · You confirmed trade complete'
                              : ' · Please confirm trade completion'}
                          </p>
                        </div>
                      )}
                      {currentOrder.status === ORDER_STATUS_VALUE.COMPLETE && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs font-medium text-blue-800">Trade complete</p>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {/* Confirm trade complete button (after buyer receipt) */}
                        {currentOrder.status === ORDER_STATUS_VALUE.RECEIVED && !currentOrder.sellerCompleted && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Confirm trade completion?')) {
                                const updated = confirmOrderCompletion(currentOrder.id, 'seller');
                                if (updated?.status === ORDER_STATUS_VALUE.COMPLETE) {
                                  addTradeCompletedToChat(updated);
                                  navigate(`/review/${currentOrder.id}`);
                                }
                                setRoom(getChatRoom(roomId!));
                              }
                            }}
                            className="flex-1 min-w-[120px] px-4 py-2.5 text-white rounded-lg text-sm font-medium"
                            style={{ backgroundColor: '#00A8A3' }}
                          >
                            Confirm trade complete
                          </button>
                        )}
                        {/* Write review (after complete) — hidden if review already submitted */}
                        {currentOrder.status === ORDER_STATUS_VALUE.COMPLETE && !getReviewByOrderId(currentOrder.id) && (
                          <button
                            type="button"
                            onClick={() => navigate(`/review/${currentOrder.id}`)}
                            className="flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-sm font-medium"
                            style={{ borderWidth: 1, borderColor: '#00A8A3', color: '#00A8A3' }}
                          >
                            Write review
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!currentOrder?.id) {
                              alert('Could not load order.');
                              return;
                            }
                            navigate(`/meetup/${currentOrder.id}`);
                          }}
                          className="flex-1 min-w-[120px] px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Schedule meetup
                        </button>
                        {!isShareOrder && (
                          <button onClick={() => navigate(`/dispute/${currentOrder.id}`)} disabled={!canOpenDispute(currentOrder)} className="flex-1 min-w-[120px] px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            Open dispute
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {isBuyer && (
                    <div className="w-full space-y-3">
                      {currentOrder.status === ORDER_STATUS_VALUE.COMPLETE ? (
                        <div className="flex gap-2">
                          {getReviewByOrderId(currentOrder.id) ? (
                            <div className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-center text-gray-400 border border-gray-200">
                              Review submitted ✓
                            </div>
                          ) : (
                            <button
                              onClick={() => navigate(`/review/${currentOrder.id}`)}
                              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
                              style={{ borderWidth: 1, borderColor: '#00A8A3', color: '#00A8A3' }}
                            >
                              Write review
                            </button>
                          )}
                          {!isShareOrder && (
                            <button onClick={() => navigate(`/dispute/${currentOrder.id}`)} disabled={!canOpenDispute(currentOrder)} className="flex-1 px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium disabled:opacity-50">
                              Open dispute
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {buyerTabOptions.length > 1 ? (
                            <>
                              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                                {buyerTabOptions.map((tab) => (
                                  <button key={tab} type="button" onClick={() => setBuyerTab(tab)} className={`flex-1 py-2 rounded-md text-sm font-medium ${buyerTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
                                    {labelBuyerChatTab(tab)}
                                  </button>
                                ))}
                              </div>
                              <div className="min-h-[44px] flex items-center justify-center">
                                {buyerTab === BUYER_CHAT_TAB_VALUE.RECEIVE && (needsMeetupAccept ? (
                                  <button onClick={() => {
                                    if (confirm('Accept the scheduled meetup?')) {
                                      acceptOrderMeetup(currentOrder.id);
                                    }
                                  }} className="w-full px-4 py-2.5 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: '#00A8A3' }}>Accept meetup</button>
                                ) : (
                                  <button onClick={() => {
                                    navigate(`/receive/${currentOrder.id}`);
                                  }} disabled={!receiveEnabled} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Confirm receipt</button>
                                ))}
                                {buyerTab === BUYER_CHAT_TAB_VALUE.OFFER && (canOfferPrice ? <button onClick={() => navigate(`/offer/${room!.product!.id}`)} className="w-full px-4 py-2.5 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: '#00A8A3' }}>Send price offer</button> : <p className="text-xs text-gray-500">This listing does not accept offers.</p>)}
                                {buyerTab === BUYER_CHAT_TAB_VALUE.OPEN_DISPUTE && (currentOrder?.proposedPrice === 0 || currentOrder?.product?.isFreeShare || currentOrder?.product?.price === 0 ? <p className="text-xs text-gray-500">Free shares cannot be disputed.</p> : <button onClick={() => navigate(`/dispute/${currentOrder.id}`)} disabled={!canOpenDispute(currentOrder)} className="w-full px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium disabled:opacity-50">Open dispute</button>)}
                              </div>
                            </>
                          ) : (
                            <div className="min-h-[44px] flex items-center justify-center">
                              {needsMeetupAccept ? (
                                <button onClick={() => {
                                  if (confirm('Accept the scheduled meetup?')) {
                                    acceptOrderMeetup(currentOrder.id);
                                  }
                                }} className="w-full px-4 py-2.5 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: '#00A8A3' }}>Accept meetup</button>
                              ) : (
                                <button onClick={() => {
                                  navigate(`/receive/${currentOrder.id}`);
                                }} disabled={!receiveEnabled} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Confirm receipt</button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentOrder && currentOrder.meetupPlace && currentOrder.meetupDate && currentOrder.meetupTime && (
          <div className="flex-shrink-0 px-4 pt-4 pb-2">
            <div
              role="button"
              onClick={() => {
                setMeetupDetailMessage({
                  id: 'banner',
                  content: CHAT_MSG_PRODUCT_RESERVED,
                  senderId: currentOrder.seller.id,
                  timestamp: new Date().toISOString(),
                  type: 'meetup_confirmed',
                });
              }}
              className="rounded-lg px-4 py-3 text-white text-sm shadow-sm cursor-pointer active:opacity-90"
              style={{
                background: 'linear-gradient(90deg, #00A8A3 0%, #27AE60 100%)',
              }}
            >
              <p className="font-semibold mb-1 flex items-center gap-1"><img src="/h.svg" alt="" className="w-4 h-4 inline-block" /> {CHAT_MSG_PRODUCT_RESERVED}</p>
              <p className="text-white/95 text-xs mb-0.5">
                Meetup place <span className="font-medium text-white">{currentOrder.meetupPlace}</span>
              </p>
              <p className="text-white/95 text-xs">
                Date {[currentOrder.meetupDate, currentOrder.meetupTime].filter(Boolean).join(' ')}
              </p>
              <p className="text-white/80 text-xs mt-1">Tap for details</p>
            </div>
          </div>
        )}
        {currentOrder && !(currentOrder.meetupPlace && currentOrder.meetupDate && currentOrder.meetupTime) && messages.some((m) => m.type === 'system' && isMeetupCanceledMessage(m.content)) && (
          <div className="flex-shrink-0 px-4 pt-4 pb-2">
            <div className="rounded-lg px-4 py-3 border border-gray-200 bg-gray-50 text-gray-700 text-sm">
              <p className="font-semibold">{'\u{1F6AB}'} {CHAT_MSG_MEETUP_CANCELED}</p>
              <p className="text-gray-500 text-xs mt-1">Status reflects the cancelation. You can schedule a new meetup.</p>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {displayMessages.map((msg, msgIndex) => {
          const isMe = msg.senderId === getCurrentUserId();
          const msgKey = `${msg.id}-${msgIndex}`;
          if (msg.type === 'system') {
            return (
              <div key={msgKey} className="flex justify-center">
                <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                  {displayChatMessageContent(msg.content)}
                </span>
              </div>
            );
          }
          if (msg.type === 'meetup_confirmed') {
            const isSeller = room && getCurrentUserId() === room.sellerId;
            const hasDetail = !!(msg.meetupPlace || msg.meetupDate || msg.meetupTime);
            return (
              <div key={msgKey} className={`flex ${isSeller ? 'justify-end' : 'justify-start'}`}>
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
                    {msg.meetupPlace && (
                      <p className="mb-0.5 text-white/95">
                        Meetup place
                        <br />
                        <span className="font-bold text-base text-white">{msg.meetupPlace}</span>
                      </p>
                    )}
                    {msg.meetupDate && msg.meetupTime && (
                      <p className="mt-2 text-white/95">
                        Date {msg.meetupDate} {msg.meetupTime}
                      </p>
                    )}
                    {!hasDetail && (
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
              <div key={msgKey} className={`flex ${isOfferFromMe ? 'justify-end' : 'justify-start'}`}>
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
                          addPriceOfferResultToChat(order, 'rejected');
                          deleteOrder(order.id);
                          setMessages(getMessages(roomId!));
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
            );
          }
          if (msg.type === 'price_offer_result') {
            const isAccepted = msg.offerResult === 'accepted';
            const isShareResult = msg.proposedPrice === 0;
            // Seller sent accept/decline: align to seller when me
            const isResultFromMe = getCurrentUserId() === room?.sellerId;
            return (
              <div key={msgKey} className={`flex ${isResultFromMe ? 'justify-end' : 'justify-start'}`}>
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
            );
          }
          return (
            <div
              key={msgKey}
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
          );
        })}
        <div ref={messagesEndRef} />
        </div>
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


