import React, { useEffect, useState } from 'react';
import { TOAST_EVENT, type ToastDetail } from '@/utils/toast';

export const ToastHost: React.FC = () => {
  const [toast, setToast] = useState<ToastDetail | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      setToast(detail);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.durationMs ?? 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[10001] flex justify-center px-4">
      <div
        className="max-w-sm rounded-xl px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl"
        style={{ backgroundColor: '#00A8A3' }}
      >
        {toast.message}
      </div>
    </div>
  );
};
