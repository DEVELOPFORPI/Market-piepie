import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { BottomSheet } from '@/components/common/BottomSheet';
import { ReportModal } from '@/components/common/ReportModal';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';
import { Comment, Post, User, POST_CATEGORY_VALUE } from '@/types';
import { maskSensitiveContent } from '@/utils/contentFilter';
import { ensurePostById, deleteUserPost, getCommentsByPostId, addComment, deleteComment, buildCommentTree } from '@/utils/communityStorage';
import { getMyUser, resolveDisplayNickname, resolveProfileAvatarUrl } from '@/utils/profileStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { getPostLikeCount, isPostLiked, togglePostLike, syncPostLikeFromDB } from '@/utils/postLikeStorage';
import { syncCommentsFromDB } from '@/utils/dbSync';
import { getPostViewCount, incrementPostViewCount } from '@/utils/postViewStorage';
import { getPostCommentCount, syncPostCommentCountFromDB } from '@/utils/postCommentCountStorage';
import { getDisputeByOrderId, getDisputeByPostId, ensureDisputeByOrderId } from '@/utils/disputeStorage';
import { ensureOrderById, getOrderById } from '@/utils/orderStorage';
import { getProductById } from '@/utils/productStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { guestGuard } from '@/utils/guestGate';
import { useDismissOnClickOutside } from '@/hooks/useDismissOnClickOutside';
import { useLanguage, type AppMessageKey } from '@/hooks/useLanguage';
import { useLocalizedRegion } from '@/hooks/useLocalizedRegion';
import { labelDisputeStoredValue, localizeDisputePostTitle } from '@/utils/disputeLabels';

const CAT_KEY: Record<string, AppMessageKey> = {
  [POST_CATEGORY_VALUE.QUESTION]: 'catQuestion',
  [POST_CATEGORY_VALUE.INFO]: 'catInfo',
  [POST_CATEGORY_VALUE.LOOKING_FOR]: 'catLookingFor',
  [POST_CATEGORY_VALUE.DISPUTE]: 'catDispute',
  [POST_CATEGORY_VALUE.SWAP]: 'catSwap',
};

function relativeTimeLabel(
  isoDate: string,
  t: (key: AppMessageKey, vars?: Record<string, string | number>) => string,
): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return t('justNow');
  if (diff < 60) return t('minutesAgo', { n: diff });
  if (diff < 1440) return t('hoursAgo', { n: Math.floor(diff / 60) });
  return t('daysAgo', { n: Math.floor(diff / 1440) });
}

function minimalUser(id: string, nickname: string): User {
  return {
    id,
    nickname,
    kycStatus: 'unverified',
    trustScore: 0,
    rating: 0,
    tradeCount: 0,
  };
}

/** Parse auto-generated dispute post body into reason/details for display. */
function parseDisputePostContent(content: string): { reason?: string; details?: string; action?: string } {
  const reasonMatch = content.match(/^Reason:\s*(.+)$/m);
  const actionMatch = content.match(/^Requested action:\s*(.+)$/m);
  const detailsMatch = content.match(/\nDetails:\s*\n([\s\S]*)$/);
  return {
    reason: reasonMatch?.[1]?.trim() || undefined,
    action: actionMatch?.[1]?.trim() || undefined,
    details: detailsMatch?.[1]?.trim() || undefined,
  };
}

const MAX_REPLY_INDENT_DEPTH = 1;
const REPLY_INDENT_REM = 2.5;

const CommentTree: React.FC<{
  items: Comment[];
  depth?: number;
  parentAuthorNickname?: string;
  onReply: (commentId: string, nickname: string) => void;
  onOpenMenu: (comment: Comment) => void;
  onAuthorClick: (authorId: string) => void;
  timeAgo: (createdAt: string) => string;
  replyLabel: string;
  commentOptionsAria: string;
}> = ({ items, depth = 0, parentAuthorNickname, onReply, onOpenMenu, onAuthorClick, timeAgo, replyLabel, commentOptionsAria }) => (
  <>
    {items.map((c) => {
      const displayName = resolveDisplayNickname(c.author.id, c.author.nickname);
      const isReply = depth > 0;
      const indentDeltaRem = depth === 1 ? REPLY_INDENT_REM : 0;
      const showReplyTarget = isReply && depth > MAX_REPLY_INDENT_DEPTH && !!parentAuthorNickname;

      return (
      <div
        key={c.id}
        className={isReply ? 'mt-3 min-w-0' : 'py-3 border-b border-gray-50 last:border-b-0 min-w-0'}
        style={isReply && indentDeltaRem > 0 ? { marginLeft: `${indentDeltaRem}rem` } : undefined}
      >
        <div className="flex gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onAuthorClick(c.author.id)}
            className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0"
            aria-label={displayName}
          >
            <UserAvatarImage
              src={resolveProfileAvatarUrl(c.author.id, c.author.profileImage)}
              alt={displayName}
              iconClassName="w-4 h-4 text-gray-500"
            />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onAuthorClick(c.author.id)}
                    className="text-sm font-semibold text-gray-900 truncate text-left hover:underline"
                  >
                    {displayName}
                  </button>
                  {showReplyTarget && (
                    <span className="text-xs text-gray-500 truncate">
                      @{parentAuthorNickname}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(c.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenMenu(c)}
                className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                aria-label={commentOptionsAria}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap break-words">
              {maskSensitiveContent(c.content)}
            </p>
            <button
              type="button"
              onClick={() => onReply(c.id, c.author.nickname)}
              className="text-xs text-gray-500 hover:text-[#00A8A3] mt-2"
            >
              {replyLabel}
            </button>
          </div>
        </div>
        {c.replies && c.replies.length > 0 && (
          <CommentTree
            items={c.replies}
            depth={depth + 1}
            parentAuthorNickname={displayName}
            onReply={onReply}
            onOpenMenu={onOpenMenu}
            onAuthorClick={onAuthorClick}
            timeAgo={timeAgo}
            replyLabel={replyLabel}
            commentOptionsAria={commentOptionsAria}
          />
        )}
      </div>
      );
    })}
  </>
);

export const PostDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { lang, t } = useLanguage();
  const [post, setPost] = useState<Post | null>(null);
  const localizedRegion = useLocalizedRegion(post?.region, post?.latitude, post?.longitude);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const postMenuRef = useRef<HTMLDivElement>(null);
  useDismissOnClickOutside(postMenuRef, showMenu, () => setShowMenu(false));
  const [commentMenuTarget, setCommentMenuTarget] = useState<Comment | null>(null);
  const [commentReportTarget, setCommentReportTarget] = useState<Comment | null>(null);
  const [showCommentReport, setShowCommentReport] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyingToNickname, setReplyingToNickname] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [linkedDisputeStatus, setLinkedDisputeStatus] = useState<string | undefined>(undefined);

  const isMine = post?.author.id === getCurrentUserId();
  const currentUserId = getCurrentUserId();
  const isMineComment = (authorId: string) => authorId === currentUserId;
  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const goToUserProfile = (userId: string) => {
    if (!userId) return;
    navigate(`/seller/${userId}`);
  };
  const isDisputePost = post?.category === POST_CATEGORY_VALUE.DISPUTE;
  const isGeneralPost = !isDisputePost;
  const linkedDispute = post
    ? getDisputeByPostId(post.id) ?? (post.orderId ? getDisputeByOrderId(post.orderId) : undefined)
    : undefined;

  const disputeParties = useMemo(() => {
    if (!post || !isDisputePost || !linkedDispute) return null;
    const openerId = linkedDispute.openedByUserId || post.author.id;
    const otherId =
      openerId === linkedDispute.buyerId ? linkedDispute.sellerId : linkedDispute.buyerId;
    if (!openerId || !otherId || openerId === otherId) return null;

    const order = linkedDispute.orderId ? getOrderById(linkedDispute.orderId) : undefined;
    const openerFromOrder =
      order && (order.buyer.id === openerId ? order.buyer : order.seller.id === openerId ? order.seller : null);
    const otherFromOrder =
      order && (order.buyer.id === otherId ? order.buyer : order.seller.id === otherId ? order.seller : null);

    const opener =
      openerFromOrder ||
      (post.author.id === openerId
        ? post.author
        : minimalUser(
            openerId,
            openerId === linkedDispute.buyerId
              ? linkedDispute.buyerNickname
              : linkedDispute.sellerNickname,
          ));
    const otherParty =
      otherFromOrder ||
      minimalUser(
        otherId,
        otherId === linkedDispute.buyerId
          ? linkedDispute.buyerNickname
          : linkedDispute.sellerNickname,
      );

    return { opener, otherParty };
  }, [
    post,
    isDisputePost,
    linkedDispute?.id,
    linkedDispute?.openedByUserId,
    linkedDispute?.buyerId,
    linkedDispute?.sellerId,
    linkedDispute?.buyerNickname,
    linkedDispute?.sellerNickname,
    linkedDispute?.orderId,
  ]);

  const linkedOrder = post?.orderId ? getOrderById(post.orderId) : undefined;
  const linkedListing =
    post?.attachedProduct ||
    linkedOrder?.product ||
    (linkedOrder?.product?.id ? getProductById(linkedOrder.product.id) : undefined) ||
    (linkedDispute
      ? {
          id: linkedOrder?.product?.id || '',
          title: linkedDispute.productTitle,
          price: linkedDispute.proposedPrice,
          images: [linkedDispute.productImage || '/placeholder.jpg'],
          isFreeShare: linkedDispute.proposedPrice === 0,
        }
      : undefined);
  const isDisputeParty = Boolean(
    currentUserId &&
      linkedDispute &&
      (currentUserId === linkedDispute.buyerId || currentUserId === linkedDispute.sellerId),
  );
  /** Auto-created dispute posts (dispute + orderId) cannot be edited or deleted */
  const isAutoCreatedDisputePost = isDisputePost && !!post?.orderId;
  const disputeBodySummary =
    isAutoCreatedDisputePost && post
      ? parseDisputePostContent(post.content)
      : null;
  const disputePath =
    post?.orderId && linkedDispute && currentUserId
      ? currentUserId === linkedDispute.openedByUserId
        ? `/dispute/${post.orderId}`
        : `/dispute/${post.orderId}?view=other`
      : post?.orderId
        ? `/dispute/${post.orderId}`
        : undefined;

  /** Seller cannot edit/delete dispute post while dispute is open */
  const isSellerBlockedFromEdit =
    isDisputePost &&
    !!post?.orderId &&
    linkedDisputeStatus !== undefined &&
    linkedDisputeStatus !== 'RESOLVED' &&
    linkedDispute?.sellerId === getCurrentUserId();
  const canEditOrDeletePost = isMine && !isSellerBlockedFromEdit && !isAutoCreatedDisputePost;

  useEffect(() => {
    if (id && !isDisputePost) {
      setLiked(isPostLiked(id));
      setLikeCount(getPostLikeCount(id));
      // DB에서 최신 좋아요 상태/개수 동기화 (다른 유저가 누른 좋아요 반영)
      syncPostLikeFromDB(id);
    }
  }, [id, isDisputePost]);

  useEffect(() => {
    const onLikesChanged = () => {
      if (id && !isDisputePost) {
        setLiked(isPostLiked(id));
        setLikeCount(getPostLikeCount(id));
      }
    };
    window.addEventListener('postLikesChanged', onLikesChanged);
    return () => window.removeEventListener('postLikesChanged', onLikesChanged);
  }, [id, isDisputePost]);

  const loadPost = async () => {
    if (!id) return;
    const found = await ensurePostById(id);
    if (found) {
      setPost(found);
      if (found.orderId) {
        await ensureOrderById(found.orderId);
        await ensureDisputeByOrderId(found.orderId);
        const dispute = getDisputeByPostId(found.id) ?? getDisputeByOrderId(found.orderId);
        setLinkedDisputeStatus(dispute?.status);
      } else {
        setLinkedDisputeStatus(undefined);
      }
    } else {
      setPost(null);
    }
    setLoading(false);
  };

  const loadComments = () => {
    if (id) setComments(getCommentsByPostId(id));
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadPost();
    loadComments();
    // DB에서 최신 댓글·댓글 수 동기화
    syncCommentsFromDB(id).then(() => {
      loadComments();
      if (id) setCommentCount(getPostCommentCount(id));
    });
    void syncPostCommentCountFromDB(id);

    const onPostsChanged = () => { void loadPost(); };
    window.addEventListener('commentsChanged', loadComments);
    window.addEventListener('postsChanged', onPostsChanged);
    return () => {
      window.removeEventListener('commentsChanged', loadComments);
      window.removeEventListener('postsChanged', onPostsChanged);
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setViewCount(getPostViewCount(id));
    void incrementPostViewCount(id).then(setViewCount);
  }, [id]);

  useEffect(() => {
    const onViewCountsChanged = () => {
      if (id) setViewCount(getPostViewCount(id));
    };
    window.addEventListener('postViewCountsChanged', onViewCountsChanged);
    return () => window.removeEventListener('postViewCountsChanged', onViewCountsChanged);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setCommentCount(getPostCommentCount(id));
    const onCommentCountsChanged = () => {
      setCommentCount(getPostCommentCount(id));
    };
    window.addEventListener('postCommentCountsChanged', onCommentCountsChanged);
    return () => window.removeEventListener('postCommentCountsChanged', onCommentCountsChanged);
  }, [id]);

  const handleSubmitComment = () => {
    if (guestGuard('comment')) return;
    if (!commentText.trim() || !id) return;

    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      author: getMyUser(),
      content: commentText.trim(),
      createdAt: new Date().toISOString(),
      ...(replyingToId && { parentId: replyingToId }),
    };

    addComment(id, newComment);
    setCommentText('');
    setReplyingToId(null);
    setReplyingToNickname(null);
    loadComments();
    loadPost();
  };

  const handleDeleteComment = (commentId: string) => {
    if (!id) return;
    if (confirm(t('deleteCommentConfirm'))) {
      deleteComment(id, commentId);
      loadComments();
      loadPost();
    }
  };

  const handleDeletePost = () => {
    if (!post) return;
    if (post.category === POST_CATEGORY_VALUE.DISPUTE && post.orderId) {
      alert(t('cannotDeleteDispute'));
      return;
    }
    if (confirm(t('deletePostConfirm', { title: post.title }))) {
      deleteUserPost(post.id);
      navigate('/community', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <p className="text-gray-600">{t('loading')}</p>
      </div>
    );
  }

  if (!post) {
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
          title={t('postDetailTitle')}
        />
        <div className="text-center py-12 text-gray-500">{t('postNotFound')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        title={t('postDetailTitle')}
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        rightContent={isDisputePost ? undefined : (
          <div ref={postMenuRef} className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                {canEditOrDeletePost && (
                  <>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        navigate(`/community/edit/${post.id}`);
                      }}
                      className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleDeletePost();
                      }}
                      className="w-full px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50"
                    >
                      {t('delete')}
                    </button>
                  </>
                )}
                {!isMine && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      if (guestGuard('report')) return;
                      setShowReport(true);
                    }}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                  >
                    {t('report')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      />

      <div className="px-4 py-6 space-y-6">
        {isDisputePost ? (
          <h1 className="text-xl font-bold text-gray-900">
            {localizeDisputePostTitle(lang, post.title, t('catDispute'))}
          </h1>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 text-xs font-medium rounded" style={{ backgroundColor: '#00A8A3', color: 'white' }}>
              {t(CAT_KEY[post.category] ?? 'catInfo')}
            </span>
            {localizedRegion && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                {localizedRegion}
              </span>
            )}
            {post.tags && post.tags.map((tag, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Author / dispute parties — dual cards only for linked dispute posts */}
        {disputeParties ? (
          <div className="space-y-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">{t('disputeFiledBy')}</p>
              <SellerMiniCard
                seller={disputeParties.opener}
                onClick={() => goToUserProfile(disputeParties.opener.id)}
              />
            </div>
            <div className="flex items-center gap-3 px-1 py-1">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{t('disputeWith')}</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">{t('disputeOtherParty')}</p>
              <SellerMiniCard
                seller={disputeParties.otherParty}
                onClick={() => goToUserProfile(disputeParties.otherParty.id)}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg">
            <SellerMiniCard
              seller={post.author}
              onClick={() => goToUserProfile(post.author.id)}
            />
          </div>
        )}

        {!isDisputePost && (
          <h1 className="text-xl font-bold text-gray-900">{post.title}</h1>
        )}

        {/* Content — auto dispute posts use listing card + short reason instead of raw key/value body */}
        {isAutoCreatedDisputePost ? (
          <div className="space-y-3">
            {linkedListing && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">{t('disputeLinkedListing')}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (linkedListing.id) navigate(`/product/${linkedListing.id}`);
                  }}
                  disabled={!linkedListing.id}
                  className="w-full flex gap-3 p-3 border border-gray-200 rounded-lg text-left hover:bg-gray-50 disabled:opacity-60 disabled:cursor-default"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    <img
                      src={getDisplayImageUrl(linkedListing.images?.[0] || '/placeholder.jpg')}
                      alt={linkedListing.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 mb-1 truncate">{linkedListing.title}</h4>
                    <p className="text-base font-bold text-gray-900">
                      {linkedListing.isFreeShare || linkedListing.price === 0
                        ? t('free')
                        : `${Number(linkedListing.price).toLocaleString()} Pi`}
                    </p>
                  </div>
                </button>
              </div>
            )}
            {(disputeBodySummary?.reason || linkedDispute?.reason) && (
              <div className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">{t('disputeReason')}: </span>
                {labelDisputeStoredValue(lang, disputeBodySummary?.reason || linkedDispute?.reason)}
              </div>
            )}
            {disputeBodySummary?.action && (
              <div className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">{t('requestedAction')}: </span>
                {labelDisputeStoredValue(lang, disputeBodySummary.action)}
              </div>
            )}
            {disputeBodySummary?.details && (
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-900 mb-1">{t('disputeDetails')}</p>
                <p className="whitespace-pre-line text-gray-600">{maskSensitiveContent(disputeBodySummary.details)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-none">
            <p className={`whitespace-pre-line leading-relaxed ${isGeneralPost ? 'text-base text-gray-600' : 'text-sm text-gray-700'}`}>
              {maskSensitiveContent(post.content)}
            </p>
          </div>
        )}

        {isAutoCreatedDisputePost && (
          <div className={`p-4 rounded-lg border ${linkedDisputeStatus === 'RESOLVED' ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
            {linkedDisputeStatus === 'RESOLVED' ? (
              <p className={`text-sm font-medium ${isDisputeParty ? 'mb-2' : ''} text-green-800`}>
                {t('disputePostResolved')}
              </p>
            ) : (
              <p className={`text-sm text-gray-700 ${isDisputeParty ? 'mb-2' : ''}`}>
                {t('disputeShareView')}
              </p>
            )}
            {isDisputeParty && disputePath && (
              <button
                type="button"
                onClick={() => navigate(disputePath)}
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium ${
                  linkedDisputeStatus === 'RESOLVED'
                    ? 'border border-green-300 text-green-700 hover:bg-green-50'
                    : 'border border-red-300 text-red-700 hover:bg-red-50'
                }`}
              >
                {t('disputeView')}
              </button>
            )}
          </div>
        )}

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <div className="space-y-2">
            {post.images.map((img, idx) => (
              <div key={idx} className="w-full rounded-lg overflow-hidden bg-gray-200">
                <img src={getDisplayImageUrl(img)} alt={`Post image ${idx + 1}`} className="w-full h-auto object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Attached Product — skip if already shown as dispute linked listing */}
        {post.attachedProduct && !isAutoCreatedDisputePost && (
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('attachedListing')}</h3>
            <div
              onClick={() => navigate(`/product/${post.attachedProduct!.id}`)}
              className="flex gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
            >
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={getDisplayImageUrl(post.attachedProduct.images[0])}
                  alt={post.attachedProduct.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 mb-1">{post.attachedProduct.title}</h4>
                <p className="text-base font-bold text-gray-900">
                  {post.attachedProduct.isFreeShare || post.attachedProduct.price === 0
                    ? t('free')
                    : `${post.attachedProduct.price.toLocaleString()} Pi`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-200 text-xs text-gray-400">
          <span>{relativeTimeLabel(post.createdAt, t)}</span>
          <div className="flex items-center gap-3">
            {!isDisputePost && (
              <button
                type="button"
                onClick={() => {
                  if (guestGuard('like')) return;
                  void togglePostLike(post.id);
                }}
                className="flex items-center gap-1.5 text-sm"
                aria-label={t('likeAria')}
              >
                <svg
                  className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                  fill={liked ? 'currentColor' : 'none'}
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
                <span className={liked ? 'text-red-500 font-medium text-xs' : 'text-gray-500 text-xs'}>{likeCount}</span>
              </button>
            )}
            <span className="flex items-center gap-1 text-gray-500">
              <img src="/post/chat.svg" alt="" className="w-4 h-4" />
              {commentCount}
            </span>
            <span className="text-gray-500">{t('viewsCount', { n: viewCount })}</span>
          </div>
        </div>

        {/* Comments Section */}
        <div className={`space-y-4 overflow-x-hidden ${isGeneralPost ? 'pt-2' : ''}`}>
          <h3 className="text-lg font-semibold text-gray-900">{t('commentsCount', { n: commentCount })}</h3>

          {comments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('noCommentsYet')}</p>
          ) : (
            <CommentTree
              items={commentTree}
              onReply={(commentId, nickname) => {
                if (guestGuard('comment')) return;
                setReplyingToId(commentId);
                setReplyingToNickname(nickname);
              }}
              onOpenMenu={setCommentMenuTarget}
              onAuthorClick={goToUserProfile}
              timeAgo={(createdAt) => relativeTimeLabel(createdAt, t)}
              replyLabel={t('reply')}
              commentOptionsAria={t('commentOptions')}
            />
          )}
        </div>
      </div>

      {/* Comment Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        {replyingToNickname && (
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{t('replyingTo', { name: replyingToNickname })}</span>
            <button
              type="button"
              onClick={() => { setReplyingToId(null); setReplyingToNickname(null); }}
              className="text-gray-400 hover:text-gray-600"
            >
              {t('cancel')}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onFocus={() => { guestGuard('comment'); }}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
            placeholder={
              replyingToNickname
                ? t('replyToPlaceholder', { name: replyingToNickname })
                : t('writeComment')
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
          <button
            onClick={handleSubmitComment}
            disabled={!commentText.trim()}
            className="px-4 py-2 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            style={commentText.trim() ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {t('postComment')}
          </button>
        </div>
      </div>

      <BottomSheet
        isOpen={!!commentMenuTarget}
        onClose={() => setCommentMenuTarget(null)}
        height="auto"
      >
        <div className="py-2">
          {commentMenuTarget && isMineComment(commentMenuTarget.author.id) ? (
            <button
              type="button"
              onClick={() => {
                const targetId = commentMenuTarget.id;
                setCommentMenuTarget(null);
                handleDeleteComment(targetId);
              }}
              className="w-full px-4 py-4 text-center text-base text-red-500 border-b border-gray-100"
            >
              {t('delete')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (guestGuard('report')) return;
                setCommentReportTarget(commentMenuTarget);
                setCommentMenuTarget(null);
                setShowCommentReport(true);
              }}
              className="w-full px-4 py-4 text-center text-base text-gray-900 border-b border-gray-100"
            >
              {t('report')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCommentMenuTarget(null)}
            className="w-full px-4 py-4 text-center text-base text-gray-500"
          >
            {t('cancel')}
          </button>
        </div>
      </BottomSheet>

      {/* Report Modal */}
      {post && (
        <ReportModal
          open={showReport}
          onClose={() => setShowReport(false)}
          targetType="post"
          targetId={post.id}
          targetLabel={post.title}
        />
      )}
      {commentReportTarget && (
        <ReportModal
          open={showCommentReport}
          onClose={() => {
            setShowCommentReport(false);
            setCommentReportTarget(null);
          }}
          targetType="comment"
          targetId={commentReportTarget.id}
          targetLabel={commentReportTarget.content.slice(0, 80)}
        />
      )}
    </div>
  );
};
