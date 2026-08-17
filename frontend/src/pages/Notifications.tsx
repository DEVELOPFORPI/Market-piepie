import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  removeNotifications,
  StoredNotification,
  NotificationType,
} from '@/utils/notificationStorage';
import { ORDER_STATUS_VALUE } from '@/types';
import { ensureOrderById, getOrders } from '@/utils/orderStorage';
import { getReviewByOrderId } from '@/utils/reviewStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { showToast } from '@/utils/toast';
import { getChatRoomByOrder, getChatRoomByProduct, getChatRooms } from '@/utils/chatStorage';
import { syncNotificationsFromDB, syncChatRoomsFromDB } from '@/utils/dbSync';
import {
  COMPLETION_TITLE_SET,
  isMeetupNotificationTitle,
  normalizeNotificationTitle,
  NOTIFY_MEETUP_CONFIRMED,
  NOTIFY_MEETUP_UPDATED,
  NOTIFY_MEETUP_CANCELED,
  NOTIFY_OFFER_ACCEPTED,
  NOTIFY_OFFER_DECLINED,
  NOTIFY_PURCHASE_OFFER_ARRIVED,
  NOTIFY_FREE_SHARE_REQUEST_ARRIVED,
  NOTIFY_RECEIVE_CONFIRM,
  NOTIFY_REVIEW_WRITTEN,
  NOTIFY_TRADE_COMPLETE_CHECK,
  NOTIFY_TRADE_COMPLETED,
} from '@/locale/enUI';
import { useLanguage } from '@/hooks/useLanguage';
import { notifyT } from '@/i18n/notifyMessages';
import { localizeNotification } from '@/utils/notifyDisplay';
import type { AppMessageKey } from '@/hooks/useLanguage';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';

const COMPLETION_TITLES = COMPLETION_TITLE_SET;
const RECEIVE_TITLES = new Set([NOTIFY_RECEIVE_CONFIRM]);
const REVIEW_TITLES = new Set([NOTIFY_REVIEW_WRITTEN]);
const ACCEPT_TITLES = new Set([NOTIFY_OFFER_ACCEPTED]);

const CHAT_DEST_TITLES = new Set([
  NOTIFY_PURCHASE_OFFER_ARRIVED,
  NOTIFY_FREE_SHARE_REQUEST_ARRIVED,
  NOTIFY_OFFER_ACCEPTED,
  NOTIFY_OFFER_DECLINED,
  NOTIFY_RECEIVE_CONFIRM,
  NOTIFY_TRADE_COMPLETE_CHECK,
  NOTIFY_TRADE_COMPLETED,
  NOTIFY_MEETUP_CONFIRMED,
  NOTIFY_MEETUP_UPDATED,
  NOTIFY_MEETUP_CANCELED,
]);

function orderIdFromLink(link: string): string | null {
  const orderMatch = link.match(/^\/order\/([^/?#]+)/);
  if (orderMatch) return orderMatch[1];
  const reviewMatch = link.match(/^\/review\/([^/?#]+)/);
  if (reviewMatch) return reviewMatch[1];
  try {
    const q = link.includes('?') ? new URLSearchParams(link.slice(link.indexOf('?') + 1)) : null;
    return q?.get('order') || null;
  } catch {
    return null;
  }
}

function productIdFromLink(link: string): string | null {
  const m = link.match(/^\/product\/([^/?#]+)/);
  return m?.[1] || null;
}

async function resolveChatRoomLink(link: string, content: string): Promise<string | null> {
  const uid = getCurrentUserId();
  if (uid) await syncChatRoomsFromDB(uid);

  const orderId = orderIdFromLink(link);
  if (orderId) {
    const order = await ensureOrderById(orderId);
    const room = order ? getChatRoomByOrder(order) : null;
    if (room?.id) return `/chat/${room.id}`;
  }

  const productId = productIdFromLink(link);
  if (productId) {
    const byProduct = getChatRoomByProduct(productId);
    if (byProduct?.id) return `/chat/${byProduct.id}`;
    const mine = getOrders().find(
      (o) => o.product?.id === productId && (o.buyer?.id === uid || o.seller?.id === uid),
    );
    const room = mine ? getChatRoomByOrder(mine) : null;
    if (room?.id) return `/chat/${room.id}`;
  }

  if (link === '/chat' || link === '/chat/') {
    const titleMatch = content.match(/"(.+?)"/);
    const productTitle = titleMatch?.[1];
    if (productTitle) {
      const room = getChatRooms().find((r) => r.product?.title === productTitle);
      if (room?.id) return `/chat/${room.id}`;
    }
  }

  if (link.startsWith('/chat/') && link !== '/chat/') return link;
  return null;
}

function relativeTimeLabel(
  isoDate: string,
  t: (key: AppMessageKey, vars?: Record<string, string | number>) => string,
): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return t('justNow');
  if (diff < 60) return t('minutesAgo', { n: diff });
  if (diff < 1440) return t('hoursAgo', { n: Math.floor(diff / 60) });
  return t('daysAgo', { n: Math.floor(diff / 1440) });
}

export const Notifications: React.FC = () => {
  useGuestPageGuard('notification');
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);

  const load = () => setNotifications(getNotifications());

  const exitDeleteMode = () => {
    setDeleteMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const ok = await removeNotifications(ids);
    if (!ok) return;
    setSelectedIds(new Set());
    load();
    if (notifications.length === ids.length) setDeleteMode(false);
  };

  useEffect(() => {
    load();
    window.addEventListener('notificationsChanged', load);
    const uid = getCurrentUserId();
    if (uid) {
      syncNotificationsFromDB(uid).then(() => {
        load();
      });
    }
    return () => window.removeEventListener('notificationsChanged', load);
  }, []);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'comment':
        return '\u{1F4AC}';
      case 'reply':
        return '\u{1F4DD}';
      case 'popular':
        return '\u{1F525}';
      case 'related':
        return '\u{1F517}';
      case 'chat':
        return '\u{1F4E9}';
      case 'badge':
        return '\u{1F3C5}';
      default:
        return '\u{1F514}';
    }
  };

  const handleNotificationClick = async (notification: StoredNotification) => {
    markAsRead(notification.id);
    load();

    if (!notification.link) return;

    const title = normalizeNotificationTitle(notification.title);
    const link = notification.link;
    let destinationLink = link;

    if (title === NOTIFY_REVIEW_WRITTEN) {
      const reviewOrderId = orderIdFromLink(link);
      destinationLink = reviewOrderId
        ? `/my/reviews?order=${encodeURIComponent(reviewOrderId)}`
        : '/my/reviews';
      navigate(destinationLink);
      return;
    }

    // 나눔 완료 후 후기 작성 안내는 후기 작성 화면을 유지한다.
    const keepReviewWrite = title === NOTIFY_TRADE_COMPLETED && link.startsWith('/review/');
    if (
      !keepReviewWrite
      && (CHAT_DEST_TITLES.has(title) || isMeetupNotificationTitle(title))
    ) {
      const chatLink = await resolveChatRoomLink(link, notification.content || '');
      if (chatLink) destinationLink = chatLink;
    }

    const orderId = orderIdFromLink(link);
    const order = orderId ? await ensureOrderById(orderId) : null;

    if (title === NOTIFY_TRADE_COMPLETE_CHECK && order?.status === ORDER_STATUS_VALUE.COMPLETE) {
      const existingReview = orderId ? getReviewByOrderId(orderId) : undefined;
      if (existingReview) {
        showToast(notifyT(lang, 'alertTradeDoneReviewed'));
        navigate(destinationLink);
        return;
      }
    }
    if (
      title === NOTIFY_RECEIVE_CONFIRM &&
      order &&
      (order.status === ORDER_STATUS_VALUE.RECEIVED || order.status === ORDER_STATUS_VALUE.COMPLETE)
    ) {
      const userId = getCurrentUserId();
      const isBuyer = userId && order.buyer?.id === userId;
      if (isBuyer) {
        showToast(notifyT(lang, 'alertReceiptConfirmed'));
      }
      navigate(destinationLink);
      return;
    }

    navigate(destinationLink);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-2">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-2" aria-label={notifyT(lang, 'backAria')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900">{notifyT(lang, 'pageTitle')}</h1>
          </div>
          <div className="flex items-center gap-2 pr-2">
            {deleteMode ? (
              <>
                <button
                  onClick={() => setSelectedIds(new Set(notifications.map((n) => n.id)))}
                  className="text-sm font-medium"
                  style={{ color: '#00A8A3' }}
                >
                  {notifyT(lang, 'selectAll')}
                </button>
                <button
                  onClick={exitDeleteMode}
                  className="text-sm font-medium text-gray-600"
                >
                  {notifyT(lang, 'cancel')}
                </button>
              </>
            ) : (
              <>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      markAllAsRead();
                      load();
                    }}
                    className="text-sm font-medium"
                    style={{ color: '#00A8A3' }}
                  >
                    {notifyT(lang, 'markAllRead')}
                  </button>
                )}
                <button
                  onClick={() => setDeleteMode(true)}
                  className="p-2 text-gray-600"
                  aria-label={notifyT(lang, 'deleteAria')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {notifyT(lang, 'noNotifications')}
          </div>
        ) : (
          notifications.map((notification, index) => {
            const display = localizeNotification(lang, notification);
            const title = normalizeNotificationTitle(notification.title);
            return (
            <div
              key={`${notification.id}-${index}`}
              onClick={deleteMode ? undefined : () => handleNotificationClick(notification)}
              className={`px-4 py-4 flex items-start gap-3 ${
                !deleteMode ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100' : ''
              } ${!notification.read && !deleteMode ? 'bg-blue-50/50' : ''} ${
                selectedIds.has(notification.id) ? 'bg-gray-100' : ''
              }`}
            >
              {deleteMode && (
                <button
                  type="button"
                  onClick={(e) => toggleSelect(notification.id, e)}
                  className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center mt-0.5 transition-colors ${
                    selectedIds.has(notification.id)
                      ? 'border-[#00A8A3] bg-[#00A8A3]'
                      : 'border-gray-300 hover:border-[#00A8A3]'
                  }`}
                  aria-label={notifyT(lang, 'selectAria')}
                >
                  {selectedIds.has(notification.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}
              <div className="text-2xl flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {notification.type === 'badge' ? (
                  <img src="/Batch/icon.svg" alt="" className="w-5 h-5 object-contain" />
                ) : notification.type === 'chat' ? (
                  <img src="/post/chat.svg" alt="" className="w-5 h-5 object-contain" />
                ) : isMeetupNotificationTitle(title) ? (
                  <img src="/post/time.svg" alt="" className="w-5 h-5 object-contain" />
                ) : COMPLETION_TITLES.has(title) ? (
                  <img src="/post/check.svg" alt="" className="w-5 h-5 object-contain" />
                ) : RECEIVE_TITLES.has(title) ? (
                  <img src="/post/parcel.svg" alt="" className="w-5 h-5 object-contain" />
                ) : REVIEW_TITLES.has(title) ? (
                  <img src="/post/smile.svg" alt="" className="w-5 h-5 object-contain" />
                ) : ACCEPT_TITLES.has(title) ? (
                  <img src="/3 ICON/4.svg" alt="" className="w-5 h-5 object-contain" />
                ) : (
                  getIcon(notification.type)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {display.title}
                  </h3>
                  {!notification.read && !deleteMode && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#00A8A3' }}
                    />
                  )}
                </div>
                {display.content ? (
                  <p className="text-sm text-gray-600 mb-1">{display.content}</p>
                ) : null}
                <span className="text-xs text-gray-400">{relativeTimeLabel(notification.timestamp, t)}</span>
              </div>
            </div>
          )})
        )}
      </div>

      {deleteMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {selectedIds.size > 0
              ? notifyT(lang, 'nSelected', { n: selectedIds.size })
              : notifyT(lang, 'selectToDelete')}
          </span>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#00A8A3' }}
          >
            {notifyT(lang, 'deleteSelected')}
          </button>
        </div>
      )}
    </div>
  );
};
