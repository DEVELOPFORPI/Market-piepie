import React from 'react';
import { KYCStatus } from '@/types';

interface KYCBadgeProps {
  status: KYCStatus;
  userId?: string;
}

export const KYCBadge: React.FC<KYCBadgeProps> = ({ status, userId }) => {
  const isGuest = userId ? userId.startsWith('guest_') : false;

  if (isGuest) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-xs font-medium text-gray-500 align-middle leading-none">
        Guest
      </span>
    );
  }

  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 align-middle leading-none">
        <span className="text-sm font-medium leading-none" style={{ color: '#00A8A3' }}>KYC</span>
        <span
          className="w-2.5 h-2.5 rounded-full inline-flex items-center justify-center flex-shrink-0 align-middle"
          style={{ backgroundColor: '#00A8A3' }}
        >
          <svg className="w-1.5 h-1.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-500">KYC not verified</span>
  );
};



