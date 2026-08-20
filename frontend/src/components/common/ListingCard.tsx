import React, { useState, useCallback, useEffect } from 'react';
import { Product, ProductStatus, PRODUCT_STATUS_VALUE } from '@/types';
import { isFreeShareListing } from '@/locale/enUI';
import { Badge } from './Badge';
import { getLikeCount, isFavorite, toggleFavorite } from '@/utils/favoriteStorage';
import { guestGuard } from '@/utils/guestGate';
import { getChatRoomCountByProductId } from '@/utils/chatStorage';
import { getDisputeCountByProductId } from '@/utils/disputeStorage';
import { hasProductReservedOrder, hasProductCompletedOrder } from '@/utils/orderStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { AvatarWithBadgeOverlay } from './AvatarWithBadgeOverlay';
import { resolveProfileAvatarUrl, resolveDisplayNickname } from '@/utils/profileStorage';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { useLanguage } from '@/hooks/useLanguage';
import { useLocalizedRegion } from '@/hooks/useLocalizedRegion';
import type { HomeMessageKey } from '@/i18n/homeMessages';

interface ListingCardProps {
  product: Product;
  layout?: 'grid' | 'list';
  onClick?: () => void;
  hideLikeCount?: boolean;
  hideLikeButton?: boolean;
  hideSeller?: boolean;
}

function relativeTimeLocalized(
  isoDate: string,
  t: (key: HomeMessageKey, vars?: Record<string, string | number>) => string,
): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return t('justNow');
  if (diff < 60) return t('minutesAgo', { n: diff });
  if (diff < 1440) return t('hoursAgo', { n: Math.floor(diff / 60) });
  return t('daysAgo', { n: Math.floor(diff / 1440) });
}

function ListingCardMeta({
  product,
  likeCount,
  chatCount,
  productDisputeCount,
  timeLabel,
  hideLikeCount,
}: {
  product: Product;
  likeCount: number;
  chatCount: number;
  productDisputeCount: number;
  timeLabel: string;
  hideLikeCount?: boolean;
}) {
  const localizedRegion = useLocalizedRegion(product.region);
  const shownLikeCount = hideLikeCount ? 0 : likeCount;
  const hasStats = shownLikeCount > 0 || chatCount > 0 || productDisputeCount > 0;

  return (
    <>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-400 mb-1">
        <span className="truncate min-w-0">{localizedRegion}</span>
        <span className="flex-shrink-0">{timeLabel}</span>
      </div>
      {hasStats && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {shownLikeCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden>
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {shownLikeCount}
            </span>
          )}
          {chatCount > 0 && (
            <span className="flex items-center gap-1">
              <img src="/post/chat.svg" alt="" className="w-3.5 h-3.5" />
              {chatCount}
            </span>
          )}
          {productDisputeCount > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <img src="/3 ICON/warning.svg" alt="" className="w-3.5 h-3.5" />
              {productDisputeCount}
            </span>
          )}
        </div>
      )}
    </>
  );
}

export const ListingCard: React.FC<ListingCardProps> = ({
  product,
  layout = 'grid',
  onClick,
  hideLikeCount,
  hideLikeButton,
  hideSeller,
}) => {
  const { t } = useLanguage();
  const statusVariant: Record<ProductStatus, 'success' | 'warning' | 'default'> = {
    [PRODUCT_STATUS_VALUE.FOR_SALE]: 'success',
    [PRODUCT_STATUS_VALUE.RESERVED]: 'warning',
    [PRODUCT_STATUS_VALUE.SOLD]: 'default',
  };

  const isFreeListing = isFreeShareListing(product);
  const isSold = product.status === PRODUCT_STATUS_VALUE.SOLD || hasProductCompletedOrder(product.id);
  const isTrading = !isSold && hasProductReservedOrder(product.id);
  const statusLabel =
    isFreeListing && !isSold && !isTrading
      ? t('free')
      : isTrading
        ? t('trading')
        : isSold
          ? t('sold')
          : t('forSale');
  const timeLabel = relativeTimeLocalized(product.createdAt, t);

  const [liked, setLiked] = useState(() => isFavorite(product.id));
  const [likeCount, setLikeCount] = useState(() => getLikeCount(product.id));
  const [disputeRevision, setDisputeRevision] = useState(0);

  useEffect(() => {
    setLiked(isFavorite(product.id));
  }, [product.id, product.liked]);

  useEffect(() => {
    const refresh = () => {
      setLiked(isFavorite(product.id));
      setLikeCount(getLikeCount(product.id));
    };
    const onDisputesChanged = () => setDisputeRevision((n) => n + 1);
    window.addEventListener('favoritesChanged', refresh);
    window.addEventListener('productsChanged', refresh);
    window.addEventListener('disputesChanged', onDisputesChanged);
    window.addEventListener('ordersChanged', onDisputesChanged);
    return () => {
      window.removeEventListener('favoritesChanged', refresh);
      window.removeEventListener('productsChanged', refresh);
      window.removeEventListener('disputesChanged', onDisputesChanged);
      window.removeEventListener('ordersChanged', onDisputesChanged);
    };
  }, [product.id]);

  const handleLike = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (guestGuard('like')) return;
    void (async () => {
      const nowLiked = await toggleFavorite(product);
      setLiked(nowLiked);
      setLikeCount(getLikeCount(product.id));
    })();
  }, [product]);

  const chatCount = getChatRoomCountByProductId(product.id);
  void disputeRevision;
  const productDisputeCount = getDisputeCountByProductId(product.id);
  const showDisputeBadge = productDisputeCount > 0;

  const seller = product.seller;
  const sellerAvatarSrc =
    seller?.id != null
      ? resolveProfileAvatarUrl(seller.id, seller.profileImage)
      : '/default-avatar.jpg';
  const isAdminHidden = Boolean(product.adminHidden);

  if (layout === 'list') {
    return (
      <div
        onClick={onClick}
        className={`flex gap-3 border-b border-gray-100 p-4 ${
          isAdminHidden
            ? 'cursor-default bg-gray-100 opacity-60 grayscale'
            : isSold
              ? 'cursor-pointer opacity-60'
              : 'cursor-pointer hover:bg-gray-50'
        }`}
      >
        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
          <img
            src={getDisplayImageUrl(product.images[0])}
            alt={product.title}
            className="w-full h-full object-cover"
          />
          {isAdminHidden ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-700/55">
              <span className="rounded bg-gray-900/80 px-2 py-1 text-xs font-bold text-white">
                Hidden by admin
              </span>
            </div>
          ) : isSold ? (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-xs font-bold px-2 py-1 bg-black/60 rounded">{statusLabel}</span>
            </div>
          ) : null}
          {!isAdminHidden && isTrading && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="text-white text-xs font-bold px-2 py-1 bg-teal-600/80 rounded">{statusLabel}</span>
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {showDisputeBadge ? (
              <Badge variant="danger" size="sm">
                {t('inDispute')}
              </Badge>
            ) : (
              <>
                {!isSold && !isTrading && (!isFreeListing || product.status !== PRODUCT_STATUS_VALUE.FOR_SALE) && (
                  <Badge variant={statusVariant[product.status]} size="sm">
                    {statusLabel}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
            {product.title}
          </h3>
          {product.isFreeShare || product.price === 0 ? (
            <p className="text-base font-bold text-green-600 mb-1 flex items-center gap-1">
              <span>🎁</span>
              <span>{t('free')}</span>
            </p>
          ) : (
            <p className="text-base font-bold text-gray-900 mb-1">
              {product.price.toLocaleString()} Pi
            </p>
          )}
          <ListingCardMeta
            product={product}
            likeCount={likeCount}
            chatCount={chatCount}
            productDisputeCount={productDisputeCount}
            timeLabel={timeLabel}
            hideLikeCount={hideLikeCount}
          />
          {!hideSeller && seller?.id && (
            <div className="flex items-center gap-2 mt-2">
              <AvatarWithBadgeOverlay userId={seller.id} sizePx={28}>
                <UserAvatarImage src={sellerAvatarSrc} />
              </AvatarWithBadgeOverlay>
              <span className="text-xs text-gray-600 truncate">{resolveDisplayNickname(seller.id, seller.nickname)}</span>
            </div>
          )}
        </div>
        {!hideLikeButton && (
        <button
          onClick={handleLike}
          className="self-start p-1 text-gray-400 hover:text-red-500"
          aria-label={liked ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg
            className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
        className={`min-w-0 transition-opacity ${
          isAdminHidden
            ? 'cursor-default opacity-60 grayscale'
            : isSold
              ? 'cursor-pointer opacity-60'
              : 'cursor-pointer hover:opacity-90'
        }`}
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 mb-2">
        <img
          src={getDisplayImageUrl(product.images[0])}
          alt={product.title}
          className="w-full h-full object-cover"
        />
        {isAdminHidden ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-700/55">
            <span className="rounded-lg bg-gray-900/80 px-3 py-1.5 text-sm font-bold text-white">
              Hidden by admin
            </span>
          </div>
        ) : isSold ? (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-sm font-bold px-3 py-1.5 bg-black/60 rounded-lg">{statusLabel}</span>
          </div>
        ) : null}
        {!isAdminHidden && isTrading && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="text-white text-sm font-bold px-3 py-1.5 bg-teal-600/80 rounded-lg">{statusLabel}</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end">
          {showDisputeBadge ? (
            <Badge variant="danger" size="sm">
              {t('inDispute')}
            </Badge>
          ) : (
            <>
              {!isSold && !isTrading && (!isFreeListing || product.status !== PRODUCT_STATUS_VALUE.FOR_SALE) && (
                <Badge variant={statusVariant[product.status]} size="sm">
                  {statusLabel}
                </Badge>
              )}
            </>
          )}
        </div>
        {(product.isFreeShare || product.price === 0) && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
            🎁 {t('free')}
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
        {product.title}
      </h3>
      {product.isFreeShare || product.price === 0 ? (
        <p className="text-base font-bold text-green-600 mb-1 truncate">{t('free')}</p>
      ) : (
        <p className="text-base font-bold text-gray-900 mb-1 truncate">
          {product.price.toLocaleString()} PI
        </p>
      )}
      <ListingCardMeta
        product={product}
        likeCount={likeCount}
        chatCount={chatCount}
        productDisputeCount={productDisputeCount}
        timeLabel={timeLabel}
        hideLikeCount={hideLikeCount}
      />
    </div>
  );
};


