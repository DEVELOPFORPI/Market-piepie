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
import { getOrderById } from '@/utils/orderStorage';
import { getReviewByOrderId } from '@/utils/reviewStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { getChatRoomByOrder } from '@/utils/chatStorage';
import { syncNotificationsFromDB } from '@/utils/dbSync';
import {
  COMPLETION_TITLE_SET,
  isMeetupNotificationTitle,
  NOTIFY_MEETUP_CONFIRMED,
  NOTIFY_MEETUP_UPDATED,
  NOTIFY_OFFER_ACCEPTED,
  NOTIFY_RECEIVE_CONFIRM,
  NOTIFY_REVIEW_WRITTEN,
  NOTIFY_TRADE_COMPLETE_CHECK,
  relativeTimeShort,
} from '@/locale/enUI';
import { ACTIVITY_BADGE_DEFINITIONS } from '@/constants/activityBadges';

const COMPLETION_TITLES = COMPLETION_TITLE_SET;

const RECEIVE_TITLES = new Set([NOTIFY_RECEIVE_CONFIRM]);

const REVIEW_TITLES = new Set([NOTIFY_REVIEW_WRITTEN]);

const ACCEPT_TITLES = new Set([NOTIFY_OFFER_ACCEPTED]);
const BADGE_NOTIFY_TITLE = '새로운 활동 배지가 획득되었습니다!';
const badgeLabelMap: Map<string, string> = new Map(
  ACTIVITY_BADGE_DEFINITIONS.map((b) => [b.id, b.label] as const)
);

function getBadgeDisplay(notification: StoredNotification): { title: string; content: string } {
  if (notification.type !== 'badge') {
    return { title: notification.title, content: notification.content };
  }
  // Legacy entries looked like "Badge 04 has been added ..."
  const legacyText = `${notification.title} ${notification.content}`;
  const m = legacyText.match(/Badge\s*(\d{2})/i);
  const badgeId = m?.[1];
  const badgeTitle = badgeId ? badgeLabelMap.get(badgeId) ?? badgeId : notification.content;
  return {
    title: BADGE_NOTIFY_TITLE,
    content: badgeTitle || '',
  };
}

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
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

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    removeNotifications(Array.from(selectedIds));
    setSelectedIds(new Set());
    load();
    if (notifications.length === count) setDeleteMode(false);
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

  const handleNotificationClick = (notification: StoredNotification) => {
    markAsRead(notification.id);
    load();

    if (!notification.link) return;

    const orderIdMatch = notification.link.match(/^\/order\/(.+)$/);
    const orderId = orderIdMatch?.[1];
    const order = orderId ? getOrderById(orderId) : null;
    let destinationLink = notification.link;

    // Order notifications from chat flow ??open the trade chat room when possible
    if (order && isMeetupNotificationTitle(notification.title)) {
      const room = getChatRoomByOrder(order);
      if (room?.id) {
        destinationLink = `/chat/${room.id}`;
      }
    }

    if (notification.title === NOTIFY_TRADE_COMPLETE_CHECK && order?.status === ORDER_STATUS_VALUE.COMPLETE) {
      const existingReview = orderId ? getReviewByOrderId(orderId) : undefined;
      if (existingReview) {
        alert('This trade is already complete and you have left a review.');
        navigate(destinationLink);
        return;
      }
    }
    if (
      notification.title === NOTIFY_RECEIVE_CONFIRM &&
      order &&
      (order.status === ORDER_STATUS_VALUE.RECEIVED || order.status === ORDER_STATUS_VALUE.COMPLETE)
    ) {
      const userId = getCurrentUserId();
      const isBuyer = userId && order.buyer?.id === userId;
      if (isBuyer) {
        alert('Receipt is already confirmed.');
      }
      navigate(destinationLink);
      return;
    }
    if (
      (notification.title === NOTIFY_MEETUP_CONFIRMED || notification.title === NOTIFY_MEETUP_UPDATED) &&
      order?.meetupPlace
    ) {
      // Meetup confirmed/updated: keep default link to order detail
    }

    navigate(destinationLink);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-2">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-2" aria-label="Back">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
          </div>
          <div className="flex items-center gap-2 pr-2">
            {deleteMode ? (
              <>
                <button
                  onClick={() => setSelectedIds(new Set(notifications.map((n) => n.id)))}
                  className="text-sm font-medium"
                  style={{ color: '#00A8A3' }}
                >
                  Select all
                </button>
                <button
                  onClick={exitDeleteMode}
                  className="text-sm font-medium text-gray-600"
                >
                  Cancel
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
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setDeleteMode(true)}
                  className="p-2 text-gray-600"
                  aria-label="Delete"
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
            No notifications yet.
          </div>
        ) : (
          notifications.map((notification, index) => {
            const badgeDisplay = getBadgeDisplay(notification);
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
                  aria-label="Select"
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
                ) : isMeetupNotificationTitle(notification.title) ? (
                  <img src="/post/time.svg" alt="" className="w-5 h-5 object-contain" />
                ) : COMPLETION_TITLES.has(notification.title) ? (
                  <img src="/post/check.svg" alt="" className="w-5 h-5 object-contain" />
                ) : RECEIVE_TITLES.has(notification.title) ? (
                  <img src="/post/parcel.svg" alt="" className="w-5 h-5 object-contain" />
                ) : REVIEW_TITLES.has(notification.title) ? (
                  <img src="/post/smile.svg" alt="" className="w-5 h-5 object-contain" />
                ) : ACCEPT_TITLES.has(notification.title) ? (
                  <img src="/3 ICON/4.svg" alt="" className="w-5 h-5 object-contain" />
                ) : (
                  getIcon(notification.type)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {badgeDisplay.title}
                  </h3>
                  {!notification.read && !deleteMode && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#00A8A3' }}
                    />
                  )}
                </div>
                {badgeDisplay.content ? (
                  <p className="text-sm text-gray-600 mb-1">{badgeDisplay.content}</p>
                ) : null}
                <span className="text-xs text-gray-400">{relativeTimeShort(notification.timestamp)}</span>
              </div>
            </div>
          )})
        )}
      </div>

      {deleteMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select notifications to delete'}
          </span>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Delete selected
          </button>
        </div>
      )}
    </div>
  );
};
