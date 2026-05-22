import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';
import { Product, TRADE_METHOD_VALUE } from '@/types';
import { getAllProducts } from '@/utils/productStorage';
import { createOrder } from '@/utils/orderStorage';
import { getChatRoomByOrder } from '@/utils/chatStorage';
import { addNotification } from '@/utils/notificationStorage';
import { NOTIFY_FREE_SHARE_REQUEST_ARRIVED } from '@/locale/enUI';

export const ShareApply: React.FC = () => {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const allProducts = getAllProducts();
    const found = allProducts.find((p) => p.id === productId);
    if (found) setProduct(found);
  }, [productId]);

  const handleSubmit = () => {
    if (!product) return;

    const order = createOrder({
      product,
      proposedPrice: 0,
      tradeMethod: TRADE_METHOD_VALUE.IN_PERSON,
      memo: message || 'Requesting a free share.',
    });

    addNotification({
      targetUserId: order.seller.id,
      type: 'order',
      title: NOTIFY_FREE_SHARE_REQUEST_ARRIVED,
      content: `${order.buyer.nickname} requested a free share for "${order.product.title}".`,
      link: `/order/${order.id}`,
    });

    const room = getChatRoomByOrder(order);
    if (room && confirm('Open the chat for this request?')) {
      navigate(`/chat/${room.id}`, { replace: true });
    } else {
      navigate(`/order/${order.id}`, { replace: true });
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
        title="Request free share"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {product && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={product.images?.[0] || '/placeholder.jpg'}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{product.title}</h3>
                <p className="text-base font-bold text-green-600 mt-1 flex items-center gap-1">
                  <span>🎁</span> Free
                </p>
                <p className="text-xs text-gray-500 mt-1">{product.region}</p>
              </div>
            </div>
          </div>
        )}

        {product && (
          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Giver</h2>
            <SellerMiniCard seller={product.seller} />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say why you would like this item or introduce yourself"
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
          <p className="text-sm font-medium text-green-900">🎁 About free shares</p>
          <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
            <li>You receive the item at no Pi cost.</li>
            <li>After the giver accepts, they set meetup place and time.</li>
            <li>Please follow the agreed meetup.</li>
            <li>Be respectful and punctual.</li>
          </ul>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          className="w-full px-4 py-3 text-white rounded-lg font-medium hover:opacity-90"
          style={{ backgroundColor: '#22C55E' }}
        >
          🎁 Submit request
        </button>
      </div>
    </div>
  );
};
