import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getHomePopupConfig,
  publishHomePopupConfig,
  saveHomePopupConfig,
  type HomePopupConfig,
} from '@/utils/homePopupStorage';
import { HomePromoPopup } from '@/components/home/HomePromoPopup';

const TEAL = '#00A8A3';
const CHARCOAL = '#2c2c2e';

/** Wider max for a single hero banner (localStorage size still applies). */
async function compressImageFile(file: File, max = 900): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          if (w > h) {
            h = Math.round((h * max) / w);
            w = max;
          } else {
            w = Math.round((w * max) / h);
            h = max;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export const AdminHomePopup: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cfg, setCfg] = useState<HomePopupConfig>(() => getHomePopupConfig());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedHint, setSavedHint] = useState('');
  const [pickedLabel, setPickedLabel] = useState('');

  const refresh = useCallback(() => {
    setCfg(getHomePopupConfig());
  }, []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('homePopupConfigChanged', onChange);
    return () => window.removeEventListener('homePopupConfigChanged', onChange);
  }, [refresh]);

  const fileRowText =
    pickedLabel || (cfg.heroImage ? '등록된 이미지가 있습니다' : '선택된 파일 없음');

  const handleToggleEnabled = (enabled: boolean) => {
    if (enabled) {
      const next = publishHomePopupConfig({
        enabled: true,
        title: cfg.title.trim() || 'Meet in person for safer trades',
        subtitle: cfg.subtitle.trim() || 'Start every deal safely.',
        heroImage: cfg.heroImage,
      });
      setCfg(next);
      setSavedHint('팝업이 켜졌습니다. 새 버전이 적용되어 이전에 닫은 사용자에게도 다시 표시됩니다.');
    } else {
      const next = saveHomePopupConfig({ enabled: false });
      setCfg(next);
      setSavedHint('팝업이 꺼졌습니다(게시 중지).');
    }
    window.setTimeout(() => setSavedHint(''), 2800);
  };

  const handlePublish = () => {
    const next = publishHomePopupConfig({
      enabled: cfg.enabled,
      title: cfg.title.trim() || 'Meet in person for safer trades',
      subtitle: cfg.subtitle.trim() || 'Start every deal safely.',
      heroImage: cfg.heroImage,
    });
    setCfg(next);
    setSavedHint('게시되었습니다. 홈에서 이 버전이 다시 노출됩니다.');
    window.setTimeout(() => setSavedHint(''), 3500);
  };

  const onPickHero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setPickedLabel(file.name);
    const data = await compressImageFile(file);
    if (!data) return;
    setCfg((c) => ({ ...c, heroImage: data }));
  };

  const clearHero = () => {
    setPickedLabel('');
    setCfg((c) => ({ ...c, heroImage: '' }));
  };

  return (
    <div className="min-h-0 pb-12">
      <div className="mx-auto max-w-2xl space-y-5 px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">홈 화면 팝업</h1>
          <button
            type="button"
            role="switch"
            aria-checked={cfg.enabled}
            aria-label="팝업 표시"
            onClick={() => handleToggleEnabled(!cfg.enabled)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${cfg.enabled ? '' : 'bg-gray-300'}`}
            style={cfg.enabled ? { backgroundColor: TEAL } : undefined}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                cfg.enabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-gray-600">
          팝업을 켜거나 끌 수 있습니다. 내용을 저장하면 버전이 올라가며, 예전에 팝업을 닫았던 사용자에게도 새
          내용이 다시 표시됩니다.
        </p>

        {savedHint ? (
          <div className="rounded-xl border border-teal-100 bg-teal-50/90 px-4 py-3 text-sm text-teal-950">
            {savedHint}
          </div>
        ) : null}

        <div className="space-y-6 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#1a1a1a]">이미지 업로드</p>
              <span className="text-xs font-medium text-gray-500">330x220px</span>
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
                className="shrink-0 rounded-xl bg-[#4a4a4c] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3a3a3c]"
              >
                파일선택
              </button>
            </div>
            {cfg.heroImage ? (
              <div className="mt-4 space-y-2">
                <div className="aspect-[16/10] max-h-48 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img src={cfg.heroImage} alt="" className="h-full w-full object-cover" />
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

          <details className="rounded-xl border border-gray-100 bg-[#fafafa] px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              제목·부제 수정 (선택)
            </summary>
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">제목</label>
                <input
                  type="text"
                  value={cfg.title}
                  onChange={(e) => setCfg((c) => ({ ...c, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">부제</label>
                <textarea
                  value={cfg.subtitle}
                  onChange={(e) => setCfg((c) => ({ ...c, subtitle: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </details>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={handlePublish}
              className="min-h-[48px] flex-1 rounded-2xl text-[15px] font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
              style={{ backgroundColor: TEAL }}
            >
              게시하기
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="min-h-[48px] flex-1 rounded-2xl text-[15px] font-semibold text-white transition-opacity hover:opacity-95"
              style={{ backgroundColor: CHARCOAL }}
            >
              미리보기
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-400">리비전 {cfg.revision}</p>
        </div>
      </div>

      {previewOpen ? (
        <HomePromoPopup
          config={cfg}
          onClose={() => {
            setPreviewOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};
