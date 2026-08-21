import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { KYCBadge } from '@/components/common/KYCBadge';
import { Badge } from '@/components/common/Badge';
import { ListingCard } from '@/components/common/ListingCard';
import { PostCard } from '@/components/common/PostCard';
import { User, Product, PRODUCT_STATUS_VALUE, ProductStatus, Post, PostCategory, DisputeStatus, POST_CATEGORY_VALUE } from '@/types';
import { getPaidTradeCountByUserId, getShareCountByUserId } from '@/utils/orderStorage';
import { AvatarWithBadgeOverlay } from '@/components/common/AvatarWithBadgeOverlay';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { ProfileStatsRow } from '@/components/common/ProfileStatsRow';
import { resolveDisplayNickname, resolveProfileAvatarUrl } from '@/utils/profileStorage';
import { mapPostFromDB } from '@/utils/dbSync';
import { API_BASE } from '@/utils/apiConfig';
import {
  labelPostCategory,
  isFreeShareListing,
  labelFreeShareMenu,
  labelProductStatus,
} from '@/locale/enUI';
import { useLanguage, type AppMessageKey } from '@/hooks/useLanguage';
import { labelDisputeStoredValue } from '@/utils/disputeLabels';
import { labelReviewTag } from '@/utils/reviewTagLabels';
import { localeForAppLanguage } from '@/utils/languageStorage';
import { ExpandableText } from '@/components/common/ExpandableText';

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

interface PublicDispute {
  id: string;
  order_id: string;
  product_title: string;
  product_image: string;
  proposed_price: number;
  reason: string;
  status: DisputeStatus;
  created_at: string;
  resolved_at?: string;
  opened_by_user_id?: string;
}

type TabKey = 'listings' | 'posts' | 'reviews' | 'disputes';
type DisputeDirectionFilter = 'all' | 'sent' | 'received';
type PostCategoryFilter = PostCategory | 'all';
type ListingFilter = 'all' | 'free' | ProductStatus;

const POST_CATEGORY_TABS: PostCategoryFilter[] = [
  'all',
  POST_CATEGORY_VALUE.QUESTION,
  POST_CATEGORY_VALUE.INFO,
  POST_CATEGORY_VALUE.LOOKING_FOR,
  POST_CATEGORY_VALUE.DISPUTE,
  POST_CATEGORY_VALUE.SWAP,
];

const TAB_ORDER: TabKey[] = ['listings', 'posts', 'reviews', 'disputes'];

const TAB_I18N: Record<TabKey, AppMessageKey> = {
  listings: 'listingsTab',
  posts: 'postsTab',
  reviews: 'reviews',
  disputes: 'disputes',
};

function disputeStatusVariant(status: DisputeStatus): 'warning' | 'success' {
  return status === 'RESOLVED' ? 'success' : 'warning';
}

function buildStarDistribution(reviews: ReviewFromDB[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const review of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    counts[star] += 1;
  }
  return counts;
}

function ReviewSummary({
  avgRating,
  reviews,
  reviewCountLabel,
}: {
  avgRating: number;
  reviews: ReviewFromDB[];
  reviewCountLabel: string;
}) {
  const distribution = buildStarDistribution(reviews);
  const total = reviews.length;

  return (
    <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-stretch gap-0">
        <div className="flex flex-col items-center justify-center shrink-0 w-[88px] pr-4 border-r border-gray-100">
          <span className="text-4xl font-bold text-gray-900 tracking-tight leading-none">
            {avgRating.toFixed(1)}
          </span>
          <p className="mt-2.5 text-xs font-medium text-gray-500">{reviewCountLabel}</p>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2 pl-4">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = distribution[star];
            const widthPct = total > 0 ? (count / total) * 100 : 0;
            const barWidth = count > 0 ? Math.max(widthPct, 6) : 0;
            return (
              <div key={star} className="flex items-center gap-2.5">
                <span className="w-3 text-xs font-semibold text-gray-500 tabular-nums text-right">
                  {star}
                </span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-400 transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-5 text-[11px] text-gray-400 tabular-nums text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const SellerProfile: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>('listings');
  const [seller, setSeller] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postCategoryFilter, setPostCategoryFilter] = useState<PostCategoryFilter>('all');
  const [reviews, setReviews] = useState<ReviewFromDB[]>([]);
  const [disputes, setDisputes] = useState<PublicDispute[]>([]);
  const [disputeFilter, setDisputeFilter] = useState<DisputeDirectionFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [userRes, productsRes, reviewsRes, postsRes, disputesRes] = await Promise.all([
          fetch(`${API_BASE}/api/users/${id}`),
          fetch(`${API_BASE}/api/products?seller_id=${id}`),
          fetch(`${API_BASE}/api/reviews?reviewee_id=${id}`),
          fetch(`${API_BASE}/api/posts?author_id=${encodeURIComponent(id)}`),
          fetch(`${API_BASE}/api/users/${id}/disputes`),
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
        } else {
          setSeller(null);
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
              status: p.status || PRODUCT_STATUS_VALUE.FOR_SALE,
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
        } else {
          setProducts([]);
        }

        if (reviewsRes.ok) {
          setReviews((await reviewsRes.json()) as ReviewFromDB[]);
        } else {
          setReviews([]);
        }

        if (postsRes.ok) {
          const rows = (await postsRes.json()) as Record<string, unknown>[];
          setPosts(rows.map((row) => mapPostFromDB(row)));
        } else {
          setPosts([]);
        }

        if (disputesRes.ok) {
          setDisputes((await disputesRes.json()) as PublicDispute[]);
        } else {
          setDisputes([]);
        }
      } catch (e) {
        console.error('[SellerProfile] load error:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const postCategoryTabLabel = (category: PostCategoryFilter): string => {
    if (category === 'all') return t('chipAll');
    return labelPostCategory(category);
  };

  const disputeStatusLabel = (status: DisputeStatus): string => (
    status === 'RESOLVED' ? t('disputeResolved') : t('disputeActive')
  );

  const reviewCountLabel = (count: number): string => (
    count === 1 ? t('reviewCountOne') : t('reviewCountMany', { n: count })
  );

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
            <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }
        />
        <div className="text-center py-16 text-gray-500">{t('userNotFound')}</div>
      </div>
    );
  }

  const headerImage = resolveProfileAvatarUrl(seller.id, seller.profileImage);
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : seller.rating || 0;

  const filteredDisputes = disputes.filter((dispute) => {
    if (disputeFilter === 'all') return true;
    const isSent = dispute.opened_by_user_id === id;
    return disputeFilter === 'sent' ? isSent : !isSent;
  });

  const filteredPosts =
    postCategoryFilter === 'all'
      ? posts
      : posts.filter((post) => post.category === postCategoryFilter);

  const filteredProducts = (() => {
    if (listingFilter === 'all') return products;
    if (listingFilter === 'free') return products.filter((p) => isFreeShareListing(p));
    return products.filter((p) => p.status === listingFilter);
  })();

  const listingFilterTabs: { value: ListingFilter; label: string }[] = [
    { value: 'all', label: t('chipAll') },
    { value: 'free', label: labelFreeShareMenu() },
    { value: PRODUCT_STATUS_VALUE.FOR_SALE, label: labelProductStatus(PRODUCT_STATUS_VALUE.FOR_SALE) },
    { value: PRODUCT_STATUS_VALUE.RESERVED, label: labelProductStatus(PRODUCT_STATUS_VALUE.RESERVED) },
    { value: PRODUCT_STATUS_VALUE.SOLD, label: labelProductStatus(PRODUCT_STATUS_VALUE.SOLD) },
  ];

  const disputeFilterOptions: { value: DisputeDirectionFilter; label: string }[] = [
    { value: 'all', label: t('chipAll') },
    { value: 'sent', label: t('disputeSent') },
    { value: 'received', label: t('disputeReceived') },
  ];

  return (
    <div className="min-h-screen bg-white pb-6">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
      />

      <div className="bg-white px-5 py-5 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <AvatarWithBadgeOverlay userId={id} sizePx={64}>
            <UserAvatarImage
              src={headerImage}
              alt={seller.nickname}
              iconClassName="w-9 h-9 text-gray-500"
            />
          </AvatarWithBadgeOverlay>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {resolveDisplayNickname(seller.id, seller.nickname)}
              </h1>
            </div>
            <ProfileStatsRow
              variant="ownProfile"
              rating={avgRating}
              tradeCount={id ? getPaidTradeCountByUserId(id) : seller.tradeCount}
              shareCount={id ? getShareCountByUserId(id) : 0}
              disputeCount={disputes.length}
              showDisputes
              ratingAccessory={
                <>
                  <KYCBadge status={seller.kycStatus} userId={seller.id} />
                  {seller.activityRegion && (
                    <span className="min-w-0 truncate text-xs text-gray-500">
                      {seller.activityRegion}
                    </span>
                  )}
                </>
              }
            />
          </div>
        </div>
        {seller.bio && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-sm leading-relaxed text-gray-600">{seller.bio}</p>
          </div>
        )}
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === tab
                ? 'border-b-2'
                : 'text-gray-500'
            }`}
            style={activeTab === tab ? { color: '#00A8A3', borderColor: '#00A8A3' } : undefined}
          >
            {t(TAB_I18N[tab])}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {activeTab === 'listings' && (
          <div>
            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {t('sellerNoListings')}
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1">
                  {listingFilterTabs.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setListingFilter(value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                        listingFilter === value
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      style={listingFilter === value ? { backgroundColor: '#00A8A3' } : undefined}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {t('noListingsInCategory')}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {filteredProducts.map((product) => (
                      <ListingCard
                        key={product.id}
                        product={product}
                        layout="grid"
                        onClick={() => navigate(`/product/${product.id}`)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'posts' && (
          <div>
            {posts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {t('noPostsYet')}
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1">
                  {POST_CATEGORY_TABS.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setPostCategoryFilter(category)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                        postCategoryFilter === category
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      style={postCategoryFilter === category ? { backgroundColor: '#00A8A3' } : undefined}
                    >
                      {postCategoryTabLabel(category)}
                    </button>
                  ))}
                </div>
                {filteredPosts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {t('noPostsInCategory')}
                  </div>
                ) : (
                  <div className="-mx-4">
                    {filteredPosts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            {reviews.length === 0 ? (
              <div className="text-center py-8 text-gray-400">{t('noReviewsYet')}</div>
            ) : (
              <>
                <ReviewSummary
                  avgRating={avgRating}
                  reviews={reviews}
                  reviewCountLabel={reviewCountLabel(reviews.length)}
                />
                <div className="space-y-4">
                  {reviews.map((review) => (
                  <div key={review.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {review.reviewer?.nickname || t('anonymous')}
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
                            {labelReviewTag(tag, lang)}
                          </span>
                        ))}
                      </div>
                    )}
                    {review.comment && (
                      <ExpandableText text={review.comment} className="text-sm text-gray-700" />
                    )}
                  </div>
                ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'disputes' && (
          <div>
            {disputes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {t('noDisputes')}
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-4 overflow-x-auto">
                  {disputeFilterOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDisputeFilter(value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                        disputeFilter === value
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      style={disputeFilter === value ? { backgroundColor: '#00A8A3' } : undefined}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filteredDisputes.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {t('noDisputesInCategory')}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDisputes.map((dispute) => {
                  const isSent = dispute.opened_by_user_id === id;
                  const directionLabel = isSent ? t('disputeSent') : t('disputeReceived');
                  return (
                    <div
                      key={dispute.id}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex gap-3 mb-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                          <img
                            src={dispute.product_image || '/placeholder.jpg'}
                            alt={dispute.product_title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {dispute.product_title}
                            </h3>
                            <Badge variant={disputeStatusVariant(dispute.status)}>
                              {disputeStatusLabel(dispute.status)}
                            </Badge>
                          </div>
                          <p className="text-base font-bold text-gray-900 mb-1">
                            {Number(dispute.proposed_price).toLocaleString()} Pi
                          </p>
                          <p className="text-xs text-gray-600">
                            {t('reasonLabel')} {labelDisputeStoredValue(lang, dispute.reason)}
                          </p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-100 text-xs text-gray-500">
                        <span className={isSent ? 'text-gray-700 font-medium' : 'text-amber-700 font-medium'}>
                          {directionLabel}
                        </span>
                        {' · '}
                        {new Date(dispute.created_at).toLocaleDateString(localeForAppLanguage(lang))}
                      </div>
                    </div>
                  );
                })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
