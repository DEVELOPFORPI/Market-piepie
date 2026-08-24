import React from 'react';
import { relativeTimeShort } from '@/locale/enUI';
import { useLanguage } from '@/hooks/useLanguage';
import { TEXT_LIMIT } from '@/constants/textLimits';
import { POST_CATEGORY_VALUE } from '@/types';
import { localizeDisputePostTitle } from '@/utils/disputeLabels';
import type { AuthorCommentRow } from '@/pages/MyComments';

export const CommentActivityRow: React.FC<{
  comment: AuthorCommentRow;
  showHiddenBadge?: boolean;
  showActions?: boolean;
  editing?: boolean;
  draft?: string;
  onDraftChange?: (value: string) => void;
  onClick: () => void;
  onEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onDelete?: () => void;
  saving?: boolean;
}> = ({
  comment,
  showHiddenBadge,
  showActions,
  editing,
  draft,
  onDraftChange,
  onClick,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  saving,
}) => {
  const { lang, t } = useLanguage();
  const hidden = Boolean(Number(comment.admin_hidden));
  const reason = String(comment.admin_hidden_reason || '').trim();
  const rawTitle = comment.post_title || '';
  const isDispute =
    comment.post_category === POST_CATEGORY_VALUE.DISPUTE ||
    /^\[Dispute\]/i.test(rawTitle);
  const title = isDispute
    ? localizeDisputePostTitle(lang, rawTitle, t('catDispute'))
    : rawTitle;
  const meta = [comment.parent_id ? t('reply') : '', title].filter(Boolean).join(' · ');

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {editing ? (
        <div className="px-4 py-3.5">
          <p className="mb-2 truncate text-xs font-medium text-gray-600">{meta}</p>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange?.(e.target.value.slice(0, TEXT_LIMIT.comment))}
            maxLength={TEXT_LIMIT.comment}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#00A8A3]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={saving || !draft?.trim()}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:bg-gray-300"
              style={!saving && draft?.trim() ? { backgroundColor: '#00A8A3' } : undefined}
            >
              {saving ? t('saving') : t('saveChanges')}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onClick} className="w-full px-4 py-3.5 text-left">
          <div className="flex items-baseline gap-3">
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-gray-600">{meta}</p>
            <span className="shrink-0 text-xs text-gray-400">{relativeTimeShort(comment.created_at)}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-gray-900">
            {comment.content || t('commentAdminHidden')}
          </p>
        </button>
      )}
      {showHiddenBadge && hidden && !editing ? (
        <div className="border-t border-gray-200 bg-gray-100 px-4 py-2 text-xs text-gray-600">
          {t('commentAdminHiddenMine')}
          {reason ? ` ${t('postAdminHiddenReason', { reason })}` : ''}
        </div>
      ) : null}
      {showActions && !editing ? (
        <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-2.5">
          {!hidden && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border px-4 py-1.5 text-xs font-medium"
              style={{ borderColor: '#00A8A3', color: '#00A8A3' }}
            >
              {t('edit')}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-300 px-4 py-1.5 text-xs font-medium text-red-500"
          >
            {t('delete')}
          </button>
        </div>
      ) : null}
    </div>
  );
};
