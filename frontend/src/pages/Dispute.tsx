import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Badge } from '@/components/common/Badge';
import { ORDER_STATUS_VALUE, POST_CATEGORY_VALUE } from '@/types';
import { ensureOrderById, getOrderById, updateOrderStatus } from '@/utils/orderStorage';
import {
  createDispute,
  ensureDisputeByOrderId,
  getDisputeByOrderId,
  updateDisputeStatus,
  Dispute as DisputeType,
} from '@/utils/disputeStorage';
import { addUserPost } from '@/utils/communityStorage';
import { getMyUser } from '@/utils/profileStorage';
import { addNotification } from '@/utils/notificationStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { uploadImagesToR2, uploadImageReferencesToR2 } from '@/utils/imageUpload';
import { getCurrentUserId } from '@/utils/authStorage';
import { syncDisputesFromDB, syncOrdersFromDB } from '@/utils/dbSync';
import { labelTradeMethod } from '@/locale/enUI';
import { Order } from '@/types';

const buyerDisputeReasons = [
  'Listing mismatch',
  'Not received',
  'Damaged item',
  'Seller no-show',
  'Other',
];

const sellerDisputeReasons = [
  'Buyer no-show',
  'Buyer not responding',
  'Payment not received',
  'Bad-faith behavior',
  'Other',
];

const buyerDisputeActions = ['Request full refund', 'Request partial refund', 'Request seller action'];

export const Dispute: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [reason, setReason] = useState('');
  const [action, setAction] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [dispute, setDispute] = useState<DisputeType | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setOrder(undefined);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [foundOrder, existingDispute] = await Promise.all([
        ensureOrderById(orderId),
        ensureDisputeByOrderId(orderId, getCurrentUserId()),
      ]);
      if (cancelled) return;
      setOrder(foundOrder);
      if (existingDispute) {
        setDispute(existingDispute);
        setReason(existingDispute.reason);
        setAction(existingDispute.action);
        setDescription(existingDispute.description);
        setEvidence(existingDispute.evidence || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    // sync*FromDB는 완료 시 disputesChanged/ordersChanged 이벤트를 다시 발생시키므로,
    // 이벤트 핸들러에서 sync를 또 부르면 무한 요청 루프가 된다(429/ERR_INSUFFICIENT_RESOURCES).
    // 이벤트 핸들러는 로컬 저장소만 다시 읽는다.
    const readLocal = () => {
      const foundOrder = getOrderById(orderId);
      if (foundOrder) setOrder(foundOrder);
      setDispute(getDisputeByOrderId(orderId, getCurrentUserId()) ?? null);
    };
    const syncThenRead = () => {
      void (async () => {
        const uid = getCurrentUserId();
        if (uid) {
          await Promise.all([syncDisputesFromDB(uid), syncOrdersFromDB(uid)]);
        }
        readLocal();
      })();
    };
    syncThenRead();
    window.addEventListener('disputesChanged', readLocal);
    window.addEventListener('ordersChanged', readLocal);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncThenRead();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('disputesChanged', readLocal);
      window.removeEventListener('ordersChanged', readLocal);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orderId]);

  useEffect(() => {
    if (order) {
      const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
      if (isShare) {
        alert('Free shares cannot be disputed.');
        navigate(orderId ? `/order/${orderId}` : '/my/orders', { replace: true });
      }
    }
  }, [order, orderId, navigate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingEvidence(true);
    try {
      const urls = await uploadImagesToR2(files, { folder: 'disputes' });
      setEvidence((prev) => [...prev, ...urls]);
    } catch {
      alert('Could not upload images.');
    } finally {
      setUploadingEvidence(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!orderId || !order) return;

    let evidenceToSave: string[] = [];
    try {
      evidenceToSave = evidence.length > 0
        ? await uploadImageReferencesToR2(evidence, { folder: 'disputes' })
        : [];
    } catch {
      alert('Could not upload images.');
      return;
    }
    const currentUserId = getCurrentUserId();
    const isSellerOpener = currentUserId === order.seller.id;
    const actionToSave = isSellerOpener ? '' : action;

    const newDispute = await createDispute({
      orderId,
      productTitle: order.product.title,
      productImage: order.product.images[0] || '/placeholder.jpg',
      proposedPrice: order.proposedPrice,
      tradeMethod: order.tradeMethod,
      buyerId: order.buyer.id,
      buyerNickname: order.buyer.nickname,
      sellerId: order.seller.id,
      sellerNickname: order.seller.nickname || 'Seller',
      reason,
      action: actionToSave,
      description,
      evidence: evidenceToSave,
    });
    if (!newDispute) {
      alert('Could not file dispute. Check your connection and try again.');
      return;
    }

    await updateOrderStatus(orderId, ORDER_STATUS_VALUE.DISPUTE, `Dispute filed: ${reason}`);

    const otherUser = order.buyer.id === currentUserId ? order.seller : order.buyer;
    const openerNickname = order.buyer.id === currentUserId ? order.buyer.nickname : order.seller.nickname;
    addNotification({
      targetUserId: otherUser.id,
      type: 'order',
      title: 'Dispute filed',
      content: `${openerNickname} filed a dispute for "${order.product.title}". (Reason: ${reason})`,
      link: `/dispute/${orderId}`,
    });

    const author = getMyUser();
    const disputePostId = `dispute_post_${newDispute.id}`;
    const postSaved = await addUserPost({
      id: disputePostId,
      title: `[Dispute] ${order.product.title} - ${reason}`,
      content: [
        `Listing: ${order.product.title}`,
        `Amount: ${order.proposedPrice.toLocaleString()} Pi`,
        `Reason: ${reason}`,
        ...(actionToSave ? [`Requested action: ${actionToSave}`] : []),
        description ? `\nDetails:\n${description}` : '',
      ].join('\n'),
      category: POST_CATEGORY_VALUE.DISPUTE,
      author,
      images: evidenceToSave.length > 0 ? evidenceToSave : undefined,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      orderId,
    });
    if (!postSaved) {
      alert('Dispute was filed, but the community post could not be published. Check your connection.');
    } else {
      addNotification({
        targetUserId: otherUser.id,
        type: 'order',
        title: 'Dispute post published',
        content: `A community post was created for the dispute on "${order.product.title}". You can leave comments there.`,
        link: `/community/post/${disputePostId}`,
      });
    }

    setDispute(newDispute);
    window.scrollTo(0, 0);
  };

  const handleResolve = async () => {
    if (!dispute) return;
    const uid = getCurrentUserId();
    if (!dispute.openedByUserId || dispute.openedByUserId !== uid) {
      alert('Only the party who filed this dispute can mark it resolved.');
      return;
    }
    if (!confirm('Mark this dispute as resolved?')) return;
    const ok = await updateDisputeStatus(dispute.id, 'RESOLVED', 'Resolved by mutual agreement.');
    if (!ok) {
      alert('Could not update dispute status. Check your connection and try again.');
      return;
    }
    setDispute({
      ...dispute,
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
      adminResponse: 'Resolved by mutual agreement.',
    });
  };

  const statusVariant = {
    OPEN: 'warning' as const,
    IN_REVIEW: 'info' as const,
    RESOLVED: 'success' as const,
  };

  const statusLabel = {
    OPEN: 'Submitted',
    IN_REVIEW: 'In review',
    RESOLVED: 'Resolved',
  };

  const currentUserId = getCurrentUserId();
  const isSellerOpening = Boolean(order && currentUserId && order.seller.id === currentUserId);
  const isDisputeOpener = Boolean(
    dispute && currentUserId && dispute.openedByUserId === currentUserId,
  );
  const showRequestedActionSummary = Boolean(dispute?.action?.trim());
  const disputeReasonOptions = isSellerOpening ? sellerDisputeReasons : buyerDisputeReasons;

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
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={dispute ? 'Dispute details' : 'Open dispute'}
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {dispute && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <Badge variant={statusVariant[dispute.status]}>
                {statusLabel[dispute.status]}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Filed: {new Date(dispute.createdAt).toLocaleString('en-US')}
            </p>
            {dispute.resolvedAt && (
              <p className="text-xs text-green-600 mt-1">
                Resolved: {new Date(dispute.resolvedAt).toLocaleString('en-US')}
              </p>
            )}
          </div>
        )}

        {order && (
          <div
            className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
            onClick={() => navigate(`/order/${orderId}`)}
          >
            <h3 className="text-sm font-medium text-gray-700 mb-3">Order</h3>
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={order.product.images[0] || '/placeholder.jpg'}
                  alt={order.product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 mb-1">{order.product.title}</h4>
                <p className="text-sm font-bold text-gray-900">{order.proposedPrice.toLocaleString()} Pi</p>
                <p className="text-xs text-gray-500 mt-1">{labelTradeMethod(order.tradeMethod)}</p>
              </div>
            </div>
          </div>
        )}

        {!order && !dispute && (
          <div className="text-center py-8 text-gray-500">
            <p>Order not found.</p>
          </div>
        )}

        {!dispute && order && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <div className="space-y-2">
                {disputeReasonOptions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`w-full px-4 py-3 border rounded-lg text-left text-sm ${
                      reason === r
                        ? 'text-white'
                        : 'border-gray-300 text-gray-700'
                    }`}
                    style={reason === r ? { borderColor: '#00A8A3', backgroundColor: '#00A8A3' } : undefined}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {!isSellerOpening && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Requested action</label>
              <div className="space-y-2">
                {buyerDisputeActions.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className={`w-full px-4 py-3 border rounded-lg text-left text-sm ${
                      action === a
                        ? 'text-white'
                        : 'border-gray-300 text-gray-700'
                    }`}
                    style={action === a ? { borderColor: '#00A8A3', backgroundColor: '#00A8A3' } : undefined}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 font-medium mb-1">Refund notice</p>
                <p className="text-xs text-yellow-700">
                  Refunds are arranged privately between you and the seller (e.g. Pi transfer). The platform cannot
                  force a refund; dispute outcomes may affect seller trust or access.
                </p>
              </div>
            </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Details</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened in detail"
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Evidence</label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {evidence.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
                    <img src={getDisplayImageUrl(img)} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setEvidence(evidence.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#00A8A3]">
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
            </div>
          </>
        )}

        {dispute && (
          <>
            <div className="p-4 border border-gray-200 rounded-lg space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Dispute summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Reason</span>
                  <span className="text-gray-900 font-medium">{dispute.reason}</span>
                </div>
                {showRequestedActionSummary && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Requested action</span>
                  <span className="text-gray-900 font-medium">{dispute.action}</span>
                </div>
                )}
              </div>
              {dispute.description && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-700 leading-relaxed">{dispute.description}</p>
                </div>
              )}
            </div>

            {dispute.evidence && dispute.evidence.length > 0 && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Evidence</h3>
                <div className="grid grid-cols-3 gap-2">
                  {dispute.evidence.map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                      <img src={getDisplayImageUrl(img)} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dispute.status === 'OPEN' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-900 mb-2">Dispute received</h3>
                <p className="text-sm text-yellow-800">
                  {isDisputeOpener
                    ? 'Try to resolve with the other party. When resolved, tap the button below.'
                    : 'The other party filed this dispute. Resolve together in chat; only they can mark it closed.'}
                </p>
              </div>
            )}

            {dispute.status === 'IN_REVIEW' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Under review</h3>
                <p className="text-sm text-blue-800 mb-2">
                  {dispute.adminResponse || 'We will respond within 3 business days.'}
                </p>
                <p className="text-xs text-blue-700">
                  Outcomes may affect the seller (trust score, restrictions).
                </p>
              </div>
            )}

            {dispute.status === 'RESOLVED' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-sm font-medium text-green-900 mb-2">Dispute resolved</h3>
                <p className="text-sm text-green-800">
                  {dispute.adminResponse || 'This dispute is closed.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        {!dispute && order ? (
          <button
            onClick={handleSubmit}
            disabled={!reason || (!isSellerOpening && !action) || !description || uploadingEvidence}
            className="w-full px-4 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            style={reason && (isSellerOpening || action) && description && !uploadingEvidence ? { backgroundColor: '#EF4444' } : undefined}
          >
            {uploadingEvidence ? 'Uploading...' : 'Submit dispute'}
          </button>
        ) : dispute && (dispute.status === 'OPEN' || dispute.status === 'IN_REVIEW') && isDisputeOpener ? (
          <button
            onClick={() => void handleResolve()}
            className="w-full px-4 py-3 text-white rounded-lg font-medium"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Mark resolved
          </button>
        ) : dispute ? (
          <button
            onClick={() => navigate('/my/orders')}
            className="w-full px-4 py-3 text-white rounded-lg font-medium"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Back to orders
          </button>
        ) : null}
      </div>
    </div>
  );
};
