import React, { useEffect, useMemo, useState } from 'react';
import { getEffectiveDisplayActivityBadgeIdForUser } from '@/utils/profileStorage';

type Props = {
  userId?: string | null;
  /** Avatar diameter (px) */
  sizePx: number;
  className?: string;
  /** Inner content (image or placeholder) */
  children: React.ReactNode;
};

/** Avatar with featured activity badge overlay (profile, seller, posts, chat) */
export const AvatarWithBadgeOverlay: React.FC<Props> = ({
  userId,
  sizePx,
  className = '',
  children,
}) => {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const on = () => setBump((n) => n + 1);
    window.addEventListener('profileDisplayBadgeChanged', on);
    window.addEventListener('profileSaved', on);
    window.addEventListener('activityBadgesChanged', on);
    return () => {
      window.removeEventListener('profileDisplayBadgeChanged', on);
      window.removeEventListener('profileSaved', on);
      window.removeEventListener('activityBadgesChanged', on);
    };
  }, []);

  const badgeId = useMemo(
    () => getEffectiveDisplayActivityBadgeIdForUser(userId ?? undefined),
    [userId, bump]
  );

  /** White circle behind badge SVG */
  const badgeWrap = Math.max(24, Math.round(sizePx * 0.56));
  const badgeImg = Math.max(22, Math.round(badgeWrap * 0.94));

  return (
    <div
      className={`relative flex-shrink-0 overflow-visible ${className}`}
      style={{ width: sizePx, height: sizePx }}
    >
      <div className="w-full h-full rounded-full overflow-hidden">{children}</div>
      {badgeId && (
        <div
          className="absolute flex items-center justify-center rounded-full bg-white overflow-hidden pointer-events-none"
          style={{
            width: badgeWrap,
            height: badgeWrap,
            bottom: -2,
            right: -2,
          }}
          aria-hidden
        >
          <img
            src={`/Batch/${badgeId}.svg`}
            alt=""
            width={badgeImg}
            height={badgeImg}
            className="object-contain"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
};
