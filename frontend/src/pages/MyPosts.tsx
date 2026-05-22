import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Post } from '@/types';
import { labelPostCategory, relativeTimeShort } from '@/locale/enUI';
import { getUserPosts, deleteUserPost } from '@/utils/communityStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';

export const MyPosts: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);

  const loadPosts = () => {
    setPosts(getUserPosts());
  };

  useEffect(() => {
    loadPosts();
    window.addEventListener('postsChanged', loadPosts);
    return () => window.removeEventListener('postsChanged', loadPosts);
  }, []);

  const handleDelete = (post: Post) => {
    if (confirm(`Delete "${post.title}"?`)) {
      deleteUserPost(post.id);
      loadPosts();
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="My posts"
        rightContent={
          posts.length > 0 ? (
            <span className="text-sm text-gray-500">{posts.length}</span>
          ) : undefined
        }
      />

      <div className="px-4 py-4">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
            <p className="text-gray-500">No posts yet.</p>
            <button
              onClick={() => navigate('/community/write')}
              className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Write post
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="p-4 border border-gray-200 rounded-lg"
              >
                {/* Post Content - clickable */}
                <div
                  onClick={() => navigate(`/community/post/${post.id}`)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded text-white"
                      style={{ backgroundColor: '#00A8A3' }}
                    >
                      {labelPostCategory(post.category)}
                    </span>
                    {post.region && (
                      <span className="text-xs text-gray-500">{post.region}</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{relativeTimeShort(post.createdAt)}</span>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    {post.content}
                  </p>

                  {post.images && post.images.length > 0 && (
                    <div className="flex gap-2 mb-2">
                      {post.images.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                          <img src={getDisplayImageUrl(img)} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {post.images.length > 3 && (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                          +{post.images.length - 3}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <img src="/post/chat.svg" alt="" className="w-3.5 h-3.5" />
                    {post.commentCount} comments
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => navigate(`/community/edit/${post.id}`)}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg border"
                    style={{ borderColor: '#00A8A3', color: '#00A8A3' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(post)}
                    className="px-4 py-1.5 text-xs font-medium text-red-500 border border-red-300 rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
