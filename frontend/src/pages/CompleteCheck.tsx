import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { getOrderById, updateOrderStatus, confirmOrderCompletion } from '@/utils/orderStorage';
import { addTradeCompletedToChat } from '@/utils/chatStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { Order, ORDER_STATUS_VALUE } from '@/types';

export const CompleteCheck: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [completed, setCompleted] = useState(false);
  const [hasProblem, setHasProblem] = useState(false);
  const [problemNote, setProblemNote] = useState('');
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const o = getOrderById(orderId);
    if (o) setOrder(o);
  }, [orderId]);

  const userId = getCurrentUserId();
  const isSeller = !!(order && userId && order.seller.id === userId);
  const otherNickname = order
    ? (isSeller ? order.buyer.nickname : order.seller.nickname)
    : '';

  const handleSubmit = () => {
    if (!completed && !hasProblem) {
      alert('Choose trade complete or report a problem.');
      return;
    }

    if (hasProblem && !problemNote.trim()) {
      alert('Describe the problem.');
      return;
    }

    if (!orderId || !order) return;

    if (hasProblem) {
      const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
      if (isShare) {
        alert('Free-share orders cannot open a dispute.');
        return;
      }
      // Problem flow ??dispute
      updateOrderStatus(orderId, ORDER_STATUS_VALUE.DISPUTE, 'Dispute filed');
      navigate(`/dispute/${orderId}`);
    } else {
      const updated = confirmOrderCompletion(orderId, isSeller ? 'seller' : 'buyer');
      if (updated?.status === ORDER_STATUS_VALUE.COMPLETE) {
        addTradeCompletedToChat(updated);
        alert('Trade completed. You can leave a review.');
        navigate(`/review/${orderId}`, { replace: true });
        return;
      }
      alert('Your completion is saved. Waiting for the other party.');
      navigate('/my/orders', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        leftContent={
          <button onClick={() => navigate('/my/orders')} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="Confirm trade"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {/* Order Summary */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Trade details</h3>
          <div className="flex gap-3 mb-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              <img
                src={order?.product.images?.[0] || '/placeholder.jpg'}
                alt={order?.product.title || 'Listing'}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                {order?.product.title || 'Loading...'}
              </h4>
              <p className="text-base font-bold text-gray-900">
                {(order?.proposedPrice || 0).toLocaleString()} Pi
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-1">Counterparty</p>
            <p className="text-sm text-gray-900">{otherNickname || '-'}</p>
          </div>
        </div>

        {/* Completion Status */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Completion</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Seller</span>
              <span className={`text-sm font-medium ${order?.sellerCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                {order?.sellerCompleted ? 'Done' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Buyer</span>
              <span className={`text-sm font-medium ${order?.buyerCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                {order?.buyerCompleted ? 'Done' : 'Pending'}
              </span>
            </div>
          </div>
          {order?.sellerCompleted && order?.buyerCompleted && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ??Both sides confirmed. Leave a review.
              </p>
            </div>
          )}
        </div>

        {/* Check Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            How did it go?
          </label>
          <div className="space-y-3">
            <button
              onClick={() => {
                setCompleted(true);
                setHasProblem(false);
              }}
              className={`w-full min-h-[72px] px-5 py-4 border rounded-lg text-left ${
                completed
                  ? 'border-2 border-[#27AE60]  text-[#27AE60]'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <img src="/3 ICON/check.svg" alt="" className="w-5 h-5 flex-shrink-0" />
                <div className="ml-2 flex-1 min-w-0">
                  <p className="text-base font-medium">Trade complete</p>
                  <p className="text-xs text-gray-500">Everything went as expected</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                setHasProblem(true);
                setCompleted(false);
              }}
              className={`w-full min-h-[72px] px-5 py-4 border rounded-lg text-left ${
                hasProblem
                  ? 'border-2 border-[#EB5757]  text-[#EB5757]'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <img src="/3 ICON/warning.svg" alt="" className="w-5 h-5 flex-shrink-0" />
                <div className="ml-2 flex-1 min-w-0">
                  <p className="text-base font-medium">There is a problem</p>
                  <p className="text-xs text-gray-500">Something went wrong with this trade</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Problem Note */}
        {hasProblem && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What went wrong <span className="text-red-500">*</span>
            </label>
            <textarea
              value={problemNote}
              onChange={(e) => setProblemNote(e.target.value)}
              placeholder="Describe the issue in detail"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        )}

        {/* Notice */}
        <div className="flex flex-col items-center text-center">
          <img src="/3 ICON/exclamation.svg" alt="" className="w-4 h-4 flex-shrink-0 mb-4" />
          <p className="text-xs text-gray-700">
            The trade finishes only after both sides mark it complete.
            <br />
            If there is a problem, open a dispute.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!completed && !hasProblem}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {hasProblem ? 'Open dispute' : 'Confirm complete'}
        </button>
      </div>
    </div>
  );
};

