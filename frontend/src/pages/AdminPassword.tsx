import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';
import { setAdminPassword, setAdminVerified } from '@/utils/adminAccessStorage';

export const AdminPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const search = new URLSearchParams(location.search);
  const returnTo = search.get('next') || '/admin/popup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Please enter the admin password.');
      return;
    }

    setSubmitting(true);
    const res = await api.get('/api/admin/stats', {
      headers: { 'x-admin-password': trimmed },
    });
    setSubmitting(false);

    if (!res.ok) {
      setAdminVerified(false);
      setError(res.status === 503 ? 'Admin is not configured.' : 'Incorrect password.');
      return;
    }

    setAdminPassword(trimmed);
    setAdminVerified(true);
    navigate(returnTo, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5] px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#1a1a1a]">Admin</h1>
        <p className="mt-2 text-sm text-gray-600">Please enter the admin password.</p>
        <label className="mt-5 block text-xs font-medium text-gray-600">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError('');
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          autoFocus
        />
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-[#00A8A3] py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {submitting ? 'Checking...' : 'Login'}
        </button>
      </form>
    </div>
  );
};
