import React, { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

interface Product {
  id: string;
  title: string;
  price: number;
  category: string | null;
  region: string | null;
  status: string;
  images: string[] | null;
  is_free_share: boolean;
  allow_offer: boolean;
  seller_id: string | null;
  seller_nickname?: string;
  description: string | null;
  created_at: string;
}

const TEAL = '#00A8A3';

const STATUS_OPTIONS = [
  { value: 'ALL', label: '전체' },
  { value: '판매중', label: '판매중' },
  { value: '예약중', label: '예약중' },
  { value: '판매완료', label: '판매완료' },
];

export const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [freeOnly, setFreeOnly] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (freeOnly) params.set('free_share', 'true');
    if (search.trim()) params.set('q', search.trim());
    const res = await api.get<Product[]>(`/api/admin/products?${params.toString()}`, {
      headers: adminPasswordHeaders(),
    });
    setProducts(res.ok && res.data ? res.data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, freeOnly]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete product ${id}? This cannot be undone.`)) return;
    const res = await api.delete(`/api/admin/products/${id}`, { headers: adminPasswordHeaders() });
    if (!res.ok) {
      alert(`삭제 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    setSelected(null);
    load();
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
        <span className="text-sm text-gray-500">{products.length} products</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="제목 또는 ID 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
        </form>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />
          나눔만 보기
        </label>
        <button onClick={() => load()} className="px-4 py-2.5 text-sm text-white rounded-lg" style={{ backgroundColor: TEAL }}>
          검색
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">조건에 맞는 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">상품</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">판매자</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">가격</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">카테고리</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">등록일</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelected(p)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                        {p.images?.[0] && (
                          <img src={p.images[0]} alt="" className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{p.title}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.seller_nickname || (p.seller_id?.slice(0, 8) ?? '-')}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {p.is_free_share ? <span className="text-green-600">무료나눔</span> : `${Number(p.price || 0).toLocaleString()} Pi`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === '판매중' ? 'bg-green-100 text-green-700'
                      : p.status === '예약중' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.category || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-500 text-xs font-medium hover:underline"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">상품 상세</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                selected.status === '판매중' ? 'bg-green-100 text-green-700'
                : selected.status === '예약중' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-500'
              }`}>{selected.status}</span>
            </div>

            {selected.images && selected.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto mb-4">
                {selected.images.map((img, idx) => (
                  <a key={idx} href={img} target="_blank" rel="noreferrer">
                    <img src={img} alt="" className="w-32 h-32 object-cover rounded-lg border border-gray-200 hover:opacity-80" />
                  </a>
                ))}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-400 text-xs">제목</span>
                <p className="font-medium text-gray-900">{selected.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-400 text-xs">가격</span>
                  <p className="font-medium">
                    {selected.is_free_share ? '무료나눔' : `${Number(selected.price || 0).toLocaleString()} Pi`}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">카테고리</span>
                  <p className="font-medium">{selected.category || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">지역</span>
                  <p className="font-medium">{selected.region || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">판매자</span>
                  <p className="font-medium">{selected.seller_nickname || selected.seller_id || '-'}</p>
                </div>
              </div>
              {selected.description && (
                <div>
                  <span className="text-gray-400 text-xs">설명</span>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 mt-1 max-h-40 overflow-y-auto">{selected.description}</p>
                </div>
              )}
              <div className="text-xs text-gray-400 break-all">ID: {selected.id}</div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                닫기
              </button>
              <button onClick={() => handleDelete(selected.id)}
                className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg bg-red-500 hover:bg-red-600">
                상품 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
