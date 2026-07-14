import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { HomePopupView } from '@/utils/homePopupStorage';
import { useLanguage } from '@/hooks/useLanguage';

const TEAL = '#00A8A3';

type Props = {
  popup: HomePopupView;
  onClose: () => void;
};

export const HomePromoPopup: React.FC<Props> = ({ popup, onClose }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { title, heroImage, noticeId } = popup;
  const hasDetail = !!noticeId;

  const handleDetail = () => {
    if (noticeId) navigate(`/notices/${noticeId}`);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center px-4 py-6 sm:px-5 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-promo-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div className="relative z-[1] flex w-[500px] max-h-[calc(100vh-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="shrink-0 px-5 pt-5 pb-3">
          <h2
            id="home-promo-title"
            className="line-clamp-2 text-lg font-bold leading-snug text-gray-900"
            title={title}
          >
            {title}
          </h2>
        </div>

        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-gray-100">
          <div className="mx-auto h-full w-full max-h-[min(70vh,700px)] aspect-[5/7]">
            {heroImage ? (
              <img src={heroImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-gray-400">
                {t('popupNoImage')}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 p-5 pt-3">
          {hasDetail ? (
            <button
              type="button"
              onClick={handleDetail}
              className="min-h-[48px] flex-1 rounded-2xl text-sm font-semibold text-white transition-opacity hover:opacity-95"
              style={{ backgroundColor: TEAL }}
            >
              {t('details')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={`min-h-[48px] rounded-2xl border border-gray-300 bg-white text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 ${
              hasDetail ? 'flex-1' : 'w-full'
            }`}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
