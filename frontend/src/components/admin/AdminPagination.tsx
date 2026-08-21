import React, { useEffect, useMemo, useState } from 'react';

export const ADMIN_PAGE_SIZE = 20;

export function slicePage<T>(items: T[], page: number, size = ADMIN_PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: safePage,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  };
}

export function useAdminPage<T>(items: T[], resetKey: unknown) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const sliced = useMemo(() => slicePage(items, page), [items, page]);

  useEffect(() => {
    if (sliced.page !== page) setPage(sliced.page);
  }, [sliced.page, page]);

  return { ...sliced, setPage };
}

export const AdminPagination: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
}> = ({ page, totalPages, total, from, to, onPageChange }) => {
  if (total <= ADMIN_PAGE_SIZE) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
      <span>{from}–{to} / {total}건 · {ADMIN_PAGE_SIZE}개씩</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          이전
        </button>
        <span className="min-w-[4.5rem] text-center font-medium text-gray-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  );
};
