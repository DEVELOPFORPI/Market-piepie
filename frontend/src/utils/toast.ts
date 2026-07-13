export const TOAST_EVENT = 'app-toast';

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
