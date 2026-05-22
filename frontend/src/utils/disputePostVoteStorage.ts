import { getCurrentUserId } from '@/utils/authStorage';

const DISPUTE_POST_VOTES_KEY = 'disputePostVotes';

type Vote = 'like' | 'dislike';

type VotesByPost = Record<string, Record<string, Vote>>;

const getVotes = (): VotesByPost => {
  try {
    const raw = localStorage.getItem(DISPUTE_POST_VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveVotes = (votes: VotesByPost) => {
  localStorage.setItem(DISPUTE_POST_VOTES_KEY, JSON.stringify(votes));
};

export const getDisputeVoteCounts = (postId: string): { likeCount: number; dislikeCount: number } => {
  const votes = getVotes()[postId];
  if (!votes) return { likeCount: 0, dislikeCount: 0 };
  let likeCount = 0;
  let dislikeCount = 0;
  for (const v of Object.values(votes)) {
    if (v === 'like') likeCount++;
    else dislikeCount++;
  }
  return { likeCount, dislikeCount };
};

export const getMyDisputeVote = (postId: string): Vote | null => {
  const userId = getCurrentUserId();
  if (!userId) return null;
  const postVotes = getVotes()[postId];
  return postVotes?.[userId] ?? null;
};

/** Vote agree/disagree; same button toggles off, opposite switches vote */
export const setDisputeVote = (postId: string, vote: Vote): void => {
  const userId = getCurrentUserId();
  if (!userId) return;
  const all = getVotes();
  if (!all[postId]) all[postId] = {};
  const current = all[postId][userId];
  if (current === vote) {
    delete all[postId][userId];
    if (Object.keys(all[postId]).length === 0) delete all[postId];
  } else {
    all[postId][userId] = vote;
  }
  saveVotes(all);
  window.dispatchEvent(new Event('disputePostVotesChanged'));
};
