import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { OrderStatusChip } from '@/components/common/OrderStatusChip';
import { Order, ORDER_STATUS_VALUE } from '@/types';
import { getOrders, confirmOrderCompletion } from '@/utils/orderStorage';
import { addTradeCompletedToChat } from '@/utils/chatStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { getItem } from '@/utils/heavyStorage';
import { labelTradeMethod } from '@/locale/enUI';
import { getProductById } from '@/utils/productStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';

const ACTIVE_STATUSES: Set<string> = new Set([
  ORDER_STATUS_VALUE.PENDING_OFFER,
  ORDER_STATUS_VALUE.ACCEPTED,
  ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO,
  ORDER_STATUS_VALUE.MEETUP_SET,
  ORDER_STATUS_VALUE.SHIPPED,
  ORDER_STATUS_VALUE.DELIVERED,
  ORDER_STATUS_VALUE.RECEIVED,
]);

export const ActiveTrades: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = () => {
    const all = getOrders().filter((o) => ACTIVE_STATUSES.has(o.status));
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setOrders(all);
  };

  useEffect(() => {
    loadOrders();
    window.addEventListener('ordersChanged', loadOrders);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'all_orders') loadOrders();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('ordersChanged', loadOrders);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const userId = getCurrentUserId();

  const getActionButton = (order: Order) => {
    const isBuyer = order.buyer.id === userId;
    const isSeller = order.seller.id === userId;

    switch (order.status) {
      case ORDER_STATUS_VALUE.PENDING_OFFER:
        return isSeller ? (
          <span className="text-xs text-yellow-600 font-medium">Action needed: Review offer</span>
        ) : (
          <span className="text-xs text-gray-500">Waiting for seller response</span>
        );

      case ORDER_STATUS_VALUE.ACCEPTED:
        return isSeller ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/chat/${findChatRoomForOrder(order)}`);
            }}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Schedule meetup
          </button>
        ) : (
          <span className="text-xs text-gray-500">Waiting for meetup schedule</span>
        );

      case ORDER_STATUS_VALUE.MEETUP_SET:
        return isBuyer ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/receive/${order.id}`);
            }}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Confirm receipt
          </button>
        ) : (
          <span className="text-xs text-yellow-600 font-medium">Waiting for buyer receipt</span>
        );

      case ORDER_STATUS_VALUE.RECEIVED: {
        const myCompleted = isSeller ? !!order.sellerCompleted : !!order.buyerCompleted;
        if (myCompleted) {
          return <span className="text-xs text-gray-500">Waiting for other party</span>;
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Confirm trade completion?')) {
                const updated = confirmOrderCompletion(order.id, isSeller ? 'seller' : 'buyer');
                if (updated?.status === ORDER_STATUS_VALUE.COMPLETE) {
                  addTradeCompletedToChat(updated);
                  navigate(`/review/${order.id}`);
                  return;
                }
                loadOrders();
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Confirm complete
          </button>
        );
      }

      case ORDER_STATUS_VALUE.SHIPPED:
        return isBuyer ? (
          <span className="text-xs text-blue-600 font-medium">Item shipped — check tracking</span>
        ) : (
          <span className="text-xs text-gray-500">Shipped, awaiting delivery</span>
        );

      case ORDER_STATUS_VALUE.DELIVERED:
        return isBuyer ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/receive/${order.id}`);
            }}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Confirm receipt
          </button>
        ) : (
          <span className="text-xs text-gray-500">Delivered, awaiting receipt</span>
        );

      default:
        return null;
    }
  };

  const findChatRoomForOrder = (order: Order): string => {
    try {
      const rooms = JSON.parse(getItem('all_chatrooms') || '[]');
      const match = rooms.find(
        (r: { buyerId?: string; sellerId?: string; product?: { id?: string } }) =>
          r.product?.id === order.product?.id &&
          r.buyerId === order.buyer.id &&
          r.sellerId === order.seller.id
      );
      return match?.id || '';
    } catch {
      return '';
    }
  };

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
        title="Active trades"
        rightContent={
          <span className="text-sm text-gray-500">{orders.length}</span>
        }
      />

      <div className="px-4 py-4">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12l-2 13H6L4 7H2M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            <p className="text-gray-500 mb-1">No active trades</p>
            <p className="text-xs text-gray-400">Trades in progress will appear here</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Browse listings
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isBuyer = order.buyer.id === userId;
              // Enrich product with full data from local store (DB orders have images: [])
              const fullProduct = order.product?.id ? getProductById(order.product.id) : undefined;
              const productImage = fullProduct?.images?.[0] || order.product?.images?.[0];
              const productTitle = fullProduct?.title || order.product?.title || 'Listing';
              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/order/${order.id}`)}
                  className="p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {productImage ? (
                        <img
                          src={getDisplayImageUrl(productImage)}
                          alt={productTitle}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            const parent = (e.currentTarget as HTMLImageElement).parentElement;
                            if (parent && !parent.querySelector('[data-fallback]')) {
                              const div = document.createElement('div');
                              div.setAttribute('data-fallback', '1');
                              div.className = 'w-full h-full flex items-center justify-center text-gray-400';
                              div.innerHTML = '<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
                              parent.appendChild(div);
                            }
                          }}
                        />
                      ) : (
                        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                        {productTitle}
                      </h3>
                      <p className="text-base font-bold text-gray-900 mb-1.5">
                        {order.proposedPrice === 0 || order.product?.isFreeShare
                          ? 'Free'
                          : `${Number(order.proposedPrice ?? 0).toLocaleString()} Pi`}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <OrderStatusChip status={order.status} />
                        <span className="text-xs text-gray-500">
                          {order.tradeMethod ? labelTradeMethod(order.tradeMethod) : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isBuyer ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                        {isBuyer ? 'Buying' : 'Selling'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div>{getActionButton(order)}</div>
                  </div>

                  {order.meetupPlace && (
                    <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Meetup:</span> {order.meetupPlace}
                        {order.meetupDate && ` · ${order.meetupDate}`}
                        {order.meetupTime && ` ${order.meetupTime}`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
