import {
  isGuestUser,
  getCurrentUserId,
  markExplicitLogout,
  isSuspendedAccount,
  getSuspensionReason,
  enterSuspendedGuestSession,
} from '@/utils/authStorage';

export type GuestGuardReason =
  | 'chat'
  | 'profile'
  | 'sell'
  | 'post'
  | 'offer'
  | 'share'
  | 'like'
  | 'comment'
  | 'report'
  | 'inquiry'
  | 'notification'
  | 'order'
  | 'review'
  | 'dispute'
  | 'default';

export function isGuest(): boolean {
  return isGuestUser(getCurrentUserId()) || isSuspendedAccount();
}

function showGateOverlay(opts: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}): void {
  const existing = document.getElementById('guest-gate-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'guest-gate-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.45);opacity:0;transition:opacity 280ms cubic-bezier(0.32, 0.72, 0, 1)';

  const modal = document.createElement('div');
  modal.style.cssText =
    'background:#fff;border-radius:20px;padding:36px 28px 24px;text-align:center;' +
    'max-width:300px;width:calc(100% - 48px);box-shadow:0 16px 48px rgba(0,0,0,0.2);' +
    'transform:translateY(18px) scale(0.96);opacity:0;' +
    'transition:transform 280ms cubic-bezier(0.22, 1, 0.36, 1),opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)';

  const iconBg = isSuspendedAccount() ? '#FEF2F2' : '#F0FDFA';
  const iconColor = isSuspendedAccount() ? '#DC2626' : '#00A8A3';
  const icon = isSuspendedAccount()
    ? `<path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>`
    : `<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>`;

  modal.innerHTML = `
    <div style="width:56px;height:56px;border-radius:50%;background:${iconBg};margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icon}
      </svg>
    </div>
    <div style="font-size:18px;font-weight:800;color:#1a1a1a;margin-bottom:${opts.body ? '10px' : '24px'}">${opts.title}</div>
    ${opts.body ? `<div style="font-size:13px;line-height:1.5;color:#6b7280;margin-bottom:24px">${opts.body}</div>` : ''}
    <button id="guest-gate-login" style="
      width:100%;padding:14px 0;border:none;border-radius:28px;font-size:15px;font-weight:700;
      color:#fff;background:#00A8A3;cursor:pointer;margin-bottom:6px
    ">${opts.confirmLabel}</button>
    ${opts.cancelLabel ? `<button id="guest-gate-close" style="
      width:100%;padding:12px 0;border:none;border-radius:28px;font-size:14px;font-weight:500;
      color:#888;background:transparent;cursor:pointer
    ">${opts.cancelLabel}</button>` : ''}
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      modal.style.opacity = '1';
      modal.style.transform = 'none';
    });
  });

  const close = () => {
    overlay.style.opacity = '0';
    modal.style.opacity = '0';
    modal.style.transform = 'translateY(14px) scale(0.96)';
    setTimeout(() => overlay.remove(), 280);
  };

  const closeBtn = document.getElementById('guest-gate-close');
  if (closeBtn) closeBtn.onclick = close;
  document.getElementById('guest-gate-login')!.onclick = () => {
    close();
    opts.onConfirm();
  };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showGuestLoginPrompt(_reason: GuestGuardReason = 'default'): void {
  if (isSuspendedAccount()) {
    const reason = getSuspensionReason();
    showGateOverlay({
      title: '정지 중인 계정입니다',
      body: reason
        ? `사유: ${escapeHtml(reason)}<br/>지금은 둘러보기만 가능합니다.`
        : '이 계정은 관리자에 의해 정지되어 지금은 둘러보기만 가능합니다.',
      confirmLabel: '확인',
      onConfirm: () => undefined,
    });
    return;
  }

  showGateOverlay({
    title: 'Sign in to continue',
    confirmLabel: 'Log in with Pi',
    cancelLabel: 'Not now',
    onConfirm: () => {
      markExplicitLogout();
      window.location.href = '/welcome';
    },
  });
}

export async function applySuspendedAccess(
  reason?: string | null,
  options?: { prompt?: boolean },
): Promise<void> {
  await enterSuspendedGuestSession(reason);
  if (options?.prompt !== false) showGuestLoginPrompt();
}

export function guestGuard(reason: GuestGuardReason = 'default'): boolean {
  if (isGuest()) {
    showGuestLoginPrompt(reason);
    return true;
  }
  return false;
}
