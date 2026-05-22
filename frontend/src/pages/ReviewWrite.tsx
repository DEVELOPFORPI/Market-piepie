import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Review, Order } from '@/types';
import { saveReview, getReviewByOrderId, addReceivedReviewForUser } from '@/utils/reviewStorage';
import { getOrderById } from '@/utils/orderStorage';
import { addReviewToChat } from '@/utils/chatStorage';
import { getMyUser } from '@/utils/profileStorage';
import { addNotification } from '@/utils/notificationStorage';
import { NOTIFY_REVIEW_WRITTEN, labelTradeMethod } from '@/locale/enUI';

const reviewTags = ['Quick response', 'On time', 'Kind', 'As described', 'Recommend'];

export const ReviewWrite: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!orderId) return;

    const found = getOrderById(orderId);
    console.log('[REVIEW] mount getOrderById', { orderId, found: !!found, buyerId: found?.buyer?.id, sellerId: found?.seller?.id });
    if (found) setOrder(found);

    const existing = getReviewByOrderId(orderId);
    if (existing) {
      console.log('[REVIEW] mount existing review found - redirecting');
      alert('Reviews cannot be edited after they are submitted.');
      navigate('/my/reviews', { replace: true });
      return;
    }

    const onError = (ev: ErrorEvent) => {
      console.log('[REVIEW] GLOBAL ERROR', ev.message, ev.error);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      console.log('[REVIEW] GLOBAL UNHANDLED REJECTION', ev.reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [orderId, navigate]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    console.log('[REVIEW] handleSubmit start', { orderId, rating, hasOrder: !!order });

    let review: Review;
    try {
      const me = getMyUser();
      console.log('[REVIEW] getMyUser ok', { id: me?.id, nickname: me?.nickname });
      review = {
        id: `review_${Date.now()}`,
        reviewer: me,
        rating,
        tags: selectedTags,
        comment: comment.trim() || '',
        createdAt: new Date().toISOString(),
        orderId,
        productTitle: order?.product.title,
        productImage: undefined,
      };
    } catch (e) {
      console.log('[REVIEW] build review FAILED', e);
      alert('Could not build review: ' + String(e));
      return;
    }

    if (order) {
      const reviewee = review.reviewer.id === order.buyer.id ? order.seller : order.buyer;
      console.log('[REVIEW] sync + received map', { revieweeId: reviewee?.id });
      const synced = await addReceivedReviewForUser(reviewee.id, review);
      if (!synced) {
        alert('Review could not be submitted. Check your connection and try again.');
        return;
      }
      try {
        addNotification({
          targetUserId: reviewee.id,
          type: 'order',
          title: NOTIFY_REVIEW_WRITTEN,
          content: `${review.reviewer.nickname} left a ${rating}-star review for "${order.product.title}".`,
          link: '/my/reviews',
        });
        addReviewToChat(order, review.reviewer.nickname);
      } catch (e) {
        console.log('[REVIEW] notification/chat side effects FAILED', e);
      }
    }

    try {
      saveReview(review);
      console.log('[REVIEW] saveReview OK');
    } catch (e) {
      console.log('[REVIEW] saveReview FAILED', e);
      const message = e instanceof Error ? e.message : 'Could not save review.';
      alert(message);
      return;
    }

    alert('Review submitted!');
    navigate('/my/reviews', { replace: true, state: { showWrittenTab: true } });
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="Write a review"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {/* Order Info */}
        {order && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={order.product.images[0] || '/placeholder.jpg'}
                  alt={order.product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{order.product.title}</h3>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {order.proposedPrice.toLocaleString()} Pi
                </p>
                <p className="text-xs text-gray-500 mt-1">{labelTradeMethod(order.tradeMethod)}</p>
              </div>
            </div>
          </div>
        )}

        {!order && (
          <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
            Order not found.
          </div>
        )}

        {/* Rating */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rating</h2>
          <div className="flex items-center justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="focus:outline-none"
              >
                <svg
                  className={`w-12 h-12 ${
                    star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-gray-500 mt-2">
              {rating === 5 ? 'Excellent!' : rating === 4 ? 'Good' : rating === 3 ? 'Okay' : rating === 2 ? 'Poor' : 'Bad'}
            </p>
          )}
        </div>

        {/* Tags */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Tags (optional)</h2>
          <div className="flex flex-wrap gap-2">
            {reviewTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedTags.includes(tag)
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
                style={selectedTags.includes(tag) ? { backgroundColor: '#00A8A3' } : undefined}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Comment</h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience"
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3] resize-none"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          className="w-full px-4 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          style={rating > 0 ? { backgroundColor: '#00A8A3' } : undefined}
        >
          Submit review
        </button>
      </div>
    </div>
  );
};
