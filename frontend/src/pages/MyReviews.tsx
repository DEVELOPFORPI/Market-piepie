import { api } from '@/utils/api';
import { getMyUser } from '@/utils/profileStorage';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Review } from '@/types';
import { getMyWrittenReviews, getReceivedReviews } from '@/utils/reviewStorage';
import { useLanguage } from '@/hooks/useLanguage';
import { localeForAppLanguage } from '@/utils/languageStorage';
import { labelReviewTag } from '@/utils/reviewTagLabels';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';
import { ExpandableText } from '@/components/common/ExpandableText';

type TabType = 'received' | 'written';

export const MyReviews: React.FC = () => {
  useGuestPageGuard('review');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const focusOrderId = searchParams.get('order');
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [writtenReviews, setWrittenReviews] = useState<Review[]>([]);
  const [receivedReviews, setReceivedReviews] = useState<Review[]>([]);

  const loadReviews = async () => {
    setWrittenReviews(getMyWrittenReviews());
    setReceivedReviews(getReceivedReviews());
    try {
      const me = getMyUser();
      if (me?.id) {
        const res = await api.get(`/api/reviews?reviewee_id=${me.id}`);
        if (res.ok) {
          const dbReviews = (res.data as any[]).map((r: any) => ({
            id: r.id,
            reviewerId: r.reviewer_id,
            revieweeId: r.reviewee_id,
            orderId: r.order_id,
            rating: r.rating,
            tags: r.tags || [],
            comment: r.comment,
            productTitle: r.product_title,
            productImage: r.product_image,
            createdAt: r.created_at,
            reviewer: r.reviewer
              ? { id: r.reviewer.id, nickname: r.reviewer.nickname, profileImage: r.reviewer.profile_image }
              : undefined,
          }));
          setReceivedReviews(dbReviews as any);
        }
      }
    } catch (e) {
      console.error('fetch received reviews fail', e);
    }
  };

  useEffect(() => {
    loadReviews();
    window.addEventListener('reviewsChanged', loadReviews);
    return () => window.removeEventListener('reviewsChanged', loadReviews);
  }, []);

  useEffect(() => {
    if (location.state?.showWrittenTab) {
      setActiveTab('written');
    }
  }, [location.state]);

  useEffect(() => {
    if (!focusOrderId) return;
    setActiveTab('received');
    const frame = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-review-order="${CSS.escape(focusOrderId)}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusOrderId, receivedReviews.length]);

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${
            i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );

  const renderReviewCard = (review: Review) => (
    <div
      key={review.id}
      data-review-order={review.orderId || ''}
      className={`p-4 border rounded-lg ${
        focusOrderId && review.orderId === focusOrderId
          ? 'border-[#00A8A3] bg-teal-50/40'
          : 'border-gray-200'
      }`}
    >
      {review.productTitle && (
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
          {review.productImage && (
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              <img
                src={review.productImage}
                alt={review.productTitle}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <span className="text-sm font-medium text-gray-900 truncate">{review.productTitle}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-900">
          {review.reviewer.nickname}
        </span>
        {renderStars(review.rating)}
        <span className="text-xs text-gray-500 ml-auto">
          {new Date(review.createdAt).toLocaleDateString(localeForAppLanguage(lang))}
        </span>
      </div>

      {review.tags && review.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              {labelReviewTag(tag, lang)}
            </span>
          ))}
        </div>
      )}

      {review.comment && (
        <ExpandableText text={review.comment} className="text-sm text-gray-700" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('reviews')}
      />

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === 'received'
              ? 'border-b-2'
              : 'text-gray-500'
          }`}
          style={activeTab === 'received' ? { color: '#00A8A3', borderColor: '#00A8A3' } : undefined}
        >
          {t('reviewsReceived', { n: receivedReviews.length })}
        </button>
        <button
          onClick={() => setActiveTab('written')}
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === 'written'
              ? 'border-b-2'
              : 'text-gray-500'
          }`}
          style={activeTab === 'written' ? { color: '#00A8A3', borderColor: '#00A8A3' } : undefined}
        >
          {t('reviewsWritten', { n: writtenReviews.length })}
        </button>
      </div>

      <div className="px-4 py-4">
        {activeTab === 'received' ? (
          receivedReviews.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              <p className="text-gray-500">{t('noReviewsReceived')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('noReviewsReceivedHint')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {receivedReviews.map((review) => renderReviewCard(review))}
            </div>
          )
        ) : (
          writtenReviews.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              <p className="text-gray-500">{t('noReviewsWritten')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('noReviewsWrittenHint')}</p>
              <button
                onClick={() => navigate('/my/orders')}
                className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#00A8A3' }}
              >
                {t('viewOrders')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {writtenReviews.map((review) => renderReviewCard(review))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
