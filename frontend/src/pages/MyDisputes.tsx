import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Badge } from '@/components/common/Badge';
import { DisputeStatus } from '@/types';
import { getDisputes, Dispute } from '@/utils/disputeStorage';
import { getCurrentUserId } from '@/utils/authStorage';

type FilterStatus = 'all' | DisputeStatus;

export const MyDisputes: React.FC = () => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  const loadDisputes = () => {
    setDisputes(getDisputes());
  };

  useEffect(() => {
    loadDisputes();
    window.addEventListener('disputesChanged', loadDisputes);
    return () => window.removeEventListener('disputesChanged', loadDisputes);
  }, []);

  const filteredDisputes = disputes.filter((dispute) => {
    return filterStatus === 'all' || dispute.status === filterStatus;
  });

  const statusVariant = {
    OPEN: 'warning' as const,
    IN_REVIEW: 'info' as const,
    RESOLVED: 'success' as const,
  };

  const statusLabel = {
    OPEN: 'Filed',
    IN_REVIEW: 'In review',
    RESOLVED: 'Resolved',
  };

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
        title="Disputes"
        rightContent={
          disputes.length > 0 ? (
            <span className="text-sm text-gray-500">{disputes.length}</span>
          ) : undefined
        }
      />

      {/* Status Filter */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-200 overflow-x-auto">
        {(['all', 'OPEN', 'IN_REVIEW', 'RESOLVED'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filterStatus === status
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={filterStatus === status ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {status === 'all' ? 'All' : statusLabel[status]}
          </button>
        ))}
      </div>

      {/* Dispute List */}
      <div className="px-4 py-4">
        {filteredDisputes.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500">No disputes.</p>
            <p className="text-xs text-gray-400 mt-1">Here is to smooth trades.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDisputes
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((dispute) => (
              <div
                key={dispute.id}
                onClick={() => navigate(`/dispute/${dispute.orderId}`)}
                className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex gap-3 mb-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    <img
                      src={dispute.productImage || '/placeholder.jpg'}
                      alt={dispute.productTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {dispute.productTitle}
                      </h3>
                      <Badge variant={statusVariant[dispute.status]}>
                        {statusLabel[dispute.status]}
                      </Badge>
                    </div>
                    <p className="text-base font-bold text-gray-900 mb-1">
                      {dispute.proposedPrice.toLocaleString()} Pi
                    </p>
                    <p className="text-xs text-gray-600">
                      Reason: {dispute.reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {dispute.buyerId === getCurrentUserId() ? 'Buyer' : 'Seller'} ·{' '}
                    {new Date(dispute.createdAt).toLocaleDateString('en-US')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/order/${dispute.orderId}`);
                      }}
                      className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg"
                    >
                      Order
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
