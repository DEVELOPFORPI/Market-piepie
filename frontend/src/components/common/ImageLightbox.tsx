import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MODAL_ANIM_MS } from '@/components/common/ModalShell';

type Props = {
  src: string | null;
  onClose: () => void;
  alt?: string;
};

export const ImageLightbox: React.FC<Props> = ({ src, onClose, alt = 'Full size' }) => {
  const open = !!src;
  const heldRef = useRef(src);
  if (src) heldRef.current = src;
  const shown = src ?? heldRef.current;

  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      setMounted(true);
      setVisible(false);
      document.body.style.overflow = 'hidden';
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    if (!wasOpenRef.current) return;

    setVisible(false);
    const timer = window.setTimeout(() => {
      wasOpenRef.current = false;
      setMounted(false);
      document.body.style.overflow = '';
    }, MODAL_ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => () => {
    document.body.style.overflow = '';
  }, []);

  if (!mounted || !shown || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`image-lightbox${visible ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button type="button" className="image-lightbox-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <img
        src={shown}
        alt={alt}
        className="image-lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
};
