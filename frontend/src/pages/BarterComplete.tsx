import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { PRODUCT_STATUS_VALUE } from '@/types';

const mockBarterOrder = {
  id: 'bo1',
  listingA: {
    id: 'la1',
    title: 'Galaxy S23 Ultra',
    price: 450,
    images: ['/placeholder.jpg'],
    category: 'Electronics',
    region: 'Gangnam',
    status: PRODUCT_STATUS_VALUE.RESERVED,
  },
  listingB: {
    id: 'lb1',
    title: 'iPhone 14 Pro Max',
    price: 500,
    images: ['/placeholder.jpg'],
    category: 'Electronics',
    region: 'Gangnam',
    status: PRODUCT_STATUS_VALUE.RESERVED,
  },
  meetupPlace: 'Gangnam Station exit 1',
  meetupDate: '2024-01-15',
  meetupTime: '14:00',
  confirmA: false,
  confirmB: false,
  isUserA: true,
};

export const BarterComplete: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [confirmed, setConfirmed] = useState(false);
  const [hasProblem, setHasProblem] = useState(false);
  const [problemNote, setProblemNote] = useState('');

  const myProduct = mockBarterOrder.isUserA ? mockBarterOrder.listingA : mockBarterOrder.listingB;
  const otherProduct = mockBarterOrder.isUserA ? mockBarterOrder.listingB : mockBarterOrder.listingA;

  const handleSubmit = () => {
    if (!confirmed && !hasProblem) {
      alert('Choose swap complete or report a problem.');
      return;
    }

    if (hasProblem && !problemNote.trim()) {
      alert('Describe the problem.');
      return;
    }

    console.log('Barter complete check:', {
      orderId,
      confirmed,
      hasProblem,
      problemNote,
    });

    if (hasProblem) {
      navigate(`/dispute/barter/${orderId}`);
    } else {
      const bothCompleted = true;

      if (bothCompleted) {
        alert('Swap complete. Leave a review.');
        navigate(`/review/barter/${orderId}`);
      } else {
        alert('Your confirmation is saved. Waiting for the other person.');
        navigate(-1);
      }
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
        title="Confirm swap"
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Swap details</h3>

          <div className="mb-4">
            <p className="text-xs text-gray-600 mb-2">You gave</p>
            <ListingCard product={myProduct as any} layout="list" />
          </div>

          <div className="flex justify-center my-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>

          <div>
            <p className="text-xs text-gray-600 mb-2">You received</p>
            <ListingCard product={otherProduct as any} layout="list" />
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-1">Meetup place</p>
            <p className="text-sm text-gray-900">{mockBarterOrder.meetupPlace}</p>
            <p className="text-xs text-gray-600 mt-2 mb-1">Meetup time</p>
            <p className="text-sm text-gray-900">
              {mockBarterOrder.meetupDate} {mockBarterOrder.meetupTime}
            </p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Your side</span>
              <span className={`text-sm font-medium ${mockBarterOrder.confirmA ? 'text-green-600' : 'text-gray-400'}`}>
                {mockBarterOrder.confirmA ? 'Done' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Their side</span>
              <span className={`text-sm font-medium ${mockBarterOrder.confirmB ? 'text-green-600' : 'text-gray-400'}`}>
                {mockBarterOrder.confirmB ? 'Done' : 'Pending'}
              </span>
            </div>
          </div>
          {mockBarterOrder.confirmA && mockBarterOrder.confirmB && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ✅ Both confirmed. Leave a review.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            How did the swap go?
          </label>
          <div className="space-y-2">
            <button
              onClick={() => {
                setConfirmed(true);
                setHasProblem(false);
              }}
              className={`w-full px-4 py-3 border rounded-lg text-left ${
                confirmed
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <div>
                  <p className="font-medium">Swap complete</p>
                  <p className="text-xs text-gray-500">Everything went smoothly</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                setHasProblem(true);
                setConfirmed(false);
              }}
              className={`w-full px-4 py-3 border rounded-lg text-left ${
                hasProblem
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">❌</span>
                <div>
                  <p className="font-medium">Problem</p>
                  <p className="text-xs text-gray-500">Something went wrong</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {hasProblem && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What happened <span className="text-red-500">*</span>
            </label>
            <textarea
              value={problemNote}
              onChange={(e) => setProblemNote(e.target.value)}
              placeholder="Describe the issue"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        )}

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 The swap finishes when both tap complete. Report issues if needed.
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!confirmed && !hasProblem}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {hasProblem ? 'Report problem' : 'Confirm complete'}
        </button>
      </div>
    </div>
  );
};
