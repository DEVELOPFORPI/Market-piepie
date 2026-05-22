/**
 * Home screen promo popup — config in localStorage; admin can enable/disable and edit.
 */

const CONFIG_KEY = 'marketpiepie_home_popup_config_v1';
const DISMISSED_REV_KEY = 'marketpiepie_home_popup_dismissed_rev_v1';

export type HomePopupConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
  /** One wide hero image (data URL or `/path.jpg`). Replaces legacy imageLeft/imageRight. */
  heroImage: string;
  /** Incremented on each admin save so users who dismissed see the popup again. */
  revision: number;
};

const DEFAULTS: HomePopupConfig = {
  enabled: false,
  title: 'Meet in person for safer trades',
  subtitle: 'Start every deal safely—face to face when you can.',
  heroImage: '',
  revision: 1,
};

function migrateHeroImage(o: Record<string, unknown>): string {
  const h = o.heroImage;
  if (typeof h === 'string' && h) return h;
  const left = o.imageLeft;
  const right = o.imageRight;
  if (typeof left === 'string' && left) return left;
  if (typeof right === 'string' && right) return right;
  return '';
}

function parseConfig(raw: string | null): HomePopupConfig | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o !== 'object' || o === null) return null;
    return {
      enabled: Boolean(o.enabled),
      title: typeof o.title === 'string' ? o.title : DEFAULTS.title,
      subtitle: typeof o.subtitle === 'string' ? o.subtitle : DEFAULTS.subtitle,
      heroImage: migrateHeroImage(o),
      revision: typeof o.revision === 'number' && o.revision >= 1 ? o.revision : 1,
    };
  } catch {
    return null;
  }
}

export function getHomePopupConfig(): HomePopupConfig {
  try {
    const parsed = parseConfig(localStorage.getItem(CONFIG_KEY));
    return parsed ?? { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveHomePopupConfig(next: Partial<HomePopupConfig>): HomePopupConfig {
  const prev = getHomePopupConfig();
  const merged: HomePopupConfig = {
    ...prev,
    ...next,
    revision: next.revision ?? prev.revision,
  };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event('homePopupConfigChanged'));
  } catch {
    /* ignore */
  }
  return merged;
}

/** Bump revision (call when publishing changes from admin). */
export function publishHomePopupConfig(next: Partial<HomePopupConfig>): HomePopupConfig {
  const prev = getHomePopupConfig();
  return saveHomePopupConfig({
    ...next,
    revision: prev.revision + 1,
  });
}

function getDismissedRevision(): number | null {
  try {
    const v = localStorage.getItem(DISMISSED_REV_KEY);
    if (v === null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** User tapped close — hide until admin publishes a new revision. */
export function dismissHomePopupForSession(): void {
  const rev = getHomePopupConfig().revision;
  try {
    localStorage.setItem(DISMISSED_REV_KEY, String(rev));
  } catch {
    /* ignore */
  }
}

/** Whether the home page should show the overlay (enabled + not dismissed for current revision). */
export function shouldShowHomePopup(): boolean {
  const c = getHomePopupConfig();
  if (!c.enabled) return false;
  const dismissed = getDismissedRevision();
  if (dismissed === null) return true;
  return dismissed < c.revision;
}
