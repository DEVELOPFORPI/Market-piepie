import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Product, PRODUCT_STATUS_VALUE, type TradeMethod } from '@/types';
import { labelTradeMethod } from '@/locale/enUI';
import { getMyUser } from '@/utils/profileStorage';

export const RegisterComplete: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const productId = location.state?.productId || 'new-product-123'; // Real flow: ID from API after publish

  const mockProduct: Product = {
    id: productId,
    title: location.state?.title || 'Your listing',
    price: Number(location.state?.price) || 0,
    images: location.state?.images || ['/placeholder.jpg'],
    category: location.state?.category || '',
    region: location.state?.region || '',
    status: PRODUCT_STATUS_VALUE.FOR_SALE,
    description: location.state?.description || '',
    createdAt: new Date().toISOString(),
    seller: getMyUser(),
    tradeMethods: location.state?.tradeMethods || [],
    todayTradeAvailable: location.state?.todayTradeAvailable || false,
    liked: false,
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate('/')} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        }
        title="Published"
      />

      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12">
        {/* Success Icon */}
        <div className="mb-6">
          <img src="/check.svg" alt="Done" className="w-12 h-12 object-contain" />
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Listing published</h1>
        <p className="text-sm text-gray-600 mb-8 text-center">
          Your listing is visible in the marketplace.
        </p>

        {/* Product Preview */}
        <div className="w-full max-w-sm mb-8">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="relative aspect-square bg-gray-200">
              <img
                src={mockProduct.images[0] || '/placeholder.jpg'}
                alt={mockProduct.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                {mockProduct.title}
              </h3>
              {mockProduct.isFreeShare || mockProduct.price === 0 ? (
                <p className="text-base font-bold text-green-600 mb-2 flex items-center gap-1">
                  <span>🎁</span>
                  <span>Free share</span>
                </p>
              ) : (
                <p className="text-base font-bold text-gray-900 mb-2">
                  {mockProduct.price.toLocaleString()} Pi
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {mockProduct.tradeMethods.map((method) => (
                  <span
                    key={method}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                  >
                    {labelTradeMethod(method as TradeMethod)}
                  </span>
                ))}
                {mockProduct.todayTradeAvailable && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">
                    Same-day OK
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => navigate(`/product/${productId}`)}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90"
          >
            View listing
          </button>
          <button
            onClick={() => navigate('/my/products')}
            className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            My listings
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-3 text-gray-600 rounded-lg font-medium hover:text-gray-900"
          >
            Home
          </button>
        </div>

        {/* Tips */}
        <div className="mt-8 w-full max-w-sm">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tips</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Clear photos get more views</li>
              <li>• Accurate descriptions close deals faster</li>
              <li>• Same-day trade can attract more interest</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

