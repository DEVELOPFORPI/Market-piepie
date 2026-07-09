import { userKey, getCurrentUserId } from '@/utils/authStorage';
import { api } from '@/utils/api';

const DISPUTE_POST_VOTE_COUNTS_KEY = 'disputePostVoteCounts';
const DISPUTE_POST_MY_VOTE_KEY = 'disputePostMyVote';

export type DisputeVote = 'like' | 'dislike';

type VoteCounts = { likeCount: number; dislikeCount: number };

const getVoteCountsMap = (): Record<string, VoteCounts> => {
  try {
    const raw = localStorage.getItem(DISPUTE_POST_VOTE_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveVoteCountsMap = (map: Record<string, VoteCounts>) => {
  localStorage.setItem(DISPUTE_POST_VOTE_COUNTS_KEY, JSON.stringify(map));
};

const getMyVotesMap = (): Record<string, DisputeVote> => {
  try {
    const raw = localStorage.getItem(userKey(DISPUTE_POST_MY_VOTE_KEY));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveMyVotesMap = (map: Record<string, DisputeVote>) => {
  localStorage.setItem(userKey(DISPUTE_POST_MY_VOTE_KEY), JSON.stringify(map));
};

const setLocalDisputeVote = (
  postId: string,
  vote: DisputeVote | null,
  counts: VoteCounts,
) => {
  const countsMap = getVoteCountsMap();
  countsMap[postId] = {
    likeCount: Math.max(counts.likeCount, 0),
    dislikeCount: Math.max(counts.dislikeCount, 0),
  };
  saveVoteCountsMap(countsMap);

  const myVotes = getMyVotesMap();
  if (vote) myVotes[postId] = vote;
  else delete myVotes[postId];
  saveMyVotesMap(myVotes);

  window.dispatchEvent(new Event('disputePostVotesChanged'));
};

export const getDisputeVoteCounts = (postId: string): VoteCounts => {
  return getVoteCountsMap()[postId] || { likeCount: 0, dislikeCount: 0 };
};

export const getMyDisputeVote = (postId: string): DisputeVote | null => {
  if (!getCurrentUserId()) return null;
  return getMyVotesMap()[postId] ?? null;
};

/** DB에서 분쟁 게시글 투표 상태/개수 로드 후 로컬 반영 */
export const syncDisputeVotesFromDB = async (postId: string): Promise<void> => {
  const userId = getCurrentUserId() || '';
  try {
    const res = await api.get<{ vote: DisputeVote | null; likeCount: number; dislikeCount: number }>(
      `/api/posts/${postId}/dispute-votes${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`,
    );
    if (res.ok && res.data) {
      setLocalDisputeVote(postId, res.data.vote, {
        likeCount: res.data.likeCount,
        dislikeCount: res.data.dislikeCount,
      });
    }
  } catch {
    // 오프라인 시 무시
  }
};

/** Up/Down 투표 (DB 먼저, 로컬은 응답으로 보정) */
export const setDisputeVote = async (postId: string, vote: DisputeVote): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) return;

  const prevVote = getMyDisputeVote(postId);
  const prevCounts = getDisputeVoteCounts(postId);
  let nextVote: DisputeVote | null = vote;
  let nextCounts = { ...prevCounts };

  if (prevVote === vote) {
    nextVote = null;
    if (vote === 'like') nextCounts.likeCount = Math.max(prevCounts.likeCount - 1, 0);
    else nextCounts.dislikeCount = Math.max(prevCounts.dislikeCount - 1, 0);
  } else {
    if (prevVote === 'like') nextCounts.likeCount = Math.max(prevCounts.likeCount - 1, 0);
    if (prevVote === 'dislike') nextCounts.dislikeCount = Math.max(prevCounts.dislikeCount - 1, 0);
    if (vote === 'like') nextCounts.likeCount += 1;
    else nextCounts.dislikeCount += 1;
  }

  setLocalDisputeVote(postId, nextVote, nextCounts);

  try {
    const res = await api.put<{ vote: DisputeVote | null; likeCount: number; dislikeCount: number }>(
      `/api/posts/${postId}/dispute-vote`,
      { vote },
    );
    if (res.ok && res.data) {
      setLocalDisputeVote(postId, res.data.vote, {
        likeCount: res.data.likeCount,
        dislikeCount: res.data.dislikeCount,
      });
      return;
    }
    setLocalDisputeVote(postId, prevVote, prevCounts);
  } catch {
    setLocalDisputeVote(postId, prevVote, prevCounts);
  }
};
