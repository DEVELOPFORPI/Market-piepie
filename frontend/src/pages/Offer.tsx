import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';
import { Product, PRODUCT_STATUS_VALUE, TRADE_METHOD_VALUE } from '@/types';
import { getAllProducts } from '@/utils/productStorage';
import { createOrder, getMyPendingOfferOrder } from '@/utils/orderStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { isListingHeldByOtherBuyerDispute } from '@/utils/disputeStorage';
import { useLanguage } from '@/hooks/useLanguage';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';
import { showToast } from '@/utils/toast';

/** 방금 보낸 제안을 전환 애니메이션이 다시 마운트하며 '이미 대기 중'으로 착각하지 않게 한다 */
const justSentOfferIds = new Set<string>();

function markOfferJustSent(productId: string) {
  justSentOfferIds.add(productId);
  window.setTimeout(() => justSentOfferIds.delete(productId), 10_000);
}

export const Offer: React.FC = () => {
  useGuestPageGuard('offer');
  const navigate = useNavigate();
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const returnRoomId = searchParams.get('from') === 'chat' ? searchParams.get('room') : null;
  const [product, setProduct] = useState<Product | null>(null);
  const [price, setPrice] = useState('');

  const leaveOffer = (orderId?: string) => {
    if (returnRoomId) {
      navigate(`/chat/${returnRoomId}`, { replace: true });
      return;
    }
    if (orderId) {
      navigate(`/order/${orderId}`, { replace: true });
      return;
    }
    navigate(-1);
  };

  useEffect(() => {
    const allProducts = getAllProducts();
    const found = allProducts.find((p) => p.id === productId);
    if (found) {
      if (found.status === PRODUCT_STATUS_VALUE.SOLD) {
        showToast(t('cannotOfferSold'));
        leaveOffer();
        return;
      }
      // 방금 보낸 직후엔 대기 중 주문이 생기는 게 정상이다. 중복 토스트·뒤로가기를 하지 않는다.
      if (justSentOfferIds.has(found.id)) {
        setProduct(found);
        setPrice(String(found.price));
        return;
      }
      if (getMyPendingOfferOrder(found.id, getCurrentUserId())) {
        showToast(t('offerAlreadyPending'));
        leaveOffer();
        return;
      }
      void isListingHeldByOtherBuyerDispute(found.id).then((held) => {
        if (held && !justSentOfferIds.has(found.id)) {
          showToast(t('bannerListingOtherDispute'));
          leaveOffer();
        }
      });
      setProduct(found);
      setPrice(String(found.price));
    }
  }, [productId, returnRoomId, navigate, t]);

  const handleSubmit = async () => {
    if (!product || !price) return;
    if (justSentOfferIds.has(product.id)) return;
    if (getMyPendingOfferOrder(product.id, getCurrentUserId())) {
      showToast(t('offerAlreadyPending'));
      return;
    }

    const order = await createOrder({
      product,
      proposedPrice: Number(price),
      tradeMethod: TRADE_METHOD_VALUE.IN_PERSON,
    });
    if (!order) {
      showToast(t('couldNotSendOffer'));
      return;
    }

    markOfferJustSent(product.id);
    showToast(t('offerSent'));
    leaveOffer(order.id);
  };

  const canSubmit = price && Number(price) > 0;

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('makeOffer')}
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {product && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={product.images[0] || '/placeholder.jpg'}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{product.title}</h3>
                <p className="text-base font-bold text-gray-900 mt-1">
                  {product.price.toLocaleString()} Pi
                </p>
              </div>
            </div>
          </div>
        )}

        {product && (
          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-3">{t('sellerLabel')}</h2>
            <SellerMiniCard seller={product.seller} />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('yourOfferPi')}
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
          {product && Number(price) !== product.price && Number(price) > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {t('listPriceLine', { price: product.price.toLocaleString() })}
              {Number(price) < product.price && (
                <span className="text-red-500 ml-1">
                  {t('belowListPct', {
                    pct: Math.round(((product.price - Number(price)) / product.price) * 100),
                  })}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <p className="text-sm font-medium text-blue-900">{t('tradeNotes')}</p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>{t('tradeNoteNoPayment')}</li>
            <li>{t('tradeNoteArrangeDirect')}</li>
            <li>{t('tradeNoteDisputes')}</li>
          </ul>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full px-4 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          style={canSubmit ? { backgroundColor: '#00A8A3' } : undefined}
        >
          {t('sendOffer')}
        </button>
      </div>
    </div>
  );
};
