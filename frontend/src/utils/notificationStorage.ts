import { getCurrentUserId } from '@/utils/authStorage';
import { getItem, setItem } from '@/utils/heavyStorage';
import { syncNotificationToDB, syncNotificationReadToDB, syncNotificationsDeleteToDB } from '@/utils/dbSync';
import { broadcastNotification } from '@/utils/chatSocket';

const KEY = 'all_notifications';

export type NotificationType = 'comment' | 'reply' | 'popular' | 'related' | 'chat' | 'order' | 'badge' | 'inquiry';

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

/** Append notification — DB 저장 성공 후 로컬 캐시 */
export const addNotification = async (params: {
  targetUserId: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
}): Promise<boolean> => {
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
  const ok = await syncNotificationToDB(notif);
  if (!ok) return false;
  const list = getAll();
  list.unshift(notif);
  saveAll(list);
  broadcastNotification(params.targetUserId);
  return true;
};

/** Mark one as read */
export const markAsRead = async (id: string): Promise<boolean> => {
  const ok = await syncNotificationReadToDB(id);
  if (!ok) return false;
  const list = getAll();
  const i = list.findIndex((n) => n.id === id);
  if (i >= 0) {
    list[i].read = true;
    saveAll(list);
  }
  return true;
};

/** Mark all for current user read */
export const markAllAsRead = async (): Promise<boolean> => {
  const userId = getCurrentUserId();
  const list = getAll();
  const toSync = list.filter((n) => n.targetUserId === userId && !n.read).map((n) => n.id);
  const results = await Promise.all(toSync.map((id) => syncNotificationReadToDB(id)));
  if (results.some((ok) => !ok)) return false;
  const updated = list.map((n) =>
    n.targetUserId === userId && !n.read ? { ...n, read: true } : n
  );
  saveAll(updated);
  return true;
};

/** Delete notifications by id — DB 삭제 성공 후에만 로컬에서 제거 */
export const removeNotifications = async (ids: string[]): Promise<boolean> => {
  if (ids.length === 0) return true;
  const ok = await syncNotificationsDeleteToDB(ids);
  if (!ok) return false;
  const set = new Set(ids);
  saveAll(getAll().filter((n) => !set.has(n.id)));
  return true;
};
