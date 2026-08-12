import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGuest, showGuestLoginPrompt, type GuestGuardReason } from '@/utils/guestGate';

/**
 * 로그인한 사용자만 쓸 수 있는 화면에서 호출한다.
 * 게스트면 홈으로 돌려보내고 로그인 유도 시트를 띄운다.
 */
export function useGuestPageGuard(reason: GuestGuardReason = 'default'): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isGuest()) return;
    navigate('/', { replace: true });
    showGuestLoginPrompt(reason);
  }, [navigate, reason]);
}
