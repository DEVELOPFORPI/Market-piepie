import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { Product, PRODUCT_STATUS_VALUE, TRADE_METHOD_VALUE } from '@/types';

const mockMyProducts: Product[] = [
  {
    id: 'my1',
    title: 'Galaxy S23 Ultra',
    price: 450,
    images: ['/placeholder.jpg'],
    category: 'Electronics',
    region: 'Gangnam',
    status: PRODUCT_STATUS_VALUE.FOR_SALE,
    description: '',
    createdAt: '',
    seller: {} as any,
    tradeMethods: [TRADE_METHOD_VALUE.IN_PERSON],
    todayTradeAvailable: false,
    liked: false,
  },
  {
    id: 'my2',
    title: 'AirPods Pro (2nd gen)',
    price: 200,
    images: ['/placeholder.jpg'],
    category: 'Electronics',
    region: 'Gangnam',
    status: PRODUCT_STATUS_VALUE.FOR_SALE,
    description: '',
    createdAt: '',
    seller: {} as any,
    tradeMethods: [TRADE_METHOD_VALUE.IN_PERSON],
    todayTradeAvailable: false,
    liked: false,
  },
];

export const BarterProductSelect: React.FC = () => {
  const navigate = useNavigate();
  const { targetProductId } = useParams();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const handleNext = () => {
    if (!selectedProductId) {
      alert('Select a listing to offer in exchange.');
      return;
    }
    navigate(`/barter/offer/${targetProductId}?offerProductId=${selectedProductId}`);
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
        title="Choose your listing"
      />

      {/* Notice */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
        <p className="text-sm text-blue-800">
          📍 Swap offers are only for active listings in the same area (demo: Gangnam).
        </p>
      </div>

      {/* Filter Tab */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-medium">
            For sale only
          </span>
          <span className="text-sm text-gray-600">Gangnam</span>
        </div>
      </div>

      {/* Product List */}
      <div className="px-4 py-4 pb-24">
        {mockMyProducts.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-gray-500">No active listings in this area.</p>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium"
            >
              Create a listing
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {mockMyProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProductId(product.id)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedProductId === product.id
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedProductId === product.id
                      ? 'border-primary bg-primary'
                      : 'border-gray-300'
                  }`}>
                    {selectedProductId === product.id && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <ListingCard product={product} layout="list" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Button */}
      {selectedProductId && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
          <button
            onClick={handleNext}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};


