import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PostCard } from '@/components/common/PostCard';
import { PostCategory, POST_CATEGORY_VALUE } from '@/types';
import { getAllPosts } from '@/utils/communityStorage';
import { guestGuard } from '@/utils/guestGate';
import { getUnreadCount } from '@/utils/notificationStorage';
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
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const loadPosts = () => setPosts(getAllPosts());

  useEffect(() => {
    loadPosts();
    window.addEventListener('postsChanged', loadPosts);
    return () => window.removeEventListener('postsChanged', loadPosts);
  }, []);

  useEffect(() => {
    const refreshUnread = () => {
      const count = getUnreadCount();
      setUnreadNotificationCount(count);
    };
    refreshUnread();
    window.addEventListener('notificationsChanged', refreshUnread);
    window.addEventListener('focus', refreshUnread);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshUnread();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('notificationsChanged', refreshUnread);
      window.removeEventListener('focus', refreshUnread);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const filteredPosts = useMemo(() => {
    return activeCategory === ALL
      ? [...posts]
      : posts.filter((post) => post.category === activeCategory);
  }, [posts, activeCategory]);

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 h-14">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-gray-900">Community</span>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className={`relative p-2 ${unreadNotificationCount > 0 ? 'text-[#00A8A3]' : 'text-gray-900'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadNotificationCount > 0 ? (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[10px] font-bold px-0.5"
                style={{ backgroundColor: '#00A8A3', color: '#fff' }}
              >
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </span>
            ) : null}
          </button>
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
