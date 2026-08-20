import React, { useCallback, useRef, useState } from 'react';
import { ModalShell } from '@/components/common/ModalShell';

const TEAL = '#00A8A3';

type ConfirmOptions = {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, message, confirmLabel, cancelLabel, onConfirm, onCancel }) => (
  <ModalShell
    open={open}
    onClose={onCancel}
    zIndex={80}
    panelClassName="w-full max-w-sm p-6"
  >
    <p className="text-sm text-gray-800 text-center leading-relaxed mb-6 whitespace-pre-line">
      {message}
    </p>
    <button
      type="button"
      onClick={onConfirm}
      className="w-full py-3.5 rounded-full text-white text-sm font-bold mb-2"
      style={{ backgroundColor: TEAL }}
    >
      {confirmLabel}
    </button>
    <button
      type="button"
      onClick={onCancel}
      className="w-full py-3 rounded-full text-sm font-medium text-gray-500"
    >
      {cancelLabel}
    </button>
  </ModalShell>
);

export function useConfirmDialog() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const askConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpts(options);
    });
  }, []);

  const finish = (value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpts(null);
  };

  const confirmDialog = (
    <ConfirmDialog
      open={!!opts}
      message={opts?.message ?? ''}
      confirmLabel={opts?.confirmLabel ?? ''}
      cancelLabel={opts?.cancelLabel ?? ''}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  );

  return { askConfirm, confirmDialog };
}
