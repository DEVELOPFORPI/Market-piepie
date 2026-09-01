import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';

type AllowUser = {
  id: string;
  nickname: string;
  profile_image: string | null;
  pi_username: string | null;
};

type MaintenanceAdmin = {
  enabled: boolean;
  title: string;
  message: string;
  until: string | null;
  allowlist: AllowUser[];
};

type UserHit = {
  id: string;
  nickname: string;
  profile_image: string | null;
  pi_username: string | null;
};

type UntilParts = { y: string; m: string; d: string; h: string; min: string };

const EMPTY_UNTIL: UntilParts = { y: '', m: '', d: '', h: '', min: '' };

function untilFromIso(iso: string | null): UntilParts {
  if (!iso) return EMPTY_UNTIL;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY_UNTIL;
  return {
    y: String(date.getFullYear()),
    m: String(date.getMonth() + 1),
    d: String(date.getDate()),
    h: String(date.getHours()),
    min: String(date.getMinutes()),
  };
}

function untilToIso(parts: UntilParts): string | null | 'invalid' {
  const raw = [parts.y, parts.m, parts.d, parts.h, parts.min].map((v) => v.trim());
  if (raw.every((v) => !v)) return null;
  if (raw.some((v) => v && !/^\d+$/.test(v))) return 'invalid';
  const now = new Date();
  const y = raw[0] ? Number(raw[0]) : now.getFullYear();
  const m = raw[1] ? Number(raw[1]) : now.getMonth() + 1;
  const d = raw[2] ? Number(raw[2]) : now.getDate();
  const h = raw[3] ? Number(raw[3]) : 0;
  const min = raw[4] ? Number(raw[4]) : 0;
  if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || min < 0 || min > 59) {
    return 'invalid';
  }
  const date = new Date(y, m - 1, d, h, min, 0, 0);
  if (
    date.getFullYear() !== y
    || date.getMonth() !== m - 1
    || date.getDate() !== d
  ) {
    return 'invalid';
  }
  return date.toISOString();
}

function digitsOnly(value: string, maxLen: number): string {
  return value.replace(/\D/g, '').slice(0, maxLen);
}

function UserRow({
  user,
  actionLabel,
  actionClass,
  onAction,
}: {
  user: { id: string; nickname: string; profile_image: string | null; pi_username: string | null };
  actionLabel: string;
  actionClass: string;
  onAction: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-200">
        <UserAvatarImage src={user.profile_image} alt="" imgClassName="h-full w-full object-cover" iconClassName="h-3/5 w-3/5 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{user.nickname || user.id}</p>
        <p className="truncate text-xs text-gray-400">{user.pi_username || user.id}</p>
      </div>
      <button type="button" onClick={onAction} className={`shrink-0 text-sm font-medium ${actionClass}`}>
        {actionLabel}
      </button>
    </li>
  );
}

function Switch({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? 'bg-red-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${
          on ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export const AdminMaintenance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [untilParts, setUntilParts] = useState<UntilParts>(EMPTY_UNTIL);
  const [allowlist, setAllowlist] = useState<AllowUser[]>([]);
  const [users, setUsers] = useState<UserHit[]>([]);
  const [search, setSearch] = useState('');
  const [userHint, setUserHint] = useState('');
  const [confirmOn, setConfirmOn] = useState(false);

  const applyAdmin = (data: MaintenanceAdmin) => {
    setEnabled(Boolean(data.enabled));
    setMessage(data.message || '');
    setUntilParts(untilFromIso(data.until));
    setAllowlist(data.allowlist || []);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [maintRes, usersRes] = await Promise.all([
      api.get<MaintenanceAdmin>('/api/admin/maintenance', { headers: adminPasswordHeaders() }),
      api.get<UserHit[]>('/api/admin/users', { headers: adminPasswordHeaders() }),
    ]);
    if (maintRes.ok && maintRes.data) {
      applyAdmin(maintRes.data);
    } else {
      setHint(maintRes.error || '점검 설정을 불러오지 못했습니다.');
    }
    if (usersRes.ok && usersRes.data) {
      setUsers(usersRes.data.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        profile_image: u.profile_image,
        pi_username: u.pi_username,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const payload = (): { enabled: boolean; title: string; message: string; until: string | null } | 'invalid-until' => {
    const until = untilToIso(untilParts);
    if (until === 'invalid') return 'invalid-until';
    return {
      enabled,
      title: '',
      message: message.trim(),
      until,
    };
  };

  const save = async (nextEnabled: boolean, silent = false) => {
    const body = payload();
    const nextMessage = body === 'invalid-until' ? message.trim() : body.message;
    const nextUntil = body === 'invalid-until' ? null : body.until;
    if (body === 'invalid-until' && nextEnabled) {
      if (!silent) setHint('끝나는 시각을 숫자로 확인해 주세요.');
      return;
    }
    setSaving(true);
    if (!silent) setHint('');
    setConfirmOn(false);
    try {
      const res = await api.put<MaintenanceAdmin>(
        '/api/admin/maintenance',
        { title: '', enabled: nextEnabled, message: nextMessage, until: nextUntil },
        { headers: adminPasswordHeaders() },
      );
      if (!res.ok || !res.data) {
        setHint(res.error || '저장에 실패했습니다. 백엔드가 최신인지, 서버를 재시작했는지 확인해 주세요.');
        return;
      }
      applyAdmin(res.data);
    } finally {
      setSaving(false);
    }
  };

  const addUser = async (user: UserHit) => {
    const res = await api.post<MaintenanceAdmin>(
      '/api/admin/maintenance/allowlist',
      { userId: user.id },
      { headers: adminPasswordHeaders() },
    );
    if (!res.ok || !res.data) {
      setUserHint(res.error || '옮기지 못했습니다.');
      return;
    }
    applyAdmin(res.data);
    setUserHint(`${user.nickname || user.id}을(를) 통과로 옮겼습니다.`);
  };

  const removeUser = async (user: AllowUser) => {
    const res = await api.delete<MaintenanceAdmin>(
      `/api/admin/maintenance/allowlist/${encodeURIComponent(user.id)}`,
      { headers: adminPasswordHeaders() },
    );
    if (!res.ok || !res.data) {
      setUserHint(res.error || '옮기지 못했습니다.');
      return;
    }
    applyAdmin(res.data);
    setUserHint(`${user.nickname || user.id}을(를) 제한으로 옮겼습니다.`);
  };

  const allowIds = useMemo(() => new Set(allowlist.map((u) => u.id)), [allowlist]);
  const keyword = search.trim().toLowerCase();
  const nameMatch = (user: { id: string; nickname: string; pi_username: string | null }) => (
    !keyword
    || user.nickname?.toLowerCase().includes(keyword)
    || user.id?.toLowerCase().includes(keyword)
    || user.pi_username?.toLowerCase().includes(keyword)
  );
  const restricted = useMemo(
    () => users.filter((u) => !allowIds.has(u.id) && nameMatch(u)),
    [users, keyword, allowIds],
  );
  const passing = useMemo(
    () => allowlist.filter(nameMatch),
    [allowlist, keyword],
  );

  if (loading) {
    return <p className="p-8 text-sm text-gray-500">불러오는 중...</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">점검</h1>
          <Switch
            on={enabled}
            disabled={saving}
            onToggle={() => {
              if (enabled) void save(false);
              else setConfirmOn(true);
            }}
          />
        </div>
        {confirmOn ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800 mb-3">점검을 켜면 통과 명단에 없는 사용자는 앱을 쓸 수 없습니다. 계속할까요?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium bg-red-600 text-white disabled:opacity-50"
              >
                {saving ? '저장 중...' : '확인, 켜기'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmOn(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-gray-800 mb-1">사용자에게 보일 본문 (영어)</label>
        <textarea
          value={message}
          maxLength={500}
          rows={4}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => void save(enabled, true)}
          placeholder="비우면 사용자 화면에 보이지 않습니다."
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-4 resize-none"
        />
        <label className="block text-sm font-medium text-gray-800 mb-1">끝나는 시각 (선택)</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ['y', '년', 4],
            ['m', '월', 2],
            ['d', '일', 2],
            ['h', '시', 2],
            ['min', '분', 2],
          ] as const).map(([key, label, maxLen]) => (
            <label key={key} className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={untilParts[key]}
                onChange={(e) => setUntilParts((prev) => ({ ...prev, [key]: digitsOnly(e.target.value, maxLen) }))}
                onBlur={() => void save(enabled, true)}
                placeholder={label}
                className={`${key === 'y' ? 'w-[4.5rem]' : 'w-12'} rounded-xl border border-gray-200 px-2 py-2.5 text-sm text-center`}
              />
              <span className="text-xs text-gray-500">{label}</span>
            </label>
          ))}
        </div>
        {hint ? <p className="mt-3 text-sm text-red-600">{hint}</p> : null}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-1">사용자</h2>
        <p className="text-sm text-gray-500 mb-3">왼쪽은 점검 중 막히고, 오른쪽으로 옮기면 앱이 열립니다.</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="닉네임, ID, Pi 아이디"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3"
        />
        {userHint ? <p className="mb-3 text-sm text-gray-600">{userHint}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-gray-100">
            <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">제한됨</h3>
              <span className="text-xs text-gray-400">{restricted.length}명</span>
            </div>
            {restricted.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-400">없습니다.</p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto">
                {restricted.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    actionLabel="통과"
                    actionClass="text-[#00A8A3]"
                    onAction={() => void addUser(user)}
                  />
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0 rounded-xl border border-gray-100">
            <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">통과</h3>
              <span className="text-xs text-gray-400">{passing.length}명</span>
            </div>
            {passing.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-400">아직 없습니다.</p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto">
                {passing.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    actionLabel="제한"
                    actionClass="text-red-600"
                    onAction={() => void removeUser(user)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
