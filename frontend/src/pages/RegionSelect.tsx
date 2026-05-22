import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { saveRegion } from '@/utils/regionStorage';
import { detectLocation } from '@/utils/geoLocation';

export const RegionSelect: React.FC = () => {
  const navigate = useNavigate();
  const [customRegionInput, setCustomRegionInput] = useState('');
  const [autoDetectLoading, setAutoDetectLoading] = useState(false);
  const [autoDetectError, setAutoDetectError] = useState<string | null>(null);

  const handleApplyCustom = () => {
    const value = customRegionInput.trim();
    if (value) {
      saveRegion(value);
      window.dispatchEvent(new Event('regionChanged'));
      setTimeout(() => navigate(-1), 100);
    }
  };

  const handleAutoDetect = async () => {
    setAutoDetectError(null);
    setAutoDetectLoading(true);
    try {
      const location = await detectLocation();
      if (location?.region) {
        saveRegion(location.region);
        window.dispatchEvent(new Event('regionChanged'));
        navigate(-1);
      } else {
        setAutoDetectError('Could not detect location. Enter your area manually.');
      }
    } catch {
      setAutoDetectError('Could not detect location. Enter your area manually.');
    } finally {
      setAutoDetectLoading(false);
    }
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
        title="Choose region"
      />

      <div className="px-4 py-4">
        {/* Auto-detect location */}
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
                <span>Detecting location…</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Use current location</span>
              </>
            )}
          </button>
          {autoDetectError && (
            <p className="mt-2 text-sm text-red-600">{autoDetectError}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            We use GPS or IP to suggest your area.
          </p>
        </div>

        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter manually
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customRegionInput}
              onChange={(e) => setCustomRegionInput(e.target.value)}
              placeholder="e.g. Yeongtong-gu, Suwon or Manhattan, NY"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyCustom();
              }}
            />
            <button
              onClick={handleApplyCustom}
              disabled={!customRegionInput.trim()}
              className="px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Apply
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Type your area if it does not appear above.
          </p>
        </div>
      </div>
    </div>
  );
};
