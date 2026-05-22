import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { fileToDataUrl, getDisplayImageUrl } from '@/utils/imageUrl';

export const ShippingInfo: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCompany, setShippingCompany] = useState('');
  const [shippingProof, setShippingProof] = useState<string[]>([]);

  const shippingCompanies = ['CJ Logistics', 'Hanjin', 'Logen', 'Lotte', 'Other'];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const dataUrls = await Promise.all(files.map((file) => fileToDataUrl(file)));
      setShippingProof([...shippingProof, ...dataUrls.filter((u) => u.length > 0)]);
    } catch {
      alert('Could not load image.');
    }
  };

  const handleSubmit = () => {
    console.log('Submit shipping:', {
      orderId,
      trackingNumber,
      shippingCompany,
      shippingProof,
    });
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
        title="Tracking"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            We will notify the buyer. Enter the tracking number and proof carefully.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Carrier <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {shippingCompanies.map((company) => (
              <button
                key={company}
                onClick={() => setShippingCompany(company)}
                className={`px-4 py-3 border rounded-lg font-medium ${
                  shippingCompany === company
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                {company}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tracking number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Tracking number"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proof (optional)
          </label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {shippingProof.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
                <img src={getDisplayImageUrl(img)} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => setShippingProof(shippingProof.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Upload label photo or receipt if you want.
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!trackingNumber || !shippingCompany}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Mark shipped
        </button>
      </div>
    </div>
  );
};
