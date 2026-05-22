import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';

const mockOrder = {
  id: 'o1',
  product: {
    id: 'p1',
    title: 'iPhone 14 Pro Max',
    price: 500,
    images: ['/placeholder.jpg'],
  },
  seller: {
    id: 's1',
    nickname: 'Seller1',
    kycStatus: 'verified' as const,
    trustScore: 85,
    rating: 4.5,
    tradeCount: 12,
  },
  proposedPrice: 500,
};

type PaymentStatus = 'idle' | 'opening' | 'txid_received' | 'processing' | 'completed';

export const EscrowPayment: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>('idle');

  const handlePayment = async () => {
    if (!agreed) return;
    setStatus('opening');
    setTimeout(() => setStatus('txid_received'), 2000);
    setTimeout(() => setStatus('processing'), 4000);
    setTimeout(() => {
      setStatus('completed');
      setTimeout(() => navigate(`/order/${orderId}`), 2000);
    }, 6000);
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
        title="Escrow payment"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        <div className="p-4 border border-gray-200 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order summary</h2>
          <div className="flex gap-3 mb-4">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              <img
                src={mockOrder.product.images[0] || '/placeholder.jpg'}
                alt={mockOrder.product.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                {mockOrder.product.title}
              </h3>
              <p className="text-lg font-bold text-gray-900">
                {mockOrder.proposedPrice.toLocaleString()} Pi
              </p>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <SellerMiniCard seller={mockOrder.seller} />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Amount</span>
            <span className="text-2xl font-bold text-gray-900">
              {mockOrder.proposedPrice.toLocaleString()} Pi
            </span>
          </div>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <p className="text-sm text-blue-800">
            ✅ The trade completes after you confirm receipt.
          </p>
          <p className="text-sm text-blue-800">
            ⚠️ You can open a dispute if something goes wrong.
          </p>
        </div>

        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-5 h-5 text-primary rounded mt-0.5"
          />
          <span className="text-sm text-gray-700">
            I have read the policy and agree to escrow payment.
          </span>
        </label>

        {status !== 'idle' && (
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            {status === 'opening' && (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-gray-600">Opening payment…</p>
              </div>
            )}
            {status === 'txid_received' && (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-gray-600">Received txid…</p>
              </div>
            )}
            {status === 'processing' && (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-gray-600">Finalizing on server…</p>
              </div>
            )}
            {status === 'completed' && (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-green-600 font-medium">Payment complete</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handlePayment}
          disabled={!agreed || status !== 'idle'}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Pay with Pi
        </button>
      </div>
    </div>
  );
};
