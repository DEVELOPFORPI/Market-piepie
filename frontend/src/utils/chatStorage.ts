import { ChatRoom, ChatMessage, Product, Order, ORDER_STATUS_VALUE } from '@/types';
import { syncChatRoomToDB, syncMessageToDB } from '@/utils/dbSync';
import { sendMessageViaSocket, notifyNewRoom } from '@/utils/chatSocket';
import {
  CHAT_FALLBACK_NICKNAME,
  CHAT_LASTMSG_PHOTO,
  CHAT_MSG_ACCEPT_SHARE,
  CHAT_MSG_BUYER_PRICE_OFFER,
  CHAT_MSG_BUYER_SHARE_REQUEST,
  CHAT_MSG_MEETUP_UPDATED,
  CHAT_MSG_PRODUCT_RESERVED,
  CHAT_MSG_REJECT_SHARE,
  CHAT_MSG_SELLER_MEETUP_STARTED,
  NOTIFY_CHAT_ROOM_CREATED,
  NOTIFY_NEW_CHAT,
  chatMsgAcceptOffer,
  chatMsgRejectOffer,
  chatMsgUserLeft,
} from '@/locale/enUI';
import { getCurrentUserId } from '@/utils/authStorage';
import { getMyUser } from '@/utils/profileStorage';
import { getRegion } from '@/utils/regionStorage';
import { addNotification } from '@/utils/notificationStorage';
import { getOrders } from '@/utils/orderStorage';
import { getItem, setItem } from '@/utils/heavyStorage';

/** Shared storage: all chat rooms */
const CHATROOMS_KEY = 'all_chatrooms';

/** WebSocket에서 받은 메시지를 로컬에 추가 (중복 방지) */
export const addRemoteMessage = (roomId: string, message: ChatMessage): void => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;
  if (!room.messages) room.messages = [];
  if (room.messages.some((m) => m.id === message.id)) return;
  room.messages.push(message);
  room.lastMessage = message.images && message.images.length > 0
    ? (message.content || 'Photo')
    : message.content;
  room.lastMessageTime = message.timestamp;
  const userId = getCurrentUserId();
  if (!room.readStatus) room.readStatus = {};
  if (userId) room.readStatus[userId] = false;
  saveAllChatRooms(rooms, roomId);
};

/** Realtime room_updated 이벤트 처리: lastMessage/readStatus 갱신 */
export const updateRoomFromRemote = (roomId: string, lastMessage: string, lastMessageTime: string): void => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;
  room.lastMessage = lastMessage;
  room.lastMessageTime = lastMessageTime;
  const userId = getCurrentUserId();
  if (!room.readStatus) room.readStatus = {};
  if (userId) room.readStatus[userId] = false;
  saveAllChatRooms(rooms, roomId);
};

/** WebSocket에서 받은 새 채팅방을 로컬에 추가 */
export const addRemoteRoom = (room: ChatRoom): void => {
  const rooms = getAllChatRooms();
  const idx = rooms.findIndex((r) => r.id === room.id);
  if (idx >= 0) {
    const prev = rooms[idx];
    rooms[idx] = {
      ...prev,
      ...room,
      messages: prev.messages?.length ? prev.messages : room.messages || [],
      readStatus: prev.readStatus || room.readStatus,
    };
    saveAllChatRooms(rooms, room.id);
    return;
  }
  rooms.unshift(room);
  saveAllChatRooms(rooms, room.id);
};

/** All chat rooms (localStorage) */
const getAllChatRooms = (): ChatRoom[] => {
  try {
    const raw = getItem(CHATROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** On quota exceeded, trim oldest rooms except protectRoomId and retry */
const saveAllChatRooms = (rooms: ChatRoom[], protectRoomId?: string): boolean => {
  let list = [...rooms];
  while (true) {
    try {
      setItem(CHATROOMS_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event('chatRoomsChanged'));
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        const others = list.filter((r) => r.id !== protectRoomId);
        if (others.length === 0) return false;
        const oldest = [...others].sort(
          (a, b) => new Date(a.lastMessageTime || 0).getTime() - new Date(b.lastMessageTime || 0).getTime()
        )[0];
        list = list.filter((r) => r.id !== oldest.id);
      } else {
        return false;
      }
    }
  }
};

/**
 * Free space: remove the N oldest rooms by last message time.
 * Guard: keep at least one room to avoid wiping the list entirely.
 */
export function trimOldestChatRooms(maxToRemove: number): void {
  if (maxToRemove <= 0) return;
  const rooms = getAllChatRooms();
  const removeCount = Math.min(maxToRemove, Math.max(0, rooms.length - 1));
  if (removeCount === 0) return;
  const sorted = [...rooms].sort(
    (a, b) => new Date(a.lastMessageTime || 0).getTime() - new Date(b.lastMessageTime || 0).getTime()
  );
  const toRemoveIds = new Set(sorted.slice(0, removeCount).map((r) => r.id));
  const remaining = rooms.filter((r) => !toRemoveIds.has(r.id));
  saveAllChatRooms(remaining);
}

/** Chat rooms I participate in (excludes rooms I left) */
export const getChatRooms = (): ChatRoom[] => {
  const userId = getCurrentUserId();
  return getAllChatRooms().filter(
    (r) =>
      (r.buyerId === userId || r.sellerId === userId) &&
      !(r.leftUserIds || []).includes(userId || '')
  );
};

/** Count of rooms with unread messages from the other party (chat tab badge) */
export const getUnreadChatCount = (): number => {
  const userId = getCurrentUserId();
  if (!userId) return 0;
  return getChatRooms().filter((room) => room.readStatus?.[userId] === false).length;
};

/** Get chat room by id */
export const getChatRoom = (roomId: string): ChatRoom | null => {
  return getAllChatRooms().find((r) => r.id === roomId) || null;
};

/** Number of chat rooms linked to a product */
export const getChatRoomCountByProductId = (productId: string): number => {
  return getAllChatRooms().filter((r) => r.product?.id === productId).length;
};

/** Find my chat room for a product (as buyer) */
export const getChatRoomByProduct = (productId: string): ChatRoom | null => {
  const userId = getCurrentUserId();
  return getAllChatRooms().find(
    (r) => r.product?.id === productId && r.buyerId === userId
  ) || null;
};

/** Other participant for current user */
export const getOtherUser = (room: ChatRoom) => {
  const userId = getCurrentUserId();
  if (room.buyerId === userId) {
    return room.sellerInfo || room.otherUser;
  }
  return room.buyerInfo || room.otherUser;
};

/** Active order for same product, buyer, seller (for chat binding) */
const findOrderForChat = (productId: string, buyerId: string, sellerId: string): Order | undefined => {
  const list = getOrders().filter(
    (o) =>
      o.product.id === productId &&
      o.buyer.id === buyerId &&
      o.seller.id === sellerId
  );
  const active = list.filter(
    (o) => o.status !== ORDER_STATUS_VALUE.COMPLETE && o.status !== ORDER_STATUS_VALUE.DISPUTE
  );
  const target = active.length > 0 ? active : list;
  target.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return target[0];
};

/** Create or return existing room; attach in-progress order if any */
export const createOrGetChatRoom = (product: Product): ChatRoom => {
  const existing = getChatRoomByProduct(product.id);
  if (existing) {
    const userId = getCurrentUserId();
    let room: ChatRoom = existing;
    let rejoinedAfterLeave = false;

    // User previously left this room; opening Chat again should rejoin, not bounce via ChatRoom redirect
    if (userId && (existing.leftUserIds || []).includes(userId)) {
      const rooms = getAllChatRooms();
      const idx = rooms.findIndex((r) => r.id === existing.id);
      if (idx >= 0) {
        const leftUserIds = (existing.leftUserIds || []).filter((id) => id !== userId);
        room = { ...existing, leftUserIds };
        rooms[idx] = room;
        saveAllChatRooms(rooms, existing.id);
        void syncChatRoomToDB(room);
        rejoinedAfterLeave = true;
      }
    }

    if (!room.order && room.buyerId && room.sellerId) {
      const order = findOrderForChat(product.id, room.buyerId, room.sellerId);
      if (order) {
        room = { ...room, order };
        const rooms = getAllChatRooms();
        const idx = rooms.findIndex((r) => r.id === room.id);
        if (idx >= 0) {
          rooms[idx] = room;
          saveAllChatRooms(rooms, room.id);
        }
      }
    }

    // Seller (or other device) may have no local room row; room_updated alone does nothing then — broadcast full room
    if (rejoinedAfterLeave) {
      notifyNewRoom(room);
    }
    return room;
  }

  const myUser = getMyUser();
  const region = getRegion() || product.region || '';

  const orderForRoom = findOrderForChat(product.id, myUser.id, product.seller.id);

  const room: ChatRoom = {
    id: `chat_${Date.now()}`,
    buyerId: myUser.id,
    sellerId: product.seller.id,
    buyerInfo: myUser,
    sellerInfo: product.seller,
    otherUser: product.seller,
    product: { ...product, region: region || product.region },
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 0,
    isRead: true,
    messages: [],
    readStatus: { [myUser.id]: true, [product.seller.id]: false },
    ...(orderForRoom && { order: orderForRoom }),
  };

  const rooms = getAllChatRooms();
  rooms.unshift(room);
  saveAllChatRooms(rooms, room.id);
  syncChatRoomToDB(room);
  notifyNewRoom(room);

  addNotification({
    targetUserId: product.seller.id,
    type: 'chat',
    title: NOTIFY_NEW_CHAT,
    content: `${myUser.nickname} started a chat about "${product.title}".`,
    link: `/chat/${room.id}`,
  });

  return room;
};

/** Append message; returns whether save succeeded */
export const addMessage = (roomId: string, message: ChatMessage): boolean => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) {
    return false;
  }

  if (!room.messages) room.messages = [];
  room.messages.push(message);
  room.lastMessage = message.images && message.images.length > 0
    ? (message.content || CHAT_LASTMSG_PHOTO)
    : message.content;
  room.lastMessageTime = message.timestamp;

  // Mark others unread
  const senderId = message.senderId;
  if (!room.readStatus) room.readStatus = {};
  const otherIds = [room.buyerId, room.sellerId].filter((id) => id !== senderId);
  otherIds.forEach((otherId) => {
    if (otherId) room.readStatus![otherId] = false;
  });
  room.readStatus[senderId] = true;

  const saveResult = saveAllChatRooms(rooms, roomId);
  syncMessageToDB(roomId, message);
  sendMessageViaSocket(roomId, message, { buyerId: room.buyerId || '', sellerId: room.sellerId || '' });
  return saveResult;
};

/** Mark room read for current user */
export const markAsRead = (roomId: string) => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  const userId = getCurrentUserId();
  if (!room.readStatus) room.readStatus = {};
  if (!room.lastReadAt) room.lastReadAt = {};
  if (userId) {
    room.readStatus[userId] = true;
    room.lastReadAt[userId] = new Date().toISOString();
  }
  room.isRead = true;
  room.unreadCount = 0;

  saveAllChatRooms(rooms, roomId);
};

/** 상대방이 채팅방을 읽었음을 로컬에 반영 */
export const markAsReadByOther = (roomId: string, otherUserId: string) => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;
  if (!room.readStatus) room.readStatus = {};
  if (!room.lastReadAt) room.lastReadAt = {};
  room.readStatus[otherUserId] = true;
  room.lastReadAt[otherUserId] = new Date().toISOString();
  saveAllChatRooms(rooms, roomId);
};

/** Messages for a room */
export const getMessages = (roomId: string): ChatMessage[] => {
  const room = getChatRoom(roomId);
  return room?.messages || [];
};

/** Find room by order parties and product */
export const getChatRoomByOrder = (order: Order): ChatRoom | null => {
  return getAllChatRooms().find(
    (r) =>
      r.product?.id === order.product.id &&
      r.buyerId === order.buyer.id &&
      r.sellerId === order.seller.id
  ) || null;
};

/** Ensure room for order; create if missing. Optional creator marks other party unread + notification */
export const ensureChatRoomForOrder = (order: Order, createdByUserId?: string): ChatRoom => {
  const existing = getChatRoomByOrder(order);
  if (existing) {
    existing.order = order;
    const rooms = getAllChatRooms();
    const idx = rooms.findIndex((r) => r.id === existing.id);
    if (idx >= 0) {
      rooms[idx] = { ...existing, order };
      saveAllChatRooms(rooms, existing.id);
    }
    return { ...existing, order };
  }

  const region = getRegion() || order.product.region || '';
  const otherUserId = createdByUserId
    ? (createdByUserId === order.buyer.id ? order.seller.id : order.buyer.id)
    : null;
  const readStatus: Record<string, boolean> = {
    [order.buyer.id]: true,
    [order.seller.id]: true,
  };
  if (otherUserId) readStatus[otherUserId] = false;

  const room: ChatRoom = {
    id: `chat_${Date.now()}`,
    buyerId: order.buyer.id,
    sellerId: order.seller.id,
    buyerInfo: order.buyer,
    sellerInfo: order.seller,
    otherUser: order.seller,
    product: { ...order.product, region: region || order.product.region },
    order,
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 0,
    isRead: true,
    messages: [],
    readStatus,
  };

  const rooms = getAllChatRooms();
  rooms.unshift(room);
  saveAllChatRooms(rooms, room.id);

  if (otherUserId) {
    addNotification({
      targetUserId: otherUserId,
      type: 'chat',
      title: NOTIFY_CHAT_ROOM_CREATED,
      content: `A chat was opened for "${order.product.title}".`,
      link: `/chat/${room.id}`,
    });
  }
  return room;
};

/** Meetup confirmed: add gradient card; persist room.order so receive flow works */
export const addMeetupConfirmedToChat = (order: Order) => {
  if (!order.meetupPlace || !order.meetupDate || !order.meetupTime) return;
  const room = ensureChatRoomForOrder(order);
  const rooms = getAllChatRooms();
  const r = rooms.find((x) => x.id === room.id);
  if (r) {
    r.order = order;
    saveAllChatRooms(rooms, room.id);
  }
  const msg: ChatMessage = {
    id: `meetup_${Date.now()}`,
    senderId: order.seller.id,
    content: CHAT_MSG_PRODUCT_RESERVED,
    timestamp: new Date().toISOString(),
    type: 'meetup_confirmed',
    meetupPlace: order.meetupPlace,
    meetupDate: order.meetupDate,
    meetupTime: order.meetupTime,
  };
  addMessage(room.id, msg);
};

/** Meetup updated: gradient message + refresh room.order */
export const addMeetupUpdatedToChat = (order: Order) => {
  if (!order.meetupPlace || !order.meetupDate || !order.meetupTime) return;
  const rooms = getAllChatRooms();
  const room = rooms.find(
    (r) =>
      r.product?.id === order.product.id &&
      r.buyerId === order.buyer.id &&
      r.sellerId === order.seller.id
  );
  if (!room) return;
  room.order = order;
  saveAllChatRooms(rooms, room.id);
  const msg: ChatMessage = {
    id: `meetup_updated_${Date.now()}`,
    senderId: order.seller.id,
    content: CHAT_MSG_MEETUP_UPDATED,
    timestamp: new Date().toISOString(),
    type: 'meetup_confirmed',
    meetupPlace: order.meetupPlace,
    meetupDate: order.meetupDate,
    meetupTime: order.meetupTime,
  };
  addMessage(room.id, msg);
};

/** Meetup canceled: notification only (no chat system message) */
export const addMeetupCancelledToChat = (_order: Order) => {
  // 채팅창에 이벤트 시스템 메시지 제거 - 알림 센터에서만 표시
};

/** Seller started meetup from chat: gradient card + buyer unread badge */
export const addSellerMeetupStartedToChat = (order: Order, roomIdHint?: string) => {
  const rooms = getAllChatRooms();
  let room =
    (roomIdHint ? rooms.find((r) => r.id === roomIdHint) : undefined) ||
    rooms.find(
      (r) =>
        r.product?.id === order.product.id &&
        r.buyerId === order.buyer.id &&
        r.sellerId === order.seller.id
    ) ||
    null;
  if (!room) {
    room = ensureChatRoomForOrder(order);
  }
  const msg: ChatMessage = {
    id: `seller_meetup_${Date.now()}`,
    senderId: order.seller.id,
    content: CHAT_MSG_SELLER_MEETUP_STARTED,
    timestamp: new Date().toISOString(),
    type: 'meetup_confirmed',
  };
  if (!room.messages) room.messages = [];
  room.messages.push(msg);
  room.lastMessage = msg.content;
  room.lastMessageTime = msg.timestamp;
  if (!room.readStatus) room.readStatus = {};
  room.readStatus[order.buyer.id] = false;
  room.readStatus[order.seller.id] = true;
  room.order = order;
  saveAllChatRooms(rooms, room.id);
};

/** Trade completed: notification only (no chat system message) */
export const addTradeCompletedToChat = (order: Order) => { const room = ensureChatRoomForOrder(order); addMessage(room.id, { id: `tradedone_${Date.now()}`, senderId: "system", content: "Trade completed successfully.", timestamp: new Date().toISOString(), type: "system" }); return;
  // 채팅창에 이벤트 시스템 메시지 제거 - 알림 센터에서만 표시
};

/** Receipt confirmed: notification only (no chat system message) */
export const addReceiptConfirmedToChat = (order: Order) => { const room = ensureChatRoomForOrder(order); addMessage(room.id, { id: `receipt_${Date.now()}`, senderId: "system", content: `${order.buyer?.nickname || "Buyer"} confirmed receipt.`, timestamp: new Date().toISOString(), type: "system" }); return;
  // 채팅창에 이벤트 시스템 메시지 제거 - 알림 센터에서만 표시
};

/** Review written: notification only (no chat system message) */
export const addReviewToChat = (order: Order, reviewerNickname: string) => { const room = ensureChatRoomForOrder(order); addMessage(room.id, { id: `review_${Date.now()}`, senderId: "system", content: `${reviewerNickname} wrote a review.`, timestamp: new Date().toISOString(), type: "system" }); return;
  // 채팅창에 이벤트 시스템 메시지 제거 - 알림 센터에서만 표시
};

/** Buyer price/share offer card (create room if needed); free share uses share copy */
export const addPriceOfferToChat = (order: Order) => {
  const room = ensureChatRoomForOrder(order, order.buyer.id);
  const originalPrice = order.product?.price ?? 0;
  const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
  const msg: ChatMessage = {
    id: `offer_${Date.now()}`,
    senderId: order.buyer.id,
    content: isShare ? CHAT_MSG_BUYER_SHARE_REQUEST : CHAT_MSG_BUYER_PRICE_OFFER,
    timestamp: new Date().toISOString(),
    type: 'price_offer',
    orderId: order.id,
    originalPrice,
    proposedPrice: order.proposedPrice,
  };
  addMessage(room.id, msg);
};

/** Price offer accept/reject result (different copy for free share) */
export const addPriceOfferResultToChat = (order: Order, result: 'accepted' | 'rejected') => {
  const room = getChatRoomByOrder(order);
  if (!room) return;
  const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
  const content =
    result === 'accepted'
      ? isShare
        ? CHAT_MSG_ACCEPT_SHARE
        : chatMsgAcceptOffer(order.proposedPrice.toLocaleString())
      : isShare
        ? CHAT_MSG_REJECT_SHARE
        : chatMsgRejectOffer(order.proposedPrice.toLocaleString());
  // Seller always accepts/rejects; sender is seller
  const rejecterOrAccepterId = room.sellerId ?? order.seller?.id;
  const msg: ChatMessage = {
    id: `offer_result_${Date.now()}`,
    senderId: rejecterOrAccepterId ?? '',
    content,
    timestamp: new Date().toISOString(),
    type: 'price_offer_result',
    proposedPrice: order.proposedPrice,
    offerResult: result,
  };
  addMessage(room.id, msg);
};

/** Detach order from rooms when order deleted */
export const clearOrderFromRoom = (orderId: string) => {
  const rooms = getAllChatRooms();
  const updated = rooms.map((r) =>
    r.order?.id === orderId ? { ...r, order: undefined } : r
  );
  if (updated.some((r, i) => r !== rooms[i])) saveAllChatRooms(updated);
};

/** Leave room: system message, hide only for current user */
export const leaveChatRoom = (roomId: string): boolean => {
  const allRooms = getAllChatRooms();
  const room = allRooms.find((r) => r.id === roomId);
  if (!room) return false;

  const userId = getCurrentUserId();
  const myUser = getMyUser();
  const nickname = myUser?.nickname ?? CHAT_FALLBACK_NICKNAME;

  const msg: ChatMessage = {
    id: `left_${Date.now()}`,
    senderId: userId || '',
    content: chatMsgUserLeft(nickname),
    timestamp: new Date().toISOString(),
    type: 'system',
  };
  addMessage(roomId, msg);

  const leftUserIds = [...(room.leftUserIds || []), userId].filter((id): id is string => id != null);
  const roomsAfterMessage = getAllChatRooms();
  const idx = roomsAfterMessage.findIndex((r) => r.id === roomId);
  if (idx >= 0) {
    roomsAfterMessage[idx] = { ...roomsAfterMessage[idx], leftUserIds };
    return saveAllChatRooms(roomsAfterMessage, roomId);
  }
  return false;
};

/** Delete room entirely for both parties */
export const deleteChatRoom = (roomId: string) => {
  const rooms = getAllChatRooms().filter((r) => r.id !== roomId);
  saveAllChatRooms(rooms);
};
