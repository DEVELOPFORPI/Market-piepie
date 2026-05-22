import React, { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

interface Report {
  id: string;
  reporter_id: string | null;
  reporter_nickname?: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  status: 'open' | 'resolved' | 'dismissed' | string;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_by_nickname?: string;
  created_at: string;
  resolved_at: string | null;
}

const TEAL = '#00A8A3';

const STATUS_LABEL: Record<string, string> = {
  open: '대기',
  resolved: '처리완료',
  dismissed: '반려',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
};

const TARGET_LABEL: Record<string, string> = {
  product: 'Product',
  post: 'Post',
  review: 'Review',
  user: 'User',
  comment: 'Comment',
};

export const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selected, setSelected] = useState<Report | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (typeFilter !== 'ALL') params.set('target_type', typeFilter);
    const res = await api.get<Report[]>(`/api/admin/reports?${params.toString()}`, {
      headers: adminPasswordHeaders(),
    });
    setReports(res.ok && res.data ? res.data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, typeFilter]);

  const openDetail = (r: Report) => {
    setSelected(r);
    setAdminNote(r.admin_note || '');
  };

  const updateStatus = async (newStatus: 'resolved' | 'dismissed' | 'open') => {
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

  const targetLink = (r: Report): string | null => {
    switch (r.target_type) {
      case 'product': return `/product/${r.target_id}`;
      case 'post': return `/community/post/${r.target_id}`;
      case 'user': return `/seller/${r.target_id}`;
      default: return null;
    }
  };

  const openCount = reports.filter((r) => r.status === 'open').length;

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

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1">
          {['open', 'resolved', 'dismissed', 'ALL'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-[#00A8A3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {s === 'ALL' ? '전체' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="ALL">전체 타입</option>
          {Object.entries(TARGET_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button onClick={load} className="px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          새로고침
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">조건에 맞는 신고가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} onClick={() => openDetail(r)}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] || 'bg-gray-100 text-gray-500'}`}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
                <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-50 rounded">
                  {TARGET_LABEL[r.target_type] || r.target_type}
                </span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{r.reason}</p>
              {r.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{r.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>신고자: {r.reporter_nickname || (r.reporter_id?.slice(0, 8) ?? '-')}</span>
                <span>대상 ID: <code className="px-1 bg-gray-50 rounded">{r.target_id.slice(0, 16)}{r.target_id.length > 16 ? '…' : ''}</code></span>
              </div>
            </div>
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
                <div>
                  <span className="text-gray-400 text-xs">대상 타입</span>
                  <p className="font-medium">{TARGET_LABEL[selected.target_type] || selected.target_type}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">접수일</span>
                  <p className="font-medium">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 text-xs">대상 ID</span>
                  <p className="font-mono text-xs break-all">{selected.target_id}</p>
                  {targetLink(selected) && (
                    <a href={targetLink(selected)!} target="_blank" rel="noreferrer"
                      className="inline-block mt-1 text-xs text-[#00A8A3] hover:underline">
                      → 새 탭에서 보기
                    </a>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 text-xs">신고자</span>
                  <p className="font-medium">{selected.reporter_nickname || selected.reporter_id || '-'}</p>
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
              {selected.status !== 'dismissed' && (
                <button onClick={() => updateStatus('dismissed')} disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  반려
                </button>
              )}
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
