import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';

type NoticeSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

export const NoticeList: React.FC = () => {
  const navigate = useNavigate();
  const [notices, setNotices] = useState<NoticeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await api.get<NoticeSummary[]>('/api/notices');
      if (cancelled) return;
      if (!response.ok) {
        setError(response.error || '공지 목록을 불러오지 못했습니다.');
      } else {
        setNotices(response.data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-14 max-w-2xl items-center px-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full text-gray-800 transition-colors hover:bg-gray-100 active:bg-gray-200"
            aria-label="뒤로가기"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="pointer-events-none absolute inset-x-14 text-center text-lg font-bold text-gray-900">
            공지사항
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">불러오는 중…</p>
        ) : error ? (
          <p className="px-5 py-10 text-center text-sm text-red-600">{error}</p>
        ) : notices.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-gray-500">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="space-y-2.5">
            {notices.map((notice) => (
              <li key={notice.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/notices/${notice.id}`)}
                  className="flex min-h-[58px] w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-gray-900">
                      {notice.title}
                    </p>
                  </div>
                  <time
                    dateTime={notice.created_at}
                    className="shrink-0 text-xs text-gray-400"
                  >
                    {formatDate(notice.created_at)}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};
