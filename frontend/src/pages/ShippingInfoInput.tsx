import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Order } from '@/types';
import { ensureOrderById, saveOrderShippingInfo } from '@/utils/orderStorage';

export const ShippingInfoInput: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      if (cancelled) return;
      setOrder(found ?? null);
      if (found?.shippingInfo) {
        setRecipientName(found.shippingInfo.recipientName || '');
        setRecipientPhone(found.shippingInfo.recipientPhone || '');
        setAddress(found.shippingInfo.address || '');
        setRequestNote(found.shippingInfo.requestNote || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  const handleSubmit = async () => {
    if (!orderId || !recipientName || !recipientPhone || !address) {
      alert('Fill in all required fields.');
      return;
    }

    setSubmitting(true);
    const updated = await saveOrderShippingInfo(orderId, {
      recipientName,
      recipientPhone,
      address,
      requestNote: requestNote || undefined,
    });
    setSubmitting(false);

    if (!updated) {
      alert('Could not save shipping details. Check your connection and try again.');
      return;
    }

    alert('Shipping details sent.');
    navigate(-1);
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
        title="Shipping details"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-2">📦 Shipping privacy</p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Use only for this trade</li>
            <li>Removed automatically some time after completion</li>
            <li>Enter accurate address and phone</li>
          </ul>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Item</h3>
          <p className="text-sm text-gray-900">{order.product.title}</p>
          <p className="text-base font-bold text-gray-900 mt-1">
            {order.proposedPrice.toLocaleString()} Pi
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Full name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address <span className="text-red-500">*</span>
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, unit, postal code"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery notes (optional)
          </label>
          <textarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Gate code, safe drop, etc."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={() => void handleSubmit()}
          disabled={!recipientName || !recipientPhone || !address || submitting}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving...' : 'Send shipping info'}
        </button>
      </div>
    </div>
  );
};
