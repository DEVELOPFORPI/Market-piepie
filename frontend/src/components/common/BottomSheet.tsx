import React, { useEffect, useState } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: string;
}

const ANIM_MS = 300;

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  height = '80vh',
}) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const isAuto = height === 'auto';
  const hasTitle = Boolean(title?.trim());

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setVisible(false);
      document.body.style.overflow = 'hidden';
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
      document.body.style.overflow = '';
    }, ANIM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => () => {
    document.body.style.overflow = '';
  }, []);

  if (!mounted) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transition: `opacity ${ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1)` }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl will-change-transform safe-area-bottom ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          ...(isAuto ? { maxHeight: '90vh' } : { height, maxHeight: '90vh' }),
        }}
        role="dialog"
        aria-modal="true"
      >
        {!hasTitle && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
          </div>
        )}
        {hasTitle && (
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div
          className="overflow-y-auto"
          style={isAuto || !hasTitle ? undefined : { height: `calc(${height} - 60px)` }}
        >
          {children}
        </div>
      </div>
    </>
  );
};
