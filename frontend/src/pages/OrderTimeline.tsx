import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { OrderStatusChip } from '@/components/common/OrderStatusChip';
import { Order, OrderStatus, ORDER_STATUS_VALUE, TRADE_METHOD_VALUE } from '@/types';
import { getOrderById, updateOrderStatus, deleteOrder, confirmOrderCompletion } from '@/utils/orderStorage';
import { ensureChatRoomForOrder, addTradeCompletedToChat, addPriceOfferResultToChat } from '@/utils/chatStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { addNotification } from '@/utils/notificationStorage';
import { getProductById } from '@/utils/productStorage';
import { getReviewByOrderId } from '@/utils/reviewStorage';
import { NOTIFY_OFFER_DECLINED, labelTradeMethod } from '@/locale/enUI';
import { resolveDisplayNickname } from '@/utils/profileStorage';

export const OrderTimeline: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);



  // Auto-redirect to review page when order becomes COMPLETE and no review yet

  useEffect(() => {

    if (order?.status === ORDER_STATUS_VALUE.COMPLETE && orderId) {

      const existing = getReviewByOrderId(orderId);

      if (!existing) {

        navigate(`/review/${orderId}`);

      }

    }

  }, [order?.status, orderId, navigate]);



  const loadOrder = () => {
    if (!orderId) return;
    const found = getOrderById(orderId);
    setOrder(found ? { ...found } : null);
  };

  useEffect(() => {
    loadOrder();
    window.addEventListener('ordersChanged', loadOrder);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'all_orders') loadOrder();
      if (e.key === 'all_products' && orderId) loadOrder();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadOrder();
    };
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('ordersChanged', loadOrder);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [orderId]);

  const handleStatusChange = (newStatus: OrderStatus, description?: string) => {
    if (!orderId) return;
    updateOrderStatus(orderId, newStatus, description);
    if (newStatus === ORDER_STATUS_VALUE.ACCEPTED) {
      const updated = getOrderById(orderId);
      if (updated) ensureChatRoomForOrder(updated, getCurrentUserId() ?? undefined);
    }
    loadOrder();
  };

  const handleDelete = () => {
    if (!order) return;
    if (confirm(`Cancel this trade for "${order.product?.title ?? 'this listing'}"?`)) {
      deleteOrder(order.id);
      navigate('/my/orders', { replace: true });
    }
  };

  const handleReject = () => {
    if (!order) return;
    const isShareOrder = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
    if (
      !confirm(
        isShareOrder
          ? `Decline the free share request for "${order.product.title}"?`
          : `Decline the purchase offer for "${order.product.title}"?`
      )
    )
      return;
    addNotification({
      targetUserId: order.buyer.id,
      type: 'chat',
      title: NOTIFY_OFFER_DECLINED,
      content: `${order.seller.nickname} declined your offer for "${order.product.title}".`,
      link: `/product/${order.product.id}`,
    });
    addPriceOfferResultToChat(order, 'rejected');
    deleteOrder(order.id);
    navigate('/my/orders', { replace: true });
  };

  const getActionButton = () => {
    if (!order) return null;

    const userId = getCurrentUserId();
    const isBuyer = order.buyer.id === userId;
    const isSeller = order.seller.id === userId;

    switch (order.status) {
      case ORDER_STATUS_VALUE.PENDING_OFFER:
        if (isSeller) {
          return (
            <div className="space-y-2">
              <button
                onClick={() => handleStatusChange(ORDER_STATUS_VALUE.ACCEPTED, 'Offer accepted')}
                className="w-full px-4 py-3 text-white rounded-lg font-medium"
                style={{ backgroundColor: '#00A8A3' }}
              >
                Accept offer
              </button>
              <button
                onClick={handleReject}
                className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg font-medium"
              >
                Decline offer
              </button>
            </div>
          );
        }
        if (isBuyer) {
          return (
            <button
              onClick={handleDelete}
              className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg font-medium"
            >
              Withdraw offer
            </button>
          );
        }
        return null;

      case ORDER_STATUS_VALUE.ACCEPTED:
        if (isSeller) {
          return (
            <div className="space-y-2">
              <button
                onClick={() => handleStatusChange(ORDER_STATUS_VALUE.MEETUP_SET, 'Meetup confirmed')}
                className="w-full px-4 py-3 text-white rounded-lg font-medium"
                style={{ backgroundColor: '#00A8A3' }}
              >
                Confirm meetup
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          );
        }
        if (isBuyer) {
          return (
            <p className="text-sm text-gray-500 text-center py-2">Waiting for the seller to confirm the meetup.</p>
          );
        }
        return null;

      case ORDER_STATUS_VALUE.MEETUP_SET: {
        const isShareOrder = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
        if (isBuyer) {
          return (
            <div className="space-y-2">
              <button
                onClick={() => orderId && navigate(`/receive/${orderId}`)}
                className="w-full px-4 py-3 text-white rounded-lg font-medium"
                style={{ backgroundColor: '#00A8A3' }}
              >
                Confirm receipt
              </button>
              {!isShareOrder && (
                <button
                  onClick={() => handleStatusChange(ORDER_STATUS_VALUE.DISPUTE, 'Dispute opened')}
                  className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg font-medium"
                >
                  Open dispute
                </button>
              )}
            </div>
          );
        }
        if (isSeller) {
          return (
            <div className="space-y-2">
              {order.sellerCompleted ? (

                <p className="text-xs text-gray-500 text-center py-2">Waiting for the buyer to confirm receipt</p>

              ) : (

                <button

                  onClick={() => {

                    const updated = confirmOrderCompletion(order.id, 'seller');

                    if (updated?.status === ORDER_STATUS_VALUE.COMPLETE) {

                      addTradeCompletedToChat(updated);

                    }

                    loadOrder();

                  }}

                  className="w-full px-4 py-3 text-white rounded-lg font-medium"

                  style={{ backgroundColor: '#00A8A3' }}

                >

                  Confirm delivery

                </button>

              )}
              {!isShareOrder && (
                <button
                  onClick={() => handleStatusChange(ORDER_STATUS_VALUE.DISPUTE, 'Dispute opened')}
                  className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg font-medium"
                >
                  Open dispute
                </button>
              )}
            </div>
          );
        }
        return null;
      }

      case ORDER_STATUS_VALUE.RECEIVED: {

        if (isBuyer) {

          return (

            <p className="text-sm text-gray-500 text-center py-2">

              Waiting for seller to confirm delivery.

            </p>

          );

        }

        if (isSeller) {

          if (order.sellerCompleted) {

            return (

              <p className="text-sm text-gray-500 text-center py-2">

                Delivery confirmed. Trade complete.

              </p>

            );

          }

          return (

            <button

              onClick={() => {

                const updated = confirmOrderCompletion(order.id, 'seller');

                if (updated?.status === ORDER_STATUS_VALUE.COMPLETE) {

                  addTradeCompletedToChat(updated);

                }

                loadOrder();

                if (orderId && !getReviewByOrderId(orderId)) {

                  setTimeout(() => navigate(`/review/${orderId}`), 300);

                }

              }}

              className="w-full px-4 py-3 text-white rounded-lg font-medium"

              style={{ backgroundColor: '#00A8A3' }}

            >

              Confirm delivery

            </button>

          );

        }

        return null;

      }
      case ORDER_STATUS_VALUE.COMPLETE: {

        const myReview = orderId ? getReviewByOrderId(orderId) : undefined;

        if (myReview) {

          return (

            <p className="text-sm text-gray-600 text-center py-2">

              Review submitted

            </p>

          );

        }

        return (
          <button
            onClick={() => navigate(`/review/${orderId}`)}
            className="w-full px-4 py-3 text-white rounded-lg font-medium"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Write review
          </button>
        );
      }

      case ORDER_STATUS_VALUE.DISPUTE:
        return (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center">A dispute has been filed.</p>
            <button
              onClick={() => navigate(`/dispute/${orderId}`)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
            >
              Dispute details
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-white">
        <TopBar
          leftContent={
            <button onClick={() => navigate(-1)} className="p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }
          title="Order detail"
        />
        <div className="text-center py-12 text-gray-500">
          Order not found.
        </div>
      </div>
    );
  }

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
        title="Order detail"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Status</span>
            <OrderStatusChip status={order.status} />
          </div>
          <p className="text-lg font-bold text-gray-900 mt-2">
            {order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0
              ? 'Free'
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
              <h3 className="text-sm font-medium text-gray-700 mb-3">Listing</h3>
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
                    {productDeleted ? 'Listing removed' : (order.product?.title ?? 'Listing')}
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
                    <p className="text-xs text-gray-400 mt-1">The seller removed this listing.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {order.memo && (
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Note</h3>
            <p className="text-sm text-gray-600">{order.memo}</p>
          </div>
        )}

        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Timeline</h3>
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
                  <p className="text-sm font-medium text-gray-900">{event.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(event.timestamp).toLocaleString('en-US')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Parties</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Buyer</span>
              <span className="text-gray-900">{resolveDisplayNickname(order.buyer.id, order.buyer.nickname)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Seller</span>
              <span className="text-gray-900">{resolveDisplayNickname(order.seller.id, order.seller.nickname)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Method</span>
              <span className="text-gray-900">{labelTradeMethod(order.tradeMethod)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Offer date</span>
              <span className="text-gray-900">
                {new Date(order.createdAt).toLocaleDateString('en-US')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {getActionButton() && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
          {getActionButton()}
        </div>
      )}
    </div>
  );
};
