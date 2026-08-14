import React, { useEffect, useMemo, useState } from 'react';
import {
  activityBadgeAvatarUrl,
  getEffectiveDisplayActivityBadgeIdForUser,
} from '@/utils/profileStorage';

type Props = {
  userId?: string | null;
  /** Avatar diameter (px) */
  sizePx: number;
  className?: string;
  /** When false, hide the small overlay (e.g. while picking a new photo) */
  useFeaturedBadge?: boolean;
  /** Inner content (image or placeholder) */
  children: React.ReactNode;
};

const TEAL = '#00A8A3';

/** Avatar photo plus optional small overlay from Activity badges */
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

  const markPx = Math.max(22, Math.round(sizePx * 0.5));

  return (
    <div
      className={`relative flex-shrink-0 overflow-visible ${className}`}
      style={{ width: sizePx, height: sizePx }}
    >
      <div className="w-full h-full rounded-full overflow-hidden">
        {children}
      </div>
      {badgeId ? (
        <img
          src={activityBadgeAvatarUrl(badgeId)}
          alt=""
          width={markPx}
          height={markPx}
          className="absolute -bottom-1 -right-1 rounded-full object-contain shadow-sm"
          style={{ backgroundColor: '#fff', boxShadow: `0 0 0 2px ${TEAL}` }}
          draggable={false}
        />
      ) : null}
    </div>
  );
};
