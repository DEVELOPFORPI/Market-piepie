import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { getRegion } from '@/utils/regionStorage';
import { clearAppStorage } from '@/utils/storageClear';
import { markExplicitLogout } from '@/utils/authStorage';
import { isTestLoginEnabled } from '@/config/features';
import { withdrawLocalAccount } from '@/utils/accountWithdrawal';
import { UI_REGION_PLACEHOLDER } from '@/locale/enUI';

export const Settings: React.FC = () => {
  const navigate = useNavigate();

  const [pushNotification, setPushNotification] = useState(true);
  const [showProfile, setShowProfile] = useState(true);
  const [showTradeHistory, setShowTradeHistory] = useState(true);
  const [currentRegion, setCurrentRegion] = useState<string>('');

  useEffect(() => {
    const savedRegion = getRegion();
    setCurrentRegion(savedRegion || UI_REGION_PLACEHOLDER);
  }, []);

  // Region change listener
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

  const settingsSections = React.useMemo(() => [
    {
      title: 'Notifications',
      items: [
        {
          label: 'Push',
          description: 'Trade and message alerts',
          type: 'toggle' as const,
          value: pushNotification,
          onChange: setPushNotification,
        },
      ],
    },
    {
      title: 'Privacy',
      items: [
        {
          label: 'Public profile',
          description: 'Others can view your profile',
          type: 'toggle' as const,
          value: showProfile,
          onChange: setShowProfile,
        },
        {
          label: 'Show trade history',
          description: 'Others can see your trade history',
          type: 'toggle' as const,
          value: showTradeHistory,
          onChange: setShowTradeHistory,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Region',
          description: currentRegion,
          type: 'link' as const,
          onClick: () => navigate('/region/select'),
        },
        {
          label: 'Admin console',
          description: 'Home popup, disputes — local tools (not production-safe)',
          type: 'link' as const,
          onClick: () => navigate('/admin'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          label: 'Inquiry',
          description: 'Submit a question or report an issue',
          type: 'link' as const,
          onClick: () => navigate('/inquiry'),
        },
      ],
    },
    {
      title: 'Storage',
      items: [
        {
          label: 'Clear local data',
          description: 'Removes listings, chats, orders, reviews, notifications. You stay signed in.',
          type: 'link' as const,
          onClick: async () => {
            if (confirm('This deletes saved listings, chats, orders, reviews, community posts and comments, and notifications.\nYour sign-in, profile, and region stay.\nContinue?')) {
              await clearAppStorage();
              alert('Local data cleared.');
              navigate('/my', { replace: true });
            }
          },
        },
      ],
    },
  ], [currentRegion, pushNotification, showProfile, showTradeHistory, navigate]);

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
        {settingsSections.map((section, sectionIdx) => (
          <div key={sectionIdx}>
            <h3 className="text-sm font-medium text-gray-700 mb-3">{section.title}</h3>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
              {section.items.map((item, itemIdx) => (
                <div key={itemIdx} className="px-4 py-3">
                  {item.type === 'toggle' ? (
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={item.value}
                        onChange={(e) => item.onChange(e.target.checked)}
                        className="w-11 h-6 bg-gray-200 rounded-full appearance-none cursor-pointer relative transition-colors checked:bg-primary"
                        style={{
                          backgroundImage: item.value
                            ? "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='white'/%3e%3c/svg%3e\")"
                            : "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='white'/%3e%3c/svg%3e\")",
                          backgroundPosition: item.value ? 'right center' : 'left center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '1.5rem',
                        }}
                      />
                    </label>
                  ) : (
                    <button
                      onClick={item.onClick}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        {'description' in item && item.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <div className="pt-4">
          <button
            onClick={() => {
              if (isTestLoginEnabled()) {
                sessionStorage.clear();
                window.location.href = '/welcome';
                return;
              }
              markExplicitLogout();
              window.location.href = '/welcome';
            }}
            className="w-full px-4 py-3 text-sm font-medium text-white rounded-lg mb-3"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Switch account (log out)
          </button>
          <button
            type="button"
            onClick={async () => {
              if (
                !confirm(
                  'Deleting your account removes all data stored in this browser: profile, listings, chats, trades, alerts, and more.\nThere is no server account to recover.\nDelete anyway?'
                )
              ) {
                return;
              }
              if (
                !confirm(
                  'Last step: after withdrawal you will start from sign-up on this device.'
                )
              ) {
                return;
              }
              try {
                await withdrawLocalAccount();
              } catch {
                alert('Something went wrong. Try again in a moment.');
                return;
              }
              window.location.href = '/welcome';
            }}
            className="w-full px-4 py-3 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
};

