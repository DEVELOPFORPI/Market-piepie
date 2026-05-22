import React, { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

interface User {
  id: string;
  nickname: string;
  profile_image: string | null;
  bio: string | null;
  kyc_status: string;
  trust_score: number;
  rating: number;
  trade_count: number;
  activity_region: string | null;
  seller_type: string | null;
  created_at: string;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ nickname: '', kyc_status: '', trust_score: 0, bio: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get<User[]>('/api/admin/users', { headers: adminPasswordHeaders() });
    if (res.ok && res.data) setUsers(res.data);
    else setUsers([]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(
    (u) =>
      u.nickname?.toLowerCase().includes(search.toLowerCase()) ||
      u.id?.toLowerCase().includes(search.toLowerCase()) ||
      u.activity_region?.toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = (u: User) => {
    setSelected(u);
    setEditForm({ nickname: u.nickname, kyc_status: u.kyc_status, trust_score: u.trust_score, bio: u.bio || '' });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    await api.put(`/api/admin/users/${selected.id}`, {
      nickname: editForm.nickname,
      kyc_status: editForm.kyc_status,
      trust_score: editForm.trust_score,
      bio: editForm.bio,
      seller_type: selected.seller_type,
    }, { headers: adminPasswordHeaders() });
    setSaving(false);
    setSelected(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete user ${id}?`)) return;
    await api.delete(`/api/admin/users/${id}`, { headers: adminPasswordHeaders() });
    setSelected(null);
    load();
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <span className="text-sm text-gray-500">{users.length} users</span>
      </div>

      <input
        type="text"
        placeholder="Search by nickname, ID, region..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-6 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
      />

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">KYC</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trust</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trades</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Region</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {u.profile_image && <img src={u.profile_image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.nickname}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[120px]">{u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.kyc_status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {u.kyc_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{u.trust_score}</td>
                  <td className="px-4 py-3 text-gray-700">{u.trade_count}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.activity_region || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(u)} className="text-[#00A8A3] text-xs font-medium hover:underline">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Edit User</h2>
            <p className="text-xs text-gray-400 mb-4 break-all">{selected.id}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Nickname</label>
                <input value={editForm.nickname} onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">KYC Status</label>
                <select value={editForm.kyc_status} onChange={(e) => setEditForm({ ...editForm, kyc_status: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="unverified">unverified</option>
                  <option value="verified">verified</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Trust Score</label>
                <input type="number" value={editForm.trust_score} onChange={(e) => setEditForm({ ...editForm, trust_score: +e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Bio</label>
                <textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg disabled:opacity-50" style={{ backgroundColor: '#00A8A3' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <button onClick={() => handleDelete(selected.id)} className="w-full mt-3 py-2 text-xs text-red-500 hover:text-red-700">
              Delete User
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
