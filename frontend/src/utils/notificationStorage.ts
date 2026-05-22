import { getCurrentUserId } from '@/utils/authStorage';
import { getItem, setItem } from '@/utils/heavyStorage';
import { syncNotificationToDB, syncNotificationReadToDB } from '@/utils/dbSync';
import { broadcastNotification } from '@/utils/chatSocket';

const KEY = 'all_notifications';

export type NotificationType = 'comment' | 'reply' | 'popular' | 'related' | 'chat' | 'order' | 'badge';

export interface StoredNotification {
  id: string;
  targetUserId: string;
  type: NotificationType;
  title: string;
  content: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

const getAll = (): StoredNotification[] => {
  try {
    const raw = getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveAll = (list: StoredNotification[]) => {
  setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('notificationsChanged'));
};

/** Notifications for current user */
export const getNotifications = (): StoredNotification[] => {
  const userId = getCurrentUserId();
  return getAll()
    .filter((n) => n.targetUserId === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

/** Unread count */
export const getUnreadCount = (): number => {
  return getNotifications().filter((n) => !n.read).length;
};

/** Append notification for a user */
export const addNotification = (params: {
  targetUserId: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
}) => {
  const list = getAll();
  const notif: StoredNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    targetUserId: params.targetUserId,
    type: params.type,
    title: params.title,
    content: params.content,
    timestamp: new Date().toISOString(),
    read: false,
    link: params.link,
  };
  list.unshift(notif);
  saveAll(list);
  syncNotificationToDB(notif);
  broadcastNotification(params.targetUserId);
};

/** Mark one as read */
export const markAsRead = (id: string) => {
  const list = getAll();
  const i = list.findIndex((n) => n.id === id);
  if (i >= 0) {
    list[i].read = true;
    saveAll(list);
    syncNotificationReadToDB(id);
  }
};

/** Mark all for current user read */
export const markAllAsRead = () => {

  const userId = getCurrentUserId();

  const list = getAll();

  const toSync: string[] = [];

  const updated = list.map((n) => {

    if (n.targetUserId === userId && !n.read) {

      toSync.push(n.id);

      return { ...n, read: true };

    }

    return n;

  });

  saveAll(updated);

  toSync.forEach((id) => syncNotificationReadToDB(id));

};

/** Delete notifications by id */
export const removeNotifications = (ids: string[]) => {
  if (ids.length === 0) return;
  const set = new Set(ids);
  const list = getAll().filter((n) => !set.has(n.id));
  saveAll(list);
};
