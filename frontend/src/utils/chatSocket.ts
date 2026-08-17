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
/**
 * 상대방에게 보낼 채널을 재사용한다.
 * 이벤트마다 채널을 새로 열고 닫으면 사용자가 늘어날 때 Realtime 접속 제한에 먼저 걸린다.
 */
type OutboundMessage = { event: string; payload: Record<string, unknown> };
type OutboundChannel = {
  channel: RealtimeChannel;
  subscribed: boolean;
  pending: OutboundMessage[];
  lastUsedAt: number;
};

const outboundChannels = new Map<string, OutboundChannel>();
const OUTBOUND_IDLE_MS = 60000;
let outboundSweepTimer: ReturnType<typeof setInterval> | null = null;

function closeOutboundChannel(targetUserId: string): void {
  const entry = outboundChannels.get(targetUserId);
  if (!entry) return;
  supabase.removeChannel(entry.channel);
  outboundChannels.delete(targetUserId);
  if (outboundChannels.size === 0 && outboundSweepTimer) {
    clearInterval(outboundSweepTimer);
    outboundSweepTimer = null;
  }
}

function startOutboundSweep(): void {
  if (outboundSweepTimer) return;
  outboundSweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of outboundChannels) {
      if (now - entry.lastUsedAt > OUTBOUND_IDLE_MS) closeOutboundChannel(userId);
    }
  }, OUTBOUND_IDLE_MS);
}

function broadcastToUser(targetUserId: string, event: string, payload: Record<string, unknown>): void {
  const existing = outboundChannels.get(targetUserId);
  if (existing) {
    existing.lastUsedAt = Date.now();
    if (existing.subscribed) {
      void existing.channel.send({ type: 'broadcast', event, payload });
    } else {
      existing.pending.push({ event, payload });
    }
    return;
  }

  const channel = supabase.channel(`user:${targetUserId}`, {
    config: { broadcast: { self: false } },
  });
  const entry: OutboundChannel = {
    channel,
    subscribed: false,
    pending: [{ event, payload }],
    lastUsedAt: Date.now(),
  };
  outboundChannels.set(targetUserId, entry);
  startOutboundSweep();

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      entry.subscribed = true;
      const queued = entry.pending.splice(0);
      for (const msg of queued) {
        void channel.send({ type: 'broadcast', event: msg.event, payload: msg.payload });
      }
      return;
    }
    if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      // 다음 전송에서 새 채널로 다시 시도한다.
      closeOutboundChannel(targetUserId);
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
  for (const userId of [...outboundChannels.keys()]) closeOutboundChannel(userId);
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
  const senderId = getCurrentUserId() || '';
  const message = {
    type: 'broadcast' as const,
    event: 'product_change',
    payload: { action, productId, senderId },
  };
  if (feedChannel) {
    feedChannel.send(message);
    return;
  }

  const temporaryChannel = supabase.channel('products_feed');
  temporaryChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      temporaryChannel.send(message).finally(() => {
        setTimeout(() => supabase.removeChannel(temporaryChannel), 500);
      });
    }
  });
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
