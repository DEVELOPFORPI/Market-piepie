import React, { useEffect } from 'react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = '85%',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <div
        className="fixed top-0 right-0 bottom-0 bg-white z-50 shadow-2xl flex flex-col"
        style={{
          width: width === '85%' ? '85%' : width,
          maxWidth: width === '85%' ? 320 : undefined,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        aria-hidden={!isOpen}
      >
        {title && (
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0"
            style={{
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'translateX(0)' : 'translateX(10px)',
              transition: isOpen
                ? 'opacity 0.3s ease-out 0.1s, transform 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.1s'
                : 'opacity 0.15s ease-out, transform 0.2s ease-out',
            }}
          >
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
          className="overflow-y-auto flex-1 p-4"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'translateX(0)' : 'translateX(16px)',
            transition: isOpen
              ? 'opacity 0.35s ease-out 0.15s, transform 0.4s cubic-bezier(0.32, 0.72, 0, 1) 0.15s'
              : 'opacity 0.15s ease-out, transform 0.2s ease-out',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};
