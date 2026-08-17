import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { saveProfile } from '@/utils/profileStorage';
import { getRegion } from '@/utils/regionStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { isDeviceProfileOnce, setOnboardingComplete, isOnboardingComplete } from '@/utils/onboardingStorage';
import { uploadImageReferenceToR2, uploadImageToR2 } from '@/utils/imageUpload';
import { suggestPiePieNickname } from '@/utils/nickname';
import { saveMyProfileToDB } from '@/utils/dbSync';
import { useLanguage } from '@/hooks/useLanguage';
import { showToast } from '@/utils/toast';

const TEAL = '#00A8A3';

const DRAFT_KEY = 'signup_profile_draft';

function saveDraft(data: { nickname: string; bio: string; profileImage: string | null }) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadDraft(): { nickname: string; bio: string; profileImage: string | null } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/** Sign-up: nickname, bio, region, profile photo */
export const SignupProfile: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const draft = loadDraft();
  const [nickname, setNickname] = useState(draft?.nickname || '');
  const [bio, setBio] = useState(draft?.bio ?? '');
  /** null = gray circle + icon; set = uploaded image */
  const [profileImage, setProfileImage] = useState<string | null>(draft?.profileImage ?? null);
  const [activityRegion, setActivityRegion] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const uid = getCurrentUserId();
    if (!uid) {
      navigate('/welcome', { replace: true });
      return;
    }
    if (isOnboardingComplete()) {
      navigate('/', { replace: true });
      return;
    }
    if (isDeviceProfileOnce()) {
      navigate('/login-app', { replace: true });
    }
  }, [navigate]);

  // 닉네임 비어 있으면 PiePie + 랜덤 7자리 (서버에서 중복 제거)
  useEffect(() => {
    if (draft?.nickname?.trim()) return;
    let cancelled = false;
    void suggestPiePieNickname().then((n) => {
      if (!cancelled) setNickname(n);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft는 최초 마운트 시만
  }, []);

  useEffect(() => {
    const r = getRegion();
    if (r) setActivityRegion(r);
    const onRegion = () => {
      const nr = getRegion();
      if (nr) setActivityRegion(nr);
    };
    window.addEventListener('regionChanged', onRegion);
    return () => window.removeEventListener('regionChanged', onRegion);
  }, []);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      setProfileImage(await uploadImageToR2(file, { folder: 'profiles' }));
    } catch {
      showToast(t('couldNotUpload'));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    const n = nickname.trim();
    if (n.length < 2) {
      showToast(t('nicknameMin2'));
      return;
    }
    if (n.length > 20) {
      showToast(t('nicknameMax20'));
      return;
    }
    const region = activityRegion.trim() || getRegion() || '';
    let uploadedProfileImage = profileImage;
    if (uploadedProfileImage) {
      try {
        uploadedProfileImage = await uploadImageReferenceToR2(uploadedProfileImage, { folder: 'profiles' });
      } catch {
        showToast(t('couldNotUpload'));
        return;
      }
    }

    const profileData = {
      nickname: n,
      bio: bio.trim() || t('defaultBio'),
      activityRegion: region,
      profileImage: uploadedProfileImage ?? '/default-avatar.jpg',
    };

    // DB가 원본: 서버 저장이 성공해야 가입 완료 (실패 시 users 누락 방지)
    const uid = getCurrentUserId();
    if (uid && !uid.startsWith('guest_')) {
      setSavingProfile(true);
      const ok = await saveMyProfileToDB(uid, profileData);
      setSavingProfile(false);
      if (!ok) {
        showToast(t('couldNotSaveProfile'));
        return;
      }
    }

    saveProfile(profileData);
    clearDraft();
    setOnboardingComplete();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      <TopBar
        leftContent={
          <button type="button" onClick={() => navigate('/welcome')} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('createProfile')}
      />

      <div className="px-5 pt-6 space-y-6 max-w-lg mx-auto">
        <div className="flex flex-col items-center">
          <p className="text-sm text-gray-500 text-center mb-6 px-2 leading-relaxed">
            {t('setupProfileHint')}
          </p>

          <label
            htmlFor="signup-profile-file"
            className="relative w-[110px] h-[110px] shrink-0 cursor-pointer block"
          >
            <span className="sr-only">{t('chooseProfilePhoto')}</span>
            <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              {profileImage ? (
                <img src={profileImage} alt="" className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <svg
                  className="w-[48px] h-[48px] text-white pointer-events-none"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </div>
            <span
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white active:opacity-90 pointer-events-none"
              style={{ backgroundColor: TEAL }}
              aria-hidden
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </span>
            <input
              id="signup-profile-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImage}
            />
          </label>
          <span className="text-xs text-gray-400 mt-3">{t('profilePhotoOptional')}</span>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">{t('nicknameLabel')} *</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('nicknameLengthPh')}
            maxLength={20}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00A8A3] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">{t('bioLabel')}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('bioOptionalPh')}
            rows={3}
            maxLength={200}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">{t('areaLabel')}</label>
          <button
            type="button"
            onClick={() => { saveDraft({ nickname, bio, profileImage }); navigate('/region/select'); }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-left text-gray-800 flex justify-between items-center"
          >
            <span>{activityRegion || getRegion() || t('regionPlaceholder')}</span>
            <span className="text-gray-400">›</span>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-white border-t border-gray-100">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={uploadingImage || savingProfile}
          className="w-full py-4 rounded-full text-white text-base font-bold"
          style={{ backgroundColor: TEAL }}
        >
          {uploadingImage ? t('uploading') : savingProfile ? t('saving') : t('getStarted')}
        </button>
      </div>
    </div>
  );
};
