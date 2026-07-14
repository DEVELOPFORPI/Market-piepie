import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { OrderStatusChip } from '@/components/common/OrderStatusChip';
import { Order, ORDER_STATUS_VALUE, TRADE_METHOD_VALUE } from '@/types';
import { ensureOrderById } from '@/utils/orderStorage';
import { getProductById } from '@/utils/productStorage';
import { getReviewByOrderId } from '@/utils/reviewStorage';
import { labelTradeMethod } from '@/locale/enUI';
import { resolveDisplayNickname } from '@/utils/profileStorage';
import { useLanguage } from '@/hooks/useLanguage';
import { localeForAppLanguage } from '@/utils/languageStorage';
import { displayOrderTimelineDescription } from '@/utils/orderTimelineDisplay';

export const OrderTimeline: React.FC = () => {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const dateLocale = localeForAppLanguage(lang);
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-redirect to review page when order becomes COMPLETE and no review yet
  useEffect(() => {
    if (order?.status === ORDER_STATUS_VALUE.COMPLETE && orderId) {
      const existing = getReviewByOrderId(orderId);
      if (!existing) {
        navigate(`/review/${orderId}`);
      }
    }
  }, [order?.status, orderId, navigate]);

  const loadOrder = async () => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const found = await ensureOrderById(orderId);
    setOrder(found ? { ...found } : null);
    setLoading(false);
  };

  useEffect(() => {
    const refresh = () => { void loadOrder(); };
    refresh();
    window.addEventListener('ordersChanged', refresh);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'all_orders') refresh();
      if (e.key === 'all_products' && orderId) refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('ordersChanged', refresh);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white">
        <TopBar
          leftContent={
            <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }
          title={t('orderDetailTitle')}
        />
        <div className="text-center py-12 text-gray-500">
          {t('orderNotFound')}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('orderDetailTitle')}
      />

      <div className="px-4 py-6 space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{t('statusHeading')}</span>
            <OrderStatusChip status={order.status} />
          </div>
          <p className="text-lg font-bold text-gray-900 mt-2">
            {order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0
              ? t('freePrice')
              : `${order.proposedPrice.toLocaleString()} Pi`}
          </p>
        </div>

        {(() => {
          const productDeleted = order.product?.id ? !getProductById(order.product.id) : true;
          return (
            <div
              className={`p-4 border border-gray-200 rounded-lg ${productDeleted ? '' : 'cursor-pointer hover:bg-gray-50'}`}
              onClick={productDeleted ? undefined : () => navigate(`/product/${order.product!.id}`)}
            >
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t('listingSection')}</h3>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                  <img
                    src={order.product?.images?.[0] || '/placeholder.jpg'}
                    alt={order.product?.title ?? ''}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h4 className={`text-sm font-medium mb-1 ${productDeleted ? 'text-gray-400' : 'text-gray-900'}`}>
                    {productDeleted ? t('listingRemoved') : (order.product?.title ?? t('listingSection'))}
                  </h4>
                  {!productDeleted && (
                    <>
                      <p className="text-sm text-gray-600">
                        {labelTradeMethod(order.tradeMethod)}
                        {order.tradeMethod === TRADE_METHOD_VALUE.IN_PERSON && order.meetupPlace && ` · ${order.meetupPlace}`}
                      </p>
                      {order.tradeMethod === TRADE_METHOD_VALUE.IN_PERSON && order.meetupDate && (
                        <p className="text-sm text-gray-600">
                          {order.meetupDate} {order.meetupTime}
                        </p>
                      )}
                    </>
                  )}
                  {productDeleted && (
                    <p className="text-xs text-gray-400 mt-1">{t('listingRemovedBySeller')}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {order.memo && (
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">{t('noteLabel')}</h3>
            <p className="text-sm text-gray-600">{order.memo}</p>
          </div>
        )}

        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-4">{t('timelineHeading')}</h3>
          <div className="space-y-4">
            {order.timeline.map((event, idx) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      idx === order.timeline.length - 1 ? 'bg-[#00A8A3]' : 'bg-gray-300'
                    }`}
                  />
                  {idx < order.timeline.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200 mt-1" style={{ minHeight: '24px' }} />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm font-medium text-gray-900">
                    {displayOrderTimelineDescription(event.description, lang)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(event.timestamp).toLocaleString(dateLocale)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{t('partiesHeading')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('buyerLabel')}</span>
              <span className="text-gray-900">{resolveDisplayNickname(order.buyer.id, order.buyer.nickname)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('sellerLabel')}</span>
              <span className="text-gray-900">{resolveDisplayNickname(order.seller.id, order.seller.nickname)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('methodLabel')}</span>
              <span className="text-gray-900">{labelTradeMethod(order.tradeMethod)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('offerDateLabel')}</span>
              <span className="text-gray-900">
                {new Date(order.createdAt).toLocaleDateString(dateLocale)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
