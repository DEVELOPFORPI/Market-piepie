import React, { useEffect, useMemo, useState } from 'react';
import { ACTIVITY_BADGE_DEFINITIONS } from '@/constants/activityBadges';
import { activityBadgeLabelKey } from '@/i18n/badgeNameMessages';
import { useLanguage } from '@/hooks/useLanguage';
import type { AppMessageKey } from '@/hooks/useLanguage';
import { getUnlockedBadgeIds } from '@/utils/activityBadgeStorage';
import { activityBadgeAvatarUrl } from '@/utils/profileStorage';

type Props = {
  selectedId?: string | null;
  onSelect?: (badgeId: string) => void;
};

const TEAL = '#00A8A3';

export const CollectedBadgesRow: React.FC<Props> = ({ selectedId = null, onSelect }) => {
  const { t } = useLanguage();
  const [unlocked, setUnlocked] = useState(() => getUnlockedBadgeIds());

  useEffect(() => {
    const sync = () => setUnlocked(getUnlockedBadgeIds());
    window.addEventListener('activityBadgesChanged', sync);
    return () => window.removeEventListener('activityBadgesChanged', sync);
  }, []);

  const collected = useMemo(
    () => ACTIVITY_BADGE_DEFINITIONS.filter((b) => unlocked.has(b.id)),
    [unlocked],
  );

  if (collected.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-2">{t('activityBadges')}</p>
      <div className="flex flex-wrap gap-2">
        {collected.map((badge) => {
          const labelKey = activityBadgeLabelKey(badge.id);
          const label = labelKey ? t(labelKey as AppMessageKey) : badge.label;
          const selected = selectedId === badge.id;
          const inner = (
            <img
              src={activityBadgeAvatarUrl(badge.id)}
              alt=""
              width={40}
              height={40}
              className="block object-contain"
              draggable={false}
            />
          );
          return onSelect ? (
            <button
              key={badge.id}
              type="button"
              onClick={() => onSelect(badge.id)}
              className="relative rounded-full p-0.5"
              style={{ boxShadow: `0 0 0 ${selected ? 3 : 2}px ${TEAL}` }}
              aria-pressed={selected}
              aria-label={
                selected
                  ? t('ariaBadgeFeatured', { name: label })
                  : t('ariaBadgeSet', { name: label })
              }
            >
              {inner}
              {selected ? (
                <span
                  className="absolute top-0 right-0 w-5 h-5 rounded-full flex items-center justify-center shadow pointer-events-none"
                  style={{ backgroundColor: TEAL }}
                  aria-hidden
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : null}
            </button>
          ) : (
            <span
              key={badge.id}
              className="rounded-full p-0.5"
              style={{ boxShadow: `0 0 0 2px ${TEAL}` }}
              title={label}
            >
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
};
