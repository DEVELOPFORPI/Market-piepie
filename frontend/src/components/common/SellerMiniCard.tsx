import React from 'react';
import { User } from '@/types';
import { KYCBadge } from './KYCBadge';
import { AvatarWithBadgeOverlay } from './AvatarWithBadgeOverlay';
import { getPaidTradeCountByUserId, getShareCountByUserId } from '@/utils/orderStorage';
import { resolveProfileAvatarUrl, resolveDisplayNickname } from '@/utils/profileStorage';
import { UserAvatarImage } from './UserAvatarImage';
import { ProfileStatsRow } from './ProfileStatsRow';

interface SellerMiniCardProps {
  seller: User;
  onClick?: () => void;
}

export const SellerMiniCard: React.FC<SellerMiniCardProps> = ({ seller, onClick }) => {
  const profileImage = resolveProfileAvatarUrl(seller.id, seller.profileImage);
  const tradeCount = seller.id ? getPaidTradeCountByUserId(seller.id) : seller.tradeCount;
  const shareCount = seller.id ? getShareCountByUserId(seller.id) : 0;

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
        <ProfileStatsRow rating={seller.rating} tradeCount={tradeCount} shareCount={shareCount} />
      </div>
    </div>
  );
};
