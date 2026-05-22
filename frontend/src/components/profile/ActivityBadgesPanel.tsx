import React, { useState, useEffect } from 'react';
import {
  ACTIVITY_BADGE_DEFINITIONS,
  ACTIVITY_BADGE_SVG_SIZE_PX,
} from '@/constants/activityBadges';
import { getUnlockedBadgeIds, unlockActivityBadge } from '@/utils/activityBadgeStorage';
import { getDisplayActivityBadgeId, setDisplayActivityBadgeId } from '@/utils/profileStorage';
import { piBadgePurchasePayment } from '@/utils/piAuth';

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
  const [unlocked, setUnlocked] = useState(() => getUnlockedBadgeIds());
  const [displayBadgeId, setDisplayBadgeIdState] = useState(() => getDisplayActivityBadgeId());
  const [purchaseModal, setPurchaseModal] = useState<PurchaseModal | null>(null);
  const [purchasing, setPurchasing] = useState(false);

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
        alert('Payment cancelled.');
      }
    } catch {
      alert('Payment failed. Please try again in Pi Browser.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-28 bg-white min-h-[50vh]">
      <p className="text-center text-sm text-gray-500 mb-3 px-2">
        Earn badges by trading and joining the community.
      </p>
      <p className="text-center text-xs text-gray-400 mb-8 px-3">
        Tap an unlocked badge to show it on your profile photo. Tap again to clear.
      </p>

      <div className="grid grid-cols-3 gap-x-3 gap-y-6 max-w-md mx-auto">
        {ACTIVITY_BADGE_DEFINITIONS.map(({ id, label }) => {
          const isOn = unlocked.has(id);
          const isProfilePick = displayBadgeId === id;
          return (
            <div key={id} className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() =>
                  isOn
                    ? setDisplayActivityBadgeId(id)
                    : handleLockedBadgeClick(id, label)
                }
                className={`relative rounded-full flex items-center justify-center mb-2 shrink-0 transition-transform active:scale-[0.97] ${
                  isOn
                    ? isProfilePick
                      ? 'bg-white ring-[3px] ring-amber-400 cursor-pointer'
                      : 'bg-white ring-2 ring-[#00A8A3] cursor-pointer'
                    : 'bg-gray-200 cursor-pointer'
                }`}
                style={{
                  width: ACTIVITY_BADGE_SVG_SIZE_PX,
                  height: ACTIVITY_BADGE_SVG_SIZE_PX,
                }}
                aria-pressed={isProfilePick}
                aria-label={
                  isOn
                    ? isProfilePick
                      ? `${label}, featured on profile, tap to remove`
                      : `${label}, tap to set as profile badge`
                    : `${label}, locked — tap to purchase`
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
                    className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-amber-400 text-[10px] font-bold text-white flex items-center justify-center shadow"
                    aria-hidden
                  >
                    Main
                  </span>
                )}
              </button>
              <span
                className="text-xs font-medium leading-tight px-0.5"
                style={{ color: isOn ? TEAL : '#9ca3af' }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Badge Purchase Modal */}
      {purchaseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !purchasing && setPurchaseModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl mx-6 w-full max-w-sm overflow-hidden animate-[fadeInUp_0.25s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center px-6 pt-8 pb-4">
              <div
                className="rounded-full bg-gray-200 flex items-center justify-center mb-4"
                style={{ width: ACTIVITY_BADGE_SVG_SIZE_PX + 16, height: ACTIVITY_BADGE_SVG_SIZE_PX + 16 }}
              >
                <LockIcon />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{purchaseModal.badgeLabel}</h3>
              <p className="text-sm text-gray-500 text-center leading-relaxed">
                Complete missions to earn this badge for free.
              </p>
              <p className="text-sm text-gray-700 text-center mt-3 font-medium">
                Want to unlock it now?
              </p>
              <div className="flex items-center gap-1.5 mt-2 mb-2">
                <img src="/pi_logo.svg" alt="Pi" className="w-5 h-5" />
                <span className="text-xl font-bold" style={{ color: TEAL }}>0.01 Pi</span>
              </div>
            </div>

            <div className="flex border-t border-gray-100">
              <button
                type="button"
                onClick={() => setPurchaseModal(null)}
                disabled={purchasing}
                className="flex-1 py-3.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Close
              </button>
              <div className="w-px bg-gray-100" />
              <button
                type="button"
                onClick={handlePurchase}
                disabled={purchasing}
                className="flex-1 py-3.5 text-sm font-bold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: TEAL }}
              >
                {purchasing ? 'Processing...' : 'Pay 0.01 Pi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
