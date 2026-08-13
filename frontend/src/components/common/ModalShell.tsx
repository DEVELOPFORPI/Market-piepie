import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const MODAL_ANIM_MS = 280;

type ModalShellProps = {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  zIndex?: number;
  labelledBy?: string;
  panelClassName?: string;
  onExited?: () => void;
};

export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  children,
  zIndex = 50,
  labelledBy,
  panelClassName = 'w-full max-w-sm',
  onExited,
}) => {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      setMounted(true);
      setVisible(false);
      document.body.style.overflow = 'hidden';
      const timer = window.setTimeout(() => setVisible(true), 32);
      return () => window.clearTimeout(timer);
    }

    if (!wasOpenRef.current) return;

    setVisible(false);
    const timer = window.setTimeout(() => {
      wasOpenRef.current = false;
      setMounted(false);
      document.body.style.overflow = '';
      onExited?.();
    }, MODAL_ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => () => {
    document.body.style.overflow = '';
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`modal-shell${visible ? ' is-open' : ''}`}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <button
        type="button"
        className="modal-shell-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className={`modal-shell-panel ${panelClassName}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
};
