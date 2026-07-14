import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnreadCount } from '@/utils/notificationStorage';
import { useLanguage } from '@/hooks/useLanguage';

type NotificationBellButtonProps = {
  className?: string;
};

export const NotificationBellButton: React.FC<NotificationBellButtonProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const refresh = () => setUnreadCount(getUnreadCount());
    refresh();
    window.addEventListener('notificationsChanged', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('notificationsChanged', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => navigate('/notifications')}
      className={`relative p-2 ${unreadCount > 0 ? 'text-[#00A8A3]' : 'text-gray-900 hover:text-gray-600'} ${className}`}
      aria-label={t('notifications')}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {unreadCount > 0 && (
        <span
          className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: '#00A8A3' }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};
