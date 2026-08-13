import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { computeUnlockedActivityBadgeIds } from '@/utils/activityBadgeRules';
import { addNotification } from '@/utils/notificationStorage';
import { ACTIVITY_BADGE_DEFINITIONS } from '@/constants/activityBadges';
import { api } from '@/utils/api';

const STORAGE_KEY = 'unlocked_activity_badges';
const PURCHASED_KEY = 'purchased_activity_badges';
const NOTIFIED_KEY = 'notified_badge_ids';
import { NOTIFY_BADGE_UNLOCKED } from '@/locale/enUI';
const badgeLabelMap: Map<string, string> = new Map(
  ACTIVITY_BADGE_DEFINITIONS.map((b) => [b.id, b.label] as const)
);

function readIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(userKey(key));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, ids: Iterable<string>): void {
  try {
    localStorage.setItem(userKey(key), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function getPurchasedBadgeIds(): Set<string> {
  return readIdSet(PURCHASED_KEY);
}

export function addPurchasedBadgeIds(ids: string[]): void {
  if (ids.length === 0) return;
  const next = getPurchasedBadgeIds();
  ids.forEach((id) => next.add(id));
  writeIdSet(PURCHASED_KEY, next);
}

/** Unlocked badge ids (earned + purchased) */
export function getUnlockedBadgeIds(): Set<string> {
  return readIdSet(STORAGE_KEY);
}

export function setUnlockedBadgeIds(ids: string[]): void {
  try {
    localStorage.setItem(userKey(STORAGE_KEY), JSON.stringify(ids));
    window.dispatchEvent(new Event('activityBadgesChanged'));
  } catch {
    /* ignore */
  }
}

function mergeUnlocked(extra: Iterable<string> = []): string[] {
  const merged = new Set([
    ...getUnlockedBadgeIds(),
    ...getPurchasedBadgeIds(),
    ...extra,
  ]);
  return [...merged];
}

/** Unlock a purchased badge. Stats sync must not wipe this. */
export function unlockActivityBadge(id: string): void {
  addPurchasedBadgeIds([id]);
  setUnlockedBadgeIds(mergeUnlocked([id]));
}

/** Restore paid badges from completed Pi payments, then merge into unlocks */
export async function syncPurchasedBadgesFromDB(): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;
  const res = await api.get<{ badgeIds?: string[] }>('/api/payments/my-badges');
  if (!res.ok || !Array.isArray(res.data?.badgeIds)) return;
  const ids = res.data.badgeIds.filter((id) => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return;
  addPurchasedBadgeIds(ids);
  setUnlockedBadgeIds(mergeUnlocked(ids));
}

function getNotifiedBadgeIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${NOTIFIED_KEY}_${userId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function addNotifiedBadgeIds(userId: string, ids: string[]): void {
  try {
    const set = getNotifiedBadgeIds(userId);
    ids.forEach((id) => set.add(id));
    localStorage.setItem(`${NOTIFIED_KEY}_${userId}`, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/** Recompute earned badges from stats; keep purchased unlocks */
export function syncActivityBadgesFromStats(): void {
  const userId = getCurrentUserId();
  if (!userId) return;
  const earned = computeUnlockedActivityBadgeIds(userId);
  const purchased = getPurchasedBadgeIds();
  const next = [...new Set([...earned, ...purchased])];
  const current = getUnlockedBadgeIds();
  const curKey = [...current].sort().join(',');
  const nextKey = [...next].sort().join(',');
  if (curKey === nextKey) return;
  const alreadyNotified = getNotifiedBadgeIds(userId);
  const gained = next.filter((id) => !current.has(id) && !alreadyNotified.has(id) && !purchased.has(id));

  if (current.size === 0 && next.length > 0 && alreadyNotified.size === 0) {
    addNotifiedBadgeIds(userId, next);
    setUnlockedBadgeIds(next);
    return;
  }
  gained.forEach((id) => {
    const badgeLabel = badgeLabelMap.get(id) ?? id;
    addNotification({
      targetUserId: userId,
      type: 'badge',
      title: NOTIFY_BADGE_UNLOCKED,
      content: badgeLabel,
      link: '/my?tab=badges',
    });
  });
  if (gained.length > 0) {
    addNotifiedBadgeIds(userId, gained);
  }
  setUnlockedBadgeIds(next);
}
