import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { saveProfile } from '@/utils/profileStorage';
import { getRegion } from '@/utils/regionStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { isDeviceProfileOnce, setOnboardingComplete, isOnboardingComplete } from '@/utils/onboardingStorage';
import { UI_REGION_PLACEHOLDER } from '@/locale/enUI';
import { uploadImageReferenceToR2, uploadImageToR2 } from '@/utils/imageUpload';

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
  const draft = loadDraft();
  const piNickname = (() => { try { return sessionStorage.getItem('pi_suggested_nickname') || ''; } catch { return ''; } })();
  const [nickname, setNickname] = useState(draft?.nickname || piNickname || '');
  const [bio, setBio] = useState(draft?.bio ?? '');
  /** null = gray circle + icon; set = uploaded image */
  const [profileImage, setProfileImage] = useState<string | null>(draft?.profileImage ?? null);
  const [activityRegion, setActivityRegion] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

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
      alert('Could not upload image.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    const n = nickname.trim();
    if (n.length < 2) {
      alert('Nickname must be at least 2 characters.');
      return;
    }
    if (n.length > 20) {
      alert('Nickname must be 20 characters or fewer.');
      return;
    }
    const region = activityRegion.trim() || getRegion() || '';
    let uploadedProfileImage = profileImage;
    if (uploadedProfileImage) {
      try {
        uploadedProfileImage = await uploadImageReferenceToR2(uploadedProfileImage, { folder: 'profiles' });
      } catch {
        alert('Could not upload image.');
        return;
      }
    }
    saveProfile({
      nickname: n,
      bio: bio.trim() || 'I value safe, quick trades.',
      activityRegion: region,
      profileImage: uploadedProfileImage ?? '/default-avatar.jpg',
    });
    clearDraft();
    setOnboardingComplete();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      <TopBar
        leftContent={
          <button type="button" onClick={() => navigate('/welcome')} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="Create profile"
      />

      <div className="px-5 pt-6 space-y-6 max-w-lg mx-auto">
        <div className="flex flex-col items-center">
          <p className="text-sm text-gray-500 text-center mb-6 px-2 leading-relaxed">
            Set up the profile you will use in piepie.
          </p>

          <label
            htmlFor="signup-profile-file"
            className="relative w-[110px] h-[110px] shrink-0 cursor-pointer block"
          >
            <span className="sr-only">Choose profile photo</span>
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
          <span className="text-xs text-gray-400 mt-3">Profile photo (optional)</span>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Nickname *</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="2–20 characters"
            maxLength={20}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00A8A3] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="One-line bio (optional)"
            rows={3}
            maxLength={200}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Area</label>
          <button
            type="button"
            onClick={() => { saveDraft({ nickname, bio, profileImage }); navigate('/region/select'); }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-left text-gray-800 flex justify-between items-center"
          >
            <span>{activityRegion || getRegion() || UI_REGION_PLACEHOLDER}</span>
            <span className="text-gray-400">›</span>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-white border-t border-gray-100">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploadingImage}
          className="w-full py-4 rounded-full text-white text-base font-bold"
          style={{ backgroundColor: TEAL }}
        >
          {uploadingImage ? 'Uploading...' : 'Get started'}
        </button>
      </div>
    </div>
  );
};
