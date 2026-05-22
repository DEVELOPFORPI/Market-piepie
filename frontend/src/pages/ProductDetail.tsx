import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ReportModal } from '@/components/common/ReportModal';
import { Badge } from '@/components/common/Badge';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';
import { Product } from '@/types';
import { getAllProducts, deleteProduct } from '@/utils/productStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { isFavorite, toggleFavorite, getLikeCount } from '@/utils/favoriteStorage';
import { createOrGetChatRoom, getChatRoomCountByProductId } from '@/utils/chatStorage';
import { hasProductReservedOrder } from '@/utils/orderStorage';
import { hasProductActiveDispute, getDisputeCountByUserId } from '@/utils/disputeStorage';
import { PRODUCT_STATUS_VALUE, type TradeMethod } from '@/types';
import { labelProductStatusListing, labelTradeMethod, relativeTimeShort } from '@/locale/enUI';
import { guestGuard } from '@/utils/guestGate';
import { api } from '@/utils/api';

const fallbackProduct: Product = {
  id: '0',
  title: 'Product not found',
  price: 0,
  images: ['/placeholder.jpg'],
  category: 'Other',
  region: '',
  status: PRODUCT_STATUS_VALUE.FOR_SALE,
  description: '',
  createdAt: new Date().toISOString(),
  seller: {
    id: '',
    nickname: 'Unknown',
    kycStatus: 'unverified',
    trustScore: 0,
    rating: 0,
    tradeCount: 0,
  },
  tradeMethods: [],
  todayTradeAvailable: false,
  liked: false,
};

export const ProductDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showProductMenu, setShowProductMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const [product, setProduct] = useState<Product>(fallbackProduct);
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

  // Refresh CTAs when disputes change
  const [, setDisputeRefresh] = useState(0);
  useEffect(() => {
    const onDisputesChanged = () => setDisputeRefresh((n) => n + 1);
    window.addEventListener('disputesChanged', onDisputesChanged);
    return () => window.removeEventListener('disputesChanged', onDisputesChanged);
  }, []);

  const handleDelete = () => {
    if (confirm(`Delete "${product.title}"?`)) {
      deleteProduct(product.id);
      window.dispatchEvent(new Event('productRegistered'));
      navigate(-1);
    }
  };

  const chatCount = getChatRoomCountByProductId(product.id);
  const sellerDisputeCount = product.seller?.id ? getDisputeCountByUserId(product.seller.id) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-white">
        <TopBar
          leftContent={
            <button onClick={() => navigate(-1)} className="p-2" aria-label="Go back">
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
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Product not found</h2>
          <p className="text-sm text-gray-500 mb-6">This listing may have been removed or the link is invalid.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 text-white rounded-lg font-medium text-sm"
            style={{ backgroundColor: '#00A8A3' }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label="Go back">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        rightContent={
          <div className="relative">
            <button
              onClick={() => setShowProductMenu((v) => !v)}
              className="p-2 text-gray-600"
              aria-label="More options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showProductMenu && (
              <div className="absolute right-0 top-10 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                <button
                  onClick={() => { setShowProductMenu(false); setShowReport(true); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50 rounded-lg"
                >
                  Report
                </button>
              </div>
            )}
          </div>
        }
      />
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
          onClick={(e) => { e.stopPropagation(); const now = toggleFavorite(product); setLiked(now); }}
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
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge variant={product.status === PRODUCT_STATUS_VALUE.FOR_SALE ? 'success' : 'default'} size="sm">
              {labelProductStatusListing(product.status)}
            </Badge>
            {product.status === PRODUCT_STATUS_VALUE.FOR_SALE && hasProductReservedOrder(product.id) && (
              <Badge variant="info" size="sm">Reserved</Badge>
            )}
            {product.status === PRODUCT_STATUS_VALUE.FOR_SALE && hasProductActiveDispute(product.id) && (
              <Badge variant="danger" size="sm">Dispute</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1.5">
          <span>{product.region} · {relativeTimeShort(product.createdAt)}</span>
          {chatCount > 0 && <span>· {chatCount} chats</span>}
          {sellerDisputeCount > 0 && <span>· {sellerDisputeCount} disputes</span>}
        </div>
        {(product.isFreeShare || product.price === 0) && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="success" size="sm">🎁 Free share</Badge>
          </div>
        )}
        {(product.tradeMethods?.length > 0 || product.todayTradeAvailable) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {product.tradeMethods?.map((method: TradeMethod) => (
              <Badge key={method} variant="info" size="sm">{labelTradeMethod(method)}</Badge>
            ))}
            {product.todayTradeAvailable && (
              <Badge variant="success" size="sm">Same-day OK</Badge>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pt-5">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Description</h2>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {product.description && product.description !== '-' ? (
            showFullDescription
              ? product.description
              : product.description.length > 100
                ? `${product.description.substring(0, 100)}...`
                : product.description
          ) : 'No description yet.'}
        </p>
        {product.description && product.description !== '-' && product.description.length > 100 && (
          <button
            onClick={() => setShowFullDescription(!showFullDescription)}
            className="text-sm mt-1 font-medium"
            style={{ color: '#00A8A3' }}
          >
            {showFullDescription ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Spacer for fixed footer */}
      <div className="h-20" />

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3 pb-3 safe-area-bottom">
        <div className="flex justify-end items-baseline gap-1 mb-3">
          <span className="text-sm text-gray-500">Price</span>
          {product.isFreeShare || product.price === 0 ? (
            <span className="text-lg font-bold text-green-600">Free</span>
          ) : (
            <span className="text-lg font-bold text-gray-900">{product.price.toLocaleString()} PI</span>
          )}
        </div>
        {isMine ? (
          hasProductActiveDispute(product.id) ? (
            <div className="flex items-center gap-2 py-2">
              <p className="flex-1 text-sm text-gray-500">You cannot edit or delete while a dispute is open.</p>
            </div>
          ) : (
            <div className="flex gap-3">
              {product.status !== PRODUCT_STATUS_VALUE.SOLD && (
                <button
                  onClick={() => navigate(`/register/edit/${product.id}`)}
                  className="flex-1 px-4 py-3 text-white rounded-lg font-medium text-sm"
                  style={{ backgroundColor: '#00A8A3' }}
                >
                  Edit
                </button>
              )}
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-800"
              >
                Delete
              </button>
            </div>
          )
        ) : product.status === PRODUCT_STATUS_VALUE.SOLD ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-gray-500">This listing is sold.</p>
            <button
              onClick={() => {
                const nowLiked = toggleFavorite(product);
                setLiked(nowLiked);
              }}
              className={`p-3 rounded-lg shrink-0 ${
                liked ? 'text-red-500' : 'text-gray-600'
              } hover:bg-gray-100`}
            >
              <svg
                className={`w-6 h-6 ${liked ? 'fill-current' : ''}`}
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
          </div>
        ) : hasProductReservedOrder(product.id) ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-gray-500">This item is reserved.</p>
            <button
              onClick={() => {
                const nowLiked = toggleFavorite(product);
                setLiked(nowLiked);
              }}
              className={`p-3 rounded-lg shrink-0 ${
                liked ? 'text-red-500' : 'text-gray-600'
              } hover:bg-gray-100`}
            >
              <svg
                className={`w-6 h-6 ${liked ? 'fill-current' : ''}`}
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
          </div>
        ) : hasProductActiveDispute(product.id) ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-gray-500">This listing has an open dispute.</p>
            <button
              onClick={() => {
                const nowLiked = toggleFavorite(product);
                setLiked(nowLiked);
              }}
              className={`p-3 rounded-lg shrink-0 ${
                liked ? 'text-red-500' : 'text-gray-600'
              } hover:bg-gray-100`}
            >
              <svg
                className={`w-6 h-6 ${liked ? 'fill-current' : ''}`}
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
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (guestGuard('chat')) return;
                  const room = createOrGetChatRoom(product);
                  navigate(`/chat/${room.id}`);
                }}
                className="flex-1 px-4 py-3 text-white rounded-lg font-medium"
                style={{ backgroundColor: '#00A8A3' }}
              >
                Chat
              </button>
              <button
                onClick={() => {
                  const nowLiked = toggleFavorite(product);
                  setLiked(nowLiked);
                }}
                className={`p-3 rounded-lg shrink-0 ${
                  liked ? 'text-red-500' : 'text-gray-600'
                } hover:bg-gray-100`}
              >
                <svg
                  className={`w-6 h-6 ${liked ? 'fill-current' : ''}`}
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
            </div>
            {product.allowOffer !== false && !product.isFreeShare && product.price > 0 && (
              <button
                onClick={() => { if (guestGuard('offer')) return; navigate(`/offer/${product.id}`); }}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-800"
              >
                Make offer
              </button>
            )}
            {(product.isFreeShare || product.price === 0) && (
              <button
                onClick={() => { if (guestGuard('share')) return; navigate(`/share/${product.id}`); }}
                className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 text-sm"
              >
                🎁 Request free share
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


