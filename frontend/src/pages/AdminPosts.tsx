import React, { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  author_id: string | null;
  author_nickname?: string;
  images: string[] | null;
  region: string | null;
  comment_count: number | string;
  created_at: string;
}

const TEAL = '#00A8A3';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: '전체' },
  { value: '질문', label: '질문' },
  { value: '정보', label: '정보' },
  { value: '이거 찾아요', label: '이거 찾아요' },
  { value: '분쟁', label: '분쟁' },
  { value: '교환', label: '교환' },
];

export const AdminPosts: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selected, setSelected] = useState<Post | null>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
    if (search.trim()) params.set('q', search.trim());
    const res = await api.get<Post[]>(`/api/admin/posts?${params.toString()}`, {
      headers: adminPasswordHeaders(),
    });
    setPosts(res.ok && res.data ? res.data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete post ${id}? This cannot be undone.`)) return;
    const res = await api.delete(`/api/admin/posts/${id}`, { headers: adminPasswordHeaders() });
    if (!res.ok) {
      alert(`삭제 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    setSelected(null);
    load();
  };

  const disputeCount = posts.filter((p) => p.category === '분쟁').length;

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">커뮤니티 게시물</h1>
        <div className="flex items-center gap-3">
          {disputeCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
              분쟁 {disputeCount}건
            </span>
          )}
          <span className="text-sm text-gray-500">{posts.length} posts</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="제목/내용 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
        </form>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
          {CATEGORY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => load()} className="px-4 py-2.5 text-sm text-white rounded-lg" style={{ backgroundColor: TEAL }}>
          검색
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">조건에 맞는 게시물이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} onClick={() => setSelected(p)}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.category === '분쟁' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>{p.category}</span>
                    {p.region && <span className="text-xs text-gray-400">{p.region}</span>}
                    <span className="text-xs text-gray-400 ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">{p.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.content}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{p.author_nickname || (p.author_id?.slice(0, 8) ?? '-')}</span>
                    <span>댓글 {Number(p.comment_count) || 0}</span>
                    {p.images && p.images.length > 0 && <span>이미지 {p.images.length}장</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                  className="text-red-500 text-xs font-medium hover:underline shrink-0"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">게시물 상세</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                selected.category === '분쟁' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}>{selected.category}</span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-400 text-xs">작성자</span>
                  <p className="font-medium">{selected.author_nickname || selected.author_id || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">작성일</span>
                  <p className="font-medium">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                {selected.region && (
                  <div>
                    <span className="text-gray-400 text-xs">지역</span>
                    <p className="font-medium">{selected.region}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-400 text-xs">댓글</span>
                  <p className="font-medium">{Number(selected.comment_count) || 0}개</p>
                </div>
              </div>

              <div>
                <span className="text-gray-400 text-xs">제목</span>
                <p className="font-medium text-gray-900">{selected.title}</p>
              </div>

              <div>
                <span className="text-gray-400 text-xs">내용</span>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 mt-1 max-h-60 overflow-y-auto">{selected.content}</p>
              </div>

              {selected.images && selected.images.length > 0 && (
                <div>
                  <span className="text-gray-400 text-xs">이미지 ({selected.images.length})</span>
                  <div className="flex gap-2 overflow-x-auto mt-1">
                    {selected.images.map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noreferrer">
                        <img src={img} alt="" className="w-32 h-32 object-cover rounded-lg border border-gray-200 hover:opacity-80" />
                      </a>
                    ))}
                  </div>
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
                게시물 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
