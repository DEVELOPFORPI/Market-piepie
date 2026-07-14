import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';

interface ProfileStatsRowProps {
  rating: number;
  tradeCount: number;
  shareCount: number;
  disputeCount?: number;
  /** Show dispute count chip when > 0 */
  showDisputes?: boolean;
  size?: 'sm' | 'md';
  /** Equal-width pills in one row (profile edit) */
  spread?: boolean;
  /** My profile: row1 = rating + accessory, row2 = trades · shares · disputes */
  variant?: 'default' | 'ownProfile';
  /** Shown beside rating (e.g. KYC on My profile) */
  ratingAccessory?: React.ReactNode;
  /** Center rows (profile edit — matches centered avatar) */
  centered?: boolean;
}

const pillBase =
  'inline-flex items-center justify-center gap-1 rounded-full bg-gray-50 border border-gray-100 shrink-0';

/** Compact count for profile chips — keeps one row (e.g. 1200 → 1.2k) */
function formatCompactCount(value: number): string {
  const n = Math.max(0, Math.floor(value));
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const scaled = n / 1000;
    if (scaled >= 100) return `${Math.round(scaled)}k`;
    if (scaled >= 10) return `${scaled.toFixed(1).replace(/\.0$/, '')}k`;
    return `${scaled.toFixed(1).replace(/\.0$/, '')}k`;
  }
  const scaled = n / 1_000_000;
  if (scaled >= 100) return `${Math.round(scaled)}M`;
  if (scaled >= 10) return `${scaled.toFixed(1).replace(/\.0$/, '')}M`;
  return `${scaled.toFixed(1).replace(/\.0$/, '')}M`;
}

function CountPill({
  value,
  label,
  className,
  valueClassName = 'font-semibold text-gray-800',
}: {
  value: number;
  label: string;
  className: string;
  valueClassName?: string;
}) {
  const display = formatCompactCount(value);
  return (
    <span className={className} title={display !== String(value) ? String(value) : undefined}>
      <span className={`tabular-nums ${valueClassName}`}>{display}</span>
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

export const ProfileStatsRow: React.FC<ProfileStatsRowProps> = ({
  rating,
  tradeCount,
  shareCount,
  disputeCount = 0,
  showDisputes = false,
  size = 'sm',
  spread = false,
  variant = 'default',
  ratingAccessory,
  centered = false,
}) => {
  const { t } = useLanguage();
  const textClass = size === 'md' ? 'text-sm' : 'text-xs';
  const starClass = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const padClass = size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1';
  const mainPillClass = spread
    ? `${pillBase} ${padClass} flex-1 min-w-0`
    : `${pillBase} ${padClass}`;
  const disputePillClass = `${pillBase} ${padClass} text-gray-500`;

  const ratingPill = (
    <span className={mainPillClass}>
      <img src="/star.svg" alt="" className={starClass} aria-hidden />
      <span className="font-semibold text-gray-800">{rating.toFixed(1)}</span>
    </span>
  );

  const tradesPill = (
    <CountPill value={tradeCount} label={t('statTrades')} className={mainPillClass} />
  );

  const sharesPill = (
    <CountPill value={shareCount} label={t('statShares')} className={mainPillClass} />
  );

  const disputePill = showDisputes && disputeCount > 0 ? (
    <CountPill
      value={disputeCount}
      label={t('statDisputes')}
      className={disputePillClass}
      valueClassName="font-semibold text-gray-700"
    />
  ) : null;

  if (variant === 'ownProfile') {
    const ownPillPad = 'px-2 py-1';
    const ownMainPill = `${pillBase} ${ownPillPad}`;
    const ownDisputePill = `${pillBase} ${ownPillPad} text-gray-500`;

    const rowClass = centered
      ? 'flex items-center justify-center gap-2 flex-nowrap'
      : 'flex items-center gap-2 flex-nowrap min-w-0';
    const statsRowClass = centered
      ? 'flex items-center justify-center gap-1.5 flex-nowrap flex-wrap'
      : 'flex items-center gap-1.5 flex-nowrap min-w-0 max-[260px]:flex-wrap';

    return (
      <div className={`space-y-2 ${textClass} text-gray-600 min-w-0 ${centered ? 'mx-auto' : ''}`}>
        <div className={rowClass}>
          {ratingPill}
          {ratingAccessory}
        </div>
        <div className={statsRowClass}>
          <CountPill value={tradeCount} label={t('statTrades')} className={ownMainPill} />
          <CountPill value={shareCount} label={t('statShares')} className={ownMainPill} />
          {showDisputes && disputeCount > 0 && (
            <CountPill
              value={disputeCount}
              label={t('statDisputes')}
              className={ownDisputePill}
              valueClassName="font-semibold text-gray-700"
            />
          )}
        </div>
      </div>
    );
  }

  const showDisputeRow = Boolean(disputePill);

  return (
    <div className={`space-y-2 ${textClass} text-gray-600`}>
      <div
        className={
          spread
            ? 'flex w-full gap-2'
            : 'flex items-center gap-2 flex-wrap'
        }
      >
        {ratingPill}
        {tradesPill}
        {sharesPill}
      </div>
      {showDisputeRow && (
        <div className="flex">
          {disputePill}
        </div>
      )}
    </div>
  );
};
