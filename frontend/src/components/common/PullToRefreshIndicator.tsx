import React from 'react';

interface PullToRefreshIndicatorProps {
  pull: number;
  refreshing: boolean;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({ pull, refreshing }) => {
  if (pull < 8 && !refreshing) return null;
  const opacity = refreshing ? 1 : Math.min(pull / 70, 1);
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-[15] flex justify-center"
      style={{ top: -36, opacity }}
    >
      <div className="flex items-center gap-2 bg-white/95 rounded-full px-3 py-1.5 shadow-sm border border-gray-100 text-xs text-gray-600">
        {refreshing ? (
          <>
            <span className="w-4 h-4 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
            Refreshing...
          </>
        ) : (
          <span>Pull to refresh</span>
        )}
      </div>
    </div>
  );
};
