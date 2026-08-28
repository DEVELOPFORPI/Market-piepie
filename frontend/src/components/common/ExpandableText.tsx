import React, { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';

const PREVIEW_CHARS = 120;

type Props = {
  text: string;
  className?: string;
};

export const ExpandableText: React.FC<Props> = ({ text, className }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const long = text.length > PREVIEW_CHARS;
  const shown = open || !long ? text : `${text.slice(0, PREVIEW_CHARS).trimEnd()}...`;

  return (
    <div>
      <p className={`leading-relaxed whitespace-pre-line ${className ?? 'text-sm text-gray-700'}`}>
        {shown}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm mt-1 font-medium"
          style={{ color: '#00A8A3' }}
        >
          {open ? t('showLess') : t('showMore')}
        </button>
      )}
    </div>
  );
};
