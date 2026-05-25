import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ReportModal } from '@/components/common/ReportModal';
import { KYCBadge } from '@/components/common/KYCBadge';
import { TrustBadge } from '@/components/common/TrustBadge';
import { ListingCard } from '@/components/common/ListingCard';
import { User, Product, ORDER_STATUS_VALUE } from '@/types';
import { getOrders, getShareCountByUserId } from '@/utils/orderStorage';
import { getDisputeCountByUserId } from '@/utils/disputeStorage';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import { profileAvatarObjectClass, resolveDisplayNickname } from '@/utils/profileStorage';
import { API_BASE } from '@/utils/apiConfig';

interface ReviewFromDB {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  tags: string[];
  comment: string;
  product_title?: string;
  product_image?: string;
  created_at: string;
  reviewer?: {
    id: string;
    nickname: string;
    kyc_status: string;
    trust_score: number;
    rating: number;
    trade_count: number;
    profile_image?: string;
  };
}

type TabKey = 'listings' | 'reviews' | 'about';

const TAB_LABELS: Record<TabKey, string> = {
  listings: 'Listings',
  reviews: 'Reviews',
  about: 'About',
};

export const SellerProfile: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<TabKey>('listings');
  const [seller, setSeller] = useState<User | null>(null);
  const [showSellerMenu, setShowSellerMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewFromDB[]>([]);
  const [loading, setLoading] = useState(true);

  const meetupProductIds = new Set(
    getOrders().filter((o) => o.status === ORDER_STATUS_VALUE.MEETUP_SET).map((o) => o.product?.id).filter(Boolean)
  );

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [userRes, productsRes, reviewsRes] = await Promise.all([
          fetch(`${API_BASE}/api/users/${id}`),
          fetch(`${API_BASE}/api/products?seller_id=${id}`),
          fetch(`${API_BASE}/api/reviews?reviewee_id=${id}`),
        ]);

        if (userRes.ok) {
          const u = await userRes.json();
          setSeller({
            id: u.id,
            nickname: u.nickname || 'User',
            profileImage: u.profile_image,
            kycStatus: u.kyc_status || 'unverified',
            trustScore: u.trust_score || 0,
            rating: u.rating || 0,
            tradeCount: u.trade_count || 0,
            bio: u.bio,
            activityRegion: u.activity_region,
            sellerType: u.seller_type,
          });
        }

        if (productsRes.ok) {
          const prods = await productsRes.json();
          setProducts(
            (prods as any[]).map((p: any) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              price: Number(p.price) || 0,
              category: p.category || '',
              region: p.region || '',
              status: p.status || '판매중',
              images: p.images || [],
              seller: p.seller ? {
                id: p.seller.id,
                nickname: p.seller.nickname || 'User',
                profileImage: p.seller.profile_image,
                kycStatus: p.seller.kyc_status || 'unverified',
                trustScore: p.seller.trust_score || 0,
                rating: p.seller.rating || 0,
                tradeCount: p.seller.trade_count || 0,
              } : { id, nickname: id, kycStatus: 'unverified' as const, trustScore: 0, rating: 0, tradeCount: 0 },
              tradeMethods: p.trade_methods || [],
              todayTradeAvailable: p.today_trade_available || false,
              isFreeShare: p.is_free_share || false,
              allowOffer: p.allow_offer || false,
              createdAt: p.created_at || new Date().toISOString(),
              liked: false,
            }))
          );
        }

        if (reviewsRes.ok) {
          const revs = await reviewsRes.json();
          setReviews(revs as ReviewFromDB[]);
        }
      } catch (e) {
        console.error('[SellerProfile] load error:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#00A8A3' }} />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-white">
        <TopBar
          leftContent={
            <button onClick={() => navigate(-1)} className="p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }
        />
        <div className="text-center py-16 text-gray-500">User not found.</div>
      </div>
    );
  }

  const headerImage = seller.profileImage || '/default-avatar.jpg';
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : seller.rating || 0;

  return (
    <div className="min-h-screen bg-white pb-6">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        rightContent={
          <div className="flex gap-2 relative">
            <button
              onClick={() => navigate(`/chat?seller=${id}`)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Chat
            </button>
            <button
              onClick={() => setShowSellerMenu((v) => !v)}
              className="p-2 text-gray-600"
              aria-label="More options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showSellerMenu && (
              <div className="absolute right-0 top-10 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                <button
                  onClick={() => { setShowSellerMenu(false); setShowReport(true); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50 rounded-lg"
                >
                  Report
                </button>
              </div>
            )}
          </div>
        }
      />
      {seller && id && (
        <ReportModal
          open={showReport}
          onClose={() => setShowReport(false)}
          targetType="user"
          targetId={id}
          targetLabel={seller.nickname}
        />
      )}

      {/* Header */}
      <div className="px-4 py-6 border-b border-gray-200">
        <div className="flex items-start gap-4">
          <AvatarWithBadgeOverlay userId={id} sizePx={80}>
            <img
              src={headerImage}
              alt={seller.nickname}
              className={profileAvatarObjectClass(headerImage)}
            />
          </AvatarWithBadgeOverlay>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-gray-900">{resolveDisplayNickname(seller.id, seller.nickname)}</h1>
              <KYCBadge status={seller.kycStatus} userId={seller.id} />
            </div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <TrustBadge score={seller.trustScore} />
              <span className="text-sm text-gray-600">
                ⭐ {avgRating.toFixed(1)} · {seller.tradeCount} trades · {id ? getShareCountByUserId(id) : 0} shares
                {id && getDisputeCountByUserId(id) > 0 && (
                  <> · {getDisputeCountByUserId(id)} disputes</>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['listings', 'reviews', 'about'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === tab
                ? 'border-b-2'
                : 'text-gray-500'
            }`}
            style={activeTab === tab ? { color: '#00A8A3', borderColor: '#00A8A3' } : undefined}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 py-4">
        {activeTab === 'listings' && (
          <div>
            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No active listings.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {products.map((product) => (
                  <ListingCard
                    key={product.id}
                    product={product}
                    layout="grid"
                    onClick={() => navigate(`/product/${product.id}`)}
                    meetupConfirmed={meetupProductIds.has(product.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold text-gray-900">
                  {avgRating.toFixed(1)}
                </span>
                <span className="text-lg text-gray-500">/ 5.0</span>
              </div>
              <p className="text-sm text-gray-500">{reviews.length} reviews</p>
            </div>
            {reviews.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No reviews yet.</div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {review.reviewer?.nickname || 'Anonymous'}
                      </span>
                      {review.reviewer?.kyc_status === 'verified' && (
                        <KYCBadge status="verified" userId={review.reviewer.id} />
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    {review.tags && review.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {review.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {review.comment && (
                      <p className="text-sm text-gray-700">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="space-y-4">
            {seller.bio && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Bio</h3>
                <p className="text-sm text-gray-600">{seller.bio}</p>
              </div>
            )}
            {seller.activityRegion && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Area</h3>
                <p className="text-sm text-gray-600">{seller.activityRegion}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
