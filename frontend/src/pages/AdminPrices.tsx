import React, { useCallback, useEffect, useState } from 'react';
import { ACTIVITY_BADGE_DEFINITIONS } from '@/constants/activityBadges';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';
import { setCachedAppPrices, type AppPrices } from '@/utils/appPrices';

const TEAL = '#00A8A3';

const BADGE_KO: Record<string, string> = {
  '01': '첫 거래',
  '02': '채팅 시작',
  '03': '입소문',
  '04': '첫 글',
  '05': '글솜씨',
  '06': '파워 라이터',
  '07': '나눔 새내기',
  '08': '따뜻한 손',
  '09': '착한 이웃',
  '10': '나눔 천사',
  '11': '나눔 챔피언',
  '12': '배지 새내기',
  '13': '배지 팬',
  '14': '설렘 경보',
};

function emptyBadges(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const badge of ACTIVITY_BADGE_DEFINITIONS) out[badge.id] = String(badge.pricePi);
  return out;
}

function parseAmount(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) return null;
  return Math.round(n * 10000) / 10000;
}

export const AdminPrices: React.FC = () => {
  const [signupFee, setSignupFee] = useState('3.14');
  const [badges, setBadges] = useState<Record<string, string>>(emptyBadges);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [hint, setHint] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setHint('');
    const res = await api.get<AppPrices>('/api/admin/prices', { headers: adminPasswordHeaders() });
    if (!res.ok || !res.data) {
      setHint(res.error || '요금을 불러오지 못했습니다.');
      setLoading(false);
      return;
    }
    setSignupFee(String(res.data.signupFee));
    const next = emptyBadges();
    for (const [id, amount] of Object.entries(res.data.badges || {})) {
      next[id] = String(amount);
    }
    setBadges(next);
    setCachedAppPrices(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applySaved = (data: AppPrices) => {
    setSignupFee(String(data.signupFee));
    const next = emptyBadges();
    for (const [id, amount] of Object.entries(data.badges || {})) {
      next[id] = String(amount);
    }
    setBadges(next);
    setCachedAppPrices(data);
  };

  const saveSignup = async () => {
    const signup = parseAmount(signupFee);
    if (signup == null) {
      alert('가입비를 0보다 크고 10000 이하로 입력해 주세요.');
      return;
    }
    setSavingKey('signup');
    const res = await api.put<AppPrices>(
      '/api/admin/prices',
      { signupFee: signup },
      { headers: adminPasswordHeaders() },
    );
    setSavingKey(null);
    if (!res.ok || !res.data) {
      alert(res.error || '저장에 실패했습니다.');
      return;
    }
    applySaved(res.data);
    setHint('가입비를 저장했습니다.');
  };

  const saveBadges = async () => {
    const payload: Record<string, number> = {};
    for (const badge of ACTIVITY_BADGE_DEFINITIONS) {
      const amount = parseAmount(badges[badge.id] ?? '');
      if (amount == null) {
        alert(`${BADGE_KO[badge.id] || badge.id} 가격을 확인해 주세요.`);
        return;
      }
      payload[badge.id] = amount;
    }
    setSavingKey('badges');
    const res = await api.put<AppPrices>(
      '/api/admin/prices',
      { badges: payload },
      { headers: adminPasswordHeaders() },
    );
    setSavingKey(null);
    if (!res.ok || !res.data) {
      alert(res.error || '저장에 실패했습니다.');
      return;
    }
    applySaved(res.data);
    setHint('뱃지 가격을 저장했습니다.');
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">요금 설정</h1>
          <p className="mt-1 text-sm text-gray-500">종류별로 금액을 수정한 뒤 해당 저장을 누르면 반영됩니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : (
        <>
          {hint ? <p className="mb-4 text-sm text-[#007f7b]">{hint}</p> : null}

          <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900">가입비</h2>
              <button
                type="button"
                onClick={() => void saveSignup()}
                disabled={savingKey !== null}
                className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: TEAL }}
              >
                {savingKey === 'signup' ? '저장 중...' : '저장'}
              </button>
            </div>
            <label className="flex max-w-xs items-center gap-2">
              <span className="shrink-0 text-sm text-gray-600">본인인증</span>
              <input
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={signupFee}
                onChange={(e) => setSignupFee(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <span className="text-sm text-gray-500">Pi</span>
            </label>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900">뱃지 구매</h2>
              <button
                type="button"
                onClick={() => void saveBadges()}
                disabled={savingKey !== null}
                className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: TEAL }}
              >
                {savingKey === 'badges' ? '저장 중...' : '저장'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {ACTIVITY_BADGE_DEFINITIONS.map((badge) => (
                <div key={badge.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center gap-2">
                    <img src={`/Batch/${badge.id}.svg`} alt="" className="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{badge.id}</p>
                      <p className="truncate text-sm font-medium text-gray-900">
                        {BADGE_KO[badge.id] || badge.label}
                      </p>
                    </div>
                  </div>
                  <label className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min="0.01"
                      max="10000"
                      step="0.01"
                      value={badges[badge.id] ?? ''}
                      onChange={(e) => setBadges((prev) => ({ ...prev, [badge.id]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-gray-500">Pi</span>
                  </label>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
