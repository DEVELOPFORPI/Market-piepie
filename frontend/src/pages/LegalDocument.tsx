import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { useLanguage } from '@/hooks/useLanguage';
import { getLegalDoc, type LegalKind } from '@/i18n/legalDocuments';
import { legalUi } from '@/i18n/legalUiMessages';

export const LegalDocument: React.FC<{ kind: LegalKind }> = ({ kind }) => {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const doc = getLegalDoc(kind, lang);

  return (
    <div className="min-h-screen bg-white pb-10 safe-area-bottom">
      <TopBar
        leftContent={
          <button type="button" onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={doc.title}
      />
      <article className="px-4 py-5 max-w-xl mx-auto">
        <p className="text-xs text-gray-400 mb-4">
          {legalUi(lang, 'lastUpdated', { date: doc.updated })}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mb-6">{doc.intro}</p>
        {doc.sections.map((section) => (
          <section key={section.heading} className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 mb-2">{section.heading}</h2>
            {section.body.map((para) => (
              <p key={para.slice(0, 48)} className="text-sm text-gray-600 leading-relaxed mb-2">
                {para}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
};
