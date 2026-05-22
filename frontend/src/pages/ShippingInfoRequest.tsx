import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';

const mockOrder = {
  id: 'o1',
  product: {
    title: 'iPhone 14 Pro Max',
  },
  shippingInfo: {
    recipientName: 'Jane Doe',
    recipientPhone: '010-****-1234',
    address: 'Gangnam-gu, Seoul ** (tap below for full address)',
    requestNote: 'Leave at door',
  },
  hasShippingInfo: true,
};

export const ShippingInfoRequest: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [showFullAddress, setShowFullAddress] = useState(false);

  const handleRequest = () => {
    console.log('Request shipping info:', { orderId });
    alert('We notified the buyer to enter shipping details.');
    navigate(-1);
  };

  const handleViewDetail = () => {
    setShowFullAddress(true);
  };

  const handleShipping = () => {
    navigate(`/shipping/${orderId}`);
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
        title="Shipping"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {!mockOrder.hasShippingInfo ? (
          <>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Item</h3>
              <p className="text-sm text-gray-900">{mockOrder.product.title}</p>
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
              <p className="text-sm text-gray-900">{mockOrder.product.title}</p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Shipping details</h3>

              <div>
                <p className="text-xs text-gray-600 mb-1">Recipient</p>
                <p className="text-sm text-gray-900">{mockOrder.shippingInfo.recipientName}</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Phone</p>
                <p className="text-sm text-gray-900">{mockOrder.shippingInfo.recipientPhone}</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Address</p>
                {!showFullAddress ? (
                  <div>
                    <p className="text-sm text-gray-900 mb-2">{mockOrder.shippingInfo.address}</p>
                    <button
                      onClick={handleViewDetail}
                      className="text-sm text-primary underline"
                    >
                      Show full address
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-900">
                    123 Teheran-ro, Gangnam-gu, Seoul, Unit 456 (12345)
                  </p>
                )}
              </div>

              {mockOrder.shippingInfo.requestNote && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Delivery notes</p>
                  <p className="text-sm text-gray-900">{mockOrder.shippingInfo.requestNote}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 space-y-2">
        {!mockOrder.hasShippingInfo ? (
          <button
            onClick={handleRequest}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium"
          >
            Request shipping info
          </button>
        ) : (
          <button
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
