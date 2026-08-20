import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Badge } from '@/components/common/Badge';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';
import { ImageLightbox } from '@/components/common/ImageLightbox';
import { ORDER_STATUS_VALUE, POST_CATEGORY_VALUE } from '@/types';
import { ensureOrderById, getOrderById, updateOrderStatus } from '@/utils/orderStorage';
import {
  createDispute,
  ensureOpenDisputeByOrderId,
  fetchOrderDisputes,
  getDisputesByOrderId,
  mergeDisputesById,
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
import { labelTradeMethod, NOTIFY_DISPUTE_FILED } from '@/locale/enUI';
import { Order, User } from '@/types';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useLanguage } from '@/hooks/useLanguage';
import { labelDisputeStoredValue } from '@/utils/disputeLabels';
import { disputeOpenedTimelineText } from '@/utils/orderTimelineDisplay';
import { localeForAppLanguage } from '@/utils/languageStorage';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';
import { scrollAppToTop } from '@/utils/appScroll';
import { showToast } from '@/utils/toast';

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

function resolveCounterparty(order: Order, currentUserId: string): User | null {
  if (order.buyer.id === currentUserId) return order.seller;
  if (order.seller.id === currentUserId) return order.buyer;
  return null;
}

function resolveDisputeOpenerUserId(
  order: Order,
  currentUserId: string,
  viewOtherParty: boolean,
): string {
  if (!viewOtherParty) return currentUserId;
  return order.buyer.id === currentUserId ? order.seller.id : order.buyer.id;
}

function pickFocusedDispute(
  disputes: DisputeType[],
  openerId: string | undefined,
  viewOtherParty: boolean,
): DisputeType | undefined {
  const forOpener = (d: DisputeType) => !openerId || d.openedByUserId === openerId;
  const open = disputes.find((d) => d.status !== 'RESOLVED' && forOpener(d));
  if (open) return open;
  const resolved = disputes
    .filter((d) => d.status === 'RESOLVED' && forOpener(d))
    .sort((a, b) => (a.resolvedAt || a.createdAt).localeCompare(b.resolvedAt || b.createdAt));
  if (resolved.length) return resolved[resolved.length - 1];
  if (!viewOtherParty) return undefined;
  const otherOpen = disputes.find(
    (d) => d.status !== 'RESOLVED' && (!openerId || d.openedByUserId !== openerId),
  );
  if (otherOpen) return otherOpen;
  if (disputes.length) {
    return [...disputes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
  }
  return undefined;
}

function disputeFilerName(d: DisputeType, order?: Order): string {
  if (d.openedByUserId && d.openedByUserId === d.sellerId) {
    return d.sellerNickname || order?.seller.nickname || 'Seller';
  }
  if (d.openedByUserId && d.openedByUserId === d.buyerId) {
    return d.buyerNickname || order?.buyer.nickname || 'Buyer';
  }
  return d.buyerNickname || order?.buyer.nickname || '';
}

export const Dispute: React.FC = () => {
  useGuestPageGuard('dispute');
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { askConfirm, confirmDialog } = useConfirmDialog();
  const dateLocale = localeForAppLanguage(lang);
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const viewOtherParty = searchParams.get('view') === 'other';
  const [reason, setReason] = useState('');
  const [action, setAction] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [dispute, setDispute] = useState<DisputeType | null>(null);
  const [orderDisputes, setOrderDisputes] = useState<DisputeType[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const applyDisputeList = (
    foundOrder: Order | undefined,
    list: DisputeType[],
  ) => {
    const uid = getCurrentUserId();
    const openerId = uid && foundOrder
      ? resolveDisputeOpenerUserId(foundOrder, uid, viewOtherParty)
      : uid ?? undefined;
    const focused = pickFocusedDispute(list, openerId, viewOtherParty);
    setOrderDisputes(list);
    setDispute(focused ?? null);
    if (focused) {
      setReason(focused.reason);
      setAction(focused.action);
      setDescription(focused.description);
      setEvidence(focused.evidence || []);
    }
  };

  useEffect(() => {
    if (!orderId) {
      setOrder(undefined);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const foundOrder = await ensureOrderById(orderId);
      const uid = getCurrentUserId();
      const openerId = uid && foundOrder
        ? resolveDisputeOpenerUserId(foundOrder, uid, viewOtherParty)
        : uid ?? undefined;
      await ensureOpenDisputeByOrderId(orderId, openerId);
      const remote = await fetchOrderDisputes(orderId);
      const list = mergeDisputesById(remote, getDisputesByOrderId(orderId));
      if (cancelled) return;
      setOrder(foundOrder);
      applyDisputeList(foundOrder, list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId, viewOtherParty]);

  useEffect(() => {
    if (viewOtherParty) return;
    const uid = getCurrentUserId();
    if (!orderId || (uid && getDisputesByOrderId(orderId).some((d) => d.openedByUserId === uid))) return;
    setReason('');
    setAction('');
    setDescription('');
    setEvidence([]);
  }, [orderId, viewOtherParty]);

  useEffect(() => {
    if (!orderId) return;
    // sync*FromDB는 완료 시 disputesChanged/ordersChanged 이벤트를 다시 발생시키므로,
    // 이벤트 핸들러에서 sync를 또 부르면 무한 요청 루프가 된다(429/ERR_INSUFFICIENT_RESOURCES).
    // 이벤트 핸들러는 로컬 저장소만 다시 읽는다.
    const readLocal = () => {
      const foundOrder = getOrderById(orderId);
      if (foundOrder) setOrder(foundOrder);
      void fetchOrderDisputes(orderId).then((remote) => {
        applyDisputeList(foundOrder, mergeDisputesById(remote, getDisputesByOrderId(orderId)));
      });
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
  }, [orderId, viewOtherParty]);

  // Detail view replaces the form on the same route, so the container keeps the
  // form's scroll position unless it is reset when the shown dispute changes.
  useEffect(() => {
    if (dispute?.id) scrollAppToTop();
  }, [dispute?.id]);

  useEffect(() => {
    if (order) {
      const isShare = order.proposedPrice === 0 || order.product?.isFreeShare || order.product?.price === 0;
      if (isShare) {
        showToast(t('freeShareNoDispute'));
        navigate(orderId ? `/order/${orderId}` : '/my/orders', { replace: true });
      }
    }
  }, [order, orderId, navigate, t]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingEvidence(true);
    try {
      const urls = await uploadImagesToR2(files, { folder: 'disputes' });
      setEvidence((prev) => [...prev, ...urls]);
    } catch {
      showToast(t('couldNotUpload'));
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
      showToast(t('couldNotUpload'));
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
      showToast(t('couldNotFileDispute'));
      return;
    }

    await updateOrderStatus(
      orderId,
      ORDER_STATUS_VALUE.DISPUTE,
      disputeOpenedTimelineText(isSellerOpener ? 'seller' : 'buyer'),
    );

    const otherUser = order.buyer.id === currentUserId ? order.seller : order.buyer;
    const openerNickname = order.buyer.id === currentUserId ? order.buyer.nickname : order.seller.nickname;
    addNotification({
      targetUserId: otherUser.id,
      type: 'order',
      title: NOTIFY_DISPUTE_FILED,
      content: `${openerNickname} filed a dispute for "${order.product.title}". (Reason: ${reason})`,
      link: `/dispute/${orderId}?view=other`,
    });

    const author = getMyUser();
    const disputePostId = `dispute_post_${newDispute.id}`;
    const postSaved = await addUserPost({
      id: disputePostId,
      title: `[Dispute] ${order.product.title} - ${reason}`,
      content: [
        `Reason: ${reason}`,
        ...(actionToSave ? [`Requested action: ${actionToSave}`] : []),
        description ? `\nDetails:\n${description}` : '',
      ].join('\n'),
      category: POST_CATEGORY_VALUE.DISPUTE,
      author,
      images: evidenceToSave.length > 0 ? evidenceToSave : undefined,
      attachedProduct: order.product,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      orderId,
    });
    if (!postSaved) {
      showToast(t('disputeFiledButPostFailed'));
    }

    setDispute(newDispute);
  };

  const handleResolve = async () => {
    if (!dispute) return;
    const uid = getCurrentUserId();
    if (!dispute.openedByUserId || dispute.openedByUserId !== uid) {
      showToast(t('onlyOpenerCanResolve'));
      return;
    }
    const agreed = await askConfirm({
      message: t('markResolvedConfirm'),
      confirmLabel: t('ok'),
      cancelLabel: t('cancel'),
    });
    if (!agreed) return;
    const ok = await updateDisputeStatus(dispute.id, 'RESOLVED', 'Resolved by mutual agreement.');
    if (!ok) {
      showToast(t('couldNotUpdateDisputeStatus'));
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
    IN_REVIEW: 'warning' as const,
    RESOLVED: 'success' as const,
  };

  const statusLabel = {
    OPEN: t('disputeActive'),
    IN_REVIEW: t('disputeActive'),
    RESOLVED: t('disputeResolved'),
  };

  const currentUserId = getCurrentUserId();
  const counterparty = order && currentUserId ? resolveCounterparty(order, currentUserId) : null;
  const isSellerOpening = Boolean(order && currentUserId && order.seller.id === currentUserId);
  const isDisputeOpener = Boolean(
    dispute && currentUserId && dispute.openedByUserId === currentUserId,
  );
  const viewingOtherDispute = Boolean(
    viewOtherParty
    || (dispute && currentUserId && dispute.openedByUserId !== currentUserId),
  );
  const iHaveFiled = Boolean(
    currentUserId && orderDisputes.some((d) => d.openedByUserId === currentUserId),
  );
  const showRequestedActionSummary = Boolean(dispute?.action?.trim());
  const disputeReasonOptions = isSellerOpening ? sellerDisputeReasons : buyerDisputeReasons;
  const showSubmitBar = Boolean(order && !viewOtherParty && !iHaveFiled);
  const showResolveButton = Boolean(
    dispute && (dispute.status === 'OPEN' || dispute.status === 'IN_REVIEW') && isDisputeOpener,
  );
  const showBackToOrders = Boolean((dispute || orderDisputes.length) && !showResolveButton && !showSubmitBar);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <p className="text-gray-600">{t('loading')}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <p className="text-gray-600">{t('orderNotFound')}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-white ${showSubmitBar ? 'pb-24' : 'pb-8'}`}>
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={showSubmitBar ? t('openDisputeTitle') : t('disputeDetailsTitle')}
      />

      <div className={`px-4 py-6 space-y-6 ${showSubmitBar ? 'pb-24' : ''}`}>
        {orderDisputes.length > 0 && (
          <div className="space-y-3">
            {[...orderDisputes]
              .sort((a, b) => {
                const aMine = Boolean(currentUserId && a.openedByUserId === currentUserId);
                const bMine = Boolean(currentUserId && b.openedByUserId === currentUserId);
                if (aMine !== bMine) return viewingOtherDispute ? (aMine ? 1 : -1) : (aMine ? -1 : 1);
                return a.createdAt.localeCompare(b.createdAt);
              })
              .map((d) => {
              const mine = Boolean(currentUserId && d.openedByUserId === currentUserId);
              return (
                <div key={d.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-600">
                      {mine
                        ? t('yourDispute')
                        : t('theirDispute', { name: disputeFilerName(d, order) })}
                    </span>
                    <Badge variant={statusVariant[d.status]}>
                      {statusLabel[d.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {t('filedAt', { when: new Date(d.createdAt).toLocaleString(dateLocale) })}
                  </p>
                  {d.resolvedAt && (
                    <p className="text-xs text-green-600">
                      {t('resolvedAt', { when: new Date(d.resolvedAt).toLocaleString(dateLocale) })}
                    </p>
                  )}
                  {(d.reason || d.action?.trim() || d.description) && (
                    <div className="pt-3 border-t border-gray-200 space-y-2 text-sm">
                      {d.reason && (
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-500 shrink-0">{t('reasonLabel')}</span>
                          <span className="text-gray-900 font-medium text-right">
                            {labelDisputeStoredValue(lang, d.reason)}
                          </span>
                        </div>
                      )}
                      {Boolean(d.action?.trim()) && (
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-500 shrink-0">{t('requestedAction')}</span>
                          <span className="text-gray-900 font-medium text-right">
                            {labelDisputeStoredValue(lang, d.action)}
                          </span>
                        </div>
                      )}
                      {d.description && (
                        <p className="text-gray-700 leading-relaxed pt-1">{d.description}</p>
                      )}
                    </div>
                  )}
                  {d.evidence && d.evidence.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">{t('evidence')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {d.evidence.map((img, idx) => (
                          <button
                            key={`${d.id}-${idx}`}
                            type="button"
                            onClick={() => setViewImage(getDisplayImageUrl(img))}
                            className="aspect-square rounded-lg overflow-hidden bg-gray-200"
                          >
                            <img
                              src={getDisplayImageUrl(img)}
                              alt={t('evidenceAlt', { n: idx + 1 })}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {counterparty && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">{t('otherParty')}</h3>
            <SellerMiniCard
              seller={counterparty}
              onClick={() => navigate(`/seller/${counterparty.id}`)}
            />
          </div>
        )}

        {order && (
          <div
            className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
            onClick={() => navigate(`/order/${orderId}`)}
          >
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('orderSection')}</h3>
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
            <p>{t('orderNotFound')}</p>
          </div>
        )}

        {!dispute && order && viewingOtherDispute && (
          <div className="text-center py-8 text-gray-500">
            <p>{t('noDisputeFromOther')}</p>
          </div>
        )}

        {showSubmitBar && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('reasonLabel')} <span className="text-red-500">*</span>
              </label>
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
                    {labelDisputeStoredValue(lang, r)}
                  </button>
                ))}
              </div>
            </div>

            {!isSellerOpening && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('requestedAction')} <span className="text-red-500">*</span>
              </label>
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
                    {labelDisputeStoredValue(lang, a)}
                  </button>
                ))}
              </div>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 font-medium mb-1">{t('refundNoticeTitle')}</p>
                <p className="text-xs text-yellow-700">
                  {t('refundNoticeBody')}
                </p>
              </div>
            </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('detailsLabel')} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('detailsPlaceholder')}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('evidence')}</label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {evidence.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
                    <img src={getDisplayImageUrl(img)} alt={t('evidenceAlt', { n: idx + 1 })} className="w-full h-full object-cover" />
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
            {orderDisputes.length === 0 && (
              <>
                <div className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">{t('disputeSummary')}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 shrink-0">{t('reasonLabel')}</span>
                      <span className="text-gray-900 font-medium text-right">{labelDisputeStoredValue(lang, dispute.reason)}</span>
                    </div>
                    {showRequestedActionSummary && (
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 shrink-0">{t('requestedAction')}</span>
                      <span className="text-gray-900 font-medium text-right">{labelDisputeStoredValue(lang, dispute.action)}</span>
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
                    <h3 className="text-sm font-medium text-gray-700 mb-3">{t('evidence')}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {dispute.evidence.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setViewImage(getDisplayImageUrl(img))}
                          className="aspect-square rounded-lg overflow-hidden bg-gray-200"
                        >
                          <img src={getDisplayImageUrl(img)} alt={t('evidenceAlt', { n: idx + 1 })} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {dispute.status === 'OPEN' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-900 mb-2">{t('disputeReceived')}</h3>
                <p className="text-sm text-yellow-800">
                  {isDisputeOpener ? t('resolveHintOpener') : t('resolveHintCounterparty')}
                </p>
              </div>
            )}

            {dispute.status === 'IN_REVIEW' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">{t('underReview')}</h3>
                <p className="text-sm text-blue-800 mb-2">
                  {dispute.adminResponse || t('reviewResponseDefault')}
                </p>
                <p className="text-xs text-blue-700">
                  {t('reviewOutcomesHint')}
                </p>
              </div>
            )}

            {dispute.status === 'RESOLVED' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-sm font-medium text-green-900 mb-2">{t('disputeResolvedTitle')}</h3>
                <p className="text-sm text-green-800">
                  {dispute.adminResponse && dispute.adminResponse !== 'Resolved by mutual agreement.'
                    ? dispute.adminResponse
                    : t('disputeClosedDefault')}
                </p>
              </div>
            )}

            {showResolveButton && (
              <button
                onClick={() => void handleResolve()}
                className="w-full px-4 py-3 text-white rounded-lg font-medium"
                style={{ backgroundColor: '#00A8A3' }}
              >
                {t('markResolved')}
              </button>
            )}
          </>
        )}
        {viewOtherParty && !iHaveFiled && order && (
          <button
            onClick={() => navigate(`/dispute/${orderId}`, { replace: true })}
            className="w-full px-4 py-3 text-white rounded-lg font-medium"
            style={{ backgroundColor: '#EF4444' }}
          >
            {t('openDispute')}
          </button>
        )}
        {showBackToOrders && (
          <button
            onClick={() => navigate('/my/orders')}
            className="w-full px-4 py-3 text-white rounded-lg font-medium"
            style={{ backgroundColor: '#00A8A3' }}
          >
            {t('backToOrders')}
          </button>
        )}
      </div>

      {showSubmitBar && (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!reason || (!isSellerOpening && !action) || !description || uploadingEvidence}
          className="w-full px-4 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          style={reason && (isSellerOpening || action) && description && !uploadingEvidence ? { backgroundColor: '#EF4444' } : undefined}
        >
          {uploadingEvidence ? t('uploading') : t('submitDispute')}
        </button>
      </div>
      )}
      <ImageLightbox src={viewImage} onClose={() => setViewImage(null)} alt={t('evidence')} />
      {confirmDialog}
    </div>
  );
};
