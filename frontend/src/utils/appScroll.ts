/**
 * Pages scroll inside the App shell container, not the window
 * (`.App` is h-dvh overflow-hidden), so window.scrollTo/scrollY are no-ops.
 */
export const APP_SCROLL_ID = 'app-scroll';

export function getAppScrollElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(APP_SCROLL_ID);
}

export function getAppScrollTop(): number {
  const el = getAppScrollElement();
  if (el) return el.scrollTop;
  return typeof window === 'undefined' ? 0 : window.scrollY;
}

export function scrollAppToTop(): void {
  const el = getAppScrollElement();
  if (el) el.scrollTop = 0;
  if (typeof window !== 'undefined') window.scrollTo(0, 0);
}
