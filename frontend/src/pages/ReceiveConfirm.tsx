import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { getOrderById, ensureOrderById, updateOrderStatus, completeOrderOnReceive } from '@/utils/orderStorage';
import { addReceiptConfirmedToChat, addTradeCompletedToChat } from '@/utils/chatStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { ORDER_STATUS_VALUE, TRADE_METHOD_VALUE, type TradeMethod } from '@/types';
import { useLanguage } from '@/hooks/useLanguage';
import { isListingHeldByOtherBuyerDispute } from '@/utils/disputeStorage';
import { showToast } from '@/utils/toast';
import { TEXT_LIMIT } from '@/constants/textLimits';

export const ReceiveConfirm: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { t } = useLanguage();
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const o = await ensureOrderById(orderId);
      if (cancelled) return;
      if (!o) {
        setLoading(false);
        return;
      }
      if (o.status === ORDER_STATUS_VALUE.DISPUTE) {
        showToast(t('cannotConfirmDuringDispute'));
        navigate(`/dispute/${orderId}`, { replace: true });
        return;
      }
      const held = await isListingHeldByOtherBuyerDispute(o.product.id, {
        excludeOrderId: o.id,
        excludeBuyerId: o.buyer.id,
        excludeSellerId: o.seller.id,
      });
      if (held) {
        showToast(t('bannerListingOtherDispute'));
        navigate(-1);
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
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId, navigate, t]);

  const handleSubmit = async () => {
    if (!isBuyer) {
      showToast(t('onlyBuyerCanConfirm'));
      return;
    }
    if (!confirmed) {
      showToast(t('confirmYouReceived'));
      return;
    }
    if (price !== 0 && !condition) {
      return;
    }
    if (!orderId) return;
    const o = getOrderById(orderId);
    if (o?.status === ORDER_STATUS_VALUE.DISPUTE) {
      showToast(t('cannotConfirmDuringDispute'));
      return;
    }

    const receipt =
      price !== 0 && condition
        ? { condition, notes: notes.trim() || undefined }
        : undefined;

    await updateOrderStatus(
      orderId,
      ORDER_STATUS_VALUE.RECEIVED,
      undefined,
      receipt,
    );
    const updated = getOrderById(orderId) || o;
    if (updated) void addReceiptConfirmedToChat(updated, receipt);
    const completed = await completeOrderOnReceive(orderId);
    if (completed) void addTradeCompletedToChat(completed);
    showToast(t('receiptConfirmedLeaveReview'));
    navigate(`/review/${orderId}`, { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <p className="text-gray-600">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('confirmReceipt')}
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {!isBuyer && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              {t('sellersCannotConfirm')}
            </p>
          </div>
        )}
        {/* Order Summary */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{t('tradeDetails')}</h3>
          <div className="flex gap-3 mb-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              <img
                src={orderImage || '/placeholder.jpg'}
                alt={orderTitle || t('listingSection')}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                {orderTitle || t('loading')}
              </h4>
              <p className="text-base font-bold text-gray-900">
                {price === 0 ? t('freeShare') : `${price.toLocaleString()} Pi`}
              </p>
            </div>
          </div>
          {tradeMethod === TRADE_METHOD_VALUE.IN_PERSON && meetupPlace && meetupDate && meetupTime && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-1">{t('meetupPlace')}</p>
              <p className="text-sm text-gray-900">{meetupPlace}</p>
              <p className="text-xs text-gray-600 mt-2 mb-1">{t('meetupTimeLabel')}</p>
              <p className="text-sm text-gray-900">
                {meetupDate} {meetupTime}
              </p>
            </div>
          )}
        </div>

        {price !== 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('itemCondition')}
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
                    <p className="text-base font-medium">{t('conditionGood')}</p>
                    <p className="text-xs text-gray-500">{t('conditionGoodHint')}</p>
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
                    <p className="text-base font-medium">{t('conditionOk')}</p>
                    <p className="text-xs text-gray-500">{t('conditionOkHint')}</p>
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
                    <p className="text-base font-medium">{t('conditionPoor')}</p>
                    <p className="text-xs text-gray-500">{t('conditionPoorHint')}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {price !== 0 && condition && (
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span>{t('notesOptional')}</span>
              <span className="text-xs font-normal text-gray-400">{notes.length}/{TEXT_LIMIT.receiptNotes}</span>
            </label>
            <textarea
              value={notes}
              maxLength={TEXT_LIMIT.receiptNotes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesConditionPh')}
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
            {t('confirmReceiptCheckbox')}
            {condition === 'bad' && (
              <span className="block mt-1 text-xs text-red-600">
                {price === 0 ? t('freeShareNoDisputeInline') : t('canOpenDisputeInline')}
              </span>
            )}
          </span>
        </label>

        {condition === 'bad' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium mb-1">⚠️ {t('headsUp')}</p>
            <p className="text-sm text-red-700">
              {price === 0
                ? t('freeShareUseChat')
                : t('disputeBeforeConfirmHint')}
            </p>
            {price !== 0 && (
              <button
                onClick={() => navigate(`/dispute/${orderId}`)}
                className="mt-3 w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
              >
                {t('openDispute')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!isBuyer || !confirmed || (price !== 0 && !condition)}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {t('submitReceiptConfirm')}
        </button>
      </div>
    </div>
  );
};
