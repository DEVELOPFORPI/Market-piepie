import React from 'react';
import { TrustScore } from '@/types';

interface TrustBadgeProps {
  score: TrustScore;
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ score }) => {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-gray-500">Trust</span>
      <span className="text-xs font-semibold" style={{ color: '#00A8A3' }}>{score}</span>
    </span>
  );
};



