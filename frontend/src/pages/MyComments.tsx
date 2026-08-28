import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { CommentActivityRow } from '@/components/common/CommentActivityRow';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { api } from '@/utils/api';
import { getCurrentUserId } from '@/utils/authStorage';
import { deleteComment, updateComment } from '@/utils/communityStorage';
import { showToast } from '@/utils/toast';
import { TEXT_LIMIT } from '@/constants/textLimits';
import { useLanguage } from '@/hooks/useLanguage';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';

export interface AuthorCommentRow {
  id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
  admin_hidden?: boolean | number;
  admin_hidden_reason?: string | null;
  post_id: string;
  post_title: string;
  post_category?: string;
}

type CommentFilter = 'all' | 'replies';

export const MyComments: React.FC = () => {
  useGuestPageGuard('comment');
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { askConfirm, confirmDialog } = useConfirmDialog();
  const [comments, setComments] = useState<AuthorCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CommentFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const uid = getCurrentUserId();
    if (!uid) {
      setComments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await api.get<AuthorCommentRow[]>(
        `/api/comments?author_id=${encodeURIComponent(uid)}`,
      );
      if (cancelled) return;
      setComments(res.ok && Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'replies') return comments.filter((c) => !!c.parent_id);
    return comments;
  }, [comments, filter]);

  const handleSave = async (comment: AuthorCommentRow) => {
    const text = draft.trim().slice(0, TEXT_LIMIT.comment);
    if (!text) return;
    setSaving(true);
    const ok = await updateComment(comment.post_id, comment.id, text);
    setSaving(false);
    if (!ok) {
      showToast(t('couldNotSave'));
      return;
    }
    setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, content: text } : c)));
    setEditingId(null);
  };

  const handleDelete = (comment: AuthorCommentRow) => {
    void (async () => {
      const ok = await askConfirm({
        message: t('deleteCommentConfirm'),
        confirmLabel: t('delete'),
        cancelLabel: t('cancel'),
      });
      if (!ok) return;
      const deleted = await deleteComment(comment.post_id, comment.id);
      if (!deleted) {
        showToast(t('couldNotSave'));
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      if (editingId === comment.id) setEditingId(null);
    })();
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('myComments')}
      />

      {comments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-3">
          {([
            { value: 'all' as const, label: t('chipAll') },
            { value: 'replies' as const, label: t('commentFilterReplies') },
          ]).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setFilter(tab.value);
                setEditingId(null);
              }}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                filter === tab.value ? 'text-white' : 'bg-gray-100 text-gray-700'
              }`}
              style={filter === tab.value ? { backgroundColor: '#00A8A3' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div>
        {loading ? (
          <p className="py-12 text-center text-sm text-gray-500">{t('loading')}</p>
        ) : comments.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">{t('noMyComments')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">{t('noCommentsInFilter')}</p>
        ) : (
          filtered.map((comment) => (
            <CommentActivityRow
              key={comment.id}
              comment={comment}
              showHiddenBadge
              showActions
              editing={editingId === comment.id}
              draft={draft}
              onDraftChange={setDraft}
              saving={saving}
              onClick={() => navigate(`/community/post/${comment.post_id}`)}
              onEdit={() => {
                setEditingId(comment.id);
                setDraft(comment.content || '');
              }}
              onSaveEdit={() => void handleSave(comment)}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => handleDelete(comment)}
            />
          ))
        )}
      </div>
      {confirmDialog}
    </div>
  );
};
