import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { broadcastProductChange } from '@/utils/chatSocket';
import { AdminPagination, useAdminPage } from '@/components/admin/AdminPagination';

interface Report {
  id: string;
  reporter_id: string | null;
  reporter_nickname?: string;
  reporter_kyc_status?: string;
  reporter_account_status?: string;
  reporter_pi_username?: string | null;
  reporter_activity_region?: string | null;
  target_type: string;
  target_id: string;
  target_title?: string | null;
  target_body?: string | null;
  target_price?: number | string | null;
  target_is_free_share?: boolean | number | null;
  target_images?: string[] | string | null;
  target_row_id?: string | null;
  target_hidden?: boolean | number | string | null;
  target_hidden_reason?: string | null;
  comment_post_id?: string | null;
  owner_id?: string | null;
  owner_nickname?: string | null;
  owner_kyc_status?: string | null;
  owner_account_status?: string | null;
  owner_pi_username?: string | null;
  owner_activity_region?: string | null;
  reason: string;
  description: string | null;
  status: 'open' | 'resolved' | string;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_by_nickname?: string;
  created_at: string;
  resolved_at: string | null;
}

const KYC_LABEL: Record<string, string> = {
  verified: 'KYC',
  unverified: '미인증',
};

function accountLabel(status?: string | null) {
  return status === 'suspended' ? '정지' : '정상';
}

function isHiddenFlag(value?: boolean | number | string | null) {
  return value === true || value === 1 || value === '1';
}

function PersonCard({
  title,
  userId,
  nickname,
  kyc,
  account,
  piUsername,
  region,
  actionBusy,
  onToggleSuspend,
}: {
  title: string;
  userId?: string | null;
  nickname?: string | null;
  kyc?: string | null;
  account?: string | null;
  piUsername?: string | null;
  region?: string | null;
  actionBusy?: boolean;
  onToggleSuspend?: () => void;
}) {
  const suspended = account === 'suspended';
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-400 mb-1.5">{title}</p>
      <p className="font-semibold text-gray-900">{nickname || '알 수 없음'}</p>
      {piUsername && <p className="text-xs text-gray-500">@{piUsername}</p>}
      <p className="mt-0.5 font-mono text-[11px] text-gray-400 break-all">{userId || '-'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
          kyc === 'verified' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {KYC_LABEL[kyc || ''] || '미인증'}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
          suspended ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {accountLabel(account)}
        </span>
        {region && <span className="text-[11px] text-gray-500">{region}</span>}
      </div>
      {userId && onToggleSuspend && (
        <button
          type="button"
          onClick={onToggleSuspend}
          disabled={actionBusy}
          className={`mt-2 w-full rounded-lg border px-2 py-1.5 text-xs font-medium disabled:opacity-50 ${
            suspended
              ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
              : 'border-amber-200 text-amber-700 hover:bg-amber-50'
          }`}
        >
          {actionBusy ? '처리 중' : suspended ? '정지 해제' : '정지'}
        </button>
      )}
    </div>
  );
}

const TEAL = '#00A8A3';

const STATUS_LABEL: Record<string, string> = {
  open: '대기',
  resolved: '처리완료',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
};

const TARGET_LABEL: Record<string, string> = {
  product: '상품',
  post: '게시물',
  comment: '댓글',
  user: '사용자',
  review: '후기',
};

type ReportTargetType = keyof typeof TARGET_LABEL;
type TypeFilter = 'all' | ReportTargetType;

function ReportCard({
  report,
  onOpen,
}: {
  report: Report;
  onOpen: (report: Report) => void;
}) {
  return (
    <div
      onClick={() => onOpen(report)}
      className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[report.status] || 'bg-gray-100 text-gray-500'}`}>
          {STATUS_LABEL[report.status] || report.status}
        </span>
        <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-50 rounded">
          {TARGET_LABEL[report.target_type] || report.target_type}
        </span>
        <span className="text-xs text-gray-400 ml-auto">{new Date(report.created_at).toLocaleString()}</span>
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">{report.reason}</p>
      {report.target_title && (
        <p className="text-xs text-gray-600 mb-1 truncate">대상: {report.target_title}</p>
      )}
      {report.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{report.description}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>신고자 <span className="font-medium text-gray-700">{report.reporter_nickname || report.reporter_id?.slice(0, 8) || '-'}</span></span>
        <span>올린이 <span className="font-medium text-gray-700">{report.owner_nickname || report.owner_id?.slice(0, 8) || '삭제됨'}</span></span>
      </div>
    </div>
  );
}

export const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Report | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== 'all') params.set('target_type', typeFilter);
    const res = await api.get<Report[]>(`/api/admin/reports?${params.toString()}`, {
      headers: adminPasswordHeaders(),
    });
    setReports(res.ok && res.data ? res.data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [typeFilter]);

  const openDetail = (r: Report) => {
    setSelected(r);
    setAdminNote(r.admin_note || '');
  };

  const updateStatus = async (newStatus: 'resolved' | 'open') => {
    if (!selected) return;
    setSaving(true);
    const res = await api.put(`/api/admin/reports/${selected.id}`,
      { status: newStatus, admin_note: adminNote },
      { headers: adminPasswordHeaders() }
    );
    setSaving(false);
    if (!res.ok) {
      alert(`처리 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    setSelected(null);
    load();
  };

  const patchSelected = (patch: Partial<Report>) => {
    setSelected((cur) => (cur ? { ...cur, ...patch } : cur));
    setReports((list) =>
      list.map((item) => (item.id === selected?.id ? { ...item, ...patch } : item)),
    );
  };

  const handleSuspend = async (role: 'reporter' | 'owner') => {
    if (!selected) return;
    const userId = role === 'reporter' ? selected.reporter_id : selected.owner_id;
    const nickname = role === 'reporter' ? selected.reporter_nickname : selected.owner_nickname;
    const account = role === 'reporter' ? selected.reporter_account_status : selected.owner_account_status;
    if (!userId) return;
    const isSuspended = account === 'suspended';
    let reason = '';
    if (isSuspended) {
      if (!confirm(`${nickname || '이 사용자'}의 정지를 해제할까요?`)) return;
    } else {
      const entered = window.prompt(`${nickname || '이 사용자'}를 정지할 사유를 입력하세요. (선택)`);
      if (entered === null) return;
      reason = entered.trim();
    }
    setActionBusy(role);
    const res = await api.patch(
      `/api/admin/users/${userId}/suspension`,
      { suspended: !isSuspended, reason },
      { headers: adminPasswordHeaders() },
    );
    setActionBusy(null);
    if (!res.ok) {
      alert(`처리 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    const nextStatus = isSuspended ? 'active' : 'suspended';
    const sameUser = selected.reporter_id && selected.reporter_id === selected.owner_id;
    patchSelected({
      ...(role === 'reporter' || sameUser ? { reporter_account_status: nextStatus } : {}),
      ...(role === 'owner' || sameUser ? { owner_account_status: nextStatus } : {}),
    });
  };

  const targetKind = selected?.target_type;
  const canModerateTarget = targetKind === 'product' || targetKind === 'post' || targetKind === 'comment';

  const visibilityPath = (type: string, id: string) => {
    if (type === 'product') return `/api/admin/products/${id}/visibility`;
    if (type === 'post') return `/api/admin/posts/${id}/visibility`;
    return `/api/admin/comments/${id}/visibility`;
  };

  const deletePath = (type: string, id: string) => {
    if (type === 'product') return `/api/admin/products/${id}`;
    if (type === 'post') return `/api/admin/posts/${id}`;
    return `/api/admin/comments/${id}`;
  };

  const handleHideTarget = async () => {
    if (!selected || !canModerateTarget || !selected.target_row_id) return;
    const hidden = !isHiddenFlag(selected.target_hidden);
    let reason = '';
    if (hidden) {
      const entered = window.prompt('숨김 사유를 입력하세요. (선택)', selected.target_hidden_reason || '');
      if (entered === null) return;
      reason = entered.trim();
    } else if (!confirm('이 대상의 숨김을 해제할까요?')) {
      return;
    }
    setActionBusy('hide');
    const res = await api.patch(
      visibilityPath(selected.target_type, selected.target_id),
      { hidden, reason },
      { headers: adminPasswordHeaders() },
    );
    setActionBusy(null);
    if (!res.ok) {
      alert(`처리 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    if (selected.target_type === 'product') {
      broadcastProductChange(hidden ? 'admin_hidden' : 'admin_unhidden', selected.target_id);
    }
    patchSelected({
      target_hidden: hidden ? 1 : 0,
      target_hidden_reason: hidden ? reason : null,
    });
  };

  const handleDeleteTarget = async () => {
    if (!selected || !canModerateTarget || !selected.target_row_id) return;
    const label = TARGET_LABEL[selected.target_type] || '대상';
    if (!confirm(`이 ${label}을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setActionBusy('delete');
    const res = await api.delete(deletePath(selected.target_type, selected.target_id), {
      headers: adminPasswordHeaders(),
    });
    setActionBusy(null);
    if (!res.ok) {
      alert(`삭제 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    if (selected.target_type === 'product') {
      broadcastProductChange('deleted', selected.target_id);
    }
    patchSelected({
      target_row_id: null,
      target_title: null,
      target_body: null,
      target_images: [],
      target_hidden: 0,
      target_hidden_reason: null,
    });
  };

  const targetImages = (r: Report): string[] => {
    const raw = r.target_images;
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
      } catch {
        return raw ? [raw] : [];
      }
    }
    return [];
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return reports;
    return reports.filter((r) =>
      [
        r.id,
        r.target_id,
        r.target_type,
        TARGET_LABEL[r.target_type],
        r.reason,
        r.description,
        r.admin_note,
        r.reporter_id,
        r.reporter_nickname,
        r.reporter_pi_username,
        r.owner_id,
        r.owner_nickname,
        r.owner_pi_username,
        r.target_title,
      ].some((value) => value?.toLowerCase().includes(keyword)),
    );
  }, [reports, search]);

  const openReports = filtered.filter((r) => r.status === 'open');
  const resolvedReports = filtered.filter((r) => r.status !== 'open');
  const openCount = openReports.length;
  const openPage = useAdminPage(openReports, `${search}|${typeFilter}`);
  const resolvedPage = useAdminPage(resolvedReports, `${search}|${typeFilter}`);

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">신고 관리</h1>
        {openCount > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
            대기 {openCount}건
          </span>
        )}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="신고자, 올린이, 대상, 사유로 검색"
        className="mb-4 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['all', ...Object.keys(TARGET_LABEL)] as TypeFilter[]).map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === type ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {type === 'all' ? '전체' : TARGET_LABEL[type]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          불러오는 중…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {([
            { title: '대기', items: openReports, page: openPage, empty: '대기 중인 신고가 없습니다.' },
            { title: '처리완료', items: resolvedReports, page: resolvedPage, empty: '처리 완료된 신고가 없습니다.' },
          ] as const).map((column) => (
            <section key={column.title} className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">{column.title}</h2>
                <span className="text-xs text-gray-400">{column.items.length}건</span>
              </div>
              {column.items.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <p className="text-gray-400 text-sm">{column.empty}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {column.page.items.map((r) => (
                    <ReportCard key={r.id} report={r} onOpen={openDetail} />
                  ))}
                  <AdminPagination
                    page={column.page.page}
                    totalPages={column.page.totalPages}
                    total={column.page.total}
                    from={column.page.from}
                    to={column.page.to}
                    onPageChange={column.page.setPage}
                  />
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">신고 상세</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[selected.status] || ''}`}>
                {STATUS_LABEL[selected.status] || selected.status}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <PersonCard
                  title="신고자"
                  userId={selected.reporter_id}
                  nickname={selected.reporter_nickname}
                  kyc={selected.reporter_kyc_status}
                  account={selected.reporter_account_status}
                  piUsername={selected.reporter_pi_username}
                  region={selected.reporter_activity_region}
                  actionBusy={actionBusy === 'reporter'}
                  onToggleSuspend={selected.reporter_id ? () => void handleSuspend('reporter') : undefined}
                />
                <PersonCard
                  title="대상자"
                  userId={selected.owner_id}
                  nickname={selected.owner_nickname}
                  kyc={selected.owner_kyc_status}
                  account={selected.owner_account_status}
                  piUsername={selected.owner_pi_username}
                  region={selected.owner_activity_region}
                  actionBusy={actionBusy === 'owner'}
                  onToggleSuspend={selected.owner_id ? () => void handleSuspend('owner') : undefined}
                />
              </div>

              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400 text-xs">대상</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">{TARGET_LABEL[selected.target_type] || selected.target_type}</span>
                    {isHiddenFlag(selected.target_hidden) && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">숨김</span>
                    )}
                  </div>
                </div>
                {targetImages(selected).length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {targetImages(selected).slice(0, 5).map((img, idx) => (
                      <img
                        key={`${img}-${idx}`}
                        src={getDisplayImageUrl(img)}
                        alt=""
                        className="h-24 w-24 shrink-0 rounded-lg object-cover bg-gray-100"
                      />
                    ))}
                  </div>
                )}
                {selected.target_title && (
                  <p className="font-medium text-gray-900">{selected.target_title}</p>
                )}
                {selected.target_type === 'product' && (
                  <p className="text-sm font-semibold text-gray-800">
                    {selected.target_is_free_share || Number(selected.target_price) === 0
                      ? '나눔'
                      : `${Number(selected.target_price || 0).toLocaleString()} Pi`}
                  </p>
                )}
                {selected.target_body && (
                  <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-gray-600">
                    {selected.target_body}
                  </p>
                )}
                {!selected.target_row_id && (
                  <p className="text-sm text-gray-400">대상이 삭제되었거나 볼 수 없습니다.</p>
                )}
                {isHiddenFlag(selected.target_hidden) && selected.target_hidden_reason && (
                  <p className="text-xs text-gray-500">숨김 사유: {selected.target_hidden_reason}</p>
                )}
                {canModerateTarget && selected.target_row_id && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleHideTarget()}
                      disabled={!!actionBusy}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {actionBusy === 'hide'
                        ? '처리 중'
                        : isHiddenFlag(selected.target_hidden)
                          ? '숨김 해제'
                          : '숨기기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTarget()}
                      disabled={!!actionBusy}
                      className="flex-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {actionBusy === 'delete' ? '처리 중' : '삭제'}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-400 text-xs">접수일</span>
                  <p className="font-medium">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                {selected.resolved_at && (
                  <div>
                    <span className="text-gray-400 text-xs">처리일</span>
                    <p className="font-medium">{new Date(selected.resolved_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div>
                <span className="text-gray-400 text-xs">사유</span>
                <p className="font-medium text-gray-900">{selected.reason}</p>
              </div>

              {selected.description && (
                <div>
                  <span className="text-gray-400 text-xs">상세 설명</span>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 mt-1">{selected.description}</p>
                </div>
              )}

              <div>
                <label className="text-gray-400 text-xs">관리자 메모</label>
                <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder="처리 내용 또는 사유를 기록하세요"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setSelected(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                취소
              </button>
              {selected.status !== 'resolved' && (
                <button onClick={() => updateStatus('resolved')} disabled={saving}
                  className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: TEAL }}>
                  {saving ? '...' : '처리 완료'}
                </button>
              )}
              {selected.status !== 'open' && (
                <button onClick={() => updateStatus('open')} disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium text-yellow-700 border border-yellow-300 rounded-lg hover:bg-yellow-50 disabled:opacity-50">
                  재오픈
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
