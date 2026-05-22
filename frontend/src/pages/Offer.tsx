import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';
import { Product, PRODUCT_STATUS_VALUE, TRADE_METHOD_VALUE } from '@/types';
import { getAllProducts } from '@/utils/productStorage';
import { createOrder } from '@/utils/orderStorage';

export const Offer: React.FC = () => {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [price, setPrice] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    const allProducts = getAllProducts();
    const found = allProducts.find((p) => p.id === productId);
    if (found) {
      if (found.status === PRODUCT_STATUS_VALUE.SOLD) {
        alert('You cannot offer on a sold listing.');
        navigate(-1);
        return;
      }
      setProduct(found);
      setPrice(String(found.price));
    }
  }, [productId, navigate]);

  const handleSubmit = () => {
    if (!product || !price) return;

    const order = createOrder({
      product,
      proposedPrice: Number(price),
      tradeMethod: TRADE_METHOD_VALUE.IN_PERSON,
      memo,
    });

    alert('Offer sent.');
    navigate(`/order/${order.id}`, { replace: true });
  };

  const canSubmit = price && Number(price) > 0;

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
        title="Make offer"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {/* Product Info */}
        {product && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={product.images[0] || '/placeholder.jpg'}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{product.title}</h3>
                <p className="text-base font-bold text-gray-900 mt-1">
                  {product.price.toLocaleString()} Pi
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Seller Info */}
        {product && (
          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Seller</h2>
            <SellerMiniCard seller={product.seller} />
          </div>
        )}

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your offer (Pi)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
          {product && Number(price) !== product.price && Number(price) > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              List price: {product.price.toLocaleString()} Pi
              {Number(price) < product.price && (
                <span className="text-red-500 ml-1">
                  ({Math.round(((product.price - Number(price)) / product.price) * 100)}% below list)
                </span>
              )}
            </p>
          )}
        </div>

        {/* Memo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Anything else to add"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3] resize-none"
          />
        </div>

        {/* Policy Notice */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <p className="text-sm font-medium text-blue-900">Trade notes</p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>The platform does not handle payment</li>
            <li>You arrange payment directly with the seller</li>
            <li>Use disputes if there is a problem</li>
          </ul>
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full px-4 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          style={canSubmit ? { backgroundColor: '#00A8A3' } : undefined}
        >
          Send offer
        </button>
      </div>
    </div>
  );
};
