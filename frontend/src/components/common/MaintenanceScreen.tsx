import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MAINTENANCE_SIGN_IN,
  MAINTENANCE_TITLE,
  maintenanceUntilLabel,
} from '@/i18n/maintenanceMessages';
import { isLoggedIn } from '@/utils/authStorage';
import type { MaintenancePublic } from '@/utils/maintenanceStatus';

function formatUntil(until: string | null): string | null {
  if (!until) return null;
  const date = new Date(until);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const hideTime = date.getHours() === 0 && date.getMinutes() === 0;
    const otherYear = date.getFullYear() !== new Date().getFullYear();
    return date.toLocaleString('en', {
      ...(otherYear ? { year: 'numeric' } : {}),
      month: 'short',
      day: 'numeric',
      ...(hideTime ? {} : { hour: 'numeric', minute: '2-digit' }),
    });
  } catch {
    return date.toISOString();
  }
}

export const MaintenanceScreen: React.FC<{ status: MaintenancePublic }> = ({ status }) => {
  const navigate = useNavigate();
  const body = status.message.trim();
  const until = formatUntil(status.until);
  const showSignIn = !isLoggedIn();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <img src="/LOGO_M.svg" alt="Market PiePie" className="h-16 w-auto object-contain mx-auto mb-6" />
        <h1 className="text-lg font-semibold text-gray-900 mb-2">{MAINTENANCE_TITLE}</h1>
        {body ? <p className="text-sm text-gray-500 whitespace-pre-line">{body}</p> : null}
        {until ? (
          <p className="text-sm text-[#00A8A3] mt-3">{maintenanceUntilLabel(until)}</p>
        ) : null}
        {showSignIn ? (
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            className="w-full mt-8 px-4 py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#00A8A3' }}
          >
            {MAINTENANCE_SIGN_IN}
          </button>
        ) : null}
      </div>
    </div>
  );
};
