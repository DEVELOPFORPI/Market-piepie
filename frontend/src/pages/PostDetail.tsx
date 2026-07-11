import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { BottomSheet } from '@/components/common/BottomSheet';
import { ReportModal } from '@/components/common/ReportModal';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { SellerMiniCard } from '@/components/common/SellerMiniCard';
import { Post, Comment } from '@/types';
import { maskSensitiveContent } from '@/utils/contentFilter';
import { ensurePostById, deleteUserPost, getCommentsByPostId, addComment, deleteComment, buildCommentTree } from '@/utils/communityStorage';
import { getMyUser, resolveDisplayNickname, resolveProfileAvatarUrl } from '@/utils/profileStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { getPostLikeCount, isPostLiked, togglePostLike, syncPostLikeFromDB } from '@/utils/postLikeStorage';
import { syncCommentsFromDB } from '@/utils/dbSync';
import { getDisputeVoteCounts, getMyDisputeVote, setDisputeVote, syncDisputeVotesFromDB } from '@/utils/disputePostVoteStorage';
import { getPostViewCount, incrementPostViewCount } from '@/utils/postViewStorage';
import { getPostCommentCount, syncPostCommentCountFromDB } from '@/utils/postCommentCountStorage';
import { getDisputeByOrderId, getDisputeByPostId, ensureDisputeByOrderId } from '@/utils/disputeStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { POST_CATEGORY_VALUE } from '@/types';
import { labelPostCategory, relativeTimeShort, labelCommentReply } from '@/locale/enUI';
import { guestGuard } from '@/utils/guestGate';
import { useDismissOnClickOutside } from '@/hooks/useDismissOnClickOutside';

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
}> = ({ items, depth = 0, parentAuthorNickname, onReply, onOpenMenu, onAuthorClick, timeAgo }) => (
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
            aria-label={`View ${displayName}'s profile`}
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
                aria-label="Comment options"
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
              {labelCommentReply()}
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
  const [post, setPost] = useState<Post | null>(null);
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
  const [disputeVoteCounts, setDisputeVoteCounts] = useState({ likeCount: 0, dislikeCount: 0 });
  const [myDisputeVote, setMyDisputeVote] = useState<'like' | 'dislike' | null>(null);
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
  /** Seller cannot edit/delete dispute post while dispute is open */
  const isSellerBlockedFromEdit =
    isDisputePost &&
    !!post?.orderId &&
    linkedDisputeStatus !== undefined &&
    linkedDisputeStatus !== 'RESOLVED' &&
    linkedDispute?.sellerId === getCurrentUserId();
  /** Auto-created dispute posts (dispute + orderId) cannot be edited or deleted */
  const isAutoCreatedDisputePost = isDisputePost && !!post?.orderId;
  const canEditOrDeletePost = isMine && !isSellerBlockedFromEdit && !isAutoCreatedDisputePost;

  useEffect(() => {
    if (id) {
      setLiked(isPostLiked(id));
      setLikeCount(getPostLikeCount(id));
      // DB에서 최신 좋아요 상태/개수 동기화 (다른 유저가 누른 좋아요 반영)
      syncPostLikeFromDB(id);
    }
  }, [id]);

  useEffect(() => {
    const onLikesChanged = () => {
      if (id) {
        setLiked(isPostLiked(id));
        setLikeCount(getPostLikeCount(id));
      }
    };
    window.addEventListener('postLikesChanged', onLikesChanged);
    return () => window.removeEventListener('postLikesChanged', onLikesChanged);
  }, [id]);

  useEffect(() => {
    if (id && isDisputePost) {
      setDisputeVoteCounts(getDisputeVoteCounts(id));
      setMyDisputeVote(getMyDisputeVote(id));
      void syncDisputeVotesFromDB(id);
    }
  }, [id, isDisputePost]);

  useEffect(() => {
    const onDisputeVotesChanged = () => {
      if (id) {
        setDisputeVoteCounts(getDisputeVoteCounts(id));
        setMyDisputeVote(getMyDisputeVote(id));
      }
    };
    window.addEventListener('disputePostVotesChanged', onDisputeVotesChanged);
    return () => window.removeEventListener('disputePostVotesChanged', onDisputeVotesChanged);
  }, [id]);

  const loadPost = async () => {
    if (!id) return;
    const found = await ensurePostById(id);
    if (found) {
      setPost(found);
      if (found.orderId) {
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
    if (confirm('Delete this comment?')) {
      deleteComment(id, commentId);
      loadComments();
      loadPost();
    }
  };

  const handleDeletePost = () => {
    if (!post) return;
    if (post.category === POST_CATEGORY_VALUE.DISPUTE && post.orderId) {
      alert('Posts created from a trade dispute cannot be deleted.');
      return;
    }
    if (confirm(`Delete "${post.title}"?`)) {
      deleteUserPost(post.id);
      navigate('/community', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <p className="text-gray-600">Loading…</p>
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
          title="Post"
        />
        <div className="text-center py-12 text-gray-500">Post not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        title="Post"
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        rightContent={
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
                {post.category === POST_CATEGORY_VALUE.DISPUTE && post.orderId && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      navigate(`/dispute/${post.orderId}`);
                    }}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                  >
                    Dispute details
                  </button>
                )}
                {canEditOrDeletePost && (
                  <>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        navigate(`/community/edit/${post.id}`);
                      }}
                      className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleDeletePost();
                      }}
                      className="w-full px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50"
                    >
                      Delete
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
                    Report
                  </button>
                )}
              </div>
            )}
          </div>
        }
      />

      <div className="px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium rounded" style={{ backgroundColor: '#00A8A3', color: 'white' }}>
            {labelPostCategory(post.category)}
          </span>
          {post.region && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
              {post.region}
            </span>
          )}
          {!isGeneralPost && post.tags && post.tags.map((tag, idx) => (
            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
              #{tag}
            </span>
          ))}
        </div>

        {/* Author Card */}
        <div className="rounded-lg">
          <SellerMiniCard
            seller={post.author}
            onClick={() => goToUserProfile(post.author.id)}
          />
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-gray-900">{post.title}</h1>

        {/* Content */}
        <div className="max-w-none">
          <p className={`whitespace-pre-line leading-relaxed ${isGeneralPost ? 'text-base text-gray-600' : 'text-sm text-gray-700'}`}>
            {maskSensitiveContent(post.content)}
          </p>
        </div>

        {post.category === POST_CATEGORY_VALUE.DISPUTE && post.orderId && (
          <div className={`p-4 rounded-lg border ${linkedDisputeStatus === 'RESOLVED' ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
            {linkedDisputeStatus === 'RESOLVED' ? (
              <p className="text-sm font-medium text-green-800 mb-2">This dispute is resolved.</p>
            ) : (
              <p className="text-sm text-gray-700 mb-2">This post was created when a dispute was filed. Share your view in the comments.</p>
            )}
            <button
              onClick={() => navigate(`/dispute/${post.orderId}`)}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium ${linkedDisputeStatus === 'RESOLVED' ? 'border border-green-300 text-green-700 hover:bg-green-50' : 'border border-red-300 text-red-700 hover:bg-red-50'}`}
            >
              Open dispute
            </button>
          </div>
        )}

        {isDisputePost && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void setDisputeVote(post.id, 'like')}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 transition-all ${
                myDisputeVote === 'like'
                  ? 'border-green-500 bg-green-50 text-green-600'
                  : 'border-gray-200 bg-gray-50/80 text-gray-500 hover:border-green-300 hover:bg-green-50/50'
              }`}
              aria-label="Agree — dispute seems valid"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <span className="text-sm font-semibold">Up</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${myDisputeVote === 'like' ? 'bg-green-200/60 text-green-700' : 'bg-gray-200/60 text-gray-600'}`}>
                {disputeVoteCounts.likeCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void setDisputeVote(post.id, 'dislike')}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 transition-all ${
                myDisputeVote === 'dislike'
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : 'border-gray-200 bg-gray-50/80 text-gray-500 hover:border-red-300 hover:bg-red-50/50'
              }`}
              aria-label="Disagree — dispute seems unfair"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
              <span className="text-sm font-semibold">Down</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${myDisputeVote === 'dislike' ? 'bg-red-200/60 text-red-700' : 'bg-gray-200/60 text-gray-600'}`}>
                {disputeVoteCounts.dislikeCount}
              </span>
            </button>
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

        {/* Attached Product */}
        {post.attachedProduct && (
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Attached listing</h3>
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
                    ? '🎁 Free'
                    : `${post.attachedProduct.price.toLocaleString()} Pi`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-200 text-xs text-gray-400">
          <span>{relativeTimeShort(post.createdAt)}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (guestGuard('like')) return;
                void togglePostLike(post.id);
              }}
              className="flex items-center gap-1.5 text-sm"
              aria-label="Like"
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
            <span className="flex items-center gap-1 text-gray-500">
              <img src="/post/chat.svg" alt="" className="w-4 h-4" />
              {commentCount}
            </span>
            <span className="text-gray-500">{viewCount} views</span>
          </div>
        </div>

        {/* Comments Section */}
        <div className={`space-y-4 overflow-x-hidden ${isGeneralPost ? 'pt-2' : ''}`}>
          <h3 className="text-lg font-semibold text-gray-900">Comments ({commentCount})</h3>

          {comments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No comments yet.</p>
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
              timeAgo={relativeTimeShort}
            />
          )}
        </div>
      </div>

      {/* Comment Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        {replyingToNickname && (
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Replying to @{replyingToNickname}</span>
            <button
              type="button"
              onClick={() => { setReplyingToId(null); setReplyingToNickname(null); }}
              className="text-gray-400 hover:text-gray-600"
            >
              Cancel
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
            placeholder={replyingToNickname ? `Reply to @${replyingToNickname}` : 'Write a comment'}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
          <button
            onClick={handleSubmitComment}
            disabled={!commentText.trim()}
            className="px-4 py-2 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            style={commentText.trim() ? { backgroundColor: '#00A8A3' } : undefined}
          >
            Post
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
              Delete
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
              Report
            </button>
          )}
          <button
            type="button"
            onClick={() => setCommentMenuTarget(null)}
            className="w-full px-4 py-4 text-center text-base text-gray-500"
          >
            Cancel
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
