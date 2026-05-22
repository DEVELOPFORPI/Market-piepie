import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import {
  getProfile,
  saveProfile,
  getMyUser,
  isProfileImageActivityBadge,
  profileAvatarObjectClass,
} from '@/utils/profileStorage';
import { ACTIVITY_BADGE_DEFINITIONS } from '@/constants/activityBadges';
import { getUnlockedBadgeIds } from '@/utils/activityBadgeStorage';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import {
  DEFAULT_AVATAR_PATH,
  isPlaceholderProfileImage,
  ProfilePersonSilhouetteIcon,
} from '@/components/common/profileAvatarPlaceholder';
import { getRegion } from '@/utils/regionStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { getDisputeCountByUserId } from '@/utils/disputeStorage';
import { getShareCountByUserId } from '@/utils/orderStorage';
import { UI_REGION_PLACEHOLDER } from '@/locale/enUI';

export const ProfileEdit: React.FC = () => {
  const myUser = getMyUser();
  const initialData = {
    kycStatus: myUser.kycStatus,
    trustScore: myUser.trustScore,
    rating: myUser.rating,
    tradeCount: myUser.tradeCount,
  };
  const navigate = useNavigate();
  const stored = getProfile();
  const [profileImage, setProfileImage] = useState(stored.profileImage ?? DEFAULT_AVATAR_PATH);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [nickname, setNickname] = useState(stored.nickname ?? 'My nickname');
  const [bio, setBio] = useState(stored.bio ?? 'I value safe, quick trades.');
  const [activityRegion, setActivityRegion] = useState(stored.activityRegion ?? '');
  const [hasChanges, setHasChanges] = useState(false);
  const [unlockedBadgeBump, setUnlockedBadgeBump] = useState(0);
  const unlockedBadges = useMemo(() => {
    void unlockedBadgeBump;
    return getUnlockedBadgeIds();
  }, [unlockedBadgeBump]);

  useEffect(() => {
    const onBadges = () => setUnlockedBadgeBump((n) => n + 1);
    window.addEventListener('activityBadgesChanged', onBadges);
    return () => window.removeEventListener('activityBadgesChanged', onBadges);
  }, []);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profileImage]);

  // Load region from regionStorage; mark dirty if it differs from profile snapshot
  useEffect(() => {
    const region = getRegion();
    if (region) {
      setActivityRegion(region);
      if (region !== (stored.activityRegion ?? '')) setHasChanges(true);
    }
  }, []);

  useEffect(() => {
    const onRegionChanged = () => {
      const region = getRegion();
      if (region) {
        setActivityRegion(region);
        setHasChanges(true);
      }
    };
    window.addEventListener('regionChanged', onRegionChanged);
    return () => window.removeEventListener('regionChanged', onRegionChanged);
  }, []);

  /** Compress profile photo to small JPEG (max 256px) for storage */
  const compressProfileImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl.startsWith('data:image')) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const max = 256;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          if (w > h) {
            h = Math.round((h * max) / w);
            w = max;
          } else {
            w = Math.round((w * max) / h);
            h = max;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        const compressed = await compressProfileImage(dataUrl);
        setProfileImage(compressed);
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    (async () => {
      let img = profileImage;
      if (img.startsWith('data:') && img.length > 100_000) {
        img = await compressProfileImage(img);
      }
      saveProfile({
        profileImage: img,
        nickname,
        bio,
        activityRegion,
      });
      navigate('/my');
    })();
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Discard them?')) {
        navigate('/my');
      }
    } else {
      navigate('/my');
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={handleCancel} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="Edit profile"
        rightContent={
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-3 py-1.5 text-sm font-medium text-primary disabled:text-gray-400"
          >
            Save
          </button>
        }
      />

      <div className="px-4 py-6 space-y-6">
        {/* Profile Image */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <AvatarWithBadgeOverlay userId={getCurrentUserId()} sizePx={96}>
              <div
                className={`w-full h-full flex items-center justify-center ${
                  isProfileImageActivityBadge(profileImage) ? 'bg-white' : 'bg-gray-200'
                }`}
              >
                {isPlaceholderProfileImage(profileImage) || avatarLoadFailed ? (
                  <ProfilePersonSilhouetteIcon className="w-14 h-14 text-gray-400" />
                ) : (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className={profileAvatarObjectClass(profileImage)}
                    onError={() => setAvatarLoadFailed(true)}
                  />
                )}
              </div>
            </AvatarWithBadgeOverlay>
            <label
              className="absolute bottom-1 left-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 z-10 shadow"
              style={{ backgroundColor: '#00A8A3' }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center px-2 max-w-xs">
            Tap the camera icon to choose a photo
          </p>
        </div>

        <div className="w-full max-w-md mx-auto text-center">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Use an activity badge as photo</h3>
          <p className="text-xs text-gray-500 mb-3 px-1">
            Tap an unlocked badge to set it as your profile image.
          </p>
          {unlockedBadges.size === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4 px-3 bg-gray-50 rounded-xl">
              No badges yet.
            </p>
          ) : (
            <div className="-mx-4 md:mx-0 py-1">
              <div
                className="flex flex-nowrap gap-3 overflow-x-auto overflow-y-visible overscroll-x-contain py-4 px-4 snap-x snap-mandatory touch-pan-x [scrollbar-width:thin]"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {ACTIVITY_BADGE_DEFINITIONS.filter((d) => unlockedBadges.has(d.id)).map(({ id, label }) => {
                  const path = `/Batch/${id}.svg`;
                  const selected = profileImage === path;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setProfileImage(path);
                        setHasChanges(true);
                      }}
                      className={`flex-shrink-0 snap-center w-[68px] h-[68px] rounded-full bg-white flex items-center justify-center p-1.5 transition shadow-sm ${
                        selected ? 'ring-[3px] ring-[#00A8A3] ring-offset-2 ring-offset-white' : 'ring-1 ring-gray-200'
                      }`}
                      title={label}
                      aria-label={`Use ${label} as profile photo`}
                    >
                      <span className="block w-full h-full rounded-full overflow-hidden flex items-center justify-center pointer-events-none">
                        <img src={path} alt="" className="w-full h-full object-contain" draggable={false} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-2 px-4">Swipe sideways for more</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setProfileImage(DEFAULT_AVATAR_PATH);
              setHasChanges(true);
            }}
            className="mt-4 w-full text-center text-xs text-gray-500 underline py-1"
          >
            Reset to default avatar
          </button>
        </div>

        {/* Read-only Info Rows */}
        <div className="space-y-0">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
            <span className="text-sm text-gray-700">KYC</span>
            <div className="flex items-center gap-1.5">
              <img src="/check_1.svg" alt="Verified" className="w-3 h-3" />
              <span className="text-sm font-medium" style={{ color: '#00A8A3' }}>Verified</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
            <span className="text-sm text-gray-700">Trust score</span>
            <span className="text-sm font-semibold" style={{ color: '#00A8A3' }}>
              Trust {initialData.trustScore}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
            <span className="text-sm text-gray-700">Rating</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <img src="/star.svg" alt="Rating" className="w-4 h-4" />
              <span className="text-sm font-medium text-gray-900">
                {initialData.rating.toFixed(1)} · {initialData.tradeCount} trades · {getCurrentUserId() ? getShareCountByUserId(getCurrentUserId()!) : 0} shares
                {getCurrentUserId() && getDisputeCountByUserId(getCurrentUserId()!) > 0 && (
                  <> · {getDisputeCountByUserId(getCurrentUserId()!)} disputes</>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="space-y-5">
          {/* Nickname */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Nickname
            </label>
            <div className="relative">
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Enter nickname"
                maxLength={20}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00A8A3] focus:border-transparent bg-gray-50 text-sm"
              />
              <span className="absolute right-3 bottom-3 text-xs text-gray-400">
                {nickname.length}/20
              </span>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Bio
            </label>
            <div className="relative">
              <textarea
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Tell others about yourself"
                rows={4}
                maxLength={200}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00A8A3] focus:border-transparent bg-gray-50 text-sm resize-none"
              />
              <span className="absolute right-3 bottom-3 text-xs text-gray-400">
                {bio.length}/200
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Region
            </label>
            <button
              type="button"
              onClick={() => navigate('/region/select')}
              className="w-full flex items-center justify-between px-4 py-3 border-2 rounded-xl text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
              style={{ borderColor: activityRegion ? '#00A8A3' : '#e5e7eb' }}
            >
              <span className="text-sm text-gray-700">
                {activityRegion || UI_REGION_PLACEHOLDER}
              </span>
              <span className="text-sm font-medium" style={{ color: '#00A8A3' }}>
                {activityRegion ? 'Change' : 'Set'}
              </span>
            </button>
            {activityRegion && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#00A8A3' }}>
                <img src="/check_1.svg" alt="Verified" className="w-3 h-3" />
                Verified
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};


