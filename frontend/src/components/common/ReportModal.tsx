import React, { useState } from 'react';
import { api } from '@/utils/api';

export type ReportTargetType = 'product' | 'post' | 'review' | 'user' | 'comment';

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** Optional human-readable label (e.g. product title) shown in modal header */
  targetLabel?: string;
}

const TEAL = '#00A8A3';

const REASONS: Record<ReportTargetType, string[]> = {
  product: [
    'Spam or scam',
    'Prohibited item',
    'Misleading description',
    'Fake or counterfeit',
    'Inappropriate content',
    'Other',
  ],
  post: [
    'Spam or advertising',
    'Inappropriate content',
    'Harassment',
    'Misinformation',
    'Off-topic',
    'Other',
  ],
  review: [
    'Fake review',
    'Harassment / personal attack',
    'Inappropriate language',
    'Off-topic',
    'Other',
  ],
  user: [
    'Scam / fraud',
    'Impersonation',
    'Harassment',
    'Inappropriate behavior',
    'Spam',
    'Other',
  ],
  comment: [
    'Spam',
    'Harassment',
    'Inappropriate content',
    'Off-topic',
    'Other',
  ],
};

const TYPE_LABEL: Record<ReportTargetType, string> = {
  product: 'product',
  post: 'post',
  review: 'review',
  user: 'user',
  comment: 'comment',
};

export const ReportModal: React.FC<Props> = ({ open, onClose, targetType, targetId, targetLabel }) => {
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const reset = () => {
    setReason('');
    setDescription('');
    setSending(false);
    setDone(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason || sending) return;
    setSending(true);
    const res = await api.post('/api/reports', {
      target_type: targetType,
      target_id: targetId,
      reason,
      description: description.trim() || undefined,
    });
    setSending(false);
    if (!res.ok) {
      if (res.status === 409) {
        alert('You already reported this. Wait for admin review.');
        close();
        return;
      }
      alert(res.error || `Failed to submit (HTTP ${res.status})`);
      return;
    }
    setDone(true);
  };

  const reasons = REASONS[targetType];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Report submitted</h2>
              <p className="text-sm text-gray-500">Thanks. Our team will review it shortly.</p>
            </div>
            <button onClick={close}
              className="w-full mt-4 py-2.5 text-sm text-white font-medium rounded-lg"
              style={{ backgroundColor: TEAL }}>
              Close
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Report this {TYPE_LABEL[targetType]}</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>

            {targetLabel && (
              <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400">Target</p>
                <p className="text-sm text-gray-800 truncate">{targetLabel}</p>
              </div>
            )}

            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Reason</label>
              <div className="flex flex-col gap-2">
                {reasons.map((r) => (
                  <label key={r} className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: reason === r ? TEAL : '#e5e7eb' }}>
                    <input
                      type="radio"
                      name="report-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-[#00A8A3]"
                    />
                    <span className="text-sm text-gray-800">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Details <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add any context that helps us review faster"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#00A8A3]/30"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={close}
                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={!reason || sending}
                className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#dc2626' }}>
                {sending ? 'Submitting...' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
