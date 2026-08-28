import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';
import { toggleUserSuspension } from '@/utils/adminSuspension';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { AdminPagination, useAdminPage } from '@/components/admin/AdminPagination';

type AccountStatus = 'active' | 'suspended';
type DetailTab = 'basic' | 'products' | 'orders' | 'posts' | 'issues';

interface UserSummary {
  id: string;
  nickname: string;
  profile_image: string | null;
  bio: string | null;
  kyc_status: string;
  trust_score: number;
  rating: number;
  trade_count: number;
  activity_region: string | null;
  seller_type: string | null;
  pi_username: string | null;
  account_status: AccountStatus;
  suspension_reason: string | null;
  suspended_at: string | null;
  product_count: number;
  post_count: number;
  report_count: number;
  dispute_count: number;
  created_at: string;
}

interface UserDetail extends UserSummary {
  products: Array<{
    id: string;
    title: string;
    status: string;
    price: number;
    admin_hidden: boolean;
    created_at: string;
  }>;
  orders: Array<{
    id: string;
    buyer_id: string;
    seller_id: string;
    status: string;
    proposed_price: number;
    created_at: string;
  }>;
  posts: Array<{
    id: string;
    title: string;
    category: string;
    view_count: number;
    created_at: string;
  }>;
  reports: Array<{
    id: string;
    target_type: string;
    reason: string;
    status: string;
    created_at: string;
  }>;
  disputes: Array<{
    id: string;
    order_id: string;
    reason: string;
    status: string;
    created_at: string;
  }>;
}

const KYC_LABEL: Record<string, string> = {
  verified: '인증됨',
  unverified: '미인증',
};

const TABS: Array<{ value: DetailTab; label: string }> = [
  { value: 'basic', label: '기본정보' },
  { value: 'products', label: '상품' },
  { value: 'orders', label: '거래' },
  { value: 'posts', label: '게시글' },
  { value: 'issues', label: '신고·분쟁' },
];

function dateLabel(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

function Avatar({ user, size = 'h-10 w-10' }: { user: UserSummary; size?: string }) {
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-full bg-gray-200`}>
      <UserAvatarImage
        src={user.profile_image}
        alt=""
        imgClassName="h-full w-full object-cover"
        iconClassName="h-3/5 w-3/5 text-gray-500"
      />
    </div>
  );
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('basic');
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const response = await api.get<UserSummary[]>('/api/admin/users', {
      headers: adminPasswordHeaders(),
    });
    if (!response.ok || !response.data) {
      setUsers([]);
      setLoadError(response.error || '사용자 목록을 불러오지 못했습니다.');
    } else {
      setUsers(response.data.map((user) => ({
        ...user,
        account_status: user.account_status || 'active',
        product_count: Number(user.product_count || 0),
        post_count: Number(user.post_count || 0),
        report_count: Number(user.report_count || 0),
        dispute_count: Number(user.dispute_count || 0),
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => {
      if (!keyword) return true;
      return (
        user.nickname?.toLowerCase().includes(keyword) ||
        user.id?.toLowerCase().includes(keyword) ||
        user.pi_username?.toLowerCase().includes(keyword) ||
        user.activity_region?.toLowerCase().includes(keyword)
      );
    });
  }, [users, search]);

  const activeUsers = filtered.filter((user) => user.account_status !== 'suspended');
  const suspendedUsers = filtered.filter((user) => user.account_status === 'suspended');
  const activePage = useAdminPage(activeUsers, search);
  const suspendedPage = useAdminPage(suspendedUsers, search);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    const response = await api.get<UserDetail>(`/api/admin/users/${id}`, {
      headers: adminPasswordHeaders(),
    });
    if (response.ok && response.data) {
      const detail = {
        ...response.data,
        account_status: response.data.account_status || 'active',
        products: response.data.products || [],
        orders: response.data.orders || [],
        posts: response.data.posts || [],
        reports: response.data.reports || [],
        disputes: response.data.disputes || [],
      };
      setSelected(detail);
    } else {
      alert('사용자 상세 정보를 불러오지 못했습니다.');
      setSelected(null);
    }
    setDetailLoading(false);
  };

  const openDetail = (user: UserSummary) => {
    setActiveTab('basic');
    setSelected(null);
    void loadDetail(user.id);
  };

  const handleDelete = async (user: UserSummary) => {
    if (!confirm(`사용자 ${user.nickname}(${user.id})를 삭제할까요?\n되돌릴 수 없습니다.`)) return;
    const response = await api.delete(`/api/admin/users/${user.id}`, {
      headers: adminPasswordHeaders(),
    });
    if (!response.ok) {
      alert(`삭제 실패: ${response.error || `HTTP ${response.status}`}`);
      return;
    }
    if (selected?.id === user.id) setSelected(null);
    await load();
  };

  const handleSuspension = async (user: UserSummary) => {
    setSuspendingId(user.id);
    const result = await toggleUserSuspension(user.id, user.nickname, user.account_status);
    setSuspendingId(null);
    if (!result.changed && !result.status) return;
    await load();
    if (selected?.id === user.id) await loadDetail(user.id);
  };

  const activeCount = users.filter((user) => user.account_status !== 'suspended').length;
  const suspendedCount = users.filter((user) => user.account_status === 'suspended').length;
  const issueUserCount = users.filter(
    (user) => user.report_count > 0 || user.dispute_count > 0,
  ).length;

  const actionButtons = (user: UserSummary) => (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void handleSuspension(user);
        }}
        disabled={suspendingId === user.id}
        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${
          user.account_status === 'suspended'
            ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
            : 'border-amber-200 text-amber-700 hover:bg-amber-50'
        }`}
      >
        {suspendingId === user.id
          ? '처리 중'
          : user.account_status === 'suspended'
            ? '정지 해제'
            : '정지'}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openDetail(user);
        }}
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        자세히 보기
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void handleDelete(user);
        }}
        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        삭제
      </button>
    </div>
  );

  return (
    <div className="p-6 lg:p-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">사용자 관리</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['전체 사용자', users.length, 'text-gray-900'],
          ['정상', activeCount, 'text-green-600'],
          ['정지', suspendedCount, 'text-red-600'],
          ['신고·분쟁 사용자', issueUserCount, 'text-amber-600'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <input
        type="text"
        placeholder="닉네임, Pi @, ID, 지역으로 검색"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-5 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
      />

      {loadError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-500">불러오는 중…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {([
            { title: '정상', items: activeUsers, page: activePage, empty: '정상 사용자가 없습니다.' },
            { title: '정지', items: suspendedUsers, page: suspendedPage, empty: '정지된 사용자가 없습니다.' },
          ] as const).map((column) => (
            <section key={column.title} className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">{column.title}</h2>
                <span className="text-xs text-gray-400">{column.items.length}명</span>
              </div>
              {column.items.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                  <p className="text-sm text-gray-400">{column.empty}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {column.page.items.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => openDetail(user)}
                      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar user={user} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-gray-900">{user.nickname}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              user.kyc_status === 'verified'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {KYC_LABEL[user.kyc_status] || user.kyc_status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {user.pi_username ? `@${user.pi_username}` : user.id}
                          </p>
                          <p className="text-[11px] text-gray-400">{user.activity_region || '지역 미설정'}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            거래 {user.trade_count} · 상품 {user.product_count} · 글 {user.post_count}
                            {(user.report_count > 0 || user.dispute_count > 0) && (
                              <span className="text-amber-600">
                                {' '}· 신고 {user.report_count} · 분쟁 {user.dispute_count}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3" onClick={(event) => event.stopPropagation()}>
                        {actionButtons(user)}
                      </div>
                    </div>
                  ))}
                  <AdminPagination
                    page={column.page.page}
                    totalPages={column.page.totalPages}
                    total={column.page.total}
                    from={column.page.from}
                    to={column.page.to}
                    onPageChange={column.page.setPage}
                  />
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {(detailLoading || selected) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setSelected(null);
            setDetailLoading(false);
          }}
        >
          <aside
            className="flex h-[min(812px,88vh)] w-[min(375px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {detailLoading && !selected ? (
              <p className="p-10 text-center text-sm text-gray-500">상세 정보를 불러오는 중…</p>
            ) : selected ? (
              <>
                <div className="border-b border-gray-200 p-6">
                  <div className="flex items-start gap-4">
                    <Avatar user={selected} size="h-16 w-16" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-xl font-bold text-gray-900">{selected.nickname}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          selected.account_status === 'suspended'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-50 text-green-700'
                        }`}>
                          {selected.account_status === 'suspended' ? '정지' : '정상'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {selected.pi_username ? `@${selected.pi_username}` : 'Pi 사용자명 없음'}
                      </p>
                      <p className="mt-1 break-all text-xs text-gray-400">{selected.id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      aria-label="닫기"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {[
                      ['거래', selected.trade_count],
                      ['평점', Number(selected.rating || 0).toFixed(1)],
                      ['신고', selected.reports.length],
                      ['분쟁', selected.disputes.length],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg bg-gray-50 p-2 text-center">
                        <p className="text-[11px] text-gray-400">{label}</p>
                        <p className="mt-0.5 text-sm font-bold text-gray-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex overflow-x-auto border-b border-gray-200 px-4">
                  {TABS.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveTab(tab.value)}
                      className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${
                        activeTab === tab.value
                          ? 'border-[#00A8A3] text-[#007f7b]'
                          : 'border-transparent text-gray-500'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {activeTab === 'basic' && (
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-5 text-sm">
                      <div><dt className="text-xs text-gray-400">가입일</dt><dd className="mt-1">{dateLabel(selected.created_at)}</dd></div>
                      <div><dt className="text-xs text-gray-400">활동 지역</dt><dd className="mt-1">{selected.activity_region || '-'}</dd></div>
                      <div><dt className="text-xs text-gray-400">본인인증</dt><dd className="mt-1">{KYC_LABEL[selected.kyc_status] || selected.kyc_status}</dd></div>
                      <div><dt className="text-xs text-gray-400">판매자 유형</dt><dd className="mt-1">{selected.seller_type || '-'}</dd></div>
                      <div className="col-span-2"><dt className="text-xs text-gray-400">소개</dt><dd className="mt-1 whitespace-pre-wrap">{selected.bio || '-'}</dd></div>
                      {selected.account_status === 'suspended' && (
                        <>
                          <div><dt className="text-xs text-red-400">정지일</dt><dd className="mt-1 text-red-700">{dateLabel(selected.suspended_at)}</dd></div>
                          <div><dt className="text-xs text-red-400">정지 사유</dt><dd className="mt-1 text-red-700">{selected.suspension_reason || '-'}</dd></div>
                        </>
                      )}
                    </dl>
                  )}

                  {activeTab === 'products' && (
                    <ActivityList
                      empty="등록한 상품이 없습니다."
                      rows={selected.products.map((item) => ({
                        id: item.id,
                        title: item.title,
                        meta: `${item.admin_hidden ? '관리자 숨김' : item.status} · ${Number(item.price || 0).toLocaleString()} Pi`,
                        date: item.created_at,
                      }))}
                    />
                  )}
                  {activeTab === 'orders' && (
                    <ActivityList
                      empty="거래 내역이 없습니다."
                      rows={selected.orders.map((item) => ({
                        id: item.id,
                        title: item.buyer_id === selected.id ? '구매 거래' : '판매 거래',
                        meta: `${item.status} · ${Number(item.proposed_price || 0).toLocaleString()} Pi`,
                        date: item.created_at,
                      }))}
                    />
                  )}
                  {activeTab === 'posts' && (
                    <ActivityList
                      empty="작성한 게시글이 없습니다."
                      rows={selected.posts.map((item) => ({
                        id: item.id,
                        title: item.title,
                        meta: `${item.category} · 조회 ${item.view_count || 0}`,
                        date: item.created_at,
                      }))}
                    />
                  )}
                  {activeTab === 'issues' && (
                    <div className="space-y-6">
                      <section>
                        <h3 className="mb-2 text-sm font-bold text-gray-800">신고 {selected.reports.length}건</h3>
                        <ActivityList
                          empty="신고 내역이 없습니다."
                          rows={selected.reports.map((item) => ({
                            id: item.id,
                            title: item.reason || '신고',
                            meta: `${item.target_type} · ${item.status}`,
                            date: item.created_at,
                          }))}
                        />
                      </section>
                      <section>
                        <h3 className="mb-2 text-sm font-bold text-gray-800">분쟁 {selected.disputes.length}건</h3>
                        <ActivityList
                          empty="분쟁 내역이 없습니다."
                          rows={selected.disputes.map((item) => ({
                            id: item.id,
                            title: item.reason || '분쟁',
                            meta: item.status,
                            date: item.created_at,
                          }))}
                        />
                      </section>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-gray-200 bg-white p-4">
                  <button
                    type="button"
                    onClick={() => void handleSuspension(selected)}
                    disabled={suspendingId === selected.id}
                    className="rounded-lg border border-amber-300 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {selected.account_status === 'suspended' ? '정지 해제' : '정지'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(selected)}
                    className="rounded-lg border border-red-300 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
};

function ActivityList({
  rows,
  empty,
}: {
  rows: Array<{ id: string; title: string; meta: string; date: string }>;
  empty: string;
}) {
  if (!rows.length) {
    return <p className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
      {rows.map((row) => (
        <li key={row.id} className="px-4 py-3">
          <p className="truncate text-sm font-semibold text-gray-800">{row.title}</p>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-400">
            <span className="truncate">{row.meta}</span>
            <time className="shrink-0">{new Date(row.date).toLocaleDateString('ko-KR')}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
