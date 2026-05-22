import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { OrderStatusChip } from '@/components/common/OrderStatusChip';
import { Order, OrderStatus, ORDER_STATUS_VALUE } from '@/types';
import { getOrders, getOrderById, deleteOrder, updateOrderStatus, confirmOrderCompletion, clearAllOrders } from '@/utils/orderStorage';
import { ensureChatRoomForOrder, addTradeCompletedToChat, addPriceOfferResultToChat } from '@/utils/chatStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { addNotification } from '@/utils/notificationStorage';
import { getProductById } from '@/utils/productStorage';
import { getReviewByOrderId } from '@/utils/reviewStorage';
import { NOTIFY_OFFER_DECLINED, labelOrderStatus, labelTradeMethod } from '@/locale/enUI';

type OrderType = 'all' | 'buying' | 'selling';
type FilterStatus = 'all' | OrderStatus;

export const MyOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = () => {
    setOrders(getOrders());
  };

  useEffect(() => {
    loadOrders();
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
    const statusMatch = filterStatus === 'all' || order.status === filterStatus;
    return typeMatch && statusMatch;
  });

  const handleAccept = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!order?.product) return;
    if (confirm(`Accept the buyer's offer for "${order.product.title}"?`)) {
      updateOrderStatus(order.id, ORDER_STATUS_VALUE.ACCEPTED, 'Offer accepted');
      const updated = getOrderById(order.id);
      if (updated) ensureChatRoomForOrder(updated, getCurrentUserId() ?? undefined);
      loadOrders();
    }
  };

  const handleCancel = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!order?.product) return;
    if (confirm(`Cancel this trade for "${order.product.title}"?`)) {
      deleteOrder(order.id);
      loadOrders();
    }
  };

  const handleReject = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!order?.product || !order?.buyer?.id) return;
    if (confirm(`Decline the offer for "${order.product.title}"?`)) {
      addNotification({
        targetUserId: order.buyer.id,
        type: 'chat',
        title: NOTIFY_OFFER_DECLINED,
        content: `${order.seller.nickname} declined your offer for "${order.product.title}".`,
        link: `/product/${order.product.id}`,
      });
      addPriceOfferResultToChat(order, 'rejected');
      deleteOrder(order.id);
      loadOrders();
    }
  };

  const getQuickAction = (order: Order) => {
    const userId = getCurrentUserId();
    const isBuyer = order.buyer.id === userId;
    const isSeller = order.seller.id === userId;

    switch (order.status) {
      case ORDER_STATUS_VALUE.PENDING_OFFER:
        if (isSeller) {
          return (
            <div className="flex gap-2 mt-2">
              <button
                onClick={(e) => handleAccept(e, order)}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                style={{ backgroundColor: '#00A8A3' }}
              >
                Accept
              </button>
              <button
                onClick={(e) => handleReject(e, order)}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-300 rounded-lg"
              >
                Decline
              </button>
            </div>
          );
        }
        if (isBuyer) {
          return (
            <button
              onClick={(e) => handleCancel(e, order)}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-red-500 border border-red-300 rounded-lg"
            >
              Withdraw offer
            </button>
          );
        }
        return null;
      case ORDER_STATUS_VALUE.ACCEPTED:
        if (isSeller) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateOrderStatus(order.id, ORDER_STATUS_VALUE.MEETUP_SET, 'Meetup confirmed');
                loadOrders();
              }}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-white rounded-lg"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Confirm meetup
            </button>
          );
        }
        if (isBuyer) {
          return <p className="mt-2 text-xs text-gray-400 text-center">Waiting for seller to confirm meetup</p>;
        }
        return null;
      case ORDER_STATUS_VALUE.MEETUP_SET:
        if (isBuyer) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateOrderStatus(order.id, ORDER_STATUS_VALUE.RECEIVED, 'Receipt confirmed');
                loadOrders();
              }}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-white rounded-lg"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Confirm receipt
            </button>
          );
        }
        if (isSeller) {
          return (
            <p className="mt-2 text-xs text-gray-400 text-center">Waiting for receipt confirmation</p>
          );
        }
        return null;
      case ORDER_STATUS_VALUE.RECEIVED:
        {
          const myConfirmed = isSeller ? !!order.sellerCompleted : !!order.buyerCompleted;
          const otherConfirmed = isSeller ? !!order.buyerCompleted : !!order.sellerCompleted;
          if (myConfirmed) {
            return (
              <p className="mt-2 text-xs text-gray-400 text-center">
                {otherConfirmed ? 'Both confirmed — trade complete.' : 'Waiting for the other party to confirm'}
              </p>
            );
          }
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const updated = confirmOrderCompletion(order.id, isSeller ? 'seller' : 'buyer');
                if (updated?.status === ORDER_STATUS_VALUE.COMPLETE) {
                  addTradeCompletedToChat(updated);
                  navigate(`/review/${order.id}`);
                }
                loadOrders();
              }}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-white rounded-lg"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Confirm trade complete
            </button>
          );
        }
      case ORDER_STATUS_VALUE.COMPLETE: {
        const existingReview = getReviewByOrderId(order.id);
        if (existingReview) {
          return (
            <p className="mt-2 text-xs text-gray-400 text-center">Review submitted ✓</p>
          );
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/review/${order.id}`);
            }}
            className="mt-2 w-full px-3 py-1.5 text-xs font-medium border rounded-lg"
            style={{ borderColor: '#00A8A3', color: '#00A8A3' }}
          >
            Write review
          </button>
        );
      }
      default:
        return null;
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
        title="Orders"
        rightContent={
          orders.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{orders.length}</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete all orders? (testing only)')) {
                    clearAllOrders();
                    loadOrders();
                  }
                }}
                className="text-xs text-gray-400 underline"
              >
                Clear all
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex gap-2 px-4 py-3 border-b border-gray-200">
        {(['all', 'buying', 'selling'] as OrderType[]).map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              orderType === type
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={orderType === type ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {type === 'all' ? 'All' : type === 'buying' ? 'Buying' : 'Selling'}
          </button>
        ))}
      </div>

      <div className="flex gap-2 px-4 py-3 border-b border-gray-200 overflow-x-auto">
        {(
          [
            'all',
            ORDER_STATUS_VALUE.PENDING_OFFER,
            ORDER_STATUS_VALUE.ACCEPTED,
            ORDER_STATUS_VALUE.MEETUP_SET,
            ORDER_STATUS_VALUE.RECEIVED,
            ORDER_STATUS_VALUE.COMPLETE,
            ORDER_STATUS_VALUE.DISPUTE,
          ] as FilterStatus[]
        ).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filterStatus === status
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={filterStatus === status ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {status === 'all' ? 'All' : labelOrderStatus(status)}
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
            <p className="text-gray-500">No orders yet.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Browse listings
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
                      {productDeleted ? 'Removed listing' : (order.product?.title ?? 'Listing')}
                    </h3>
                    <p className="text-base font-bold text-gray-900 mb-1">
                      {order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0
                        ? 'Free'
                        : `${Number(order.proposedPrice ?? 0).toLocaleString()} Pi`}
                    </p>
                    <div className="flex items-center gap-2">
                      <OrderStatusChip status={order.status} />
                      <span className="text-xs text-gray-500">
                        {order.tradeMethod ? labelTradeMethod(order.tradeMethod) : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {order.buyer?.id === userId ? 'Buying' : 'Selling'} ·{' '}
                    {new Date(order.createdAt).toLocaleDateString('en-US')}
                  </span>
                </div>

                {getQuickAction(order)}
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
