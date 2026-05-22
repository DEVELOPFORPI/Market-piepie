import React from 'react';
import { User } from '@/types';
import { KYCBadge } from './KYCBadge';
import { TrustBadge } from './TrustBadge';
import { AvatarWithBadgeOverlay } from './AvatarWithBadgeOverlay';
import { getDisputeCountByUserId } from '@/utils/disputeStorage';
import { getShareCountByUserId } from '@/utils/orderStorage';
import { resolveProfileAvatarUrl, resolveDisplayNickname } from '@/utils/profileStorage';
import { UserAvatarImage } from './UserAvatarImage';

interface SellerMiniCardProps {
  seller: User;
  onClick?: () => void;
}

export const SellerMiniCard: React.FC<SellerMiniCardProps> = ({ seller, onClick }) => {
  const profileImage = resolveProfileAvatarUrl(seller.id, seller.profileImage);
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50/80 transition-colors"
    >
      <AvatarWithBadgeOverlay userId={seller.id} sizePx={40}>
        <UserAvatarImage src={profileImage} alt={seller.nickname} />
      </AvatarWithBadgeOverlay>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-base font-bold text-gray-900">{resolveDisplayNickname(seller.id, seller.nickname)}</span>
          <KYCBadge status={seller.kycStatus} userId={seller.id} />
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <TrustBadge score={seller.trustScore} />
          <span className="text-gray-400">·</span>
          <span className="inline-flex items-center gap-0.5 text-gray-500">
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#00A8A3' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {seller.rating.toFixed(1)}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{seller.tradeCount} trades</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{seller.id ? getShareCountByUserId(seller.id) : 0} shares</span>
          {seller.id && getDisputeCountByUserId(seller.id) > 0 && (
            <>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{getDisputeCountByUserId(seller.id)} disputes</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
