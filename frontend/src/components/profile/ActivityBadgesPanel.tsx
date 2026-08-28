import React, { useState, useEffect, useRef } from 'react';
import { ModalShell } from '@/components/common/ModalShell';
import {
  ACTIVITY_BADGE_DEFINITIONS,
  ACTIVITY_BADGE_SVG_SIZE_PX,
} from '@/constants/activityBadges';
import { getLiveBadgePricePi, useAppPrices } from '@/utils/appPrices';
import { getUnlockedBadgeIds, unlockActivityBadge } from '@/utils/activityBadgeStorage';
import { getDisplayActivityBadgeId, setDisplayActivityBadgeId } from '@/utils/profileStorage';
import { piBadgePurchasePayment } from '@/utils/piAuth';
import { useLanguage } from '@/hooks/useLanguage';
import type { AppMessageKey } from '@/hooks/useLanguage';
import { activityBadgeLabelKey } from '@/i18n/badgeNameMessages';
import { showToast } from '@/utils/toast';

const TEAL = '#00A8A3';

function LockIcon() {
  return (
    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );
}

interface PurchaseModal {
  badgeId: string;
  badgeLabel: string;
}

export const ActivityBadgesPanel: React.FC = () => {
  const { t } = useLanguage();
  useAppPrices();
  const [unlocked, setUnlocked] = useState(() => getUnlockedBadgeIds());
  const [displayBadgeId, setDisplayBadgeIdState] = useState(() => getDisplayActivityBadgeId());
  const [purchaseModal, setPurchaseModal] = useState<PurchaseModal | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const purchaseHeldRef = useRef<PurchaseModal | null>(null);
  if (purchaseModal) purchaseHeldRef.current = purchaseModal;
  const purchaseShown = purchaseModal ?? purchaseHeldRef.current;

  useEffect(() => {
    const sync = () => setUnlocked(getUnlockedBadgeIds());
    sync();
    window.addEventListener('activityBadgesChanged', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('activityBadgesChanged', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const syncDisplay = () => setDisplayBadgeIdState(getDisplayActivityBadgeId());
    syncDisplay();
    window.addEventListener('profileDisplayBadgeChanged', syncDisplay);
    window.addEventListener('profileSaved', syncDisplay);
    return () => {
      window.removeEventListener('profileDisplayBadgeChanged', syncDisplay);
      window.removeEventListener('profileSaved', syncDisplay);
    };
  }, []);

  const handleLockedBadgeClick = (badgeId: string, badgeLabel: string) => {
    setPurchaseModal({ badgeId, badgeLabel });
  };

  const handlePurchase = async () => {
    if (!purchaseModal) return;
    setPurchasing(true);
    try {
      const paid = await piBadgePurchasePayment(purchaseModal.badgeId, purchaseModal.badgeLabel);
      if (paid) {
        unlockActivityBadge(purchaseModal.badgeId);
        setUnlocked(getUnlockedBadgeIds());
        setPurchaseModal(null);
      } else {
        showToast(t('paymentCancelled'));
      }
    } catch {
      showToast(t('paymentFailed'));
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-28 bg-white min-h-[50vh]">
      <div className="text-center text-xs text-gray-500 mb-8 px-2 space-y-1">
        <p>{t('badgesEarnHint')}</p>
        <p>{t('badgesTapHint').split(/(?<=[.。．?!])\s+/)[0]?.trim()}</p>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-6 max-w-md mx-auto">
        {ACTIVITY_BADGE_DEFINITIONS.map(({ id, label }) => {
          const isOn = unlocked.has(id);
          const isProfilePick = displayBadgeId === id;
          const labelKey = activityBadgeLabelKey(id);
          const displayLabel = labelKey ? t(labelKey as AppMessageKey) : label;
          return (
            <div key={id} className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() =>
                  isOn
                    ? setDisplayActivityBadgeId(id)
                    : handleLockedBadgeClick(id, displayLabel)
                }
                className={`relative rounded-full flex items-center justify-center mb-2 shrink-0 transition-transform active:scale-[0.97] ${
                  isOn ? 'bg-white cursor-pointer' : 'bg-gray-200 cursor-pointer'
                }`}
                style={{
                  width: ACTIVITY_BADGE_SVG_SIZE_PX,
                  height: ACTIVITY_BADGE_SVG_SIZE_PX,
                  boxShadow: isOn ? `0 0 0 ${isProfilePick ? 3 : 2}px ${TEAL}` : undefined,
                }}
                aria-pressed={isProfilePick}
                aria-label={
                  isOn
                    ? isProfilePick
                      ? t('ariaBadgeFeatured', { name: displayLabel })
                      : t('ariaBadgeSet', { name: displayLabel })
                    : t('ariaBadgeLocked', { name: displayLabel })
                }
              >
                {isOn ? (
                  <img
                    src={`/Batch/${id}.svg`}
                    alt=""
                    width={ACTIVITY_BADGE_SVG_SIZE_PX}
                    height={ACTIVITY_BADGE_SVG_SIZE_PX}
                    className="block max-w-none h-auto object-contain pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <LockIcon />
                )}
                {isProfilePick && (
                  <span
                    className="absolute top-0 right-0 w-6 h-6 rounded-full flex items-center justify-center shadow pointer-events-none"
                    style={{ backgroundColor: TEAL }}
                    aria-hidden
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
              <span
                className="text-xs font-medium leading-tight px-0.5"
                style={{ color: isOn ? TEAL : '#9ca3af' }}
              >
                {displayLabel}
              </span>
            </div>
          );
        })}
      </div>

      <ModalShell
        open={!!purchaseModal}
        onClose={() => { if (!purchasing) setPurchaseModal(null); }}
        zIndex={50}
        panelClassName="w-full max-w-sm overflow-hidden"
      >
        {purchaseShown ? (
          <>
            <div className="flex flex-col items-center px-6 pt-8 pb-4">
              <div
                className="rounded-full bg-gray-200 flex items-center justify-center mb-4"
                style={{ width: ACTIVITY_BADGE_SVG_SIZE_PX + 16, height: ACTIVITY_BADGE_SVG_SIZE_PX + 16 }}
              >
                <LockIcon />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{purchaseShown.badgeLabel}</h3>
              <p className="text-sm text-gray-500 text-center leading-relaxed">
                {t('badgeEarnFree')}
              </p>
              <p className="text-sm text-gray-700 text-center mt-3 font-medium">
                {t('badgeUnlockNow')}
              </p>
              <div className="flex items-center gap-1.5 mt-2 mb-2">
                <img src="/pi_logo.svg" alt="Pi" className="w-5 h-5" />
                <span className="text-xl font-bold" style={{ color: TEAL }}>
                  {getLiveBadgePricePi(purchaseShown.badgeId) ?? 0} Pi
                </span>
              </div>
            </div>

            <div className="flex border-t border-gray-100">
              <button
                type="button"
                onClick={() => setPurchaseModal(null)}
                disabled={purchasing}
                className="flex-1 py-3.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t('close')}
              </button>
              <div className="w-px bg-gray-100" />
              <button
                type="button"
                onClick={handlePurchase}
                disabled={purchasing}
                className="flex-1 py-3.5 text-sm font-bold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: TEAL }}
              >
                {purchasing
                  ? t('processing')
                  : t('payPi', { n: getLiveBadgePricePi(purchaseShown.badgeId) ?? 0 })}
              </button>
            </div>
          </>
        ) : null}
      </ModalShell>
    </div>
  );
};
