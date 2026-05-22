import React from 'react';
import type { HomePopupConfig } from '@/utils/homePopupStorage';

const TEAL = '#00A8A3';

type Props = {
  config: HomePopupConfig;
  onClose: () => void;
};

export const HomePromoPopup: React.FC<Props> = ({ config, onClose }) => {
  const { title, subtitle, heroImage } = config;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 sm:px-5 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-promo-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close overlay"
        onClick={onClose}
      />
      <div className="relative z-[1] flex h-[460px] w-[330px] max-h-[calc(100vh-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-gray-600 shadow-sm hover:bg-white hover:text-gray-900"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Full-width hero inside the card (edge to edge) */}
        <div className="relative h-[220px] w-full shrink-0 bg-gray-100">
          {heroImage ? (
            <img src={heroImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-gray-400">
              No image — add one in Admin → Home popup
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 pt-4">
          <h2 id="home-promo-title" className="text-lg font-bold leading-snug text-gray-900 pr-8">
            {title}
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{subtitle}</p>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
            style={{ backgroundColor: TEAL }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
