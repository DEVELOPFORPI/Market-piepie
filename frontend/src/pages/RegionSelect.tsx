import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ModalShell } from '@/components/common/ModalShell';
import { hasLocationConsent, saveRegion, setLocationConsent } from '@/utils/regionStorage';
import { detectLocation } from '@/utils/geoLocation';
import { showToast } from '@/utils/toast';
import { useLanguage } from '@/hooks/useLanguage';

export const RegionSelect: React.FC = () => {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [customRegionInput, setCustomRegionInput] = useState('');
  const [autoDetectLoading, setAutoDetectLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoDetectError, setAutoDetectError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const handleApplyCustom = async () => {
    const value = customRegionInput.trim();
    if (!value || saving) return;
    setSaving(true);
    const ok = await saveRegion(value, null);
    setSaving(false);
    if (!ok) {
      showToast(t('saveRegionFailed'));
      return;
    }
    setTimeout(() => navigate(-1), 100);
  };

  const runAutoDetect = async () => {
    setAutoDetectError(null);
    setAutoDetectLoading(true);
    try {
      const result = await detectLocation(lang);
      if (result.ok) {
        const ok = await saveRegion(result.location.region, result.location.coords ?? null);
        if (!ok) {
          setAutoDetectError(t('saveRegionFailed'));
          return;
        }
        navigate(-1);
        return;
      }
      if (result.reason === 'permission') {
        showToast(t('locationPermissionDenied'));
        return;
      }
      setAutoDetectError(t('detectLocationFailed'));
    } catch {
      setAutoDetectError(t('detectLocationFailed'));
    } finally {
      setAutoDetectLoading(false);
    }
  };

  const handleAutoDetect = () => {
    if (autoDetectLoading) return;
    if (!hasLocationConsent()) {
      setAutoDetectError(null);
      setConsentOpen(true);
      return;
    }
    void runAutoDetect();
  };

  const handleConsentAgree = () => {
    setLocationConsent();
    setConsentOpen(false);
    void runAutoDetect();
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('chooseRegion')}
      />

      <div className="px-4 py-4">
        <div className="mb-6">
          <button
            type="button"
            onClick={handleAutoDetect}
            disabled={autoDetectLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ borderColor: '#00A8A3', backgroundColor: 'rgba(0,168,163,0.08)', color: '#00A8A3' }}
          >
            {autoDetectLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{t('detectingLocation')}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{t('useCurrentLocation')}</span>
              </>
            )}
          </button>
          {autoDetectError && (
            <p className="mt-2 text-sm text-red-600">{autoDetectError}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {t('gpsHint')}
          </p>
        </div>

        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('enterManually')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customRegionInput}
              onChange={(e) => setCustomRegionInput(e.target.value)}
              placeholder={t('regionPlaceholder')}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyCustom();
              }}
            />
            <button
              onClick={() => void handleApplyCustom()}
              disabled={!customRegionInput.trim() || saving}
              className="px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#00A8A3' }}
            >
              {t('apply')}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t('regionHint')}
          </p>
        </div>
      </div>

      <ModalShell
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        labelledBy="location-consent-title"
      >
        <div className="p-4">
          <div className="flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: 'rgba(0,168,163,0.12)' }}
            >
              <svg className="w-7 h-7" fill="none" stroke="#00A8A3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 id="location-consent-title" className="text-lg font-bold text-gray-900 mb-1">
              {t('locationConsentTitle')}
            </h2>
            <p className="text-sm text-gray-600">{t('locationConsentBody')}</p>
          </div>

          <p className="mt-3 px-2 py-2 bg-gray-50 rounded-lg text-[11px] leading-4 text-gray-500 text-center whitespace-nowrap">
            {t('locationConsentNote')}
          </p>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setConsentOpen(false)}
              className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {t('locationConsentCancel')}
            </button>
            <button
              type="button"
              onClick={handleConsentAgree}
              className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90"
              style={{ backgroundColor: '#00A8A3' }}
            >
              {t('locationConsentAgree')}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
};
