import React, { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/common/BottomSheet';
import { languageLabelForUi } from '@/utils/languageLabels';
import {
  AppLanguage,
  getAppLanguage,
  labelAppLanguage,
  LANGUAGE_OPTIONS,
  setAppLanguage,
} from '@/utils/languageStorage';
import { useLanguage } from '@/hooks/useLanguage';

type LanguageButtonProps = {
  className?: string;
};

export const LanguageButton: React.FC<LanguageButtonProps> = ({ className = '' }) => {
  const { t } = useLanguage();
  const [lang, setLang] = useState<AppLanguage>(() => getAppLanguage());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setLang(getAppLanguage());
    window.addEventListener('languageChanged', refresh);
    return () => window.removeEventListener('languageChanged', refresh);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`min-w-[2.5rem] px-2.5 py-1.5 text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 ${className}`}
        aria-label={t('language')}
      >
        {labelAppLanguage(lang)}
      </button>

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title={t('language')}>
        <div className="px-4 py-4">
          <div className="grid grid-cols-5 gap-2">
            {LANGUAGE_OPTIONS.map(({ value, code }) => {
              const selected = lang === value;
              const label = languageLabelForUi(lang, value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setAppLanguage(value);
                    setLang(value);
                    setOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2.5 min-h-[3.25rem] ${
                    selected
                      ? 'border-transparent text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100'
                  }`}
                  style={selected ? { backgroundColor: '#00A8A3' } : undefined}
                  title={label}
                >
                  <span className="text-xs font-bold leading-none">{code}</span>
                  <span className="text-[9px] leading-tight truncate max-w-full opacity-80">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="pt-3 text-xs text-gray-400 text-center">
            {t('translationComingSoon')}
          </p>
        </div>
      </BottomSheet>
    </>
  );
};
