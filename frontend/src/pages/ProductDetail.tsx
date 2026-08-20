import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ReportModal } from '@/components/common/ReportModal';
import { Badge } from '@/components/common/Badge';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Product, ProductStatus } from '@/types';
import { getAllProducts, deleteProduct, updateProductStatus, saveProduct } from '@/utils/productStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { isFavorite, toggleFavorite, getLikeCount } from '@/utils/favoriteStorage';
import { createOrGetChatRoom, getChatRoomCountByProductId } from '@/utils/chatStorage';
import { hasProductReservedOrder, hasProductCompletedOrder, getOrdersByProductId, isMyAcceptedTradeOnProduct } from '@/utils/orderStorage';
import { hasProductActiveDispute, hasHomeVisibleDispute } from '@/utils/disputeStorage';
import { syncOrdersFromDB, syncDisputesFromDB } from '@/utils/dbSync';
import { ORDER_STATUS_VALUE, PRODUCT_STATUS_VALUE } from '@/types';
import { labelProductAvailability, labelInDispute, isFreeShareListing, relativeTimeShort } from '@/locale/enUI';
import { guestGuard } from '@/utils/guestGate';
import { api } from '@/utils/api';
import { useDismissOnClickOutside } from '@/hooks/useDismissOnClickOutside';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useLanguage } from '@/hooks/useLanguage';
import type { AppMessageKey } from '@/hooks/useLanguage';
import { useLocalizedRegion } from '@/hooks/useLocalizedRegion';
import { showToast } from '@/utils/toast';

const fallbackProduct: Product = {
  id: '0',
  title: '',
  price: 0,
  images: ['/placeholder.jpg'],
  category: 'Other',
  region: '',
  status: PRODUCT_STATUS_VALUE.FOR_SALE,
  description: '',
  createdAt: new Date().toISOString(),
  seller: {
    id: '',
    nickname: '',
    kycStatus: 'unverified',
    trustScore: 0,
    rating: 0,
    tradeCount: 0,
  },
  tradeMethods: [],
  todayTradeAvailable: false,
  liked: false,
};

type SellerListingMenuKey =
  | 'for_sale'
  | 'free'
  | typeof PRODUCT_STATUS_VALUE.RESERVED
  | typeof PRODUCT_STATUS_VALUE.SOLD;

function sellerListingMenu(
  t: (key: AppMessageKey, vars?: Record<string, string | number>) => string,
): { key: SellerListingMenuKey; label: string }[] {
  return [
    { key: 'for_sale', label: t('forSale') },
    { key: 'free', label: t('free') },
    { key: PRODUCT_STATUS_VALUE.RESERVED, label: t('trading') },
    { key: PRODUCT_STATUS_VALUE.SOLD, label: t('sold') },
  ];
}

function isSellerListingMenuSelected(key: SellerListingMenuKey, p: Product): boolean {
  if (p.status === PRODUCT_STATUS_VALUE.SOLD || hasProductCompletedOrder(p.id)) {
    return key === PRODUCT_STATUS_VALUE.SOLD;
  }
  if (hasProductReservedOrder(p.id)) return key === PRODUCT_STATUS_VALUE.RESERVED;
  if (key === 'free') {
    return isFreeShareListing(p);
  }
  if (key === 'for_sale') {
    return !isFreeShareListing(p);
  }
  return false;
}

export const ProductDetail: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { askConfirm, confirmDialog } = useConfirmDialog();
  const { id } = useParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showProductMenu, setShowProductMenu] = useState(false);
  const productMenuRef = useRef<HTMLDivElement>(null);
  useDismissOnClickOutside(productMenuRef, showProductMenu, () => setShowProductMenu(false));
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const [product, setProduct] = useState<Product>(fallbackProduct);
  const localizedRegion = useLocalizedRegion(product.region);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const isMine = product.seller?.id === getCurrentUserId();

  useEffect(() => {
    if (!id) { setLoading(false); setNotFound(true); return; }
    setLoading(true);
    setNotFound(false);

    const local = getAllProducts().find((p) => p.id === id);
    if (local) {
      setProduct(local);
      setLoading(false);
      return;
    }

    api.get<any>(`/api/products/${id}`).then((res) => {
      if (res.ok && res.data) {
        const d = res.data;
        const mapped: Product = {
          id: d.id,
          title: d.title || 'Untitled',
          price: d.price ?? 0,
          images: d.images ?? ['/placeholder.jpg'],
          category: d.category || 'Other',
          region: d.region || '',
          status: d.status || PRODUCT_STATUS_VALUE.FOR_SALE,
          description: d.description || '',
          createdAt: d.created_at || d.createdAt || new Date().toISOString(),
          seller: d.seller ? {
            id: d.seller.id,
            nickname: d.seller.nickname || 'Unknown',
            kycStatus: d.seller.kyc_status || 'unverified',
            trustScore: d.seller.trust_score ?? 0,
            rating: d.seller.rating ?? 0,
            tradeCount: d.seller.trade_count ?? 0,
            profileImage: d.seller.profile_image,
          } : fallbackProduct.seller,
          tradeMethods: d.trade_methods ?? [],
          todayTradeAvailable: d.today_trade_available ?? false,
          liked: false,
          isFreeShare: d.is_free_share ?? false,
          allowOffer: d.allow_offer ?? true,
          adminHidden: Boolean(d.admin_hidden),
          adminHiddenReason: d.admin_hidden_reason || undefined,
        };
        setProduct(mapped);
      } else {
        setNotFound(true);
      }
    }).catch(() => {
      setNotFound(true);
    }).finally(() => setLoading(false));
  }, [id]);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    setLiked(isFavorite(product.id));
    setLikeCount(getLikeCount(product.id));
  }, [product.id]);

  useEffect(() => {
    const onFavChanged = () => {
      setLiked(isFavorite(product.id));
      setLikeCount(getLikeCount(product.id));
    };
    window.addEventListener('favoritesChanged', onFavChanged);
    return () => window.removeEventListener('favoritesChanged', onFavChanged);
  }, [product.id]);

  const [ctaRefresh, setCtaRefresh] = useState(0);

  useEffect(() => {
    if (!id) return;
    const uid = getCurrentUserId();
    void (async () => {
      if (uid) {
        await Promise.all([syncOrdersFromDB(uid), syncDisputesFromDB(uid)]);
      }
      const fresh = getAllProducts().find((p) => p.id === id);
      if (fresh) setProduct(fresh);
      setCtaRefresh((n) => n + 1);
    })();
  }, [id]);

  useEffect(() => {
    const refresh = () => {
      if (id) {
        const fresh = getAllProducts().find((p) => p.id === id);
        if (fresh) setProduct(fresh);
        if (
          fresh
          && hasProductCompletedOrder(fresh.id)
          && fresh.status !== PRODUCT_STATUS_VALUE.SOLD
        ) {
          void updateProductStatus(fresh.id, PRODUCT_STATUS_VALUE.SOLD);
        } else if (
          fresh
          && fresh.status === PRODUCT_STATUS_VALUE.RESERVED
          && !hasProductReservedOrder(fresh.id)
          && !hasProductCompletedOrder(fresh.id)
        ) {
          void updateProductStatus(fresh.id, PRODUCT_STATUS_VALUE.FOR_SALE);
        }
      }
      setCtaRefresh((n) => n + 1);
    };
    window.addEventListener('disputesChanged', refresh);
    window.addEventListener('ordersChanged', refresh);
    window.addEventListener('productsChanged', refresh);
    return () => {
      window.removeEventListener('disputesChanged', refresh);
      window.removeEventListener('ordersChanged', refresh);
      window.removeEventListener('productsChanged', refresh);
    };
  }, [id]);

  const handleDelete = () => {
    void (async () => {
      const ok = await askConfirm({
        message: t('deleteConfirm', { title: product.title }),
        confirmLabel: t('delete'),
        cancelLabel: t('cancel'),
      });
      if (!ok) return;
      deleteProduct(product.id);
      window.dispatchEvent(new Event('productRegistered'));
      navigate(-1);
    })();
  };

  const handleSellerListingMenu = async (key: SellerListingMenuKey) => {
    setShowStatusMenu(false);

    if (key === 'free') {
      if (isFreeShareListing(product) && product.status === PRODUCT_STATUS_VALUE.FOR_SALE) return;
      const updated: Product = {
        ...product,
        status: PRODUCT_STATUS_VALUE.FOR_SALE,
        isFreeShare: true,
        price: 0,
        allowOffer: false,
      };
      const ok = await saveProduct(updated);
      if (!ok) {
        showToast(t('couldNotUpdateListing'));
        return;
      }
      setProduct(updated);
      return;
    }

    if (key === 'for_sale') {
      if (!isFreeShareListing(product) && product.status === PRODUCT_STATUS_VALUE.FOR_SALE) return;
      if (isFreeShareListing(product)) {
        if (!product.price || product.price <= 0) {
          showToast(t('setPriceBeforeForSale'));
          navigate(`/register/edit/${product.id}`);
          return;
        }
        const updated: Product = {
          ...product,
          status: PRODUCT_STATUS_VALUE.FOR_SALE,
          isFreeShare: false,
          allowOffer: product.allowOffer !== false,
        };
        const ok = await saveProduct(updated);
        if (!ok) {
          showToast(t('couldNotUpdateListing'));
          return;
        }
        setProduct(updated);
        return;
      }
      const ok = await updateProductStatus(product.id, PRODUCT_STATUS_VALUE.FOR_SALE);
      if (!ok) {
        showToast(t('couldNotUpdateStatus'));
        return;
      }
      setProduct((prev) => ({ ...prev, status: PRODUCT_STATUS_VALUE.FOR_SALE }));
      return;
    }

    const status = key as ProductStatus;
    const ok = await updateProductStatus(product.id, status);
    if (!ok) {
      showToast(t('couldNotUpdateStatus'));
      return;
    }
    setProduct((prev) => ({ ...prev, status }));
  };

  const productMeetupReserved = hasProductReservedOrder(product.id);
  const productCompleted = hasProductCompletedOrder(product.id)
    || product.status === PRODUCT_STATUS_VALUE.SOLD;
  const listingView = {
    ...product,
    status: productCompleted
      ? PRODUCT_STATUS_VALUE.SOLD
      : productMeetupReserved
        ? PRODUCT_STATUS_VALUE.RESERVED
        : PRODUCT_STATUS_VALUE.FOR_SALE,
  };
  const anyActiveDispute = hasProductActiveDispute(product.id);
  const publicDisputeOpen = hasHomeVisibleDispute(product.id);
  const sellerStatusLocked = anyActiveDispute || productMeetupReserved;
  const sellerHeaderStatusLabel = publicDisputeOpen
    ? labelInDispute()
    : labelProductAvailability(listingView);
  const buyerHeaderStatusLabel = publicDisputeOpen
    ? labelInDispute()
    : labelProductAvailability(listingView);
  const headerStatusLabel = isMine ? sellerHeaderStatusLabel : buyerHeaderStatusLabel;
  const headerStatusLocked = isMine ? sellerStatusLocked : publicDisputeOpen;

  const chatCount = getChatRoomCountByProductId(product.id);
  const uid = getCurrentUserId();
  void ctaRefresh;
  const hasPendingOffer = Boolean(
    uid
    && getOrdersByProductId(product.id).some(
      (o) => o.buyer?.id === uid && o.status === ORDER_STATUS_VALUE.PENDING_OFFER,
    ),
  );
  const myTradeInProgress = isMyAcceptedTradeOnProduct(product.id, uid);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-white">
        <TopBar
          leftContent={
            <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }
        />
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">{t('productNotFound')}</h2>
          <p className="text-sm text-gray-500 mb-6">{t('listingRemovedOrInvalid')}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 text-white rounded-lg font-medium text-sm"
            style={{ backgroundColor: '#00A8A3' }}
          >
            {t('goHome')}
          </button>
        </div>
      </div>
    );
  }

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
        centerContent={isMine ? (
          <button
            type="button"
            disabled={sellerStatusLocked}
            onClick={() => setShowStatusMenu(true)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border ${
              headerStatusLocked
                ? 'border-red-200 bg-red-50 text-red-700 cursor-not-allowed'
                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span>{headerStatusLabel}</span>
            {!headerStatusLocked && (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        ) : (
          <span
            className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${
              headerStatusLocked
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-gray-300 bg-white text-gray-900'
            }`}
          >
            {headerStatusLabel}
          </span>
        )}
        rightContent={!isMine ? (
          <div ref={productMenuRef} className="relative">
            <button
              onClick={() => setShowProductMenu((v) => !v)}
              className="p-2 text-gray-600"
              aria-label={t('moreOptions')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showProductMenu && (
              <div className="absolute right-0 top-10 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                <button
                  onClick={() => {
                    setShowProductMenu(false);
                    if (guestGuard('report')) return;
                    setShowReport(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50 rounded-lg"
                >
                  {t('report')}
                </button>
              </div>
            )}
          </div>
        ) : undefined}
      />
      <BottomSheet
        isOpen={showStatusMenu}
        onClose={() => setShowStatusMenu(false)}
        height="auto"
      >
        <div className="py-2">
          {sellerListingMenu(t).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => void handleSellerListingMenu(option.key)}
              className={`w-full px-4 py-4 text-center text-base border-b border-gray-100 last:border-b-0 ${
                isSellerListingMenuSelected(option.key, product) ? 'font-semibold text-gray-900' : 'text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowStatusMenu(false)}
            className="w-full px-4 py-4 text-center text-base text-gray-500 border-t border-gray-100"
          >
            {t('cancel')}
          </button>
        </div>
      </BottomSheet>
      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        targetType="product"
        targetId={product.id}
        targetLabel={product.title}
      />

      {/* Gallery + like count */}
      <div className="relative w-full aspect-square bg-gray-200">
        <img
          src={product.images[currentImageIndex] || '/placeholder.jpg'}
          alt={product.title}
          className="w-full h-full object-cover"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (guestGuard('like')) return;
            void toggleFavorite(product).then(setLiked);
          }}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/90 rounded-lg shadow-sm hover:bg-white"
        >
          <svg className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">{likeCount}</span>
        </button>
        {product.images.length > 1 && (
          <>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 bg-black/50 rounded-full px-3 py-1">
              {product.images.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full ${
                    idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() =>
                setCurrentImageIndex(
                  (prev) => (prev - 1 + product.images.length) % product.images.length
                )
              }
              className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 bg-black/50 rounded-full text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() =>
                setCurrentImageIndex((prev) => (prev + 1) % product.images.length)
              }
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 bg-black/50 rounded-full text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Seller row */}
      <div className="px-4 pt-4">
        <SellerMiniCard
          seller={product.seller}
          onClick={() => navigate(`/seller/${product.seller.id}`)}
        />
      </div>

      {/* Title + status */}
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 flex-1">{product.title}</h1>
          {!isMine && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge variant={product.status === PRODUCT_STATUS_VALUE.FOR_SALE ? 'success' : 'default'} size="sm">
                {labelProductAvailability(product)}
              </Badge>
              {publicDisputeOpen && (
                <Badge variant="danger" size="sm">{t('inDispute')}</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1.5">
          <span>{localizedRegion} · {relativeTimeShort(product.createdAt)}</span>
          {chatCount > 0 && <span>· {t('chatsCount', { n: chatCount })}</span>}
        </div>
        {(product.isFreeShare || product.price === 0) && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="success" size="sm">🎁 {t('freeShare')}</Badge>
          </div>
        )}
        {product.todayTradeAvailable && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="success" size="sm">{t('sameDayOk')}</Badge>
          </div>
        )}
      </div>

      <div className="px-4 pt-5">
        <h2 className="text-base font-semibold text-gray-900 mb-2">{t('description')}</h2>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {product.description && product.description !== '-' ? (
            showFullDescription
              ? product.description
              : product.description.length > 100
                ? `${product.description.substring(0, 100)}...`
                : product.description
          ) : t('noDescription')}
        </p>
        {product.description && product.description !== '-' && product.description.length > 100 && (
          <button
            onClick={() => setShowFullDescription(!showFullDescription)}
            className="text-sm mt-1 font-medium"
            style={{ color: '#00A8A3' }}
          >
            {showFullDescription ? t('showLess') : t('showMore')}
          </button>
        )}
      </div>

      {/* Spacer for fixed footer */}
      <div className="h-20" />

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3 pb-3 safe-area-bottom">
        <div className="flex justify-end items-baseline gap-1 mb-3">
          <span className="text-sm text-gray-500">{t('priceLabel')}</span>
          {product.isFreeShare || product.price === 0 ? (
            <span className="text-lg font-bold text-green-600">{t('free')}</span>
          ) : (
            <span className="text-lg font-bold text-gray-900">{product.price.toLocaleString()} PI</span>
          )}
        </div>
        {product.adminHidden ? (
          <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
            {t('adminHidden')}
            {product.adminHiddenReason ? ` ${product.adminHiddenReason}` : ''}
            {!isMine ? t('adminHiddenContinue') : ''}
          </div>
        ) : isMine ? (
          hasProductActiveDispute(product.id) ? (
            <div className="flex items-center gap-2 py-2">
              <p className="flex-1 text-sm text-gray-500">{t('cannotEditDeleteDispute')}</p>
            </div>
          ) : (
            <div className="flex gap-3">
              {listingView.status !== PRODUCT_STATUS_VALUE.SOLD && (
                <button
                  onClick={() => navigate(`/register/edit/${product.id}`)}
                  className="flex-1 px-4 py-3 text-white rounded-lg font-medium text-sm"
                  style={{ backgroundColor: '#00A8A3' }}
                >
                  {t('edit')}
                </button>
              )}
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-800"
              >
                {t('delete')}
              </button>
            </div>
          )
        ) : listingView.status === PRODUCT_STATUS_VALUE.SOLD ? (
          <p className="text-sm text-gray-500 py-2">{t('listingSold')}</p>
        ) : hasProductReservedOrder(product.id) ? (
          <p className="text-sm text-gray-500 py-2">{t('itemReserved')}</p>
        ) : hasHomeVisibleDispute(product.id) ? (
          <p className="text-sm text-gray-500 py-2">{t('listingOpenDispute')}</p>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (guestGuard('chat')) return;
                void createOrGetChatRoom(product).then((room) => {
                  navigate(`/chat/${room.id}`);
                });
              }}
              className="flex-1 px-4 py-3 text-white rounded-lg font-medium text-sm"
              style={{ backgroundColor: '#00A8A3' }}
            >
              {t('navChat')}
            </button>
            {product.allowOffer !== false && !product.isFreeShare && product.price > 0 && (
              hasPendingOffer || myTradeInProgress ? (
                <div className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('offerSent')}
                </div>
              ) : (
                <button
                  onClick={() => { if (guestGuard('offer')) return; navigate(`/offer/${product.id}`); }}
                  className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-800"
                >
                  {t('makeOffer')}
                </button>
              )
            )}
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
};


