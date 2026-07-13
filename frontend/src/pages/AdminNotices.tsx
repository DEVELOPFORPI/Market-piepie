import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';
import { createAdminNotice, fetchAdminNotices, type NoticeRecord } from '@/utils/homePopupStorage';
import { NoticeEditor } from '@/components/notice/NoticeEditor';
import { uploadImageToR2 } from '@/utils/imageUpload';

const TEAL = '#00A8A3';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AdminNotices: React.FC = () => {
  const formRef = useRef<HTMLDivElement>(null);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hint, setHint] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchAdminNotices();
    setNotices(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadNoticeImage = async (file: File): Promise<string> => {
    setUploadingImage(true);
    try {
      return await uploadImageToR2(file, { folder: 'notices', admin: true });
    } finally {
      setUploadingImage(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setEditingId(null);
  };

  const startEdit = (notice: NoticeRecord) => {
    setTitle(notice.title);
    setContent(notice.content ?? '');
    setEditingId(notice.id);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 본문을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const response = await api.put<NoticeRecord>(
          `/api/admin/notices/${editingId}`,
          { title: title.trim(), content: content.trim() },
          { headers: adminPasswordHeaders() },
        );
        if (!response.ok) {
          alert('공지를 수정하지 못했습니다.');
          return;
        }
        resetForm();
        setHint('공지가 수정되었습니다.');
        window.setTimeout(() => setHint(''), 3000);
        await load();
        return;
      }

      const created = await createAdminNotice(
        { title: title.trim(), content: content.trim(), published: true },
        adminPasswordHeaders(),
      );
      if (!created) {
        alert('공지를 저장하지 못했습니다.');
        return;
      }
      resetForm();
      setHint('공지가 등록되었습니다.');
      window.setTimeout(() => setHint(''), 3000);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteNotice = async (notice: NoticeRecord) => {
    if (!window.confirm(`「${notice.title}」 공지를 삭제할까요?\n연결된 팝업의 자세히 보기 버튼도 사라집니다.`)) {
      return;
    }

    setDeletingId(notice.id);
    try {
      const response = await api.delete<{ ok: boolean }>(
        `/api/admin/notices/${notice.id}`,
        { headers: adminPasswordHeaders() },
      );
      if (!response.ok) {
        alert('공지를 삭제하지 못했습니다.');
        return;
      }
      if (editingId === notice.id) resetForm();
      setHint('공지가 삭제되었고 팝업 연결이 해제되었습니다.');
      window.setTimeout(() => setHint(''), 3000);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const setPublished = async (notice: NoticeRecord, published: boolean) => {
    if (notice.published === published) return;
    const res = await api.put<NoticeRecord>(
      `/api/admin/notices/${notice.id}`,
      { published },
      { headers: adminPasswordHeaders() },
    );
    if (!res.ok) {
      alert('상태를 변경하지 못했습니다.');
      return;
    }
    await load();
  };

  return (
    <div className="min-h-0 pb-12">
      <div className="mx-auto max-w-2xl space-y-5 px-6 py-8 lg:px-10 lg:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">공지</h1>
        <p className="text-sm text-gray-600">
          홈 팝업의 「자세히 보기」와 연결할 공지를 작성합니다. 본문에 이미지를 넣을 수 있습니다.
        </p>

        {hint ? (
          <div className="rounded-xl border border-teal-100 bg-teal-50/90 px-4 py-3 text-sm text-teal-950">
            {hint}
          </div>
        ) : null}

        <div
          ref={formRef}
          className="space-y-4 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#1a1a1a]">
              {editingId ? '공지 수정' : '새 공지 작성'}
            </h2>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-gray-500 underline hover:text-gray-800"
              >
                수정 취소
              </button>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#1a1a1a]">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              placeholder="공지 제목"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#1a1a1a]">본문</label>
            <NoticeEditor
              value={content}
              onChange={setContent}
              onUploadImage={uploadNoticeImage}
            />
            <p className="mt-1 text-xs text-gray-500">
              글을 작성하다 이미지 버튼을 누르면 현재 커서 위치에 여러 장을 삽입할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || uploadingImage}
            className="min-h-[44px] w-full rounded-2xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: TEAL }}
          >
            {saving ? '저장 중…' : editingId ? '수정 저장' : '공지 등록'}
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-[#1a1a1a]">공지 목록</h2>
          {loading ? (
            <p className="text-sm text-gray-500">불러오는 중…</p>
          ) : notices.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 공지가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notices.map((notice) => (
                <li key={notice.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{notice.title}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(notice.created_at)} · 조회 {notice.view_count ?? 0}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <div className="flex overflow-hidden rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => void setPublished(notice, true)}
                        className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          notice.published
                            ? 'bg-teal-50 text-teal-700'
                            : 'bg-white text-gray-400 hover:bg-gray-50'
                        }`}
                        aria-pressed={notice.published}
                      >
                        공개
                      </button>
                      <button
                        type="button"
                        onClick={() => void setPublished(notice, false)}
                        className={`border-l border-gray-200 px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          !notice.published
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-white text-gray-400 hover:bg-gray-50'
                        }`}
                        aria-pressed={!notice.published}
                      >
                        비공개
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(notice)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteNotice(notice)}
                      disabled={deletingId === notice.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === notice.id ? '삭제 중…' : '삭제'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
