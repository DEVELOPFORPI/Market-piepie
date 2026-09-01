import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { FilePickerInput } from '@/components/common/FilePickerInput';
import {
  getProfile,
  saveProfile,
  getMyUser,
  isProfileImageActivityBadge,
  profileAvatarObjectClass,
  activityBadgeAvatarUrl,
  profileImageToBadgeId,
  rememberLastProfilePhoto,
} from '@/utils/profileStorage';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import {
  DEFAULT_AVATAR_PATH,
  isPlaceholderProfileImage,
  ProfilePersonSilhouetteIcon,
} from '@/components/common/profileAvatarPlaceholder';
import { getRegion } from '@/utils/regionStorage';
import { getCurrentUserId, isGuestUser } from '@/utils/authStorage';
import { getDisputeCountByUserId } from '@/utils/disputeStorage';
import { getPaidTradeCountByUserId, getShareCountByUserId } from '@/utils/orderStorage';
import { createLocalPreviewUrls, revokeLocalPreviewUrl, uploadImageReferenceToR2 } from '@/utils/imageUpload';
import { ProfileStatsRow } from '@/components/common/ProfileStatsRow';
import { KYCBadge } from '@/components/common/KYCBadge';
import { CollectedBadgesRow } from '@/components/profile/CollectedBadgesRow';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useLanguage } from '@/hooks/useLanguage';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';
import { showToast } from '@/utils/toast';

export const ProfileEdit: React.FC = () => {
  useGuestPageGuard('profile');
  const { t } = useLanguage();
  const myUser = getMyUser();
  const initialData = {
    kycStatus: myUser.kycStatus,
    rating: myUser.rating,
    tradeCount: myUser.tradeCount,
  };
  const navigate = useNavigate();
  const stored = getProfile();
  const [profileImage, setProfileImage] = useState(stored.profileImage ?? DEFAULT_AVATAR_PATH);
  const [lastPhoto, setLastPhoto] = useState(
    () => rememberLastProfilePhoto(stored.profileImage) ?? stored.lastProfilePhoto,
  );
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [nickname, setNickname] = useState(stored.nickname ?? 'My nickname');
  const [bio, setBio] = useState(stored.bio ?? 'I value safe, quick trades.');
  const [activityRegion, setActivityRegion] = useState(stored.activityRegion ?? '');
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { askConfirm, confirmDialog } = useConfirmDialog();

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    void (async () => {
      const previews = await createLocalPreviewUrls(files.slice(0, 1));
      if (previews.length === 0) {
        showToast(t('couldNotUpload'));
        return;
      }
      revokeLocalPreviewUrl(profileImage);
      setProfileImage(previews[0]);
      setHasChanges(true);
    })();
  };

  const handleSave = () => {
    void (async () => {
      setUploadingImage(true);
      let img = profileImage;
      try {
        img = await uploadImageReferenceToR2(profileImage, { folder: 'profiles' });
      } catch {
        showToast(t('couldNotUpload'));
        return;
      } finally {
        setUploadingImage(false);
      }
      const profileData = {
        profileImage: img,
        nickname,
        bio,
        activityRegion,
        lastProfilePhoto: rememberLastProfilePhoto(img) ?? lastPhoto,
      };
      const ok = await saveProfile(profileData);
      if (!ok) {
        showToast(t('couldNotSaveProfile'));
        return;
      }
      if (profileImage.startsWith('blob:')) revokeLocalPreviewUrl(profileImage);
      navigate('/my');
    })();
  };

  const handleCancel = () => {
    void (async () => {
      if (hasChanges) {
        const ok = await askConfirm({
          message: t('discardUnsavedConfirm'),
          confirmLabel: t('discardUnsaved'),
          cancelLabel: t('cancel'),
        });
        if (!ok) return;
      }
      revokeLocalPreviewUrl(profileImage);
      navigate('/my');
    })();
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={handleCancel} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('editProfile')}
        rightContent={
          <button
            onClick={handleSave}
            disabled={!hasChanges || uploadingImage}
            className="px-3 py-1.5 text-sm font-medium text-primary disabled:text-gray-400"
          >
            {uploadingImage ? t('uploading') : t('save')}
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
                    alt={t('profileAlt')}
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
              <FilePickerInput onChange={handleImageUpload} />
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </label>
          </div>
        </div>

        {/* Read-only stats — same layout as My profile */}
        <div className="border-t border-b border-gray-100 py-4">
          <ProfileStatsRow
            variant="ownProfile"
            centered
            rating={initialData.rating}
            tradeCount={getCurrentUserId() ? getPaidTradeCountByUserId(getCurrentUserId()!) : initialData.tradeCount}
            shareCount={getCurrentUserId() ? getShareCountByUserId(getCurrentUserId()!) : 0}
            disputeCount={getCurrentUserId() ? getDisputeCountByUserId(getCurrentUserId()!) : 0}
            showDisputes
            ratingAccessory={
              !isGuestUser() ? (
                <KYCBadge status={initialData.kycStatus} userId={getCurrentUserId() ?? undefined} />
              ) : undefined
            }
          />
        </div>

        {/* Editable Fields */}
        <div className="space-y-5">
          <CollectedBadgesRow
            selectedId={profileImageToBadgeId(profileImage)}
            onSelect={(id) => {
              if (profileImageToBadgeId(profileImage) === id) {
                setProfileImage(lastPhoto || DEFAULT_AVATAR_PATH);
              } else {
                const currentPhoto = rememberLastProfilePhoto(profileImage);
                if (currentPhoto) setLastPhoto(currentPhoto);
                revokeLocalPreviewUrl(profileImage);
                setProfileImage(activityBadgeAvatarUrl(id));
              }
              setHasChanges(true);
            }}
          />

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              {t('nicknameLabel')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setHasChanges(true);
                }}
                placeholder={t('nicknamePlaceholder')}
                maxLength={20}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00A8A3] focus:border-transparent bg-gray-50 text-sm"
              />
              <span className="absolute right-3 bottom-3 text-xs text-gray-400">
                {nickname.length}/20
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              {t('bioLabel')}
            </label>
            <div className="relative">
              <textarea
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  setHasChanges(true);
                }}
                placeholder={t('bioPlaceholder')}
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
              {t('regionLabel')}
            </label>
            <button
              type="button"
              onClick={() => navigate('/region/select')}
              className="w-full flex items-center justify-between px-4 py-3 border-2 rounded-xl text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
              style={{ borderColor: activityRegion ? '#00A8A3' : '#e5e7eb' }}
            >
              <span className={`text-sm ${activityRegion ? 'text-gray-700' : 'text-gray-400'}`}>
                {activityRegion || t('regionUnset')}
              </span>
              <span className="text-sm font-medium" style={{ color: '#00A8A3' }}>
                {activityRegion ? t('change') : t('setRegion')}
              </span>
            </button>
            {activityRegion && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#00A8A3' }}>
                <img src="/check_1.svg" alt={t('verified')} className="w-3 h-3" />
                {t('verified')}
              </p>
            )}
          </div>
        </div>

      </div>

      {confirmDialog}
    </div>
  );
};
