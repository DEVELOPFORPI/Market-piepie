import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUnreadChatCount } from '@/utils/chatStorage';
import { getUnreadCount } from '@/utils/notificationStorage';
import { guestGuard } from '@/utils/guestGate';
import { useLanguage } from '@/hooks/useLanguage';
import type { HomeMessageKey } from '@/i18n/homeMessages';

interface TabItem {
  id: string;
  labelKey: HomeMessageKey | null;
  iconSrc: string | null;
  path: string;
}

const tabs: TabItem[] = [
  { id: 'home', labelKey: 'navHome', iconSrc: '/icon_1.svg', path: '/' },
  { id: 'community', labelKey: 'navCommunity', iconSrc: '/icon_2.svg', path: '/community' },
  { id: 'register', labelKey: null, iconSrc: null, path: '/register' },
  { id: 'chat', labelKey: 'navChat', iconSrc: '/icon_3.svg', path: '/chat' },
  { id: 'my', labelKey: 'navProfile', iconSrc: '/icon_4.svg', path: '/my' },
];

export const BottomTab: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, t } = useLanguage();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const isRtl = lang === 'ar' || lang === 'fa' || lang === 'ur';

  useEffect(() => {
    const refresh = () => {
      const chat = getUnreadChatCount();
      const notification = getUnreadCount();
      setUnreadChatCount(chat);
      setUnreadNotificationCount(notification);
    };
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'all_chatrooms' || e.key === 'all_notifications') refresh();
    };
    window.addEventListener('chatRoomsChanged', refresh);
    window.addEventListener('notificationsChanged', refresh);
    window.addEventListener('focus', refresh);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('chatRoomsChanged', refresh);
      window.removeEventListener('notificationsChanged', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [location.pathname]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom"
      style={{ fontFamily: "'StunningSans', sans-serif" }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const label = tab.labelKey ? t(tab.labelKey) : tab.id;
          const isActive =
            location.pathname === tab.path ||
            (tab.path === '/' && location.pathname === '/home') ||
            (tab.id === 'my' && location.pathname.startsWith('/my'));

          const guestBlocked = tab.id === 'register' || tab.id === 'chat' || tab.id === 'my';

          if (tab.id === 'register') {
            return (
              <button
                key={tab.id}
                onClick={() => { if (guestGuard('sell')) return; navigate(tab.path); }}
                className="flex flex-col items-center justify-center flex-1 h-full -mt-6"
              >
                <div className="relative">
                  {/* Large teal circle + cart icon */}
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#00A8A3', border: '3px solid #E2E2E2' }}
                  >
                    <img src="/main.svg" alt="Sell" className="h-9 w-9 object-contain" />
                  </div>
                  {/* Small overlapping teal circle + plus */}
                  <div
                    className="absolute -left-0.5 -top-0.5 flex h-6 w-6 items-center justify-center rounded-full p-1"
                    style={{ backgroundColor: '#00A8A3', border: '2px solid #E2E2E2' }}
                  >
                    <img src="/plus.svg" alt="+" className="w-full h-full object-contain" />
                  </div>
                </div>
              
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => { if (guestBlocked && guestGuard(tab.id === 'chat' ? 'chat' : tab.id === 'my' ? 'profile' : 'default')) return; navigate(tab.path); }}
              className={`flex flex-col items-center justify-center flex-1 h-full relative ${!isActive ? 'text-gray-500' : ''}`}
              style={isActive ? { color: '#00A8A3' } : undefined}
            >
              {tab.iconSrc && (
                <span className="relative inline-block">
                  <img
                    src={tab.iconSrc}
                    alt={label}
                    className={`h-[18px] w-[18px] object-contain ${!isActive ? 'opacity-50 grayscale' : ''}`}
                  />
                  {tab.id === 'chat' && unreadChatCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] font-bold border-2 px-0.5"
                      style={{ backgroundColor: '#00A8A3', borderColor: '#00A8A3', color: '#FFFFFF' }}
                    >
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                  {tab.id === 'home' && unreadNotificationCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[10px] font-bold px-0.5"
                      style={{ backgroundColor: '#00A8A3', color: '#fff' }}
                    >
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </span>
                  )}
                </span>
              )}
              <span
                className={`mt-1 mx-0 max-w-full whitespace-nowrap leading-tight ${
                  label.length > 10 ? 'text-[8px]' : label.length > 7 ? 'text-[9px]' : 'text-[10px]'
                }`}
                style={isActive ? { color: '#00A8A3' } : undefined}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};


