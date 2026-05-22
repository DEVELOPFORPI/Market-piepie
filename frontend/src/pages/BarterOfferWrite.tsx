import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';

const mockTargetProduct = {
  id: 'target1',
  title: 'iPhone 14 Pro Max',
  price: 500,
  images: ['/placeholder.jpg'],
  category: 'Electronics',
  region: 'Gangnam',
  seller: {
    nickname: 'Seller1',
  },
};

const mockOfferProduct = {
  id: 'offer1',
  title: 'Galaxy S23 Ultra',
  price: 450,
  images: ['/placeholder.jpg'],
  category: 'Electronics',
  region: 'Gangnam',
};

export const BarterOfferWrite: React.FC = () => {
  const navigate = useNavigate();
  const { targetProductId } = useParams();
  const [searchParams] = useSearchParams();
  const offerProductId = searchParams.get('offerProductId');
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (!offerProductId) {
      alert('Select a listing to offer in exchange.');
      return;
    }

    console.log('Submit barter offer:', {
      targetProductId,
      offerProductId,
      message,
    });

    alert('Swap offer sent.');
    navigate(-1);
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
        title="Swap offer"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-1">
            🔄 Swaps are in-person in the same area only (demo)
          </p>
          <p className="text-xs text-blue-700">
            If accepted, both listings move to reserved.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">You want</h3>
          <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
            <ListingCard
              product={mockTargetProduct as any}
              layout="list"
              onClick={() => navigate(`/product/${targetProductId}`)}
            />
            <div className="mt-2 text-xs text-gray-600">
              Seller: {mockTargetProduct.seller.nickname}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">You offer</h3>
          <div className="p-4 border-2 border-gray-200 rounded-lg">
            <ListingCard
              product={mockOfferProduct as any}
              layout="list"
              onClick={() => navigate(`/product/${offerProductId}`)}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-2">Reference prices (you agree value in chat)</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">Their listing</span>
            <span className="font-medium text-gray-900">{mockTargetProduct.price.toLocaleString()} Pi</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-700">Your listing</span>
            <span className="font-medium text-gray-900">{mockOfferProduct.price.toLocaleString()} Pi</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Note (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message with your swap offer"
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium"
        >
          Send swap offer
        </button>
      </div>
    </div>
  );
};
