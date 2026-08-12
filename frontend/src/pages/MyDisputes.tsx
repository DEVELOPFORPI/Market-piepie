import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Badge } from '@/components/common/Badge';
import { DisputeStatus } from '@/types';
import { getDisputes, Dispute } from '@/utils/disputeStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { useLanguage } from '@/hooks/useLanguage';
import { labelDisputeStoredValue } from '@/utils/disputeLabels';
import { localeForAppLanguage } from '@/utils/languageStorage';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';

type FilterStatus = 'all' | 'active' | 'resolved';
type FilterDirection = 'all' | 'sent' | 'received';

function isDisputeActive(status: DisputeStatus): boolean {
  return status === 'OPEN' || status === 'IN_REVIEW';
}

function disputeStatusVariant(status: DisputeStatus): 'warning' | 'success' {
  return status === 'RESOLVED' ? 'success' : 'warning';
}

function disputeDetailPath(dispute: Dispute, myId: string): string {
  const isSent = dispute.openedByUserId === myId;
  return isSent ? `/dispute/${dispute.orderId}` : `/dispute/${dispute.orderId}?view=other`;
}

export const MyDisputes: React.FC = () => {
  useGuestPageGuard('dispute');
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterDirection, setFilterDirection] = useState<FilterDirection>('all');
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  const loadDisputes = () => {
    const myId = getCurrentUserId();
    const all = getDisputes();
    setDisputes(
      myId ? all.filter((d) => d.buyerId === myId || d.sellerId === myId) : all,
    );
  };

  useEffect(() => {
    loadDisputes();
    window.addEventListener('disputesChanged', loadDisputes);
    return () => window.removeEventListener('disputesChanged', loadDisputes);
  }, []);

  const filteredDisputes = disputes.filter((dispute) => {
    const myId = getCurrentUserId();
    if (filterStatus === 'active' && !isDisputeActive(dispute.status)) return false;
    if (filterStatus === 'resolved' && dispute.status !== 'RESOLVED') return false;
    if (filterDirection !== 'all' && myId) {
      const isSent = dispute.openedByUserId === myId;
      if (filterDirection === 'sent' && !isSent) return false;
      if (filterDirection === 'received' && isSent) return false;
    }
    return true;
  });

  const disputeStatusLabel = (status: DisputeStatus): string =>
    status === 'RESOLVED' ? t('disputeResolved') : t('disputeActive');

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: t('chipAll') },
    { value: 'active', label: t('disputeActive') },
    { value: 'resolved', label: t('disputeResolved') },
  ];

  const directionOptions: { value: Exclude<FilterDirection, 'all'>; label: string }[] = [
    { value: 'sent', label: t('disputeSent') },
    { value: 'received', label: t('disputeReceived') },
  ];

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('disputes')}
        rightContent={
          disputes.length > 0 ? (
            <span className="text-sm text-gray-500">{disputes.length}</span>
          ) : undefined
        }
      />

      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-3">
        {filterOptions.map(({ value, label }) => (
          <button
            key={value}
            onClick={() =>
              setFilterStatus((current) => (current === value && value !== 'all' ? 'all' : value))
            }
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              filterStatus === value
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={filterStatus === value ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {label}
          </button>
        ))}
        {directionOptions.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterDirection((current) => (current === value ? 'all' : value))}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              filterDirection === value
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={filterDirection === value ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

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
            <p className="text-gray-500">{t('noDisputes')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('noDisputesHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDisputes
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((dispute) => {
                const myId = getCurrentUserId();
                const isSent = Boolean(myId && dispute.openedByUserId === myId);
                const directionLabel = isSent ? t('disputeSent') : t('disputeReceived');

                return (
                  <div
                    key={dispute.id}
                    onClick={() => myId && navigate(disputeDetailPath(dispute, myId))}
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
                          <Badge variant={disputeStatusVariant(dispute.status)}>
                            {disputeStatusLabel(dispute.status)}
                          </Badge>
                        </div>
                        <p className="text-base font-bold text-gray-900 mb-1">
                          {dispute.proposedPrice.toLocaleString()} Pi
                        </p>
                        <p className="text-xs text-gray-600">
                          {t('reasonLabel')} {labelDisputeStoredValue(lang, dispute.reason)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        <span className={isSent ? 'text-gray-700 font-medium' : 'text-amber-700 font-medium'}>
                          {directionLabel}
                        </span>
                        {' · '}
                        {new Date(dispute.createdAt).toLocaleDateString(localeForAppLanguage(lang))}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/order/${dispute.orderId}`);
                          }}
                          className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg"
                        >
                          {t('orderButton')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
