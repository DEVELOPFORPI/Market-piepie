import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarterOrder, BarterOrderStatus } from '@/types';
import { ListingCard } from './ListingCard';

interface BarterOrderPanelProps {
  order: BarterOrder;
  isUserA: boolean;
  onClose?: () => void;
}

const statusMap: Record<BarterOrderStatus, string> = {
  AGREED: 'Swap agreed',
  MEETUP_SET: 'Meetup set',
  COMPLETED: 'Swap complete',
  DISPUTE: 'Dispute',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const BarterOrderPanel: React.FC<BarterOrderPanelProps> = ({
  order,
  isUserA,
  onClose,
}) => {
  const navigate = useNavigate();

  const myProduct = isUserA ? order.listingA : order.listingB;
  const otherProduct = isUserA ? order.listingB : order.listingA;
  const myConfirmed = isUserA ? order.confirmA : order.confirmB;
  const otherConfirmed = isUserA ? order.confirmB : order.confirmA;

  const getActionButton = () => {
    switch (order.status) {
      case 'AGREED':
        return (
          <button
            onClick={() => navigate(`/meetup/barter/${order.id}`)}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
          >
            Schedule meetup
          </button>
        );
      case 'MEETUP_SET':
        return (
          <div className="space-y-2">
            {!myConfirmed ? (
              <button
                onClick={() => navigate(`/barter/complete/${order.id}`, { replace: true })}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
              >
                Confirm swap complete
              </button>
            ) : (
              <p className="text-xs text-center text-gray-600">
                You confirmed. Waiting for the other person.
              </p>
            )}
            <button
              onClick={() => navigate(`/dispute/barter/${order.id}`)}
              className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium"
            >
              Report an issue
            </button>
          </div>
        );
      case 'COMPLETED':
        return (
          <button
            onClick={() => navigate(`/review/barter/${order.id}`)}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
          >
            Write review
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Barter</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-600">Status:</span>
        <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
          {statusMap[order.status]}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <p className="text-xs text-gray-600 mb-2">Your listing</p>
          <div className="p-3 border-2 border-gray-200 rounded-lg bg-white">
            {myProduct && (
              <ListingCard
                product={myProduct}
                layout="list"
                onClick={() => navigate(`/product/${myProduct.id}`)}
              />
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>

        <div>
          <p className="text-xs text-gray-600 mb-2">Their listing</p>
          <div className="p-3 border-2 border-primary rounded-lg bg-primary/5">
            {otherProduct && (
              <ListingCard
                product={otherProduct}
                layout="list"
                onClick={() => navigate(`/product/${otherProduct.id}`)}
              />
            )}
          </div>
        </div>
      </div>

      {order.status === 'MEETUP_SET' && order.meetupPlace && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <p className="text-xs text-blue-800 font-medium mb-1">Meetup</p>
          <p className="text-sm text-blue-900">{order.meetupPlace}</p>
          {order.meetupDate && order.meetupTime && (
            <p className="text-sm text-blue-900">
              {order.meetupDate} {order.meetupTime}
            </p>
          )}
        </div>
      )}

      {order.status === 'MEETUP_SET' && (
        <div className="p-3 bg-gray-100 rounded-lg mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Your completion</span>
            <span className={myConfirmed ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {myConfirmed ? 'Done' : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-gray-600">Their completion</span>
            <span className={otherConfirmed ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {otherConfirmed ? 'Done' : 'Pending'}
            </span>
          </div>
        </div>
      )}

      <div>{getActionButton()}</div>
    </div>
  );
};
