import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { OrderStatusChip } from '@/components/common/OrderStatusChip';
import { Order, ORDER_STATUS_VALUE } from '@/types';
import { getOrders } from '@/utils/orderStorage';
import { syncOrdersFromDB } from '@/utils/dbSync';
import { getCurrentUserId } from '@/utils/authStorage';
import { getProductById } from '@/utils/productStorage';
import { labelDisplayOrderStatus, labelTradeMethod } from '@/locale/enUI';
import { useLanguage } from '@/hooks/useLanguage';
import { localeForAppLanguage } from '@/utils/languageStorage';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';
import { DISPLAY_IN_PROGRESS, getDisplayOrderStatus, type DisplayOrderStatus } from '@/utils/orderStatusDisplay';

type OrderType = 'all' | 'buying' | 'selling';
type FilterStatus = 'all' | DisplayOrderStatus;

export const MyOrders: React.FC = () => {
  useGuestPageGuard('order');
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = () => {
    setOrders(getOrders());
  };

  useEffect(() => {
    const uid = getCurrentUserId();
    void (async () => {
      if (uid) await syncOrdersFromDB(uid);
      loadOrders();
    })();
    window.addEventListener('ordersChanged', loadOrders);
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'all_orders' || e.key === 'all_products') loadOrders();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('ordersChanged', loadOrders);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const userId = getCurrentUserId();
  const filteredOrders = orders.filter((order) => {
    if (!order?.product || !order?.buyer?.id || !order?.seller?.id) return false;
    const typeMatch =
      orderType === 'all' ||
      (orderType === 'buying' && order.buyer.id === userId) ||
      (orderType === 'selling' && order.seller.id === userId);
    const statusMatch = filterStatus === 'all' || getDisplayOrderStatus(order) === filterStatus;
    return typeMatch && statusMatch;
  });

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
        title={t('orders')}
      />

      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            setOrderType('all');
            setFilterStatus('all');
          }}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
            orderType === 'all' && filterStatus === 'all'
              ? 'text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
          style={orderType === 'all' && filterStatus === 'all' ? { backgroundColor: '#00A8A3' } : undefined}
        >
          {t('chipAll')}
        </button>
        {(['buying', 'selling'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setOrderType((current) => (current === type ? 'all' : type))}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              orderType === type
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={orderType === type ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {type === 'buying' ? t('buying') : t('selling')}
          </button>
        ))}
        {(
          [
            ORDER_STATUS_VALUE.PENDING_OFFER,
            ORDER_STATUS_VALUE.ACCEPTED,
            DISPLAY_IN_PROGRESS,
            ORDER_STATUS_VALUE.MEETUP_SET,
            ORDER_STATUS_VALUE.RECEIVED,
            ORDER_STATUS_VALUE.COMPLETE,
            ORDER_STATUS_VALUE.DISPUTE,
            ORDER_STATUS_VALUE.TRADE_FAILED,
          ] as DisplayOrderStatus[]
        ).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus((current) => (current === status ? 'all' : status))}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              filterStatus === status
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={filterStatus === status ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {labelDisplayOrderStatus(status)}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {filteredOrders.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-500">{t('noOrdersYet')}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              {t('browseListings')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((order) => {
              const productDeleted = order.product?.id ? !getProductById(order.product.id) : true;
              return (
              <div
                key={order.id}
                onClick={() => navigate(`/order/${order.id}`)}
                className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                  <div className="flex gap-3 mb-3">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    <img
                      src={order.product?.images?.[0] || '/placeholder.jpg'}
                      alt={order.product?.title ?? ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate mb-1 ${productDeleted ? 'text-gray-400' : 'text-gray-900'}`}>
                      {productDeleted ? t('removedListing') : (order.product?.title ?? t('listingFallback'))}
                    </h3>
                    <p className="text-base font-bold text-gray-900 mb-1">
                      {order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0
                        ? t('free')
                        : `${Number(order.proposedPrice ?? 0).toLocaleString()} Pi`}
                    </p>
                    <div className="flex items-center gap-2">
                      <OrderStatusChip status={getDisplayOrderStatus(order)} />
                      <span className="text-xs text-gray-500">
                        {order.tradeMethod ? labelTradeMethod(order.tradeMethod) : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {order.buyer?.id === userId ? t('buying') : t('selling')} ·{' '}
                    {new Date(order.createdAt).toLocaleDateString(localeForAppLanguage(lang))}
                  </span>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
