export const TOAST_EVENT = 'app-toast';
/** All app toasts use this background. */
export const TOAST_BG = '#00A8A3';

export type ToastDetail = {
  message: string;
  durationMs?: number;
};

export function showToast(message: string, durationMs = 2800) {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, {
      detail: { message, durationMs },
    }),
  );
}
