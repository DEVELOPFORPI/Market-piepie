import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMyUser, isProfileImageActivityBadge, profileAvatarObjectClass } from '@/utils/profileStorage';
import { getCurrentUserId, isGuestUser } from '@/utils/authStorage';
import { syncMyProfileFromDB } from '@/utils/dbSync';
import { getDisputeCountByUserId } from '@/utils/disputeStorage';
import { getPaidTradeCountByUserId, getShareCountByUserId } from '@/utils/orderStorage';
import { ActivityBadgesPanel } from '@/components/profile/ActivityBadgesPanel';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import { ProfileStatsRow } from '@/components/common/ProfileStatsRow';
import { KYCBadge } from '@/components/common/KYCBadge';
import {
  isPlaceholderProfileImage,
  ProfilePersonSilhouetteIcon,
} from '@/components/common/profileAvatarPlaceholder';
import { isGuest } from '@/utils/guestGate';
import { useLanguage } from '@/hooks/useLanguage';
import type { AppMessageKey } from '@/hooks/useLanguage';

const TEAL = '#00A8A3';
type ProfileTab = 'info' | 'badges';

export const My: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    if (isGuest()) navigate('/welcome', { replace: true });
  }, [navigate]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(() => getMyUser());
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    const refresh = () => setUser(getMyUser());
    const uid = getCurrentUserId();
    if (uid) {
      void syncMyProfileFromDB(uid).then(refresh);
    }
    window.addEventListener('profileSaved', refresh);
    return () => window.removeEventListener('profileSaved', refresh);
  }, []);
  /** Sync with bottom nav: App hides nav when ?tab=badges */
  const profileTab: ProfileTab =
    searchParams.get('tab') === 'badges' ? 'badges' : 'info';
  const goProfileTab = (tab: ProfileTab) => {
    if (tab === 'badges') setSearchParams({ tab: 'badges' }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user.profileImage]);

  const showAvatarPlaceholder =
    isPlaceholderProfileImage(user.profileImage) || avatarLoadFailed;

  const menuItems: { labelKey: AppMessageKey; icon: string; path: string }[] = [
    { labelKey: 'myListings', icon: '/profile/1.svg', path: '/my/products' },
    { labelKey: 'saved', icon: '/profile/2.svg', path: '/my/favorites' },
    { labelKey: 'orders', icon: '/profile/3.svg', path: '/my/orders' },
    { labelKey: 'myPosts', icon: '/profile/5.svg', path: '/my/posts' },
    { labelKey: 'reviews', icon: '/profile/6.svg', path: '/my/reviews' },
    { labelKey: 'inquiries', icon: '/profile/9.svg', path: '/my/inquiries' },
    { labelKey: 'disputes', icon: '/profile/4.svg', path: '/my/disputes' },
    { labelKey: 'settings', icon: '/profile/7.svg', path: '/settings' },
  ];

  return (
    <div
      className={`min-h-screen bg-gray-50 ${profileTab === 'badges' ? 'pb-6' : 'pb-20'}`}
    >
      {/* Header + tabs */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        {profileTab === 'info' ? (
          <div className="flex items-center justify-between px-4 h-14">
            <div className="w-20" />
            <h1 className="text-lg font-bold text-gray-900">{t('myTitle')}</h1>
            <button
              type="button"
              onClick={() => navigate('/profile/edit')}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('editProfile')}
            </button>
          </div>
        ) : (
          <div className="relative flex items-center px-2 h-14">
            <div className="relative z-10 flex w-11 shrink-0 items-center justify-start">
              <button
                type="button"
                onClick={() => goProfileTab('info')}
                className="p-2 text-gray-800"
                aria-label={t('back')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <h1
              className="pointer-events-none absolute left-1/2 top-1/2 z-[1] max-w-[calc(100%-5.5rem)] -translate-x-1/2 -translate-y-1/2 text-center text-base font-bold leading-none text-gray-900 whitespace-nowrap sm:text-lg"
              title={t('activityBadges')}
            >
              {t('activityBadges')}
            </h1>
            {/* Same width as back column so the title stays visually centered */}
            <span aria-hidden className="ml-auto w-11 shrink-0" />
          </div>
        )}

        <div className="flex border-t border-gray-100">
          <button
            type="button"
            onClick={() => goProfileTab('info')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              profileTab === 'info' ? 'border-b-2' : 'text-gray-500 border-b-2 border-transparent'
            }`}
            style={
              profileTab === 'info'
                ? { color: TEAL, borderBottomColor: TEAL }
                : undefined
            }
          >
            {t('profileTab')}
          </button>
          <button
            type="button"
            onClick={() => goProfileTab('badges')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              profileTab === 'badges' ? 'border-b-2' : 'text-gray-500 border-b-2 border-transparent'
            }`}
            style={
              profileTab === 'badges'
                ? { color: TEAL, borderBottomColor: TEAL }
                : undefined
            }
          >
            {t('badgesTab')}
          </button>
        </div>
      </div>

      {profileTab === 'badges' ? (
        <ActivityBadgesPanel />
      ) : (
        <>
      {/* Profile Card */}
      <div className="bg-white px-5 py-5">
        <div className="flex items-center gap-4">
          <AvatarWithBadgeOverlay userId={getCurrentUserId()} sizePx={64}>
            <div
              className={`w-full h-full flex items-center justify-center ${
                showAvatarPlaceholder
                  ? 'bg-gray-200'
                  : isProfileImageActivityBadge(user.profileImage)
                    ? 'bg-white'
                    : 'bg-gray-200'
              }`}
            >
              {showAvatarPlaceholder ? (
                <ProfilePersonSilhouetteIcon className="w-9 h-9 text-gray-500" />
              ) : (
                <img
                  src={user.profileImage}
                  alt=""
                  className={profileAvatarObjectClass(user.profileImage)}
                  onError={() => setAvatarLoadFailed(true)}
                />
              )}
            </div>
          </AvatarWithBadgeOverlay>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name + KYC / Guest */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold text-gray-900 truncate">
                {user.nickname}
              </span>
              {isGuestUser() && (
                <span className="text-xs font-medium flex-shrink-0 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {t('guest')}
                </span>
              )}
            </div>
            <ProfileStatsRow
              variant="ownProfile"
              rating={user.rating}
              tradeCount={getCurrentUserId() ? getPaidTradeCountByUserId(getCurrentUserId()!) : user.tradeCount}
              shareCount={getCurrentUserId() ? getShareCountByUserId(getCurrentUserId()!) : 0}
              disputeCount={getCurrentUserId() ? getDisputeCountByUserId(getCurrentUserId()!) : 0}
              showDisputes
              ratingAccessory={
                !isGuestUser() ? (
                  <KYCBadge status={user.kycStatus} userId={getCurrentUserId() ?? undefined} />
                ) : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="mt-3 px-4 space-y-2">
        {menuItems.map((item) => {
          const label = t(item.labelKey);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-4 px-4 py-5 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left shadow-sm"
            >
              {/* Icon */}
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <img src={item.icon} alt={label} className="max-w-[20px] max-h-[20px]" />
              </div>
              {/* Label */}
              <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
              {/* Chevron */}
              <svg
                className="w-5 h-5 text-gray-300 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
};
