
import React, { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { isTestLoginEnabled } from '@/config/features';

import { clearImplicitSessionSkip, ensureImplicitSession, getCurrentUserId, login, setSessionToken } from '@/utils/authStorage';

import { isDeviceProfileOnce, isOnboardingComplete } from '@/utils/onboardingStorage';

import { piAuthenticate, piVerificationPayment, verifyPiAuth, isPiBrowser, PI_VERIFICATION_AMOUNT } from '@/utils/piAuth';

import { checkMyProfileInDB } from '@/utils/dbSync';



const TEAL = '#00A8A3';

const PI_PURPLE = '#7B2D8E';



export const AppLogin: React.FC = () => {

  const navigate = useNavigate();

  const testMode = isTestLoginEnabled();

  const [piLoading, setPiLoading] = useState(false);

  const [piError, setPiError] = useState<string | null>(null);

  const [piStep, setPiStep] = useState('');

  const [showPaymentNotice, setShowPaymentNotice] = useState(false);
  const [pendingVerified, setPendingVerified] = useState<{ uid: string; username?: string; piVerified?: boolean; sessionToken?: string } | null>(null);

  const handlePiLogin = async () => {

    setPiLoading(true);

    setPiError(null);

    try {

      setPiStep('Authenticating with Pi...');

      const authResult = await piAuthenticate();

      setPiStep('Verifying identity...');

      const verified = await verifyPiAuth(authResult.accessToken, getCurrentUserId());
      console.log('verified response:', verified);

      if (!verified.piVerified) {
        setPendingVerified(verified);
        setShowPaymentNotice(true);
        setPiLoading(false);
        setPiStep('');
        return;
      }

      login(verified.uid, true);
      if (verified.sessionToken) setSessionToken(verified.sessionToken);
      try { sessionStorage.setItem('pi_suggested_nickname', verified.username || ''); } catch {}

      // DB가 원본: 서버에 프로필이 있어야 온보딩 완료로 인정
      setPiStep('Loading profile...');
      const profileStatus = await checkMyProfileInDB(verified.uid);
      if (profileStatus === 'incomplete') {
        localStorage.removeItem('marketpiepie_onboarding_v1_' + verified.uid);
        localStorage.removeItem('marketpiepie_device_profile_once_v1');
        localStorage.removeItem(`user_profile_${verified.uid}`);
        navigate('/signup', { replace: true });
        return;
      }
      localStorage.setItem('marketpiepie_onboarding_v1_' + verified.uid, '1');
      localStorage.setItem('marketpiepie_device_profile_once_v1', '1');
      navigate('/', { replace: true });

    } catch (e: any) {

      console.error('Pi login failed:', e);

      setPiError(e.message || 'Pi login failed');

    } finally {

      setPiLoading(false);

      setPiStep('');

    }

  };

  const handleConfirmPayment = async () => {
    if (!pendingVerified) return;
    setShowPaymentNotice(false);
    setPiLoading(true);
    setPiStep('Processing verification payment...');
    try {
      // 결제 승인/완료 API 는 본인 확인을 하므로 Pi 세션을 먼저 저장해야 한다
      if (pendingVerified.sessionToken) setSessionToken(pendingVerified.sessionToken);
      const paid = await piVerificationPayment(pendingVerified.username);
      if (!paid) {
        setPiError('Payment cancelled. Please try again.');
        setPendingVerified(null);
        return;
      }
      login(pendingVerified.uid, true);
      try { sessionStorage.setItem('pi_suggested_nickname', pendingVerified.username || ''); } catch {}
      localStorage.removeItem('marketpiepie_onboarding_v1_' + pendingVerified.uid);
      localStorage.removeItem('marketpiepie_device_profile_once_v1');
      navigate('/signup', { replace: true });
    } catch (e: any) {
      console.error('Pi verification payment failed:', e);
      setPiError(e.message || 'Payment failed');
    } finally {
      setPiLoading(false);
      setPiStep('');
      setPendingVerified(null);
    }
  };



  return (

    <div className="min-h-screen bg-white flex flex-col px-6 pt-8 pb-10">

      <button

        type="button"

        onClick={() => navigate('/welcome')}

        className="self-start p-2 -ml-2 text-gray-600 mb-4"

        aria-label="Back"

      >

        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">

          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />

        </svg>

      </button>



      <h1 className="text-2xl font-bold text-gray-900 mb-2">Log in</h1>

      <p className="text-sm text-gray-600 leading-relaxed mb-8">

        Verify your identity with Pi Network to start trading.

        <br />A small verification fee of {PI_VERIFICATION_AMOUNT} Pi is required.

      </p>



      {/* Pi Network Login Button */}

      <button

        type="button"

        onClick={handlePiLogin}

        disabled={piLoading}

        className="w-full py-4 rounded-full text-white text-base font-bold mb-3 flex items-center justify-center gap-2 disabled:opacity-50"

        style={{ backgroundColor: PI_PURPLE }}

      >

        {piLoading ? (

          <span>{piStep || 'Processing...'}</span>

        ) : (

          <>

            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">

              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>

              <text x="12" y="16" textAnchor="middle" fontSize="12" fill="currentColor" fontWeight="bold">Pi</text>

            </svg>

            Sign in with Pi Network

          </>

        )}

      </button>



      {piError && (

        <p className="text-sm text-red-500 mb-4 text-center">{piError}</p>

      )}



      {!isPiBrowser() && (

        <p className="text-xs text-gray-400 mb-4 text-center">

          Open in Pi Browser for Pi Network login

        </p>

      )}



      {/* Divider */}

      <div className="flex items-center gap-3 mb-4">

        <div className="flex-1 h-px bg-gray-200" />

        <span className="text-xs text-gray-400">or</span>

        <div className="flex-1 h-px bg-gray-200" />

      </div>



      {/* Guest Mode */}

      <button

        type="button"

        onClick={() => {
          clearImplicitSessionSkip();
          // Decide destination before guest session exists (matches prior sync behavior).
          const uidNow = getCurrentUserId();
          const goHome = uidNow != null ? isOnboardingComplete() : isDeviceProfileOnce();
          void ensureImplicitSession({ allowAutoGuest: true }).then(() => {
            navigate(goHome ? '/' : '/signup', { replace: true });
          });
        }}

        className="w-full py-4 rounded-full text-base font-bold border-2 mb-4"

        style={{ borderColor: TEAL, color: TEAL }}

      >

        Continue as Guest

      </button>



      {testMode && (

        <div className="mt-auto pt-8 border-t border-gray-100">

          <p className="text-xs text-gray-500 mb-3">Development</p>

          <button

            type="button"

            onClick={() => navigate('/welcome')}

            className="w-full py-3 rounded-xl bg-gray-100 text-gray-800 text-sm font-medium"

          >

            Welcome — Local account 1 / Local account 2

          </button>

        </div>

      )}

      {showPaymentNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-center w-14 h-14 rounded-full mx-auto mb-4" style={{ backgroundColor: '#F0FDFA' }}>
              <svg className="w-7 h-7" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">One-time fee</h3>
            <p className="text-sm text-gray-600 text-center leading-relaxed mb-1">
              Pay <strong className="text-gray-900">{PI_VERIFICATION_AMOUNT} Pi</strong> once to join.
            </p>
            <p className="text-xs text-gray-400 text-center mb-6">
              No refund after your account is created.
            </p>
            <button
              type="button"
              onClick={handleConfirmPayment}
              className="w-full py-3.5 rounded-full text-white text-sm font-bold mb-2"
              style={{ backgroundColor: PI_PURPLE }}
            >
              Pay {PI_VERIFICATION_AMOUNT} Pi
            </button>
            <button
              type="button"
              onClick={() => { setShowPaymentNotice(false); setPendingVerified(null); }}
              className="w-full py-3 rounded-full text-sm font-medium text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>

  );

};

