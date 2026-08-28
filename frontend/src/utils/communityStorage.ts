import { Post, Comment } from '@/types';
import { tryFreeSpaceForSave } from '@/utils/storageClear';
import { getItem, setItem, removeItem } from '@/utils/heavyStorage';
import { syncPostToDB, syncPostDeleteToDB, syncCommentToDB, syncCommentUpdateToDB, syncCommentDeleteToDB, syncPostFromDB } from '@/utils/dbSync';
import { applyPostCommentCount } from '@/utils/postCommentCountStorage';
import { addNotification } from '@/utils/notificationStorage';
import { NOTIFY_POST_COMMENT, NOTIFY_POST_REPLY } from '@/locale/enUI';

const DISPUTE_STORAGE_KEY = 'community_dispute_posts';
const USER_POSTS_STORAGE_KEY = 'community_user_posts';
const FEED_POSTS_STORAGE_KEY = 'community_feed_posts';
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
              // fall through
            }
          }
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

function upsertFeedPost(post: Post): void {
  const posts = getFeedPosts();
  const clone = JSON.parse(JSON.stringify(post)) as Post;
  const idx = posts.findIndex((p) => p.id === post.id);
  if (idx >= 0) posts[idx] = clone;
  else posts.unshift(clone);
  setItem(FEED_POSTS_STORAGE_KEY, JSON.stringify(posts));
}

function removeFeedPost(postId: string): void {
  const posts = getFeedPosts().filter((p) => p.id !== postId);
  setItem(FEED_POSTS_STORAGE_KEY, JSON.stringify(posts));
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

/** Community feed cache (all posts from server sync) */
export const getFeedPosts = (): Post[] => {
  try {
    const raw = getItem(FEED_POSTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addUserPost = async (post: Post): Promise<boolean> => {
  const ok = await syncPostToDB(post);
  if (!ok) return false;
  const posts = getUserPosts();
  const clone = JSON.parse(JSON.stringify(post)) as Post;
  posts.unshift(clone);
  setUserPostsWithQuotaRetry(posts, post.id);
  upsertFeedPost(clone);
  window.dispatchEvent(new Event('postsChanged'));
  return true;
};

export const updateUserPost = async (post: Post): Promise<boolean> => {
  const ok = await syncPostToDB(post);
  if (!ok) return false;
  const posts = getUserPosts();
  const idx = posts.findIndex((p) => p.id === post.id);
  if (idx >= 0) {
    const updated = JSON.parse(JSON.stringify(post)) as Post;
    posts[idx] = updated;
    setUserPostsWithQuotaRetry(posts, post.id);
    upsertFeedPost(updated);
    window.dispatchEvent(new Event('postsChanged'));
  }
  return true;
};

export const deleteUserPost = async (postId: string): Promise<boolean> => {
  const ok = await syncPostDeleteToDB(postId);
  if (!ok) return false;
  const posts = getUserPosts().filter((p) => p.id !== postId);
  setUserPostsWithQuotaRetry(posts);
  removeFeedPost(postId);
  deleteCommentsByPostId(postId);
  window.dispatchEvent(new Event('postsChanged'));
  return true;
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

export const addDisputePost = async (post: Post): Promise<boolean> => {
  return addUserPost(post);
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
  const feed = getFeedPosts();
  const legacyDispute = getDisputePosts().filter((d) => !feed.some((u) => u.id === d.id));
  return [...legacyDispute, ...feed].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getPostById = (id: string | undefined): Post | null => {
  if (!id) return null;
  const fromFeed = getFeedPosts().find((p) => p.id === id);
  if (fromFeed) return fromFeed;
  const fromUser = getUserPosts().find((p) => p.id === id);
  if (fromUser) return fromUser;
  const fromDispute = getDisputePosts().find((p) => p.id === id);
  if (fromDispute) return fromDispute;
  return null;
};

/** 로컬에 없으면 DB에서 게시물 1건을 받아온 뒤 반환 */
export const ensurePostById = async (id: string): Promise<Post | null> => {
  const local = getPostById(id);
  if (local) return local;
  const fromDb = await syncPostFromDB(id);
  return fromDb ?? getPostById(id);
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

const patchLocalPostCommentCount = (postId: string, count: number) => {
  applyPostCommentCount(postId, count);
  const userPosts = getUserPosts();
  const userPost = userPosts.find((p) => p.id === postId);
  if (userPost) {
    userPost.commentCount = count;
    setItem(USER_POSTS_STORAGE_KEY, JSON.stringify(userPosts));
  }
  const feedPosts = getFeedPosts();
  const feedPost = feedPosts.find((p) => p.id === postId);
  if (feedPost) {
    feedPost.commentCount = count;
    setItem(FEED_POSTS_STORAGE_KEY, JSON.stringify(feedPosts));
  }
  const disputePosts = getDisputePosts();
  const disputePost = disputePosts.find((p) => p.id === postId);
  if (disputePost) {
    disputePost.commentCount = count;
    setItem(DISPUTE_STORAGE_KEY, JSON.stringify(disputePosts));
  }
};

export const addComment = async (postId: string, comment: Comment): Promise<boolean> => {
  const result = await syncCommentToDB(postId, {
    id: comment.id,
    authorId: comment.author?.id || '',
    content: comment.content,
    parentId: comment.parentId,
  });
  if (!result.ok) return false;

  const all = getAllComments();
  if (!all[postId]) all[postId] = [];
  all[postId].push(comment);
  setItem(COMMENTS_STORAGE_KEY, JSON.stringify(all));

  if (result.count != null) {
    patchLocalPostCommentCount(postId, result.count);
  }

  const post = getPostById(postId) || await ensurePostById(postId);
  const commenterId = comment.author?.id;
  const commenterName = comment.author?.nickname || 'Someone';
  const postTitle = post?.title || 'Post';
  if (comment.parentId) {
    const parent = (all[postId] || []).find((c) => c.id === comment.parentId);
    const parentAuthorId = parent?.author?.id;
    if (parentAuthorId && commenterId && parentAuthorId !== commenterId) {
      void addNotification({
        targetUserId: parentAuthorId,
        type: 'reply',
        title: NOTIFY_POST_REPLY,
        content: `${commenterName} replied to your comment on "${postTitle}".`,
        link: `/community/post/${postId}`,
      });
    }
  } else {
    const authorId = post?.author?.id;
    if (authorId && commenterId && authorId !== commenterId) {
      void addNotification({
        targetUserId: authorId,
        type: 'comment',
        title: NOTIFY_POST_COMMENT,
        content: `${commenterName} commented on "${postTitle}".`,
        link: `/community/post/${postId}`,
      });
    }
  }

  window.dispatchEvent(new Event('commentsChanged'));
  return true;
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

export const updateComment = async (
  postId: string,
  commentId: string,
  content: string,
): Promise<boolean> => {
  const text = content.trim();
  if (!text) return false;
  const ok = await syncCommentUpdateToDB(commentId, text);
  if (!ok) return false;
  const all = getAllComments();
  if (all[postId]) {
    all[postId] = all[postId].map((c) => (c.id === commentId ? { ...c, content: text } : c));
    setItem(COMMENTS_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event('commentsChanged'));
  }
  return true;
};

export const deleteComment = async (postId: string, commentId: string): Promise<boolean> => {
  const all = getAllComments();
  const local = all[postId] ?? [];
  const toDelete = local.length
    ? collectCommentIdsToDelete(local, commentId)
    : new Set([commentId]);
  const results = await Promise.all([...toDelete].map((id) => syncCommentDeleteToDB(id)));
  if (results.some((r) => !r.ok)) return false;

  if (all[postId]) {
    all[postId] = all[postId].filter((c) => !toDelete.has(c.id));
    setItem(COMMENTS_STORAGE_KEY, JSON.stringify(all));
  }

  const lastCount = [...results].reverse().find((r) => r.count != null)?.count;
  if (lastCount != null) {
    patchLocalPostCommentCount(postId, lastCount);
  }

  window.dispatchEvent(new Event('commentsChanged'));
  return true;
};

const deleteCommentsByPostId = (postId: string): void => {
  const all = getAllComments();
  delete all[postId];
  setItem(COMMENTS_STORAGE_KEY, JSON.stringify(all));
};
