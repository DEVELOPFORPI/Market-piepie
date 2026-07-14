import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  createAdminHomePopup,
  deleteAdminHomePopup,
  fetchAdminHomePopups,
  fetchAdminNotices,
  HOME_POPUP_TITLE_MAX,
  mapHomePopupRecord,
  updateAdminHomePopup,
  type HomePopupRecord,
  type HomePopupView,
  type NoticeRecord,
} from '@/utils/homePopupStorage';
import { HomePromoPopup } from '@/components/home/HomePromoPopup';
import { uploadImageToR2 } from '@/utils/imageUpload';
import { adminPasswordHeaders } from '@/utils/adminApi';

const TEAL = '#00A8A3';
const CHARCOAL = '#2c2c2e';

type FormState = {
  title: string;
  heroImage: string;
  noticeId: string;
};

const emptyForm = (): FormState => ({
  title: '',
  heroImage: '',
  noticeId: '',
});

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AdminHomePopup: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [popups, setPopups] = useState<HomePopupRecord[]>([]);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPopup, setPreviewPopup] = useState<HomePopupView | null>(null);
  const [savedHint, setSavedHint] = useState('');
  const [pickedLabel, setPickedLabel] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(true);

  const activePopup = popups.find((p) => p.enabled);
  const isGloballyEnabled = Boolean(activePopup);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [popupRows, noticeRows] = await Promise.all([
        fetchAdminHomePopups(),
        fetchAdminNotices(),
      ]);
      setPopups(popupRows);
      setNotices(noticeRows);
      setTableExists(true);
    } catch {
      setTableExists(false);
      setPopups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flashHint = (msg: string, ms = 3200) => {
    setSavedHint(msg);
    window.setTimeout(() => setSavedHint(''), ms);
  };

  const notifyHome = () => {
    try {
      window.dispatchEvent(new Event('homePopupConfigChanged'));
    } catch {
      /* ignore */
    }
  };

  const requireTitle = (): string | null => {
    const title = form.title.trim();
    if (!title) {
      setTitleError('제목을 입력해 주세요.');
      return null;
    }
    if (title.length > HOME_POPUP_TITLE_MAX) {
      setTitleError(`제목은 ${HOME_POPUP_TITLE_MAX}자 이내로 입력해 주세요.`);
      return null;
    }
    setTitleError('');
    return title;
  };

  const fileRowText =
    pickedLabel || (form.heroImage ? '등록된 이미지가 있습니다' : '선택된 파일 없음');

  const handleToggleGlobal = async () => {
    const headers = adminPasswordHeaders();
    if (isGloballyEnabled && activePopup) {
      const updated = await updateAdminHomePopup(activePopup.id, { enabled: false }, headers);
      if (!updated) {
        alert('팝업을 끄지 못했습니다.');
        return;
      }
      flashHint('팝업이 꺼졌습니다.');
      await load();
      notifyHome();
      return;
    }

    const target = activePopup ?? popups[0];
    if (!target) {
      alert('먼저 팝업을 게시해 주세요.');
      return;
    }

    const updated = await updateAdminHomePopup(
      target.id,
      { enabled: true, bump_revision: true },
      headers,
    );
    if (!updated) {
      alert('팝업을 켜지 못했습니다.');
      return;
    }
    flashHint('팝업이 켜졌습니다. 새 버전이 적용되어 이전에 닫은 사용자에게도 다시 표시됩니다.');
    await load();
    notifyHome();
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setPickedLabel('');
    setTitleError('');
  };

  const startEdit = (popup: HomePopupRecord) => {
    setEditingId(popup.id);
    setForm({
      title: popup.title,
      heroImage: popup.hero_image,
      noticeId: popup.notice_id || '',
    });
    setPickedLabel('');
    setTitleError('');
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePublish = async () => {
    const title = requireTitle();
    if (!title) return;
    if (!form.heroImage.trim()) {
      alert('이미지를 업로드해 주세요.');
      return;
    }

    setPublishing(true);
    try {
      const headers = adminPasswordHeaders();
      const payload = {
        title,
        hero_image: form.heroImage.trim(),
        notice_id: form.noticeId || null,
      };

      if (editingId) {
        const editing = popups.find((p) => p.id === editingId);
        const updated = await updateAdminHomePopup(
          editingId,
          {
            ...payload,
            bump_revision: Boolean(editing?.enabled),
          },
          headers,
        );
        if (!updated) {
          alert('수정하지 못했습니다.');
          return;
        }
        flashHint('팝업이 수정되었습니다.', 3500);
        resetForm();
        await load();
        notifyHome();
        return;
      }

      const created = await createAdminHomePopup(
        {
          ...payload,
          enabled: true,
        },
        headers,
      );
      if (!created) {
        alert('게시하지 못했습니다. DB 마이그레이션과 관리자 비밀번호를 확인해 주세요.');
        return;
      }
      flashHint('게시되었습니다. 홈에서 이 버전이 다시 노출됩니다.', 3500);
      resetForm();
      await load();
      notifyHome();
    } finally {
      setPublishing(false);
    }
  };

  const handleDeletePopup = async (popup: HomePopupRecord) => {
    if (!window.confirm(`「${popup.title}」 팝업을 삭제할까요?`)) return;
    setDeletingId(popup.id);
    try {
      const ok = await deleteAdminHomePopup(popup.id, adminPasswordHeaders());
      if (!ok) {
        alert('삭제하지 못했습니다.');
        return;
      }
      if (editingId === popup.id) resetForm();
      flashHint('팝업이 삭제되었습니다.');
      await load();
      notifyHome();
    } finally {
      setDeletingId(null);
    }
  };

  const handleEnablePopup = async (popup: HomePopupRecord) => {
    const updated = await updateAdminHomePopup(
      popup.id,
      { enabled: true, bump_revision: true },
      adminPasswordHeaders(),
    );
    if (!updated) {
      alert('활성화하지 못했습니다.');
      return;
    }
    flashHint('선택한 팝업이 노출 중입니다.');
    await load();
    notifyHome();
  };

  const onPickHero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setPickedLabel(file.name);
    setUploadingHero(true);
    try {
      const url = await uploadImageToR2(file, { folder: 'home-popup', admin: true });
      setForm((f) => ({ ...f, heroImage: url }));
    } catch {
      alert('이미지를 업로드하지 못했습니다.');
    } finally {
      setUploadingHero(false);
    }
  };

  const clearHero = () => {
    setPickedLabel('');
    setForm((f) => ({ ...f, heroImage: '' }));
  };

  const openPreview = () => {
    const title = requireTitle();
    if (!title) return;
    const noticeId = form.noticeId || null;
    setPreviewPopup({
      id: 'preview',
      title,
      heroImage: form.heroImage,
      noticeId,
      revision: 1,
      enabled: true,
    });
  };

  return (
    <div className="min-h-0 overflow-x-hidden pb-12">
      <div className="mx-auto max-w-2xl space-y-5 px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">홈 화면 팝업</h1>
          <button
            type="button"
            role="switch"
            aria-checked={isGloballyEnabled}
            aria-label="팝업 표시"
            onClick={() => void handleToggleGlobal()}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${isGloballyEnabled ? '' : 'bg-gray-300'}`}
            style={isGloballyEnabled ? { backgroundColor: TEAL } : undefined}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                isGloballyEnabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-gray-600">
          팝업을 게시하면 DB에 저장되고, 아래 목록에서 이전 팝업을 다시 노출할 수 있습니다. 공지를 연결하면
          「자세히 보기」가 공지 상세로 이동합니다.
        </p>

        {!tableExists ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            home_popups 테이블이 없습니다. 백엔드 마이그레이션(010_notices_home_popups.sql)을 실행해 주세요.
          </div>
        ) : null}

        {savedHint ? (
          <div className="rounded-xl border border-teal-100 bg-teal-50/90 px-4 py-3 text-sm text-teal-950">
            {savedHint}
          </div>
        ) : null}

        <div
          ref={formSectionRef}
          className="space-y-6 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#1a1a1a]">
              {editingId ? '팝업 수정' : '새 팝업 작성'}
            </h2>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-gray-500 underline hover:text-gray-800"
              >
                작성 취소
              </button>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#1a1a1a]">
              제목 <span className="text-red-500">*</span>
              <span className="ml-1 text-xs font-normal text-gray-500">
                (최대 {HOME_POPUP_TITLE_MAX}자)
              </span>
            </label>
            <input
              type="text"
              value={form.title}
              required
              maxLength={HOME_POPUP_TITLE_MAX}
              placeholder="팝업 제목을 입력하세요"
              onChange={(e) => {
                setForm((f) => ({ ...f, title: e.target.value }));
                if (e.target.value.trim() && e.target.value.length <= HOME_POPUP_TITLE_MAX) {
                  setTitleError('');
                }
              }}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                titleError ? 'border-red-400 focus:ring-red-200' : 'border-gray-300'
              }`}
            />
            {titleError ? <p className="mt-1 text-xs text-red-600">{titleError}</p> : null}
            <p className="mt-1 text-right text-xs text-gray-400">
              {form.title.length}/{HOME_POPUP_TITLE_MAX}
            </p>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-sm font-semibold text-[#1a1a1a]">연결 공지 (선택)</label>
            <select
              value={form.noticeId}
              onChange={(e) => setForm((f) => ({ ...f, noticeId: e.target.value }))}
              title={notices.find((n) => n.id === form.noticeId)?.title || ''}
              className="w-full max-w-full min-w-0 truncate rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            >
              <option value="">공지 없음</option>
              {notices.map((n) => (
                <option key={n.id} value={n.id} title={n.title}>
                  {n.title.length > 40 ? `${n.title.slice(0, 40)}…` : n.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              연결 시 「자세히 보기」가 표시되고, 없으면 「닫기」만 보입니다.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#1a1a1a]">
                이미지 업로드 <span className="text-red-500">*</span>
              </p>
              <span className="text-xs font-medium text-gray-500">500×700px</span>
            </div>
            <div className="flex gap-2">
              <div
                className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700"
                title={fileRowText}
              >
                <span className="line-clamp-1">{fileRowText}</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onPickHero}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingHero}
                className="shrink-0 rounded-xl bg-[#4a4a4c] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3a3a3c]"
              >
                {uploadingHero ? '업로드 중…' : '파일선택'}
              </button>
            </div>
            {form.heroImage ? (
              <div className="mt-4 space-y-2">
                <div className="mx-auto aspect-[5/7] w-full max-w-[250px] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img src={form.heroImage} alt="" className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  className="text-left text-xs font-medium text-red-600 underline decoration-red-600/60"
                  onClick={clearHero}
                >
                  이미지 제거
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing}
              className="min-h-[48px] flex-1 rounded-2xl text-[15px] font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: TEAL }}
            >
              {publishing ? (editingId ? '저장 중…' : '게시 중…') : editingId ? '저장' : '게시하기'}
            </button>
            <button
              type="button"
              onClick={openPreview}
              className="min-h-[48px] flex-1 rounded-2xl text-[15px] font-semibold text-white transition-opacity hover:opacity-95"
              style={{ backgroundColor: CHARCOAL }}
            >
              미리보기
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-[#1a1a1a]">게시된 팝업</h2>
          {loading ? (
            <p className="text-sm text-gray-500">불러오는 중…</p>
          ) : popups.length === 0 ? (
            <p className="text-sm text-gray-500">아직 게시된 팝업이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {popups.map((popup) => (
                <li key={popup.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {popup.hero_image ? (
                      <img src={popup.hero_image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 truncate text-sm font-semibold text-gray-900" title={popup.title}>
                      {popup.title}
                    </p>
                    <p
                      className="mt-0.5 truncate text-xs text-gray-500"
                      title={
                        popup.notice_title
                          ? `${formatDate(popup.created_at)} · 리비전 ${popup.revision} · 공지: ${popup.notice_title}`
                          : undefined
                      }
                    >
                      {formatDate(popup.created_at)} · 리비전 {popup.revision}
                      {popup.notice_title ? ` · 공지: ${popup.notice_title}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {popup.enabled ? (
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                        노출 중
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleEnablePopup(popup)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        노출하기
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewPopup(mapHomePopupRecord(popup))}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      미리보기
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(popup)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePopup(popup)}
                      disabled={deletingId === popup.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === popup.id ? '삭제 중…' : '삭제'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {previewPopup ? (
        <HomePromoPopup
          popup={previewPopup}
          onClose={() => setPreviewPopup(null)}
        />
      ) : null}
    </div>
  );
};
