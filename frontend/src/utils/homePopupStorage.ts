/**
 * Home screen promo popup — active popup from API.
 */

import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

/** Popup title — short headline only. */
export const HOME_POPUP_TITLE_MAX = 30;

export type HomePopupRecord = {
  id: string;
  title: string;
  hero_image: string;
  detail_link: string | null;
  notice_id: string | null;
  revision: number;
  enabled: boolean;
  created_at: string;
  notice_title?: string | null;
};

export type HomePopupView = {
  id: string;
  title: string;
  heroImage: string;
  noticeId: string | null;
  revision: number;
  enabled: boolean;
};

export type NoticeRecord = {
  id: string;
  title: string;
  content?: string;
  published: boolean;
  view_count?: number;
  created_at: string;
  updated_at?: string;
};

export function mapHomePopupRecord(row: HomePopupRecord): HomePopupView {
  return {
    id: row.id,
    title: row.title,
    heroImage: row.hero_image,
    noticeId: row.notice_id || null,
    revision: Number(row.revision) || 1,
    enabled: Boolean(row.enabled),
  };
}

export async function fetchActiveHomePopup(): Promise<HomePopupView | null> {
  const res = await api.get<HomePopupRecord | null>('/api/home-popup');
  if (!res.ok || !res.data) return null;
  return mapHomePopupRecord(res.data);
}

/** Popup-linked published notice, else newest published notice. */
export async function fetchNoticeBannerTarget(): Promise<{ id: string; title: string } | null> {
  const [noticesRes, popup] = await Promise.all([
    api.get<NoticeRecord[]>('/api/notices'),
    fetchActiveHomePopup(),
  ]);
  const notices = noticesRes.ok && Array.isArray(noticesRes.data) ? noticesRes.data : [];
  if (!notices.length) return null;
  const linked = popup?.noticeId
    ? notices.find((n) => n.id === popup.noticeId)
    : undefined;
  const pick = linked ?? notices[0];
  return pick ? { id: pick.id, title: pick.title } : null;
}

export async function fetchAdminHomePopups(): Promise<HomePopupRecord[]> {
  const res = await api.get<HomePopupRecord[]>('/api/admin/home-popups', {
    headers: adminPasswordHeaders(),
  });
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

export async function fetchAdminNotices(): Promise<NoticeRecord[]> {
  const res = await api.get<NoticeRecord[]>('/api/admin/notices', {
    headers: adminPasswordHeaders(),
  });
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

export async function createAdminHomePopup(
  body: {
    title: string;
    hero_image: string;
    notice_id?: string | null;
    enabled?: boolean;
  },
  headers: Record<string, string>,
): Promise<HomePopupRecord | null> {
  const res = await api.post<HomePopupRecord>('/api/admin/home-popups', body, { headers });
  return res.ok && res.data ? res.data : null;
}

export async function updateAdminHomePopup(
  id: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<HomePopupRecord | null> {
  const res = await api.put<HomePopupRecord>(`/api/admin/home-popups/${id}`, body, { headers });
  return res.ok && res.data ? res.data : null;
}

export async function deleteAdminHomePopup(
  id: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const res = await api.delete<{ ok: boolean }>(`/api/admin/home-popups/${id}`, { headers });
  return res.ok;
}

export async function createAdminNotice(
  body: { title: string; content: string; published?: boolean },
  headers: Record<string, string>,
): Promise<NoticeRecord | null> {
  const res = await api.post<NoticeRecord>('/api/admin/notices', body, { headers });
  return res.ok && res.data ? res.data : null;
}
