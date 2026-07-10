import { ChatRoom, ChatMessage, Product, Order, ORDER_STATUS_VALUE, PRODUCT_STATUS_VALUE } from '@/types';
import { syncChatRoomToDB, syncMessageToDB, syncChatRoomMetaToDB } from '@/utils/dbSync';
import { sendMessageViaSocket, notifyNewRoom } from '@/utils/chatSocket';
import {
  CHAT_FALLBACK_NICKNAME,
  CHAT_LASTMSG_PHOTO,
  CHAT_MSG_ACCEPT_SHARE,
  CHAT_MSG_BUYER_PRICE_OFFER,
  CHAT_MSG_BUYER_SHARE_REQUEST,
  CHAT_MSG_MEETUP_UPDATED,
  CHAT_MSG_MEETUP_CANCELED,
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
import { getOrderById, getOrders, cancelOrderMeetup } from '@/utils/orderStorage';
import { getProductById, updateProductStatus } from '@/utils/productStorage';
import { getItem, setItem } from '@/utils/heavyStorage';

/** Shared storage: all chat rooms */
const CHATROOMS_KEY = 'all_chatrooms';

/**
 * 새 방의 DB 저장이 끝나기 전에 메시지 POST가 나가면 FK 오류로 유실된다.
 * 방 생성 → DB 저장 promise를 기억해 두고, 첫 메시지는 이걸 기다린 후 전송.
 */
const pendingRoomSyncs = new Map<string, Promise<boolean>>();

const trackRoomSync = (room: ChatRoom): Promise<boolean> => {
  const existing = pendingRoomSyncs.get(room.id);
  if (existing) return existing;

  const p = syncChatRoomToDB(room).finally(() => pendingRoomSyncs.delete(room.id));
  pendingRoomSyncs.set(room.id, p);
  return p;
};

/** WebSocket에서 받은 메시지를 로컬에 추가 (중복 방지) */
export const addRemoteMessage = (roomId: string, message: ChatMessage): void => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room || isChatRoomEnded(room)) return;
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

/** Chat rooms I participate in (hides rooms I left; ended rooms stay for the other party) */
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
  return getChatRooms().filter(
    (room) => !isChatRoomEnded(room) && room.readStatus?.[userId] === false,
  ).length;
};

/** Get chat room by id */
export const getChatRoom = (roomId: string): ChatRoom | null => {
  return getAllChatRooms().find((r) => r.id === roomId) || null;
};

/** Number of chat rooms linked to a product */
export const getChatRoomCountByProductId = (productId: string): number => {
  return getAllChatRooms().filter((r) => r.product?.id === productId).length;
};

/** Find my reusable chat room for a product (as buyer); skip ended rooms */
export const getChatRoomByProduct = (productId: string): ChatRoom | null => {
  const userId = getCurrentUserId();
  return getAllChatRooms().find(
    (r) =>
      r.product?.id === productId &&
      r.buyerId === userId &&
      !(r.leftUserIds || []).length
  ) || null;
};

/** Resolve live order row for a room (prefer storage over stale room.order snapshot) */
const getRoomLinkedOrder = (room: ChatRoom): Order | undefined => {
  if (room.order?.id) {
    return getOrderById(room.order.id) || room.order;
  }
  return room.order;
};

/** Room whose linked trade is finished (complete / dispute / mutual complete flags) */
const isCompletedChatRoom = (room: ChatRoom): boolean => {
  const order = getRoomLinkedOrder(room);
  if (!order) return false;
  if (order.status === ORDER_STATUS_VALUE.COMPLETE || order.status === ORDER_STATUS_VALUE.DISPUTE) {
    return true;
  }
  return !!(order.buyerCompleted && order.sellerCompleted);
};

/** Anyone left → room is closed for both parties */
export const isChatRoomEnded = (room: ChatRoom | null | undefined): boolean => {
  return !!room && (room.leftUserIds || []).length > 0;
};

const isListingForSale = (product: Product): boolean => {
  const latest = getProductById(product.id) || product;
  return latest.status === PRODUCT_STATUS_VALUE.FOR_SALE;
};

/** Other participant for current user */
export const getOtherUser = (room: ChatRoom) => {
  const userId = getCurrentUserId();
  const otherId = userId === room.buyerId ? room.sellerId : room.buyerId;
  if (otherId && room.otherUser?.id === otherId && room.otherUser.nickname) {
    return room.otherUser;
  }
  if (room.buyerId === userId) {
    return room.sellerInfo || room.otherUser;
  }
  return room.buyerInfo || room.otherUser;
};

/**
 * In-progress order for an existing open chat only.
 * Brand-new rooms after leave start without the old trade attached.
 */
const findOrderForChat = (productId: string, buyerId: string, sellerId: string): Order | undefined => {
  const active = getOrders().filter(
    (o) =>
      o.product.id === productId &&
      o.buyer.id === buyerId &&
      o.seller.id === sellerId &&
      o.status !== ORDER_STATUS_VALUE.COMPLETE &&
      o.status !== ORDER_STATUS_VALUE.DISPUTE &&
      !(o.buyerCompleted && o.sellerCompleted)
  );
  if (active.length === 0) return undefined;
  active.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return active[0];
};

/** Create or return existing room; never reuse ended or completed-for-sale rooms */
export const createOrGetChatRoom = async (product: Product): Promise<ChatRoom> => {
  const existing = getChatRoomByProduct(product.id);
  // Listing reopened for sale: past completed chat must not be reused (Chat / Offer / share)
  const shouldReuseExisting =
    !!existing &&
    !isChatRoomEnded(existing) &&
    !(isListingForSale(product) && isCompletedChatRoom(existing));

  if (shouldReuseExisting && existing) {
    let room: ChatRoom = existing;

    if (!room.order && room.buyerId && room.sellerId) {
      const order = findOrderForChat(product.id, room.buyerId, room.sellerId);
      if (order) {
        room = { ...room, order };
        const rooms = getAllChatRooms();
        const idx = rooms.findIndex((r) => r.id === room.id);
        if (idx >= 0) {
          rooms[idx] = room;
          saveAllChatRooms(rooms, room.id);
          persistRoomOrderLink(room.id, order);
        }
      }
    }

    return room;
  }

  const myUser = getMyUser();
  const region = getRegion() || product.region || '';

  // New room after leave / completed trade: start clean (no old order)
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
  };

  const rooms = getAllChatRooms();
  rooms.unshift(room);
  saveAllChatRooms(rooms, room.id);
  await trackRoomSync(room);
  notifyNewRoom(room);

  void addNotification({
    targetUserId: product.seller.id,
    type: 'chat',
    title: NOTIFY_NEW_CHAT,
    content: `${myUser.nickname} started a chat about "${product.title}".`,
    link: `/chat/${room.id}`,
  });

  return room;
};

/** Append message — DB 저장 성공 후 로컬 캐시 갱신 */
export const addMessage = async (roomId: string, message: ChatMessage): Promise<boolean> => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) {
    return false;
  }
  if (isChatRoomEnded(room)) {
    return false;
  }

  const pendingRoom = pendingRoomSyncs.get(roomId);
  if (pendingRoom) {
    const roomOk = await pendingRoom;
    if (!roomOk) return false;
  }

  const dbOk = await syncMessageToDB(roomId, message);
  if (!dbOk) return false;

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
  const readPatch: Record<string, { read?: boolean; lastReadAt?: string }> = {};
  if (senderId) {
    readPatch[senderId] = { read: true, lastReadAt: room.lastReadAt?.[senderId] || message.timestamp };
  }
  otherIds.forEach((otherId) => {
    if (otherId) readPatch[otherId] = { read: false };
  });
  if (Object.keys(readPatch).length) {
    void syncChatRoomMetaToDB(roomId, { read_state: readPatch });
  }
  sendMessageViaSocket(roomId, message, { buyerId: room.buyerId || '', sellerId: room.sellerId || '' });
  return saveResult;
};

/** Mark room read through a specific message timestamp (partial or full read) */
export const markAsReadUpTo = (roomId: string, readThroughTimestamp: string): boolean => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return false;

  const userId = getCurrentUserId();
  if (!userId) return false;

  if (!room.readStatus) room.readStatus = {};
  if (!room.lastReadAt) room.lastReadAt = {};

  const prev = room.lastReadAt[userId] || '';
  if (readThroughTimestamp <= prev) return false;

  room.lastReadAt[userId] = readThroughTimestamp;
  const messages = room.messages || [];
  const hasUnread = messages.some((m) => m.timestamp > readThroughTimestamp);
  room.readStatus[userId] = !hasUnread;
  room.isRead = !hasUnread;
  room.unreadCount = hasUnread ? Math.max(room.unreadCount || 0, 1) : 0;

  saveAllChatRooms(rooms, roomId);
  void syncChatRoomMetaToDB(roomId, {
    read_state: {
      [userId]: { read: !hasUnread, lastReadAt: room.lastReadAt[userId] },
    },
  });
  return true;
};

/** Mark room read for current user */
export const markAsRead = (roomId: string) => {
  const rooms = getAllChatRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  const userId = getCurrentUserId();
  if (!room.readStatus) room.readStatus = {};
  if (!room.lastReadAt) room.lastReadAt = {};
  const messages = room.messages || [];
  const lastTs = messages.length ? messages[messages.length - 1].timestamp : new Date().toISOString();
  if (userId) {
    room.readStatus[userId] = true;
    room.lastReadAt[userId] = lastTs;
  }
  room.isRead = true;
  room.unreadCount = 0;

  saveAllChatRooms(rooms, roomId);
  if (userId) {
    void syncChatRoomMetaToDB(roomId, {
      read_state: {
        [userId]: { read: true, lastReadAt: room.lastReadAt[userId] },
      },
    });
  }
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
  void syncChatRoomMetaToDB(roomId, {
    read_state: {
      [otherUserId]: { read: true, lastReadAt: room.lastReadAt[otherUserId] },
    },
  });
};

/** Messages for a room */
export const getMessages = (roomId: string): ChatMessage[] => {
  const room = getChatRoom(roomId);
  return room?.messages || [];
};

/** Find room for this order (exact order id first; never attach a new trade onto a completed/ended chat) */
export const getChatRoomByOrder = (order: Order): ChatRoom | null => {
  const rooms = getAllChatRooms();
  const byOrderId = rooms.find((r) => r.order?.id === order.id && !isChatRoomEnded(r));
  if (byOrderId) return byOrderId;

  const samePair = rooms.filter(
    (r) =>
      r.product?.id === order.product.id &&
      r.buyerId === order.buyer.id &&
      r.sellerId === order.seller.id &&
      !isChatRoomEnded(r)
  );
  if (samePair.length === 0) return null;

  const orderIsTerminal =
    order.status === ORDER_STATUS_VALUE.COMPLETE ||
    order.status === ORDER_STATUS_VALUE.DISPUTE ||
    !!(order.buyerCompleted && order.sellerCompleted);

  if (orderIsTerminal) {
    return samePair.find((r) => isCompletedChatRoom(r)) || samePair[0];
  }

  // New / in-progress order: reuse only a non-completed open room for this pair
  return samePair.find((r) => !isCompletedChatRoom(r)) || null;
};

/** Ensure room for order; create if missing. Optional creator marks other party unread + notification */
export const ensureChatRoomForOrder = async (order: Order, createdByUserId?: string): Promise<ChatRoom> => {
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
  await trackRoomSync(room);
  notifyNewRoom(room);

  if (otherUserId) {
    void addNotification({
      targetUserId: otherUserId,
      type: 'chat',
      title: NOTIFY_CHAT_ROOM_CREATED,
      content: `A chat was opened for "${order.product.title}".`,
      link: `/chat/${room.id}`,
    });
  }
  return room;
};

const persistRoomOrderLink = (roomId: string, order?: Order) => {
  if (order?.id) {
    void syncChatRoomMetaToDB(roomId, { order_id: order.id });
  }
};

/** Meetup confirmed: add gradient card; persist room.order so receive flow works */
export const addMeetupConfirmedToChat = async (order: Order) => {
  if (!order.meetupPlace || !order.meetupDate || !order.meetupTime) return;
  const room = await ensureChatRoomForOrder(order);
  const rooms = getAllChatRooms();
  const r = rooms.find((x) => x.id === room.id);
  if (r) {
    r.order = order;
    saveAllChatRooms(rooms, room.id);
    persistRoomOrderLink(room.id, order);
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
  await addMessage(room.id, msg);
};

/** Meetup updated: gradient message + refresh room.order */
export const addMeetupUpdatedToChat = async (order: Order) => {
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
  persistRoomOrderLink(room.id, order);
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
  await addMessage(room.id, msg);
};

/** Meetup canceled: system message + clear linked order meetup on room */
export const addMeetupCancelledToChat = async (order: Order) => {
  const room = await ensureChatRoomForOrder(order);
  const rooms = getAllChatRooms();
  const r = rooms.find((x) => x.id === room.id);
  if (r) {
    r.order = {
      ...order,
      meetupPlace: undefined,
      meetupDate: undefined,
      meetupTime: undefined,
      meetupAccepted: false,
      status: ORDER_STATUS_VALUE.ACCEPTED,
    };
    saveAllChatRooms(rooms, room.id);
    persistRoomOrderLink(room.id, r.order);
  }
  const msg: ChatMessage = {
    id: `meetup_cancel_${Date.now()}`,
    senderId: getCurrentUserId() || order.seller.id,
    content: CHAT_MSG_MEETUP_CANCELED,
    timestamp: new Date().toISOString(),
    type: 'system',
  };
  await addMessage(room.id, msg);
};

/** Seller started meetup from chat: gradient card + buyer unread badge */
export const addSellerMeetupStartedToChat = async (order: Order, roomIdHint?: string) => {
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
    room = await ensureChatRoomForOrder(order);
  }
  const msg: ChatMessage = {
    id: `seller_meetup_${Date.now()}`,
    senderId: order.seller.id,
    content: CHAT_MSG_SELLER_MEETUP_STARTED,
    timestamp: new Date().toISOString(),
    type: 'meetup_confirmed',
  };
  await addMessage(room.id, msg);
  const roomsAfter = getAllChatRooms();
  const r = roomsAfter.find((x) => x.id === room!.id);
  if (r) {
    r.order = order;
    saveAllChatRooms(roomsAfter, room!.id);
    persistRoomOrderLink(room!.id, order);
  }
};

/** Trade completed: notification only (no chat system message) */
export const addTradeCompletedToChat = async (order: Order) => {
  const room = await ensureChatRoomForOrder(order);
  await addMessage(room.id, { id: `tradedone_${Date.now()}`, senderId: 'system', content: 'Trade completed successfully.', timestamp: new Date().toISOString(), type: 'system' });
  // 채팅창에 이벤트 시스템 메시지 제거 - 알림 센터에서만 표시
};

/** Receipt confirmed: notification only (no chat system message) */
export const addReceiptConfirmedToChat = async (order: Order) => {
  const room = await ensureChatRoomForOrder(order);
  await addMessage(room.id, { id: `receipt_${Date.now()}`, senderId: 'system', content: `${order.buyer?.nickname || 'Buyer'} confirmed receipt.`, timestamp: new Date().toISOString(), type: 'system' });
  // 채팅창에 이벤트 시스템 메시지 제거 - 알림 센터에서만 표시
};

/** Review written: notification only (no chat system message) */
export const addReviewToChat = async (order: Order, reviewerNickname: string) => {
  const room = await ensureChatRoomForOrder(order);
  await addMessage(room.id, { id: `review_${Date.now()}`, senderId: 'system', content: `${reviewerNickname} wrote a review.`, timestamp: new Date().toISOString(), type: 'system' });
  // 채팅창에 이벤트 시스템 메시지 제거 - 알림 센터에서만 표시
};

/** Buyer price/share offer card (create room if needed); free share uses share copy */
export const addPriceOfferToChat = async (order: Order) => {
  const room = await ensureChatRoomForOrder(order, order.buyer.id);
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
  await addMessage(room.id, msg);
};

/** Price offer accept/reject result (different copy for free share) */
export const addPriceOfferResultToChat = async (order: Order, result: 'accepted' | 'rejected') => {
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
  await addMessage(room.id, msg);
};

/** Detach order from rooms when order deleted */
export const clearOrderFromRoom = (orderId: string) => {
  const rooms = getAllChatRooms();
  const updated = rooms.map((r) =>
    r.order?.id === orderId ? { ...r, order: undefined } : r
  );
  if (updated.some((r, i) => r !== rooms[i])) saveAllChatRooms(updated);
};

/** Leave room: end for both parties, unlock listing, cancel meetup if needed */
export const leaveChatRoom = async (roomId: string): Promise<boolean> => {
  const allRooms = getAllChatRooms();
  const room = allRooms.find((r) => r.id === roomId);
  if (!room) return false;
  if (isChatRoomEnded(room)) return true;

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
  const messageSaved = await addMessage(roomId, msg);
  if (!messageSaved) return false;

  // Only the leaver is removed from their list; room stays for the other party (read-only / gray)
  const leftUserIds = Array.from(
    new Set(
      [...(room.leftUserIds || []), userId].filter((id): id is string => !!id),
    ),
  );

  const roomsAfterMessage = getAllChatRooms();
  const idx = roomsAfterMessage.findIndex((r) => r.id === roomId);
  if (idx < 0) return false;
  roomsAfterMessage[idx] = { ...roomsAfterMessage[idx], leftUserIds };
  const saved = saveAllChatRooms(roomsAfterMessage, roomId);
  void syncChatRoomMetaToDB(roomId, { left_user_ids: leftUserIds });

  // Unlock trade/listing: cancel meetup if set, set product back to for sale when reserved
  const linked = getRoomLinkedOrder(roomsAfterMessage[idx]);
  if (linked?.id) {
    const hasMeetup =
      linked.status === ORDER_STATUS_VALUE.MEETUP_SET ||
      !!(linked.meetupPlace && linked.meetupDate && linked.meetupTime);
    if (hasMeetup && linked.status !== ORDER_STATUS_VALUE.COMPLETE && linked.status !== ORDER_STATUS_VALUE.DISPUTE) {
      await cancelOrderMeetup(linked.id);
    } else {
      const productId = linked.product?.id || room.product?.id;
      if (productId) {
        const product = getProductById(productId);
        if (product?.status === PRODUCT_STATUS_VALUE.RESERVED) {
          void updateProductStatus(productId, PRODUCT_STATUS_VALUE.FOR_SALE);
        }
      }
    }
  } else if (room.product?.id) {
    const product = getProductById(room.product.id);
    if (product?.status === PRODUCT_STATUS_VALUE.RESERVED) {
      void updateProductStatus(room.product.id, PRODUCT_STATUS_VALUE.FOR_SALE);
    }
  }

  window.dispatchEvent(new Event('chatRoomsChanged'));
  return saved;
};

/** Delete room entirely for both parties */
export const deleteChatRoom = (roomId: string) => {
  const rooms = getAllChatRooms().filter((r) => r.id !== roomId);
  saveAllChatRooms(rooms);
};
