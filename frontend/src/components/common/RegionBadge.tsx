import React from 'react';

interface RegionBadgeProps {
  region: string;
  verified?: boolean;
}

export const RegionBadge: React.FC<RegionBadgeProps> = ({ region, verified = false }) => {
  if (!region) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-600">📍 {region}</span>
      {verified && (
        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
          Verified
        </span>
      )}
    </div>
  );
};


