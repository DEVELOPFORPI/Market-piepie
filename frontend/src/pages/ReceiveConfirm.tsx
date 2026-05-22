import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { getOrderById, updateOrderStatus, completeShareOrderOnReceive, confirmOrderCompletion } from '@/utils/orderStorage';
import { addReceiptConfirmedToChat, addTradeCompletedToChat } from '@/utils/chatStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { ORDER_STATUS_VALUE, TRADE_METHOD_VALUE, type TradeMethod } from '@/types';

export const ReceiveConfirm: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [confirmed, setConfirmed] = useState(false);
  const [condition, setCondition] = useState<'good' | 'normal' | 'bad' | ''>('');
  const [notes, setNotes] = useState('');
  const [orderTitle, setOrderTitle] = useState('');
  const [orderImage, setOrderImage] = useState<string | undefined>(undefined);
  const [price, setPrice] = useState<number>(0);
  const [tradeMethod, setTradeMethod] = useState<TradeMethod>(TRADE_METHOD_VALUE.IN_PERSON);
  const [meetupPlace, setMeetupPlace] = useState<string | undefined>(undefined);
  const [meetupDate, setMeetupDate] = useState<string | undefined>(undefined);
  const [meetupTime, setMeetupTime] = useState<string | undefined>(undefined);
  const [isBuyer, setIsBuyer] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const o = getOrderById(orderId);
    if (!o) return;
    if (o.status === ORDER_STATUS_VALUE.DISPUTE) {
      alert('You cannot confirm receipt while a dispute is open.');
      navigate(`/dispute/${orderId}`, { replace: true });
      return;
    }
    const userId = getCurrentUserId();
    const buyerMatch = !!(userId && o.buyer.id === userId);
    setIsBuyer(buyerMatch);
    setOrderTitle(o.product.title);
    setOrderImage(o.product.images?.[0]);
    setPrice(o.proposedPrice);
    setTradeMethod(o.tradeMethod);
    setMeetupPlace(o.meetupPlace);
    setMeetupDate(o.meetupDate);
    setMeetupTime(o.meetupTime);
  }, [orderId, navigate]);

  const handleSubmit = () => {
    if (!isBuyer) {
      alert('Only the buyer can confirm receipt.');
      return;
    }
    if (!confirmed) {
      alert('Confirm that you received the item.');
      return;
    }
    if (!orderId) return;
    const o = getOrderById(orderId);
    if (o?.status === ORDER_STATUS_VALUE.DISPUTE) {
      alert('You cannot confirm receipt while a dispute is open.');
      return;
    }

    // eslint-disable-next-line no-console
    console.log('[ReceiveConfirm] confirm receive', { orderId, condition, notes });
    updateOrderStatus(orderId, ORDER_STATUS_VALUE.RECEIVED, 'Receipt confirmed');
    if (o) addReceiptConfirmedToChat(o);
    const completedOrder = confirmOrderCompletion(orderId, 'buyer');
    const isShare = o && (o.proposedPrice === 0 || o.product?.isFreeShare || o.product?.price === 0);
    if (isShare) {
      const completed = completeShareOrderOnReceive(orderId);
      if (completed) addTradeCompletedToChat(completed);
      alert('Receipt confirmed. You can leave a review.');
      navigate(`/review/${orderId}`, { replace: true });
    } else {
      if (completedOrder?.status === ORDER_STATUS_VALUE.COMPLETE) {
        addTradeCompletedToChat(completedOrder);
        alert('Receipt confirmed. You can leave a review.');
        navigate(`/review/${orderId}`, { replace: true });
      } else {
        alert('Receipt confirmed. Waiting for seller to confirm delivery.');
        navigate(`/order/${orderId}`, { replace: true });
      }
    }
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
        title="Confirm receipt"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {!isBuyer && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              Sellers cannot confirm receipt. Wait for the buyer.
            </p>
          </div>
        )}
        {/* Order Summary */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Trade details</h3>
          <div className="flex gap-3 mb-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              <img
                src={orderImage || '/placeholder.jpg'}
                alt={orderTitle || 'Listing'}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                {orderTitle || 'Loading…'}
              </h4>
              <p className="text-base font-bold text-gray-900">
                {price === 0 ? 'Free share' : `${price.toLocaleString()} Pi`}
              </p>
            </div>
          </div>
          {tradeMethod === TRADE_METHOD_VALUE.IN_PERSON && meetupPlace && meetupDate && meetupTime && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Meetup place</p>
              <p className="text-sm text-gray-900">{meetupPlace}</p>
              <p className="text-xs text-gray-600 mt-2 mb-1">Meetup time</p>
              <p className="text-sm text-gray-900">
                {meetupDate} {meetupTime}
              </p>
            </div>
          )}
        </div>

        {price !== 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Item condition
            </label>
            <div className="space-y-3">
              <button
                onClick={() => setCondition('good')}
                className={`w-full min-h-[72px] px-5 py-4 border rounded-lg text-left ${
                  condition === 'good'
                    ? 'border-2 border-[#27AE60] bg-[#27AE60]/10 text-[#27AE60]'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img src="/3 ICON/1.svg" alt="" className="w-5 h-5 flex-shrink-0" />
                  <div className="ml-2 flex-1 min-w-0">
                    <p className="text-base font-medium">Good</p>
                    <p className="text-xs text-gray-500">Matches the description.</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setCondition('normal')}
                className={`w-full min-h-[72px] px-5 py-4 border rounded-lg text-left ${
                  condition === 'normal'
                    ? 'border-2 border-[#F2C94C] bg-[#F2C94C]/20 text-[#B8860B]'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img src="/3 ICON/2.svg" alt="" className="w-5 h-5 flex-shrink-0" />
                  <div className="ml-2 flex-1 min-w-0">
                    <p className="text-base font-medium">OK</p>
                    <p className="text-xs text-gray-500">Mostly matches the description.</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setCondition('bad')}
                className={`w-full min-h-[72px] px-5 py-4 border rounded-lg text-left ${
                  condition === 'bad'
                    ? 'border-2 border-[#EB5757] bg-[#EB5757]/10 text-[#EB5757]'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img src="/3 ICON/3.svg" alt="" className="w-5 h-5 flex-shrink-0" />
                  <div className="ml-2 flex-1 min-w-0">
                    <p className="text-base font-medium">Poor</p>
                    <p className="text-xs text-gray-500">Does not match or has issues.</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {price !== 0 && condition && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details about the condition"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        )}

        {/* Agreement */}
        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer">
          <span className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                confirmed
                  ? 'bg-[#00A8A3] border-[#00A8A3]'
                  : 'bg-white border-gray-300'
              }`}
              aria-hidden
            >
              {confirmed && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          </span>
          <span className="text-sm text-gray-700">
            I confirm I received the item and the trade can proceed.
            {condition === 'bad' && (
              <span className="block mt-1 text-xs text-red-600">
                {price === 0 ? 'Free shares cannot open a dispute. Message the giver in chat.' : 'You can open a dispute if there is a serious issue.'}
              </span>
            )}
          </span>
        </label>

        {condition === 'bad' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium mb-1">⚠️ Heads up</p>
            <p className="text-sm text-red-700">
              {price === 0
                ? 'Free shares cannot use disputes. Use chat to resolve issues.'
                : 'Open a dispute before confirming receipt if there is a problem. After confirmation, refunds may be harder.'}
            </p>
            {price !== 0 && (
              <button
                onClick={() => navigate(`/dispute/${orderId}`)}
                className="mt-3 w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
              >
                Open dispute
              </button>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!isBuyer || !confirmed}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Submit receipt confirmation
        </button>
      </div>
    </div>
  );
};

