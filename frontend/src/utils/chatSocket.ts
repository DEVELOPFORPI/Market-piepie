import { supabase } from '@/utils/supabaseClient';
import { getCurrentUserId } from '@/utils/authStorage';
import { ChatMessage, ChatRoom } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Generic event emitter ──────────────────────────────────
type Handler<T> = (data: T) => void;

function createEmitter<T>() {
  const handlers = new Set<Handler<T>>();
  return {
    on(h: Handler<T>): () => void {
      handlers.add(h);
      return () => { handlers.delete(h); };
    },
    emit(data: T): void {
      handlers.forEach((h) => h(data));
    },
  };
}

// ─── Event payload types ────────────────────────────────────
type MessageEvent = { roomId: string; message: ChatMessage };
type RoomUpdateEvent = { roomId: string; lastMessage: string; lastMessageTime: string; senderId: string };
type NewRoomEvent = { room: ChatRoom };
type TypingEvent = { userId: string; roomId: string };
type ReadReceiptEvent = { userId: string; roomId: string };
type OrderUpdateEvent = { orderId: string; order: unknown };
type ProductFeedEvent = { action: string; productId: string; senderId: string };

// ─── Emitters ───────────────────────────────────────────────
const messageEmitter = createEmitter<MessageEvent>();
const roomUpdateEmitter = createEmitter<RoomUpdateEvent>();
const newRoomEmitter = createEmitter<NewRoomEvent>();
const typingEmitter = createEmitter<TypingEvent>();
const readReceiptEmitter = createEmitter<ReadReceiptEvent>();
const orderUpdateEmitter = createEmitter<OrderUpdateEvent>();
const productFeedEmitter = createEmitter<ProductFeedEvent>();
const notificationEmitter = createEmitter<void>();

// ─── Channel state ──────────────────────────────────────────
let userChannel: RealtimeChannel | null = null;
let feedChannel: RealtimeChannel | null = null;
const roomChannels = new Map<string, RealtimeChannel>();
let currentUserId: string | null = null;

// ─── Helpers ────────────────────────────────────────────────
function broadcastToUser(targetUserId: string, event: string, payload: Record<string, unknown>): void {
  const ch = supabase.channel(`user:${targetUserId}`, {
    config: { broadcast: { self: false } },
  });
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ch.send({ type: 'broadcast', event, payload }).finally(() => {
        setTimeout(() => supabase.removeChannel(ch), 500);
      });
    }
  });
}

// ─── Connection lifecycle ───────────────────────────────────
export function connectChatSocket(): void {
  const userId = getCurrentUserId();
  if (!userId) return;
  if (userChannel && currentUserId === userId) return;

  disconnectChatSocket();
  currentUserId = userId;

  userChannel = supabase
    .channel(`user:${userId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'room_updated' }, ({ payload }) => roomUpdateEmitter.emit(payload as RoomUpdateEvent))
    .on('broadcast', { event: 'new_room' }, ({ payload }) => newRoomEmitter.emit(payload as NewRoomEvent))
    .on('broadcast', { event: 'order_updated' }, ({ payload }) => orderUpdateEmitter.emit(payload as OrderUpdateEvent))
    .on('broadcast', { event: 'notification' }, () => notificationEmitter.emit())
    .subscribe();

  feedChannel = supabase
    .channel('products_feed', { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'product_change' }, ({ payload }) => productFeedEmitter.emit(payload as ProductFeedEvent))
    .subscribe();
}

export function disconnectChatSocket(): void {
  roomChannels.forEach((ch) => supabase.removeChannel(ch));
  roomChannels.clear();
  if (userChannel) {
    supabase.removeChannel(userChannel);
    userChannel = null;
  }
  if (feedChannel) {
    supabase.removeChannel(feedChannel);
    feedChannel = null;
  }
  currentUserId = null;
}

// ─── Per-room channel ───────────────────────────────────────
export function joinRoom(roomId: string): void {
  if (roomChannels.has(roomId)) return;

  const ch = supabase
    .channel(`room:${roomId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'new_message' }, ({ payload }) => messageEmitter.emit(payload as MessageEvent))
    .on('broadcast', { event: 'typing' }, ({ payload }) => typingEmitter.emit(payload as TypingEvent))
    .on('broadcast', { event: 'read_receipt' }, ({ payload }) => readReceiptEmitter.emit(payload as ReadReceiptEvent))
    .subscribe();

  roomChannels.set(roomId, ch);
}

export function leaveRoom(roomId: string): void {
  const ch = roomChannels.get(roomId);
  if (ch) {
    supabase.removeChannel(ch);
    roomChannels.delete(roomId);
  }
}

// ─── Senders ────────────────────────────────────────────────
export function sendMessageViaSocket(
  roomId: string,
  message: ChatMessage,
  room: { buyerId: string; sellerId: string },
): void {
  const ch = roomChannels.get(roomId);
  if (ch) {
    ch.send({ type: 'broadcast', event: 'new_message', payload: { roomId, message } });
  }

  const participantIds = [room.buyerId, room.sellerId].filter((id): id is string => !!id);
  participantIds.forEach((uid) => {
    if (uid !== message.senderId) {
      broadcastToUser(uid, 'room_updated', {
        roomId,
        lastMessage: message.content,
        lastMessageTime: message.timestamp,
        senderId: message.senderId,
      });
    }
  });
}

export function notifyNewRoom(room: ChatRoom): void {
  const senderId = getCurrentUserId();
  const participantIds = [room.buyerId, room.sellerId].filter((id): id is string => !!id);
  participantIds.forEach((uid) => {
    if (uid !== senderId) {
      broadcastToUser(uid, 'new_room', { room });
    }
  });
}

export function emitReadReceipt(roomId: string): void {
  const userId = getCurrentUserId();
  const ch = roomChannels.get(roomId);
  if (userId && ch) {
    ch.send({ type: 'broadcast', event: 'read_receipt', payload: { userId, roomId } });
  }
}

export function emitTyping(roomId: string): void {
  const userId = getCurrentUserId();
  const ch = roomChannels.get(roomId);
  if (userId && ch) {
    ch.send({ type: 'broadcast', event: 'typing', payload: { userId, roomId } });
  }
}

export function broadcastOrderUpdate(targetUserId: string, orderId: string, order: unknown): void {
  broadcastToUser(targetUserId, 'order_updated', { orderId, order });
}

export function broadcastProductChange(action: string, productId: string): void {
  if (!feedChannel) return;
  const senderId = getCurrentUserId() || '';
  feedChannel.send({ type: 'broadcast', event: 'product_change', payload: { action, productId, senderId } });
}

export function broadcastNotification(targetUserId: string): void {
  broadcastToUser(targetUserId, 'notification', {});
}

// ─── Subscriptions ──────────────────────────────────────────
export const onNewMessage = messageEmitter.on;
export const onRoomUpdated = roomUpdateEmitter.on;
export const onNewRoom = newRoomEmitter.on;
export const onTyping = typingEmitter.on;
export const onReadReceipt = readReceiptEmitter.on;
export const onOrderUpdated = orderUpdateEmitter.on;
export const onProductFeedChange = productFeedEmitter.on;
export const onNotification = (handler: () => void): (() => void) => notificationEmitter.on(handler);
