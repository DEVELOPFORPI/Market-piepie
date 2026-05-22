import { api } from "@/utils/api";
import { getMyUser } from "@/utils/profileStorage";
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Review } from '@/types';
import { getMyWrittenReviews, getReceivedReviews, deleteReview } from '@/utils/reviewStorage';

type TabType = 'received' | 'written';

export const MyReviews: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
          const dbReviews = (res.data as any[]).map((r: any) => ({ id: r.id, reviewerId: r.reviewer_id, revieweeId: r.reviewee_id, orderId: r.order_id, rating: r.rating, tags: r.tags || [], comment: r.comment, productTitle: r.product_title, productImage: r.product_image, createdAt: r.created_at, reviewer: r.reviewer ? { id: r.reviewer.id, nickname: r.reviewer.nickname, profileImage: r.reviewer.profile_image } : undefined }));
          setReceivedReviews(dbReviews as any);
        }
      }
    } catch(e) { console.error("fetch received reviews fail", e); }
  };

  useEffect(() => {
    loadReviews();
    window.addEventListener('reviewsChanged', loadReviews);
    return () => window.removeEventListener('reviewsChanged', loadReviews);
  }, []);

  // After writing a review, deep-link can open the Written tab
  useEffect(() => {
    if (location.state?.showWrittenTab) {
      setActiveTab('written');
    }
  }, [location.state]);

  const handleDelete = (review: Review) => {
    const title = review.productTitle || 'This review';
    if (confirm(`Delete "${title}"?`)) {
      deleteReview(review.id);
      loadReviews();
    }
  };

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

  const renderReviewCard = (review: Review, showActions: boolean) => (
    <div key={review.id} className="p-4 border border-gray-200 rounded-lg">
      {/* Product info */}
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

      {/* Reviewer & Rating */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-900">
          {review.reviewer.nickname}
        </span>
        {renderStars(review.rating)}
        <span className="text-xs text-gray-500 ml-auto">
          {new Date(review.createdAt).toLocaleDateString('en-US')}
        </span>
      </div>

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
      )}

      {/* Written reviews: delete only */}
      {showActions && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={() => handleDelete(review)}
            className="text-xs font-medium text-red-500"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="Reviews"
      />

      {/* Tabs */}
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
          Received ({receivedReviews.length})
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
          Written ({writtenReviews.length})
        </button>
      </div>

      {/* Reviews List */}
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
              <p className="text-gray-500">No reviews received yet.</p>
              <p className="text-xs text-gray-400 mt-1">Complete trades to receive reviews.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {receivedReviews.map((review) => renderReviewCard(review, false))}
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
              <p className="text-gray-500">You have not written any reviews.</p>
              <p className="text-xs text-gray-400 mt-1">Leave a review after a trade.</p>
              <button
                onClick={() => navigate('/my/orders')}
                className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#00A8A3' }}
              >
                View orders
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {writtenReviews.map((review) => renderReviewCard(review, true))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
