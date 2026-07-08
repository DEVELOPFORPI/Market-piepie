import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Order } from '@/types';
import { ensureOrderById } from '@/utils/orderStorage';
import { addNotification } from '@/utils/notificationStorage';
import { getCurrentUserId } from '@/utils/authStorage';

export const ShippingInfoRequest: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullAddress, setShowFullAddress] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const found = await ensureOrderById(orderId);
      if (!cancelled) {
        setOrder(found ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  const hasShippingInfo = !!(
    order?.shippingInfo?.recipientName &&
    order?.shippingInfo?.address
  );

  const handleRequest = () => {
    if (!order) return;
    void addNotification({
      targetUserId: order.buyer.id,
      type: 'order',
      title: 'Shipping details needed',
      content: `Please enter shipping details for "${order.product.title}".`,
      link: `/shipping-info/${order.id}`,
    });
    alert('We notified the buyer to enter shipping details.');
    navigate(-1);
  };

  const handleShipping = () => {
    navigate(`/shipping/${orderId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <p className="text-gray-600">Order not found.</p>
      </div>
    );
  }

  const isSeller = getCurrentUserId() === order.seller.id;
  if (!isSeller) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <p className="text-gray-600">Only the seller can view this page.</p>
      </div>
    );
  }

  const info = order.shippingInfo;

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
        title="Shipping"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {!hasShippingInfo ? (
          <>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Item</h3>
              <p className="text-sm text-gray-900">{order.product.title}</p>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                The buyer has not entered shipping info yet. Send a reminder.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Item</h3>
              <p className="text-sm text-gray-900">{order.product.title}</p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Shipping details</h3>

              <div>
                <p className="text-xs text-gray-600 mb-1">Recipient</p>
                <p className="text-sm text-gray-900">{info?.recipientName}</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Phone</p>
                <p className="text-sm text-gray-900">{info?.recipientPhone}</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Address</p>
                {!showFullAddress ? (
                  <div>
                    <p className="text-sm text-gray-900 mb-2">
                      {info?.address?.slice(0, 24)}…
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowFullAddress(true)}
                      className="text-sm text-primary underline"
                    >
                      Show full address
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-900">{info?.address}</p>
                )}
              </div>

              {info?.requestNote && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Delivery notes</p>
                  <p className="text-sm text-gray-900">{info.requestNote}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 space-y-2">
        {!hasShippingInfo ? (
          <button
            type="button"
            onClick={handleRequest}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium"
          >
            Request shipping info
          </button>
        ) : (
          <button
            type="button"
            onClick={handleShipping}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium"
          >
            Enter tracking
          </button>
        )}
      </div>
    </div>
  );
};
