import React, { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

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

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

export const AdminDisputes: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');

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

  const filtered = filter === 'ALL' ? disputes : disputes.filter((d) => d.status === filter);

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
        <h1 className="text-2xl font-bold text-gray-900">Dispute Management</h1>
        <div className="flex gap-2">
          {openCount > 0 && <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">{openCount} Open</span>}
          {reviewCount > 0 && <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">{reviewCount} In Review</span>}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['ALL', 'OPEN', 'IN_REVIEW', 'RESOLVED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? 'bg-[#00A8A3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {s === 'ALL' ? 'All' : s === 'IN_REVIEW' ? 'In Review' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div key={d.id} onClick={() => openDetail(d)}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-500'}`}>
                      {d.status}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{d.product_title || 'Unknown product'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Buyer: {d.buyer_nickname} / Seller: {d.seller_nickname}
                  </p>
                  {d.reason && <p className="text-xs text-gray-400 mt-1 truncate">{d.reason}</p>}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400 text-sm">No disputes found</p>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Dispute Detail</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] || ''}`}>{selected.status}</span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-400 text-xs">Product</span><p className="font-medium">{selected.product_title || '-'}</p></div>
                <div><span className="text-gray-400 text-xs">Order ID</span><p className="font-medium truncate">{selected.order_id || '-'}</p></div>
                <div><span className="text-gray-400 text-xs">Buyer</span><p>{selected.buyer_nickname}</p></div>
                <div><span className="text-gray-400 text-xs">Seller</span><p>{selected.seller_nickname}</p></div>
              </div>

              {selected.reason && (
                <div><span className="text-gray-400 text-xs">Reason</span><p className="text-gray-700">{selected.reason}</p></div>
              )}
              {selected.description && (
                <div><span className="text-gray-400 text-xs">Description</span><p className="text-gray-700">{selected.description}</p></div>
              )}
              {selected.action && (
                <div><span className="text-gray-400 text-xs">User Action</span><p className="text-gray-700">{selected.action}</p></div>
              )}

              <div>
                <label className="text-gray-400 text-xs">Admin Note</label>
                <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={3}
                  placeholder="Write admin response..." />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Close</button>
              {selected.status === 'OPEN' && (
                <button onClick={() => updateStatus('IN_REVIEW')} disabled={saving}
                  className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50">
                  {saving ? '...' : 'Start Review'}
                </button>
              )}
              {(selected.status === 'OPEN' || selected.status === 'IN_REVIEW') && (
                <button onClick={() => updateStatus('RESOLVED')} disabled={saving}
                  className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50">
                  {saving ? '...' : 'Resolve'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
