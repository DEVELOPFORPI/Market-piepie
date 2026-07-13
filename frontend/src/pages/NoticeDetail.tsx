import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NoticeContent } from '@/components/notice/NoticeContent';
import { api } from '@/utils/api';
import { getAnonymousViewerId } from '@/utils/viewerIdentity';

type NoticeDetail = {
  id: string;
  title: string;
  content: string;
  view_count: number;
  created_at: string;
  updated_at?: string;
};

export const NoticeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api.get<NoticeDetail>(`/api/notices/${id}`);
      if (cancelled) return;
      if (!res.ok || !res.data) {
        setError(res.error || '공지를 불러오지 못했습니다.');
        setNotice(null);
        setLoading(false);
      } else {
        const noticeData = res.data;
        setNotice(noticeData);
        setError('');
        setLoading(false);
        const viewResponse = await api.post<{ count: number; counted: boolean }>(
          `/api/notices/${id}/view`,
          { viewer_id: getAnonymousViewerId() },
        );
        if (!cancelled && viewResponse.ok && viewResponse.data) {
          setNotice({ ...noticeData, view_count: viewResponse.data.count });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-14 max-w-2xl items-center px-4">
          <button
            type="button"
            onClick={() => navigate('/notices')}
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

      <main className="mx-auto max-w-2xl">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">불러오는 중…</p>
        ) : error ? (
          <p className="px-5 py-10 text-center text-sm text-red-600">{error}</p>
        ) : notice ? (
          <article>
            <div className="px-5 pb-6 pt-8">
              <h2 className="break-words text-2xl font-bold leading-snug text-gray-950">
                {notice.title}
              </h2>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <time dateTime={notice.created_at}>
                  {new Date(notice.created_at).toLocaleString('ko-KR')}
                </time>
                <span aria-hidden>·</span>
                <span>조회 {notice.view_count ?? 0}</span>
              </div>
            </div>
            <div className="mx-5 border-t border-gray-200" />
            <NoticeContent content={notice.content} className="px-5 py-7" />
          </article>
        ) : null}
      </main>
    </div>
  );
};
