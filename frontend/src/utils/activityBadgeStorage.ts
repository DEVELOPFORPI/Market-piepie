import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { computeUnlockedActivityBadgeIds } from '@/utils/activityBadgeRules';
import { addNotification } from '@/utils/notificationStorage';
import { ACTIVITY_BADGE_DEFINITIONS } from '@/constants/activityBadges';

const STORAGE_KEY = 'unlocked_activity_badges';
const NOTIFIED_KEY = 'notified_badge_ids';
const BADGE_NOTIFY_TITLE = '\uC0C8\uB85C\uC6B4 \uD65C\uB3D9 \uBC30\uC9C0\uAC00 \uD68D\uB4DD\uB418\uC5C8\uC2B5\uB2C8\uB2E4!';
const badgeLabelMap: Map<string, string> = new Map(
  ACTIVITY_BADGE_DEFINITIONS.map((b) => [b.id, b.label] as const)
);

/** Unlocked badge ids (e.g. ['01','02']) */
export function getUnlockedBadgeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(userKey(STORAGE_KEY));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function setUnlockedBadgeIds(ids: string[]): void {
  try {
    localStorage.setItem(userKey(STORAGE_KEY), JSON.stringify(ids));
    window.dispatchEvent(new Event('activityBadgesChanged'));
  } catch {
    /* ignore */
  }
}

/** Dev: force-unlock a badge (next sync overwrites from stats) */
export function unlockActivityBadge(id: string): void {
  const cur = getUnlockedBadgeIds();
  if (cur.has(id)) return;
  cur.add(id);
  setUnlockedBadgeIds([...cur]);
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

/** Recompute badges from stats after orders, posts, favorites, etc. change */
export function syncActivityBadgesFromStats(): void {
  const userId = getCurrentUserId();
  if (!userId) return;
  const next = computeUnlockedActivityBadgeIds(userId);
  const current = getUnlockedBadgeIds();
  const curKey = [...current].sort().join(',');
  const nextKey = [...next].sort().join(',');
  if (curKey === nextKey) return;
  const alreadyNotified = getNotifiedBadgeIds(userId);
  const gained = next.filter((id) => !current.has(id) && !alreadyNotified.has(id));
  // Only notify for brand-new unlocks (not in current set AND not previously notified)


  // If this is first run (no current badges but user has some), treat all as already notified

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
      title: BADGE_NOTIFY_TITLE,
      content: badgeLabel,
      link: '/my?tab=badges',
    });
  });
  if (gained.length > 0) {
    addNotifiedBadgeIds(userId, gained);
  }
  setUnlockedBadgeIds(next);
}
