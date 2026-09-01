import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { isTestLoginEnabled } from '@/config/features';
import { isLoggedIn, clearImplicitSessionSkip, clearSuspendedAccount, startGuestSession, getCurrentUserId, login, requestDevSessionToken, setSessionToken } from '@/utils/authStorage';
import { applySuspendedAccess } from '@/utils/guestGate';
import { isOnboardingComplete } from '@/utils/onboardingStorage';
import { piAuthenticate, piVerificationPayment, verifyPiAuth, isPiBrowser } from '@/utils/piAuth';
import { useAppPrices } from '@/utils/appPrices';
import { checkMyProfileInDB, resetLocalCacheForIncompleteProfile } from '@/utils/dbSync';
import { useLanguage } from '@/hooks/useLanguage';
import { legalUi } from '@/i18n/legalUiMessages';
import { fetchMaintenanceStatus } from '@/utils/maintenanceStatus';
import { ModalShell } from '@/components/common/ModalShell';

const TEAL = '#00A8A3';
const PI_PURPLE = '#7B2D8E';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { signupFee } = useAppPrices();
  const [piLoading, setPiLoading] = useState(false);
  const [piError, setPiError] = useState<string | null>(null);
  const [piStep, setPiStep] = useState('');
  const [showPaymentNotice, setShowPaymentNotice] = useState(false);
  const [pendingVerified, setPendingVerified] = useState<{ uid: string; username?: string; piVerified?: boolean; sessionToken?: string } | null>(null);
  const [hideGuest, setHideGuest] = useState(false);

  useEffect(() => {
    void fetchMaintenanceStatus().then((status) => {
      setHideGuest(status.enabled && !status.allowed);
    });
  }, []);

  useEffect(() => {
    if (isLoggedIn() && isOnboardingComplete()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handlePiLogin = async () => {
    setPiLoading(true);
    setPiError(null);
    try {
      setPiStep('Authenticating with Pi...');
      const authResult = await piAuthenticate();

      setPiStep('Verifying identity...');
      const verified = await verifyPiAuth(authResult.accessToken, getCurrentUserId());
      console.log('verified response:', verified);

      if (verified.accountStatus === 'suspended') {
        await applySuspendedAccess(verified.suspensionReason);
        navigate('/', { replace: true });
        return;
      }

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

      // DB가 원본: 결제 후에만 프로필, 프로필이 있어야 온보딩 완료
      setPiStep('Loading profile...');
      const profileStatus = await checkMyProfileInDB(verified.uid);
      if (profileStatus === 'unpaid') {
        setPendingVerified(verified);
        setShowPaymentNotice(true);
        return;
      }
      if (profileStatus === 'incomplete') {
        resetLocalCacheForIncompleteProfile(verified.uid);
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
      try { sessionStorage.setItem('signup_after_payment', '1'); } catch {}
      resetLocalCacheForIncompleteProfile(pendingVerified.uid);
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

  const handleGuestLogin = () => {
    clearSuspendedAccount();
    void startGuestSession().then(() => navigate('/', { replace: true }));
  };

  const handleLocalTestLogin = async (userId: 'user1' | 'user2' | 'user3') => {
    clearImplicitSessionSkip();
    login(userId);
    const session = await requestDevSessionToken(userId);
    if (session.accountStatus === 'suspended') {
      await applySuspendedAccess(session.suspensionReason);
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-8 pt-12 pb-10">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm gap-3">
        <div className="w-[150px] h-[150px] flex items-center justify-center">
          <DotLottieReact
            src="/3 ICON/marketpiepie.lottie"
            loop
            autoplay
            style={{ width: 150, height: 150 }}
          />
        </div>
        <img src="/TEXT.svg" alt="piepie" className="h-10 w-auto object-contain mb-6" />

        {/* Pi Network Login */}
        <div className="w-full">
          <button
            type="button"
            onClick={handlePiLogin}
            disabled={piLoading}
            className="w-full py-4 rounded-full text-white text-base font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:opacity-90 transition-opacity"
            style={{ backgroundColor: PI_PURPLE }}
          >
            {piLoading ? (
              <span className="text-sm">{piStep || 'Processing...'}</span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <text x="12" y="16" textAnchor="middle" fontSize="12" fill="currentColor" fontWeight="bold">π</text>
                </svg>
                {legalUi(lang, 'signInWithPi')}
              </>
            )}
          </button>
        </div>

        {piError && (
          <p className="text-sm text-red-500 text-center">{piError}</p>
        )}

        {!isPiBrowser() && (
          <p className="text-xs text-gray-400 text-center">
            Open in Pi Browser for Pi Network login
          </p>
        )}

        {!hideGuest && (
        <div className="w-full">
          <button
            type="button"
            onClick={handleGuestLogin}
            className="w-full py-4 rounded-full text-base font-bold border-2 active:opacity-90 transition-opacity"
            style={{ borderColor: TEAL, color: TEAL }}
          >
            {legalUi(lang, 'continueAsGuest')}
          </button>
        </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          <Link to="/terms" className="underline">{legalUi(lang, 'terms')}</Link>
          {' · '}
          <Link to="/privacy" className="underline">{legalUi(lang, 'privacy')}</Link>
        </p>
        <p className="text-xs text-gray-400 text-center">{legalUi(lang, 'continueAgree')}</p>

        {isTestLoginEnabled() && (
          <div className="w-full flex flex-col gap-2 mt-1">
            <button
              type="button"
              onClick={() => handleLocalTestLogin('user1')}
              disabled={piLoading}
              className="w-full py-3.5 rounded-full text-sm font-bold border-2 active:opacity-90 transition-opacity disabled:opacity-50 bg-gray-50"
              style={{ borderColor: TEAL, color: TEAL }}
            >
              Local account 1
            </button>
            <button
              type="button"
              onClick={() => handleLocalTestLogin('user2')}
              disabled={piLoading}
              className="w-full py-3.5 rounded-full text-sm font-bold border-2 active:opacity-90 transition-opacity disabled:opacity-50 bg-gray-50"
              style={{ borderColor: TEAL, color: TEAL }}
            >
              Local account 2
            </button>
            <button
              type="button"
              onClick={() => handleLocalTestLogin('user3')}
              disabled={piLoading}
              className="w-full py-3.5 rounded-full text-sm font-bold border-2 active:opacity-90 transition-opacity disabled:opacity-50 bg-gray-50"
              style={{ borderColor: TEAL, color: TEAL }}
            >
              Local account 3
            </button>
          </div>
        )}
      </div>

      <ModalShell
        open={showPaymentNotice}
        onClose={() => { setShowPaymentNotice(false); setPendingVerified(null); }}
        zIndex={50}
        panelClassName="w-full max-w-sm p-6"
      >
            <div className="flex items-center justify-center w-14 h-14 rounded-full mx-auto mb-4" style={{ backgroundColor: '#F0FDFA' }}>
              <svg className="w-7 h-7" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{legalUi(lang, 'oneTimeFee')}</h3>
            <p className="text-sm text-gray-600 text-center leading-relaxed mb-1">
              {legalUi(lang, 'payOnceToJoin', { n: signupFee })}
            </p>
            <p className="text-xs text-gray-400 text-center mb-6">
              {legalUi(lang, 'noRefundAfterAccount')}
            </p>
            <button
              type="button"
              onClick={handleConfirmPayment}
              className="w-full py-3.5 rounded-full text-white text-sm font-bold mb-2"
              style={{ backgroundColor: PI_PURPLE }}
            >
              {legalUi(lang, 'payPi', { n: signupFee })}
            </button>
            <button
              type="button"
              onClick={() => { setShowPaymentNotice(false); setPendingVerified(null); }}
              className="w-full py-3 rounded-full text-sm font-medium text-gray-500"
            >
              {t('cancel')}
            </button>
      </ModalShell>
    </div>
  );
};
