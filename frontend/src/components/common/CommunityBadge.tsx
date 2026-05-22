import React from 'react';

interface CommunityBadgeProps {
  postCount: number;
  helpfulCount?: number;
}

export const CommunityBadge: React.FC<CommunityBadgeProps> = ({ postCount, helpfulCount = 0 }) => {
  if (postCount === 0 && helpfulCount === 0) return null;

  const getLevel = () => {
    if (helpfulCount >= 50) return { label: 'Community leader', color: 'bg-purple-100 text-purple-700' };
    if (helpfulCount >= 20) return { label: 'Active member', color: 'bg-blue-100 text-blue-700' };
    if (postCount >= 10) return { label: 'Regular contributor', color: 'bg-green-100 text-green-700' };
    return null;
  };

  const level = getLevel();
  if (!level) return null;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${level.color}`}>
      {level.label}
    </span>
  );
};


