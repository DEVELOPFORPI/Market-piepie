import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';
import { AdminPagination, useAdminPage } from '@/components/admin/AdminPagination';

interface Dispute {
  id: string;
  order_id: string | null;
  product_title: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  buyer_nickname?: string;
  seller_nickname?: string;
  reason: string | null;
  action: string | null;
  description: string | null;
  status: string;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: '접수',
  IN_REVIEW: '검토 중',
  RESOLVED: '해결됨',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

const FILTER_OPTIONS = [
  { value: 'ALL', label: '전체' },
  { value: 'OPEN', label: '접수' },
  { value: 'IN_REVIEW', label: '검토 중' },
  { value: 'RESOLVED', label: '해결됨' },
] as const;

const REASON_LABEL: Record<string, string> = {
  'Listing mismatch': '물품 정보 불일치',
  'Not received': '미수령',
  'Damaged item': '파손·하자',
  'Seller no-show': '판매자 노쇼',
  'Buyer no-show': '구매자 노쇼',
  'Buyer not responding': '구매자 무응답',
  'Payment not received': '미입금',
  'Bad-faith behavior': '악의적 행위',
  Other: '기타',
};

const REASON_OPTIONS = Object.keys(REASON_LABEL);

type ReasonFilter = 'ALL' | keyof typeof REASON_LABEL;

function reasonLabel(value: string | null | undefined) {
  if (!value) return '-';
  return REASON_LABEL[value] || value;
}

export const AdminDisputes: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('ALL');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await api.get<Dispute[]>('/api/admin/disputes', { headers: adminPasswordHeaders() });
    if (res.ok && res.data) {
      setDisputes(
        res.data.map((d: any) => ({
          ...d,
          buyer_nickname: d.buyer_nickname || d.buyer_id?.substring(0, 8),
          seller_nickname: d.seller_nickname || d.seller_id?.substring(0, 8),
        }))
      );
    } else {
      setDisputes([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return disputes.filter((d) => {
      if (filter !== 'ALL' && d.status !== filter) return false;
      if (reasonFilter !== 'ALL' && d.reason !== reasonFilter) return false;
      if (!keyword) return true;
      return [
        d.id,
        d.order_id,
        d.product_title,
        d.buyer_id,
        d.seller_id,
        d.buyer_nickname,
        d.seller_nickname,
        d.reason,
        d.description,
        d.action,
        d.admin_response,
      ].some((value) => value?.toLowerCase().includes(keyword));
    });
  }, [disputes, filter, reasonFilter, search]);
  const paged = useAdminPage(filtered, `${search}|${filter}|${reasonFilter}`);

  const openDetail = (d: Dispute) => {
    setSelected(d);
    setAdminNote(d.admin_response || '');
  };

  const updateStatus = async (newStatus: string) => {
    if (!selected) return;
    setSaving(true);
    await api.put(
      `/api/admin/disputes/${selected.id}`,
      { status: newStatus, admin_response: adminNote },
      { headers: adminPasswordHeaders() }
    );
    setSaving(false);
    setSelected(null);
    load();
  };

  const openCount = disputes.filter((d) => d.status === 'OPEN').length;
  const reviewCount = disputes.filter((d) => d.status === 'IN_REVIEW').length;

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">분쟁 관리</h1>
        <div className="flex gap-2">
          {openCount > 0 && <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">접수 {openCount}건</span>}
          {reviewCount > 0 && <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">검토 중 {reviewCount}건</span>}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="상품명, 닉네임, 주문 ID, 사유로 검색"
        className="mb-4 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button key={value} onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === value ? 'bg-[#00A8A3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setReasonFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              reasonFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체 사유
          </button>
          {REASON_OPTIONS.map((reason) => (
            <button
              key={reason}
              onClick={() => setReasonFilter(reason as ReasonFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                reasonFilter === reason ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {REASON_LABEL[reason]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          불러오는 중…
        </div>
      ) : (
        <div className="space-y-3">
          {paged.items.map((d) => (
            <div key={d.id} onClick={() => openDetail(d)}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[d.status] || d.status}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{d.product_title || '상품명 없음'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    구매자: {d.buyer_nickname} / 판매자: {d.seller_nickname}
                  </p>
                  {d.reason && <p className="text-xs text-gray-400 mt-1 truncate">{reasonLabel(d.reason)}</p>}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400 text-sm">분쟁 내역이 없습니다</p>
          )}
          <AdminPagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            onPageChange={paged.setPage}
          />
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">분쟁 상세</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] || ''}`}>{STATUS_LABEL[selected.status] || selected.status}</span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-400 text-xs">상품</span><p className="font-medium">{selected.product_title || '-'}</p></div>
                <div><span className="text-gray-400 text-xs">주문 ID</span><p className="font-medium truncate">{selected.order_id || '-'}</p></div>
                <div><span className="text-gray-400 text-xs">구매자</span><p>{selected.buyer_nickname}</p></div>
                <div><span className="text-gray-400 text-xs">판매자</span><p>{selected.seller_nickname}</p></div>
              </div>

              {selected.reason && (
                <div><span className="text-gray-400 text-xs">사유</span><p className="text-gray-700">{reasonLabel(selected.reason)}</p></div>
              )}
              {selected.description && (
                <div><span className="text-gray-400 text-xs">상세 설명</span><p className="text-gray-700">{selected.description}</p></div>
              )}
              {selected.action && (
                <div><span className="text-gray-400 text-xs">사용자 요청</span><p className="text-gray-700">{selected.action}</p></div>
              )}

              <div>
                <label className="text-gray-400 text-xs">관리자 메모</label>
                <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={3}
                  placeholder="처리 내용을 입력하세요" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">닫기</button>
              {selected.status === 'OPEN' && (
                <button onClick={() => updateStatus('IN_REVIEW')} disabled={saving}
                  className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50">
                  {saving ? '…' : '검토 시작'}
                </button>
              )}
              {(selected.status === 'OPEN' || selected.status === 'IN_REVIEW') && (
                <button onClick={() => updateStatus('RESOLVED')} disabled={saving}
                  className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50">
                  {saving ? '…' : '해결 처리'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
