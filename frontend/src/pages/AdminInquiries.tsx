import React, { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

interface Inquiry {
  id: string;
  user_id: string | null;
  user_nickname?: string;
  email: string | null;
  category: string;
  title: string;
  content: string;
  images?: string[];
  status: string;
  admin_reply: string | null;
  created_at: string;
  replied_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  replied: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

const TEAL = '#00A8A3';

export const AdminInquiries: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');
  const [tableExists, setTableExists] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get<Inquiry[]>('/api/admin/inquiries', { headers: adminPasswordHeaders() });
      if (!res.ok) {
        const msg = res.error || '';
        const missingInquiriesTable =
          (/does not exist|42P01|undefined (table|relation)/i.test(msg) && /inquiries/i.test(msg)) ||
          /relation ["']?inquiries["']? does not exist/i.test(msg);
        if (missingInquiriesTable) {
          setTableExists(false);
        } else {
          setTableExists(true);
          setFetchError(msg || '문의 목록을 불러오지 못했습니다.');
        }
        setInquiries([]);
      } else if (res.data) {
        setTableExists(true);
        setInquiries(
          res.data.map((d: any) => ({
            ...d,
            user_nickname: d.user_nickname || d.user_id?.substring(0, 8) || 'Guest',
          }))
        );
      }
    } catch (e) {
      setInquiries([]);
      setFetchError(e instanceof Error ? e.message : '문의 목록을 불러오지 못했습니다.');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'ALL' ? inquiries : inquiries.filter((i) => i.status === filter);
  const pendingCount = inquiries.filter((i) => i.status === 'pending').length;

  const openDetail = (inq: Inquiry) => {
    setSelected(inq);
    setReply(inq.admin_reply || '');
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setSaving(true);
    const res = await api.put(
      `/api/admin/inquiries/${selected.id}`,
      { admin_reply: reply.trim(), status: 'replied' },
      { headers: adminPasswordHeaders() }
    );
    setSaving(false);
    if (!res.ok) {
      const hint = res.status === 401
        ? '관리자 비밀번호가 일치하지 않습니다.'
        : res.status === 503
          ? '서버에 ADMIN_PASSWORD가 설정되지 않았습니다.'
          : (res.error || `저장 실패 (HTTP ${res.status})`);
      alert(`답변 저장 실패: ${hint}`);
      return;
    }
    setSelected(null);
    load();
  };

  const handleClose = async (id: string) => {
    const res = await api.put(`/api/admin/inquiries/${id}`, { status: 'closed' }, { headers: adminPasswordHeaders() });
    if (!res.ok) {
      alert(`종료 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    setSelected(null);
    load();
  };

  const filterLabel = (s: string) => {
    if (s === 'ALL') return '전체';
    if (s === 'pending') return '대기';
    if (s === 'replied') return '답변완료';
    if (s === 'closed') return '종료';
    return s;
  };

  if (!tableExists) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">문의사항</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-4">
            API 서버 DB에 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">inquiries</code> 테이블이 없습니다.
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">backend/supabase-schema.sql</code>의 문의 섹션을 Postgres에서 실행하세요.
          </p>
          <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
{`CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  email TEXT,
  category TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  replied_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_user ON inquiries(user_id);`}
          </pre>
          <button onClick={() => { setTableExists(true); load(); }}
            className="mt-4 px-4 py-2 text-sm text-white font-medium rounded-lg" style={{ backgroundColor: TEAL }}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">문의사항</h1>
        {pendingCount > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
            대기 {pendingCount}건
          </span>
        )}
      </div>

      {fetchError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">목록을 불러오지 못했습니다</p>
          <p className="mt-1 text-red-700/90">{fetchError}</p>
          <p className="mt-2 text-xs text-red-600/80">
            API 주소(<code className="rounded bg-red-100 px-1">VITE_API_URL</code>)·관리자 비밀번호·서버 로그를 확인하세요.
          </p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-3 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-200"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      <div className="flex gap-2 mb-6">
        {['ALL', 'pending', 'replied', 'closed'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? 'bg-[#00A8A3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {filterLabel(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          불러오는 중…
        </div>
      ) : inquiries.length === 0 && !fetchError ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">아직 등록된 문의가 없습니다</p>
          <p className="text-gray-400 text-xs mt-2">앱에서 문의하기로 접수한 내역이 여기에 표시됩니다.</p>
        </div>
      ) : !loading && inquiries.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((inq) => (
            <div key={inq.id} onClick={() => openDetail(inq)}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inq.status] || 'bg-gray-100 text-gray-500'}`}>
                      {filterLabel(inq.status)}
                    </span>
                    <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded">{inq.category}</span>
                    <span className="text-xs text-gray-400">{new Date(inq.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{inq.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    보낸 사람: {inq.user_nickname}{inq.email ? ` (${inq.email})` : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400 text-sm">이 조건에 해당하는 문의가 없습니다</p>
          )}
        </div>
      ) : null}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">문의 상세</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] || ''}`}>{filterLabel(selected.status)}</span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-400 text-xs">보낸 사람</span><p className="font-medium">{selected.user_nickname}</p></div>
                <div><span className="text-gray-400 text-xs">유형</span><p className="font-medium">{selected.category}</p></div>
                {selected.email && <div className="col-span-2"><span className="text-gray-400 text-xs">이메일</span><p>{selected.email}</p></div>}
              </div>

              <div>
                <span className="text-gray-400 text-xs">제목</span>
                <p className="font-medium text-gray-900">{selected.title}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">내용</span>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 mt-1">{selected.content}</p>
              </div>

              {selected.images && selected.images.length > 0 && (
                <div>
                  <span className="text-gray-400 text-xs">첨부 이미지 ({selected.images.length})</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selected.images.map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noreferrer">
                        <img src={img} alt={`attachment-${idx}`}
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selected.admin_reply && (
                <div>
                  <span className="text-gray-400 text-xs">이전 답변</span>
                  <p className="text-gray-700 whitespace-pre-wrap bg-green-50 rounded-lg p-3 mt-1">{selected.admin_reply}</p>
                </div>
              )}

              <div>
                <label className="text-gray-400 text-xs">관리자 답변</label>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={4}
                  placeholder="답변 내용을 입력하세요" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleReply} disabled={saving || !reply.trim()}
                className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg disabled:opacity-50" style={{ backgroundColor: TEAL }}>
                {saving ? '전송 중…' : '답변 등록'}
              </button>
            </div>
            {selected.status !== 'closed' && (
              <button onClick={() => handleClose(selected.id)} className="w-full mt-3 py-2 text-xs text-gray-400 hover:text-gray-600">
                문의 종료
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
