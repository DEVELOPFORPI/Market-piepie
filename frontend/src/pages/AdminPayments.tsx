import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';
import { AdminPagination, useAdminPage } from '@/components/admin/AdminPagination';

interface PaymentRow {
  id: string;
  user_id: string | null;
  user_nickname: string | null;
  pi_username: string | null;
  payment_type: string;
  amount: number;
  memo: string | null;
  txid: string | null;
  status: string;
  wallet_address: string | null;
  account_exists: boolean;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

interface PaymentSummary {
  total_count: number;
  completed_count: number;
  completed_amount: number;
  cancelled_count: number;
  pending_count: number;
  verification_count: number;
  badge_count: number;
  orphan_count: number;
}

type StatusFilter = 'all' | 'paid' | 'unpaid' | 'orphan';
type TypeFilter = 'all' | 'profile_verification' | 'badge_purchase' | 'other';
type PeriodFilter = 'all' | '7' | '30';

const EMPTY_SUMMARY: PaymentSummary = {
  total_count: 0,
  completed_count: 0,
  completed_amount: 0,
  cancelled_count: 0,
  pending_count: 0,
  verification_count: 0,
  badge_count: 0,
  orphan_count: 0,
};

const TYPE_LABEL: Record<string, string> = {
  profile_verification: '본인인증비',
  badge_purchase: '배지 구매',
  other: '기타',
};

function typeLabel(value: string) {
  return TYPE_LABEL[value] || value;
}

function isPaid(status: string) {
  return status === 'completed';
}

function statusBadge(status: string) {
  return isPaid(status)
    ? { label: '결제됨', className: 'bg-green-100 text-green-700' }
    : { label: '결제 안 됨', className: 'bg-gray-100 text-gray-500' };
}

function dateLabel(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

function amountLabel(value: number) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} Pi`;
}

function shortWallet(value?: string | null) {
  if (!value) return '-';
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/** 결제는 완료됐는데 계정이 없는 건 — 문의가 들어오는 대표 케이스 */
function isOrphan(row: PaymentRow) {
  return row.status === 'completed' && !row.account_exists;
}

export const AdminPayments: React.FC = () => {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [repairingId, setRepairingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const response = await api.get<{ summary: PaymentSummary; rows: PaymentRow[] }>(
      '/api/admin/payments',
      { headers: adminPasswordHeaders() },
    );
    if (!response.ok || !response.data) {
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setLoadError(response.error || '결제 내역을 불러오지 못했습니다.');
    } else {
      setRows(response.data.rows || []);
      setSummary({ ...EMPTY_SUMMARY, ...response.data.summary });
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const since =
      periodFilter === 'all' ? 0 : Date.now() - Number(periodFilter) * 24 * 60 * 60 * 1000;
    return rows.filter((row) => {
      if (statusFilter === 'paid' && !isPaid(row.status)) return false;
      if (statusFilter === 'unpaid' && isPaid(row.status)) return false;
      if (statusFilter === 'orphan' && !isOrphan(row)) return false;
      if (typeFilter !== 'all') {
        const excluded = typeFilter === 'other'
          ? row.payment_type === 'profile_verification' || row.payment_type === 'badge_purchase'
          : row.payment_type !== typeFilter;
        if (excluded) return false;
      }
      if (since && new Date(row.created_at).getTime() < since) return false;
      if (!keyword) return true;
      return (
        row.pi_username?.toLowerCase().includes(keyword) ||
        row.user_nickname?.toLowerCase().includes(keyword) ||
        row.user_id?.toLowerCase().includes(keyword) ||
        row.id?.toLowerCase().includes(keyword) ||
        row.txid?.toLowerCase().includes(keyword) ||
        row.wallet_address?.toLowerCase().includes(keyword)
      );
    });
  }, [rows, search, statusFilter, typeFilter, periodFilter]);
  const paged = useAdminPage(filtered, `${search}|${statusFilter}|${typeFilter}|${periodFilter}`);

  const handleRepair = async (row: PaymentRow) => {
    if (
      !confirm(
        `Pi 서버에서 결제 정보를 다시 확인하고 계정 생성을 재시도할까요?\n결제 ID: ${row.id}`,
      )
    )
      return;
    setRepairingId(row.id);
    const response = await api.post<PaymentRow>(
      `/api/admin/payments/${row.id}/repair`,
      {},
      { headers: adminPasswordHeaders() },
    );
    setRepairingId(null);
    if (!response.ok) {
      alert(`복구 실패: ${response.error || `HTTP ${response.status}`}`);
      return;
    }
    alert(
      response.data?.account_exists
        ? '계정이 정상적으로 생성되었습니다.'
        : '결제 정보를 갱신했습니다. 계정은 아직 생성되지 않았습니다.',
    );
    setSelected(null);
    await load();
  };

  const copy = (value?: string | null) => {
    if (!value) return;
    void navigator.clipboard.writeText(value);
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">결제 내역</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { label: '결제됨', value: `${summary.completed_count}건`, color: 'text-gray-900', filter: 'paid' as StatusFilter },
            { label: '수령 금액', value: amountLabel(summary.completed_amount), color: 'text-[#007f7b]', filter: null },
            {
              label: '결제 안 됨',
              value: `${summary.pending_count + summary.cancelled_count}건`,
              color: 'text-gray-500',
              filter: 'unpaid' as StatusFilter,
            },
            {
              label: '계정 누락',
              value: `${summary.orphan_count}건`,
              color: summary.orphan_count ? 'text-red-600' : 'text-gray-900',
              filter: 'orphan' as StatusFilter,
            },
          ] as const
        ).map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              if (card.filter) setStatusFilter(card.filter);
            }}
            className={`rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm ${
              card.filter ? 'transition hover:border-[#00A8A3]/40 hover:shadow-md' : ''
            }`}
          >
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Pi @, 닉네임, uid, 지갑, 결제 ID, txid로 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체</option>
          <option value="paid">결제됨</option>
          <option value="unpaid">결제 안 됨</option>
          <option value="orphan">계정 누락</option>
        </select>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 종류</option>
          <option value="profile_verification">본인인증비</option>
          <option value="badge_purchase">배지 구매</option>
          <option value="other">기타</option>
        </select>
        <select
          value={periodFilter}
          onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 기간</option>
          <option value="7">최근 7일</option>
          <option value="30">최근 30일</option>
        </select>
      </div>

      {loadError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-500">불러오는 중…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">결제자</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">지갑</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">종류</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">금액</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">계정</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">일시</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <p className="max-w-[180px] truncate font-semibold text-gray-900">
                        {row.user_nickname || row.pi_username || '알 수 없음'}
                      </p>
                      <p className="max-w-[180px] truncate text-xs text-gray-500">
                        {row.pi_username ? `@${row.pi_username}` : row.user_id || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-xs text-gray-600"
                        title={row.wallet_address || undefined}
                      >
                        {shortWallet(row.wallet_address)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{typeLabel(row.payment_type)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {amountLabel(row.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(row.status).className}`}
                      >
                        {statusBadge(row.status).label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.account_exists ? (
                        <span className="text-xs text-gray-500">생성됨</span>
                      ) : (
                        <span
                          className={`text-xs font-semibold ${
                            isOrphan(row) ? 'text-red-600' : 'text-gray-400'
                          }`}
                        >
                          없음
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {dateLabel(row.completed_at || row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        {isOrphan(row) ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleRepair(row);
                            }}
                            disabled={repairingId === row.id}
                            className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {repairingId === row.id ? '처리 중' : '계정 복구'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(row);
                          }}
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          자세히 보기
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-gray-400">
                      결제 내역이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            onPageChange={paged.setPage}
          />
        </>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <aside
            className="flex h-[min(812px,88vh)] w-[min(375px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-bold text-gray-900">
                      {amountLabel(selected.amount)}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(selected.status).className}`}
                    >
                      {statusBadge(selected.status).label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{typeLabel(selected.payment_type)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
              {isOrphan(selected) ? (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  결제는 완료됐지만 계정이 없습니다. 아래 버튼으로 복구할 수 있습니다.
                </p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <dl className="space-y-5 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">결제자</dt>
                  <dd className="mt-1 font-medium text-gray-900">
                    {selected.user_nickname || selected.pi_username || '알 수 없음'}
                  </dd>
                  <dd className="text-xs text-gray-500">
                    {selected.pi_username ? `@${selected.pi_username}` : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Pi uid</dt>
                  <dd className="mt-1 break-all text-xs text-gray-700">{selected.user_id || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">계정 생성</dt>
                  <dd className={`mt-1 ${selected.account_exists ? 'text-gray-700' : 'text-red-600'}`}>
                    {selected.account_exists ? '생성됨' : '없음'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">메모</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-gray-700">{selected.memo || '-'}</dd>
                </div>
                <CopyField label="결제 ID" value={selected.id} onCopy={copy} />
                <CopyField label="거래 번호 (txid)" value={selected.txid} onCopy={copy} />
                <CopyField label="지갑 주소" value={selected.wallet_address} onCopy={copy} />
                <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <dt className="text-xs text-gray-400">생성</dt>
                    <dd className="mt-1 text-xs text-gray-700">{dateLabel(selected.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">승인</dt>
                    <dd className="mt-1 text-xs text-gray-700">{dateLabel(selected.approved_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">완료</dt>
                    <dd className="mt-1 text-xs text-gray-700">{dateLabel(selected.completed_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">취소</dt>
                    <dd className="mt-1 text-xs text-gray-700">{dateLabel(selected.cancelled_at)}</dd>
                  </div>
                </div>
              </dl>
            </div>

            <div className="border-t border-gray-200 bg-white p-4">
              <button
                type="button"
                onClick={() => void handleRepair(selected)}
                disabled={repairingId === selected.id}
                className="w-full rounded-lg border border-[#00A8A3] py-2.5 text-sm font-semibold text-[#007f7b] hover:bg-[#00A8A3]/5 disabled:opacity-50"
              >
                {repairingId === selected.id ? '확인 중…' : 'Pi에서 다시 확인 · 계정 복구'}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
};

function CopyField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string | null;
  onCopy: (value?: string | null) => void;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="mt-1 flex items-start gap-2">
        <span className="min-w-0 flex-1 break-all text-xs text-gray-700">{value || '-'}</span>
        {value ? (
          <button
            type="button"
            onClick={() => onCopy(value)}
            className="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-50"
          >
            복사
          </button>
        ) : null}
      </dd>
    </div>
  );
}
