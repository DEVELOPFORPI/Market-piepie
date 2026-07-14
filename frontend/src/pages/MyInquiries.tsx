import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { api } from '@/utils/api';
import { useLanguage } from '@/hooks/useLanguage';
import type { AppMessageKey } from '@/hooks/useLanguage';
import { localeForAppLanguage } from '@/utils/languageStorage';

interface Inquiry {
  id: string;
  user_id: string | null;
  email: string | null;
  category: string;
  title: string;
  content: string;
  images?: string[];
  status: 'pending' | 'replied' | 'closed' | string;
  admin_reply: string | null;
  created_at: string;
  replied_at: string | null;
}

const TEAL = '#00A8A3';

const CATEGORY_KEYS: Record<string, AppMessageKey> = {
  general: 'inqCatGeneral',
  bug_report: 'inqCatBugReport',
  account: 'inqCatAccount',
  trade: 'inqCatTrade',
  suggestion: 'inqCatSuggestion',
  other: 'inqCatOther',
};

const CATEGORY_TABS = ['all', ...Object.keys(CATEGORY_KEYS)] as const;
type CategoryFilter = (typeof CATEGORY_TABS)[number];

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/ /g, '_');
}

const STATUS_KEYS: Record<string, AppMessageKey> = {
  pending: 'inqStatusPending',
  replied: 'inqStatusReplied',
  closed: 'inqStatusClosed',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  replied: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

export const MyInquiries: React.FC = () => {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>('all');

  const categoryLabel = (value: string) => {
    const key = CATEGORY_KEYS[normalizeCategory(value)];
    return key ? t(key) : value;
  };

  const statusLabel = (status: string) => {
    const key = STATUS_KEYS[status];
    return key ? t(key) : status;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<Inquiry[]>('/api/inquiries');
    if (res.ok && Array.isArray(res.data)) {
      setInquiries(res.data);
    } else {
      setError(res.error || t('loadInquiriesFailed'));
      setInquiries([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const poll = setInterval(load, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const fresh = inquiries.find((i) => i.id === selected.id);
    if (fresh && (fresh.admin_reply !== selected.admin_reply || fresh.status !== selected.status)) {
      setSelected(fresh);
    }
  }, [inquiries, selected]);

  const filteredInquiries = useMemo(() => {
    if (filterCategory === 'all') return inquiries;
    return inquiries.filter((inq) => normalizeCategory(inq.category) === filterCategory);
  }, [inquiries, filterCategory]);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('myInquiriesTitle')}
        rightContent={
          <button
            onClick={() => navigate('/inquiry')}
            className="px-3 py-1.5 text-xs text-white font-medium rounded-lg"
            style={{ backgroundColor: TEAL }}
          >
            {t('newInquiry')}
          </button>
        }
      />

      {!loading && !error && (
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4 py-3">
          {CATEGORY_TABS.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setFilterCategory((current) =>
                  current === category && category !== 'all' ? 'all' : category,
                )
              }
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                filterCategory === category
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
              style={filterCategory === category ? { backgroundColor: TEAL } : undefined}
            >
              {category === 'all' ? t('chipAll') : t(CATEGORY_KEYS[category])}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
            {t('loading')}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-medium">{t('loadInquiriesFailed')}</p>
            <p className="mt-1 text-red-700/90">{error}</p>
            <button onClick={load} className="mt-3 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-200">
              {t('retry')}
            </button>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">{t('noInquiriesYet')}</p>
            <p className="text-gray-400 text-xs mt-2">{t('noInquiriesHint')}</p>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">{t('noInquiriesInCategory')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInquiries.map((inq) => (
              <button key={inq.id} onClick={() => setSelected(inq)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[inq.status] || 'bg-gray-100 text-gray-500'}`}>
                    {statusLabel(inq.status)}
                  </span>
                  <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded">{categoryLabel(inq.category)}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(inq.created_at).toLocaleDateString(localeForAppLanguage(lang))}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{inq.title}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{inq.content}</p>
                {inq.admin_reply && (
                  <p className="text-xs text-green-700 mt-2 font-medium">✓ {t('replyReceived')}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg overflow-x-hidden overflow-y-auto rounded-2xl bg-white shadow-xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">{t('inquiryDetail')}</h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[selected.status] || ''}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <span className="text-gray-400 text-xs">{t('labelCategory')}</span>
                    <p className="font-medium">{categoryLabel(selected.category)}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-400 text-xs">{t('labelSubmitted')}</span>
                    <p className="break-words font-medium">
                      {new Date(selected.created_at).toLocaleString(localeForAppLanguage(lang))}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 text-xs">{t('labelTitle')}</span>
                  <p className="break-all font-medium text-gray-900">{selected.title}</p>
                </div>

                <div>
                  <span className="text-gray-400 text-xs">{t('labelContent')}</span>
                  <p className="mt-1 break-all whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-gray-700">{selected.content}</p>
                </div>

                {selected.images && selected.images.length > 0 && (
                  <div>
                    <span className="text-gray-400 text-xs">{t('labelImages')}</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selected.images.map((img, idx) => (
                        <img key={idx} src={img} alt={`attachment-${idx}`}
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                      ))}
                    </div>
                  </div>
                )}

                {selected.admin_reply ? (
                  <div>
                    <span className="text-gray-400 text-xs">
                      {t('labelAdminReply')}
                      {selected.replied_at
                        ? ` · ${new Date(selected.replied_at).toLocaleString(localeForAppLanguage(lang))}`
                        : ''}
                    </span>
                    <p className="mt-1 break-all whitespace-pre-wrap rounded-lg bg-green-50 p-3 text-gray-700">{selected.admin_reply}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">{t('awaitingAdmin')}</p>
                )}
              </div>

              <button onClick={() => setSelected(null)}
                className="w-full mt-6 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
