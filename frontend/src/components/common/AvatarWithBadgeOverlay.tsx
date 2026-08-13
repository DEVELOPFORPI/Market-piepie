import React, { useEffect, useMemo, useState } from 'react';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { isPlaceholderProfileImage } from '@/components/common/profileAvatarPlaceholder';
import {
  activityBadgeAvatarUrl,
  getEffectiveDisplayActivityBadgeIdForUser,
  getProfileByUserId,
} from '@/utils/profileStorage';

type Props = {
  userId?: string | null;
  /** Avatar diameter (px) */
  sizePx: number;
  className?: string;
  /** When false, always show children (used while picking a new photo) */
  useFeaturedBadge?: boolean;
  /** Inner content (image or placeholder) */
  children: React.ReactNode;
};

/** Avatar: featured badge replaces the photo; otherwise shows children */
export const AvatarWithBadgeOverlay: React.FC<Props> = ({
  userId,
  sizePx,
  className = '',
  useFeaturedBadge = true,
  children,
}) => {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const on = () => setBump((n) => n + 1);
    window.addEventListener('profileDisplayBadgeChanged', on);
    window.addEventListener('profileSaved', on);
    window.addEventListener('activityBadgesChanged', on);
    window.addEventListener('userProfilesChanged', on);
    return () => {
      window.removeEventListener('profileDisplayBadgeChanged', on);
      window.removeEventListener('profileSaved', on);
      window.removeEventListener('activityBadgesChanged', on);
      window.removeEventListener('userProfilesChanged', on);
    };
  }, []);

  const badgeId = useMemo(
    () => (useFeaturedBadge ? getEffectiveDisplayActivityBadgeIdForUser(userId ?? undefined) : null),
    [userId, bump, useFeaturedBadge],
  );
  const cachedPhoto = useMemo(() => {
    if (!userId || badgeId) return null;
    const stored = getProfileByUserId(userId)?.profileImage;
    if (!stored || isPlaceholderProfileImage(stored)) return null;
    return stored;
  }, [userId, badgeId, bump]);

  return (
    <div
      className={`relative flex-shrink-0 overflow-visible ${className}`}
      style={{ width: sizePx, height: sizePx }}
    >
      <div className="w-full h-full rounded-full overflow-hidden">
        {badgeId ? (
          <img
            src={activityBadgeAvatarUrl(badgeId)}
            alt=""
            className="w-full h-full object-contain bg-white"
            draggable={false}
          />
        ) : useFeaturedBadge && cachedPhoto ? (
          <UserAvatarImage src={cachedPhoto} />
        ) : (
          children
        )}
      </div>
    </div>
  );
};
