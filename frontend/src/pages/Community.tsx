import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PostCard } from '@/components/common/PostCard';
import { NotificationBellButton } from '@/components/common/NotificationBellButton';
import { PullToRefreshIndicator } from '@/components/common/PullToRefreshIndicator';
import { PostCategory, POST_CATEGORY_VALUE } from '@/types';
import { getAllPosts } from '@/utils/communityStorage';
import { syncPostsFromDB } from '@/utils/dbSync';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { guestGuard } from '@/utils/guestGate';
import { labelPostCategory } from '@/locale/enUI';

type CategoryFilter = PostCategory | 'all';

const ALL: CategoryFilter = 'all';

const CATEGORY_TABS: CategoryFilter[] = [
  ALL,
  POST_CATEGORY_VALUE.QUESTION,
  POST_CATEGORY_VALUE.INFO,
  POST_CATEGORY_VALUE.LOOKING_FOR,
  POST_CATEGORY_VALUE.DISPUTE,
  POST_CATEGORY_VALUE.SWAP,
];

function tabLabel(c: CategoryFilter): string {
  if (c === 'all') return 'All';
  return labelPostCategory(c);
}

export const Community: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(ALL);
  const [posts, setPosts] = useState(getAllPosts());

  const loadPosts = () => setPosts(getAllPosts());

  useEffect(() => {
    loadPosts();
    window.addEventListener('postsChanged', loadPosts);
    return () => window.removeEventListener('postsChanged', loadPosts);
  }, []);

  const filteredPosts = useMemo(() => {
    return activeCategory === ALL
      ? [...posts]
      : posts.filter((post) => post.category === activeCategory);
  }, [posts, activeCategory]);

  const handlePullRefresh = useCallback(async () => {
    await syncPostsFromDB();
    setPosts(getAllPosts());
  }, []);

  const { pull, refreshing } = usePullToRefresh(handlePullRefresh);

  return (
    <div className="min-h-screen bg-white pb-20">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} />
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 h-14">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-gray-900">Community</span>
          </div>
          <NotificationBellButton />
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3 border-b border-gray-200 overflow-x-auto">
        {CATEGORY_TABS.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              activeCategory === category
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={activeCategory === category ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {tabLabel(category)}
          </button>
        ))}
      </div>

      <div className="divide-y divide-gray-100">
        {filteredPosts.length === 0 ? (
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500">No posts yet.</p>
            <p className="text-xs text-gray-400 mt-1">Be the first to share something.</p>
            <button
              onClick={() => { if (guestGuard('post')) return; navigate('/community/write'); }}
              className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Write a post
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </div>

      <button
        onClick={() => { if (guestGuard('post')) return; navigate('/community/write'); }}
        className="fixed bottom-24 right-4 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity z-40"
        style={{ backgroundColor: '#00A8A3' }}
        aria-label="Write post"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};
