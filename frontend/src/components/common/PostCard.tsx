import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Post, PostCategory, POST_CATEGORY_VALUE } from '@/types';
import { labelPostCategory, relativeTimeShort } from '@/locale/enUI';
import { getPostLikeCount, isPostLiked, togglePostLike, syncPostLikeFromDB } from '@/utils/postLikeStorage';
import { getPostViewCount } from '@/utils/postViewStorage';
import { getDisputeByOrderId } from '@/utils/disputeStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { AvatarWithBadgeOverlay } from './AvatarWithBadgeOverlay';
import { resolveProfileAvatarUrl, resolveDisplayNickname } from '@/utils/profileStorage';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';

interface PostCardProps {
  post: Post;
  onClick?: () => void;
}

const categoryColor: Record<PostCategory, string> = {
  [POST_CATEGORY_VALUE.QUESTION]: '#6366f1',
  [POST_CATEGORY_VALUE.INFO]: '#0ea5e9',
  [POST_CATEGORY_VALUE.LOOKING_FOR]: '#ec4899',
  [POST_CATEGORY_VALUE.DISPUTE]: '#ef4444',
  [POST_CATEGORY_VALUE.SWAP]: '#00A8A3',
};

export const PostCard: React.FC<PostCardProps> = ({ post, onClick }) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(isPostLiked(post.id));
  const [likeCount, setLikeCount] = useState(getPostLikeCount(post.id));

  useEffect(() => {
    setLiked(isPostLiked(post.id));
    setLikeCount(getPostLikeCount(post.id));
    // DB에서 최신 좋아요 상태 동기화(다른 유저가 누른 좋아요 반영)
    syncPostLikeFromDB(post.id);
  }, [post.id]);

  useEffect(() => {
    const onLikesChanged = () => {
      setLiked(isPostLiked(post.id));
      setLikeCount(getPostLikeCount(post.id));
    };
    window.addEventListener('postLikesChanged', onLikesChanged);
    return () => window.removeEventListener('postLikesChanged', onLikesChanged);
  }, [post.id]);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // togglePostLike는 내부에서 postLikesChanged 이벤트를 발생시킴
    void togglePostLike(post.id);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/community/post/${post.id}`);
    }
  };

  const color = categoryColor[post.category] || '#6b7280';
  const hasImage = post.images && post.images.length > 0;
  const authorAvatarSrc =
    post.author.id != null
      ? resolveProfileAvatarUrl(post.author.id, post.author.profileImage)
      : post.author.profileImage || '/default-avatar.jpg';

  return (
    <div
      onClick={handleClick}
      className="px-4 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      {/* Top Row: Category Badge + Region/Time */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="px-2.5 py-1 text-xs font-semibold rounded"
          style={{ color, border: `1.5px solid ${color}`, backgroundColor: `${color}10` }}
        >
          {labelPostCategory(post.category)}
        </span>
        <span className="text-xs text-gray-400">
          {post.region && <>{post.region}&nbsp;&nbsp;</>}{relativeTimeShort(post.createdAt)}
        </span>
      </div>

      {/* Content Row: Text + Thumbnail */}
      <div className="flex gap-3">
        {/* Text Area */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-gray-900 mb-1 line-clamp-2 leading-snug">
            {post.title}
          </h3>
          {post.category === POST_CATEGORY_VALUE.DISPUTE && post.orderId && getDisputeByOrderId(post.orderId)?.status === 'RESOLVED' && (
            <p className="text-xs text-green-600 font-medium mb-1">This dispute post is resolved</p>
          )}
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {post.content}
          </p>
        </div>

        {/* Thumbnail */}
        {hasImage && (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
            <img
              src={getDisplayImageUrl(post.images![0])}
              alt="thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <AvatarWithBadgeOverlay userId={post.author.id} sizePx={28}>
          <UserAvatarImage src={authorAvatarSrc} />
        </AvatarWithBadgeOverlay>
        <span className="text-xs font-medium text-gray-700 truncate">{resolveDisplayNickname(post.author.id, post.author.nickname)}</span>
      </div>

      {/* Bottom: views, likes, comments */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1 text-gray-400">Views {getPostViewCount(post.id)}</span>
        <button
          type="button"
          onClick={handleLikeClick}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
          aria-label="Like"
        >
          <svg
            className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
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
          <span className={liked ? 'text-red-500' : ''}>{likeCount}</span>
        </button>
        <span className="flex items-center gap-1">
          <img src="/post/chat.svg" alt="" className="w-3.5 h-3.5 text-gray-400" />
          {post.commentCount || 0}
        </span>
      </div>

      {/* Attached product (looking-for category) */}
      {post.category === POST_CATEGORY_VALUE.LOOKING_FOR && post.attachedProduct && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-blue-700">🔍 Looking for this item</span>
          </div>
          <div className="flex gap-2">
            {post.attachedProduct.images && post.attachedProduct.images.length > 0 && (
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={getDisplayImageUrl(post.attachedProduct.images[0])}
                  alt={post.attachedProduct.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {post.attachedProduct.title}
              </p>
              <p className="text-xs text-gray-600">
                {post.attachedProduct.price.toLocaleString()} Pi
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

