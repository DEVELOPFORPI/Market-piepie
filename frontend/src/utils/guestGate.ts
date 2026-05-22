import { isGuestUser, getCurrentUserId, markExplicitLogout } from '@/utils/authStorage';

export type GuestGuardReason = 'chat' | 'profile' | 'sell' | 'post' | 'offer' | 'share' | 'default';

const REASON_MESSAGES: Record<GuestGuardReason, string> = {
  chat: 'Log in with Pi Network to chat with sellers.',
  profile: 'Log in with Pi Network to manage your profile.',
  sell: 'Log in with Pi Network to sell your items.',
  post: 'Log in with Pi Network to write a community post.',
  offer: 'Log in with Pi Network to make an offer.',
  share: 'Log in with Pi Network to apply for free share.',
  default: 'Log in with Pi Network to unlock all features.',
};

export function isGuest(): boolean {
  return isGuestUser(getCurrentUserId());
}

export function showGuestLoginPrompt(reason: GuestGuardReason = 'default'): void {
  const existing = document.getElementById('guest-gate-overlay');
  if (existing) existing.remove();

  const description = REASON_MESSAGES[reason];

  const overlay = document.createElement('div');
  overlay.id = 'guest-gate-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.45);animation:guestFadeIn 0.2s ease';

  const modal = document.createElement('div');
  modal.style.cssText =
    'background:#fff;border-radius:20px;padding:36px 28px 24px;text-align:center;' +
    'max-width:300px;width:calc(100% - 48px);box-shadow:0 16px 48px rgba(0,0,0,0.2);' +
    'animation:guestSlideUp 0.25s ease';

  modal.innerHTML = `
    <div style="width:56px;height:56px;border-radius:50%;background:#F0FDFA;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00A8A3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    </div>
    <div style="font-size:18px;font-weight:800;color:#1a1a1a;margin-bottom:8px">Sign in to continue</div>
    <div style="font-size:13px;color:#888;margin-bottom:24px;line-height:1.5">${description}</div>
    <button id="guest-gate-login" style="
      width:100%;padding:14px 0;border:none;border-radius:28px;font-size:15px;font-weight:700;
      color:#fff;background:#00A8A3;cursor:pointer;margin-bottom:6px
    ">Log in with Pi</button>
    <button id="guest-gate-close" style="
      width:100%;padding:12px 0;border:none;border-radius:28px;font-size:14px;font-weight:500;
      color:#888;background:transparent;cursor:pointer
    ">Not now</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes guestFadeIn{from{opacity:0}to{opacity:1}}
    @keyframes guestSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  `;
  overlay.appendChild(style);

  const close = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s';
    setTimeout(() => overlay.remove(), 200);
  };

  document.getElementById('guest-gate-close')!.onclick = close;
  document.getElementById('guest-gate-login')!.onclick = () => {
    close();
    markExplicitLogout();
    window.location.href = '/welcome';
  };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

export function guestGuard(reason: GuestGuardReason = 'default'): boolean {
  if (isGuest()) {
    showGuestLoginPrompt(reason);
    return true;
  }
  return false;
}
