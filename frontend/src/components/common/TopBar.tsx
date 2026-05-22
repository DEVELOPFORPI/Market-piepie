import React from 'react';
import { UI_REGION_PLACEHOLDER } from '@/locale/enUI';

interface TopBarProps {
  title?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  onRegionClick?: () => void;
  onSearchClick?: () => void;
  onNotificationClick?: () => void;
  region?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  leftContent,
  rightContent,
  onRegionClick,
  onSearchClick,
  onNotificationClick,
  region = UI_REGION_PLACEHOLDER,
}) => {
  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="relative flex items-center px-4 py-3 h-14">
        {/* Left — title is absolutely centered so this column is not squeezed to ~33% width */}
        <div className="relative z-10 flex flex-1 items-center gap-3">
          {leftContent || (
            <button
              onClick={onRegionClick}
              className="flex items-center gap-1 text-sm font-medium text-gray-700"
            >
              {region} <span className="text-gray-400">▼</span>
            </button>
          )}
        </div>

        {title && (
          <h1
            className="pointer-events-none absolute left-1/2 top-1/2 z-[1] max-w-[calc(100%-5.5rem)] -translate-x-1/2 -translate-y-1/2 text-center text-base font-semibold leading-none text-gray-900 whitespace-nowrap sm:text-lg"
            title={title}
          >
            {title}
          </h1>
        )}

        {/* Right */}
        <div className="relative z-10 flex flex-1 items-center justify-end gap-3">
          {rightContent || (
            <>
              {onSearchClick && (
                <button
                  onClick={onSearchClick}
                  className="p-2 text-gray-600 hover:text-gray-900"
                  aria-label="Search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}
              {onNotificationClick && (
                <button
                  onClick={onNotificationClick}
                  className="p-2 text-gray-600 hover:text-gray-900 relative"
                  aria-label="Notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};



