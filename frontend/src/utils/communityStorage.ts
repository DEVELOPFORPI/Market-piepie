import { Post, Comment } from '@/types';
import { tryFreeSpaceForSave } from '@/utils/storageClear';
import { getItem, setItem, removeItem } from '@/utils/heavyStorage';
import { syncPostToDB, syncPostDeleteToDB, syncCommentToDB, syncCommentDeleteToDB } from '@/utils/dbSync';

const DISPUTE_STORAGE_KEY = 'community_dispute_posts';
const USER_POSTS_STORAGE_KEY = 'community_user_posts';
const COMMENTS_STORAGE_KEY = 'community_comments';

export const COMMUNITY_QUOTA_EXCEEDED_MESSAGE =
  'Not enough storage to save this post. Free space in Settings, then try again.';

function setUserPostsWithQuotaRetry(posts: Post[], protectPostId?: string): void {
  let list = posts;
  let freedSpaceOnce = false;
  for (;;) {
    try {
      setItem(USER_POSTS_STORAGE_KEY, JSON.stringify(list));
      if (list.length !== posts.length) window.dispatchEvent(new Event('postsChanged'));
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        const byDate = [...list].sort(
          (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
        const toRemove = byDate.find((p) => p.id !== protectPostId);
        if (!toRemove) {
          // Only protected post left: strip images and retry
          const protectedPost = list.find((p) => p.id === protectPostId);
          if (protectedPost && (protectedPost.images?.length ?? 0) > 0) {
            const trimmed = list.map((p) =>
              p.id === protectPostId ? { ...p, images: undefined } : p
            );
            try {
              setItem(USER_POSTS_STORAGE_KEY, JSON.stringify(trimmed));
              window.dispatchEvent(new Event('postsChanged'));
              return;
            } catch {
              // fall through to try free space
            }
          }
          // Still full: trim other stores once, then retry
          if (!freedSpaceOnce) {
            freedSpaceOnce = true;
            tryFreeSpaceForSave();
            list = posts;
            continue;
          }
          throw e;
        }
        list = list.filter((p) => p.id !== toRemove.id);
        continue;
      }
      throw e;
    }
  }
}

// --- User posts ---

export const getMockCommunityPosts = (): Post[] => [];

export const getUserPosts = (): Post[] => {
  try {
    const raw = getItem(USER_POSTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addUserPost = (post: Post): void => {
  const posts = getUserPosts();
  const clone = JSON.parse(JSON.stringify(post)) as Post;
  posts.unshift(clone);
  setUserPostsWithQuotaRetry(posts, post.id);
  window.dispatchEvent(new Event('postsChanged'));
  syncPostToDB(post);
};

export const updateUserPost = (post: Post): void => {
  const posts = getUserPosts();
  const idx = posts.findIndex((p) => p.id === post.id);
  if (idx >= 0) {
    posts[idx] = JSON.parse(JSON.stringify(post));
    setUserPostsWithQuotaRetry(posts, post.id);
    window.dispatchEvent(new Event('postsChanged'));
    syncPostToDB(post);
  }
};

export const deleteUserPost = (postId: string): void => {
  const posts = getUserPosts().filter((p) => p.id !== postId);
  setUserPostsWithQuotaRetry(posts);
  deleteCommentsByPostId(postId);
  window.dispatchEvent(new Event('postsChanged'));
  syncPostDeleteToDB(postId);
};

// --- Dispute posts ---

export const getDisputePosts = (): Post[] => {
  try {
    const raw = getItem(DISPUTE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addDisputePost = (post: Post): void => {
  const posts = getDisputePosts();
  posts.unshift(post);
  setItem(DISPUTE_STORAGE_KEY, JSON.stringify(posts));
  window.dispatchEvent(new Event('postsChanged'));
};

export const clearDisputePosts = (): void => {
  removeItem(DISPUTE_STORAGE_KEY);
  window.dispatchEvent(new Event('postsChanged'));
};

export const updateDisputePost = (post: Post): void => {
  const posts = getDisputePosts();
  const idx = posts.findIndex((p) => p.id === post.id);
  if (idx >= 0) {
    posts[idx] = JSON.parse(JSON.stringify(post));
    setItem(DISPUTE_STORAGE_KEY, JSON.stringify(posts));
    window.dispatchEvent(new Event('postsChanged'));
  }
};

export const deleteDisputePost = (postId: string): void => {
  const posts = getDisputePosts().filter((p) => p.id !== postId);
  setItem(DISPUTE_STORAGE_KEY, JSON.stringify(posts));
  window.dispatchEvent(new Event('postsChanged'));
};

// --- Combined feed ---

export const getAllPosts = (): Post[] => {
  const dispute = getDisputePosts();
  const user = getUserPosts();
  return [...dispute, ...user].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getPostById = (id: string | undefined): Post | null => {
  if (!id) return null;
  const fromUser = getUserPosts().find((p) => p.id === id);
  if (fromUser) return fromUser;
  const fromDispute = getDisputePosts().find((p) => p.id === id);
  if (fromDispute) return fromDispute;
  return null;
};

// --- Comments ---

const getAllComments = (): Record<string, Comment[]> => {
  try {
    const raw = getItem(COMMENTS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const getCommentsByPostId = (postId: string): Comment[] => {
  const all = getAllComments();
  return all[postId] || [];
};

/** Build comment tree from flat list */
export const buildCommentTree = (flat: Comment[]): Comment[] => {
  const withReplies = (parentId: string | undefined): Comment[] =>
    flat
      .filter((c) => (c.parentId ?? '') === (parentId ?? ''))
      .map((c) => ({ ...c, replies: withReplies(c.id) }));
  return withReplies(undefined);
};

export const addComment = (postId: string, comment: Comment): void => {
  const all = getAllComments();
  if (!all[postId]) all[postId] = [];
  all[postId].push(comment);
  setItem(COMMENTS_STORAGE_KEY, JSON.stringify(all));
  syncCommentToDB(postId, {
    id: comment.id,
    authorId: comment.author?.id || '',
    content: comment.content,
    parentId: comment.parentId,
  });

  const count = all[postId].length;
  const userPosts = getUserPosts();
  const userPost = userPosts.find((p) => p.id === postId);
  if (userPost) {
    userPost.commentCount = count;
    setItem(USER_POSTS_STORAGE_KEY, JSON.stringify(userPosts));
  }
  const disputePosts = getDisputePosts();
  const disputePost = disputePosts.find((p) => p.id === postId);
  if (disputePost) {
    disputePost.commentCount = count;
    setItem(DISPUTE_STORAGE_KEY, JSON.stringify(disputePosts));
  }

  window.dispatchEvent(new Event('commentsChanged'));
};

/** Collect comment id and all nested reply ids to delete */
const collectCommentIdsToDelete = (comments: Comment[], targetId: string): Set<string> => {
  const set = new Set<string>([targetId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of comments) {
      if (c.parentId && set.has(c.parentId) && !set.has(c.id)) {
        set.add(c.id);
        added = true;
      }
    }
  }
  return set;
};

export const deleteComment = (postId: string, commentId: string): void => {
  const all = getAllComments();
  if (all[postId]) {
    const toDelete = collectCommentIdsToDelete(all[postId], commentId);
    all[postId] = all[postId].filter((c) => !toDelete.has(c.id));
    setItem(COMMENTS_STORAGE_KEY, JSON.stringify(all));
    toDelete.forEach((id) => syncCommentDeleteToDB(id));

    const count = all[postId].length;
    const userPosts = getUserPosts();
    const userPost = userPosts.find((p) => p.id === postId);
    if (userPost) {
      userPost.commentCount = count;
      setItem(USER_POSTS_STORAGE_KEY, JSON.stringify(userPosts));
    }
    const disputePosts = getDisputePosts();
    const disputePost = disputePosts.find((p) => p.id === postId);
    if (disputePost) {
      disputePost.commentCount = count;
      setItem(DISPUTE_STORAGE_KEY, JSON.stringify(disputePosts));
    }

    window.dispatchEvent(new Event('commentsChanged'));
  }
};

const deleteCommentsByPostId = (postId: string): void => {
  const all = getAllComments();
  delete all[postId];
  setItem(COMMENTS_STORAGE_KEY, JSON.stringify(all));
};
