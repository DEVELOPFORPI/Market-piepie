import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { getRegion } from '@/utils/regionStorage';
import { markExplicitLogout } from '@/utils/authStorage';
import { isTestLoginEnabled } from '@/config/features';
import { UI_REGION_PLACEHOLDER } from '@/locale/enUI';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [currentRegion, setCurrentRegion] = useState<string>('');

  useEffect(() => {
    const savedRegion = getRegion();
    setCurrentRegion(savedRegion || UI_REGION_PLACEHOLDER);
  }, []);

  useEffect(() => {
    const handleRegionChange = () => {
      const savedRegion = getRegion();
      setCurrentRegion(savedRegion || UI_REGION_PLACEHOLDER);
    };
    window.addEventListener('regionChanged', handleRegionChange);
    return () => {
      window.removeEventListener('regionChanged', handleRegionChange);
    };
  }, []);

  const linkItems = [
    {
      label: 'Region',
      description: currentRegion,
      onClick: () => navigate('/region/select'),
    },
    {
      label: 'Inquiry',
      description: 'Submit a question or report an issue',
      onClick: () => navigate('/inquiry'),
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-8 safe-area-bottom">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="Settings"
      />

      <div className="px-4 py-4 space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {linkItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="w-full flex items-center justify-between text-left px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (isTestLoginEnabled()) {
                sessionStorage.clear();
                window.location.href = '/welcome';
                return;
              }
              markExplicitLogout();
              window.location.href = '/welcome';
            }}
            className="w-full px-4 py-3 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Switch account (log out)
          </button>
        </div>
      </div>
    </div>
  );
};
