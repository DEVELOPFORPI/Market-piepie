import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import {
  getProfile,
  saveProfile,
  getMyUser,
  isProfileImageActivityBadge,
  profileAvatarObjectClass,
} from '@/utils/profileStorage';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import {
  DEFAULT_AVATAR_PATH,
  isPlaceholderProfileImage,
  ProfilePersonSilhouetteIcon,
} from '@/components/common/profileAvatarPlaceholder';
import { getRegion } from '@/utils/regionStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { saveMyProfileToDB } from '@/utils/dbSync';
import { getDisputeCountByUserId } from '@/utils/disputeStorage';
import { getShareCountByUserId } from '@/utils/orderStorage';
import { UI_REGION_PLACEHOLDER } from '@/locale/enUI';
import { uploadImageReferenceToR2, uploadImageToR2 } from '@/utils/imageUpload';

export const ProfileEdit: React.FC = () => {
  const myUser = getMyUser();
  const initialData = {
    kycStatus: myUser.kycStatus,
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
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadImageToR2(file, { folder: 'profiles' });
      setProfileImage(url);
      setHasChanges(true);
    } catch {
      alert('Could not upload image.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    (async () => {
      let img = profileImage;
      try {
        img = await uploadImageReferenceToR2(profileImage, { folder: 'profiles' });
      } catch {
        alert('Could not upload image.');
        return;
      }
      const profileData = {
        profileImage: img,
        nickname,
        bio,
        activityRegion,
      };
      // DB가 원본: 서버 저장 성공 후에만 완료 처리
      const uid = getCurrentUserId();
      if (uid && !uid.startsWith('guest_')) {
        const ok = await saveMyProfileToDB(uid, profileData);
        if (!ok) {
          alert('Could not save profile to server. Check your connection and try again.');
          return;
        }
      }
      saveProfile(profileData);
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
            disabled={!hasChanges || uploadingImage}
            className="px-3 py-1.5 text-sm font-medium text-primary disabled:text-gray-400"
          >
            {uploadingImage ? 'Uploading...' : 'Save'}
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


