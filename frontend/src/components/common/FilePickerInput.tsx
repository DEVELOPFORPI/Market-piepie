import React from 'react';

type FilePickerInputProps = {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  multiple?: boolean;
  capture?: boolean | 'user' | 'environment';
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  /** Runs when the picker is triggered, before the OS dialog (may not) appear. */
  onOpen?: () => void;
};

/**
 * File input stretched over its positioned parent instead of hidden with
 * `display:none`. Some Android WebViews never open the picker for an input that
 * isn't rendered, so the tap has to land on the input itself.
 * The parent needs `relative` (or another positioning context).
 */
export const FilePickerInput: React.FC<FilePickerInputProps> = ({
  onChange,
  accept = 'image/*',
  multiple,
  capture,
  disabled,
  id,
  ariaLabel,
  onOpen,
}) => (
  <input
    id={id}
    type="file"
    accept={accept}
    multiple={multiple}
    capture={capture}
    disabled={disabled}
    aria-label={ariaLabel}
    onClick={onOpen}
    onChange={onChange}
    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
  />
);
