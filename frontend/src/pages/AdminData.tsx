import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

interface PaymentSummary {
  completed_count: number;
  completed_amount: number;
  cancelled_count: number;
  pending_count: number;
  verification_count: number;
  badge_count: number;
  orphan_count: number;
  week_count: number;
  week_amount: number;
}

interface Stats {
  payments?: PaymentSummary;
  users: number;
  products: number;
  orders: number;
  completedOrders: number;
  posts: number;
  chatRooms: number;
  disputes: number;
  openDisputes: number;
  reviews: number;
  freeShareProducts: number;
  inquiries: number;
  reports: number;
  openReports: number;
  pendingInquiries: number;
  suspendedUsers: number;
  hiddenProducts: number;
  usersToday: number;
  usersWeek: number;
  productsForSale: number;
  productsReserved: number;
  productsSold: number;
  ordersPending: number;
  ordersDispute: number;
  ordersInProgress: number;
  publishedNotices: number;
  enabledPopups: number;
  recentUsers: { id: string; nickname: string; created_at: string }[];
  recentOrders: { id: string; status: string; created_at: string }[];
  recentOpenReports: { id: string; target_type: string; reason: string; status: string; created_at: string }[];
  recentPendingInquiries: { id: string; title: string; status: string; created_at: string }[];
  recentOpenDisputes: { id: string; reason: string | null; status: string; created_at: string }[];
}

const TEAL = '#00A8A3';

function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: '완료',
    complete: '완료',
    '완료': '완료',
    pending_offer: '제안중',
    '제안중': '제안중',
    offer_declined: '제안거절',
    '제안거절': '제안거절',
    accepted: '수락됨',
    '수락됨': '수락됨',
    meetup_set: '약속확정',
    '약속확정': '약속확정',
    received: '수령완료',
    '수령완료': '수령완료',
    dispute: '분쟁',
    '분쟁': '분쟁',
    '관리자해결': '관리자 해결',
  };
  return map[status] || status;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('ko-KR');
}

function StatCard({
  label,
  value,
  color,
  sub,
  to,
}: {
  label: string;
  value: number | string;
  color?: string;
  sub?: string;
  to?: string;
}) {
  const body = (
    <>
      <p className="mb-1 text-xs font-medium text-gray-400">{label}</p>
      <p className="text-3xl font-bold" style={{ color: color || '#1a1a1a' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#00A8A3]/40 hover:shadow-md"
      >
        {body}
      </Link>
    );
  }

  return <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">{body}</div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-gray-800">{value.toLocaleString()}</p>
    </div>
  );
}

export const AdminData: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<Stats>('/api/admin/stats', { headers: adminPasswordHeaders() });
      if (!res.ok || !res.data) {
        setLoadError(res.error || '통계를 불러오지 못했습니다. API 서버 또는 관리자 비밀번호를 확인하세요.');
        if (!isRefresh) setStats(null);
      } else {
        setStats(res.data);
        setRefreshedAt(new Date());
      }
    } catch (e) {
      console.error('Stats load error:', e);
      setLoadError('통계를 불러오지 못했습니다.');
      if (!isRefresh) setStats(null);
    }
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500 lg:p-10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#00A8A3] border-t-transparent" />
        대시보드 불러오는 중…
      </div>
    );
  }

  if (!stats && !loading) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">대시보드</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError || '통계를 불러올 수 없습니다.'}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const recentUsers = stats.recentUsers ?? [];
  const recentOrders = stats.recentOrders ?? [];
  const recentOpenReports = stats.recentOpenReports ?? [];
  const recentPendingInquiries = stats.recentPendingInquiries ?? [];
  const recentOpenDisputes = stats.recentOpenDisputes ?? [];
  const payments = stats.payments;
  const piAmount = (value: number) =>
    `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} Pi`;

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="text-xs text-gray-400">
              {refreshedAt.toLocaleTimeString()} 기준
            </span>
          )}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? '새로고침 중…' : '새로고침'}
          </button>
        </div>
      </div>
      {loadError && stats && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="전체 사용자"
          value={stats.users}
          color={TEAL}
          sub={`오늘 ${stats.usersToday ?? 0} · 7일 ${stats.usersWeek ?? 0}`}
          to="/admin/users"
        />
        <StatCard
          label="정지 사용자"
          value={stats.suspendedUsers ?? 0}
          color={(stats.suspendedUsers ?? 0) > 0 ? '#ef4444' : undefined}
          to="/admin/users"
        />
        <StatCard
          label="상품"
          value={stats.products}
          sub={`무료 나눔 ${stats.freeShareProducts} · 숨김 ${stats.hiddenProducts ?? 0}`}
          to="/admin/products"
        />
        <StatCard
          label="주문"
          value={stats.orders}
          sub={`완료 ${stats.completedOrders} · 분쟁 ${stats.ordersDispute ?? 0}`}
        />
        <StatCard label="게시물" value={stats.posts} to="/admin/posts" />
        <StatCard label="채팅방" value={stats.chatRooms} to="/admin/chats" />
        <StatCard
          label="신고"
          value={stats.reports ?? 0}
          color={(stats.openReports ?? 0) > 0 ? '#ef4444' : undefined}
          sub={`진행 중 ${stats.openReports ?? 0}건`}
          to="/admin/reports"
        />
        <StatCard
          label="분쟁"
          value={stats.disputes}
          color={stats.openDisputes > 0 ? '#ef4444' : undefined}
          sub={`진행 중 ${stats.openDisputes}건`}
          to="/admin/disputes"
        />
        <StatCard label="리뷰" value={stats.reviews} />
        <StatCard
          label="문의"
          value={stats.inquiries ?? 0}
          color={(stats.pendingInquiries ?? 0) > 0 ? '#d97706' : undefined}
          sub={`미답변 ${stats.pendingInquiries ?? 0}건`}
          to="/admin/inquiries"
        />
        <StatCard
          label="결제 수입"
          value={piAmount(payments?.completed_amount ?? 0)}
          color={TEAL}
          sub={`완료 ${payments?.completed_count ?? 0}건 · 7일 ${piAmount(payments?.week_amount ?? 0)}`}
          to="/admin/payments"
        />
        <StatCard
          label="결제 후 가입 실패"
          value={payments?.orphan_count ?? 0}
          color={(payments?.orphan_count ?? 0) > 0 ? '#ef4444' : undefined}
          sub="계정 복구 필요"
          to="/admin/payments"
        />
        <StatCard label="게시 공지" value={stats.publishedNotices ?? 0} to="/admin/notices" />
        <StatCard label="활성 홈팝업" value={stats.enabledPopups ?? 0} to="/admin/popup" />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">상품 상태</h2>
            <Link to="/admin/products" className="text-xs text-[#007f7b] hover:underline">
              상품 관리
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="판매중" value={stats.productsForSale ?? 0} />
            <MiniStat label="예약중" value={stats.productsReserved ?? 0} />
            <MiniStat label="판매완료" value={stats.productsSold ?? 0} />
            <MiniStat label="숨김" value={stats.hiddenProducts ?? 0} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-900">주문 상태</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="제안중" value={stats.ordersPending ?? 0} />
            <MiniStat label="진행중" value={stats.ordersInProgress ?? 0} />
            <MiniStat label="완료" value={stats.completedOrders} />
            <MiniStat label="분쟁" value={stats.ordersDispute ?? 0} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">결제 현황</h2>
            <Link to="/admin/payments" className="text-xs text-[#007f7b] hover:underline">
              결제 내역
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="본인인증비" value={payments?.verification_count ?? 0} />
            <MiniStat label="배지 구매" value={payments?.badge_count ?? 0} />
            <MiniStat label="진행중" value={payments?.pending_count ?? 0} />
            <MiniStat label="취소" value={payments?.cancelled_count ?? 0} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">최근 가입 사용자</h2>
            <Link to="/admin/users" className="text-xs text-[#007f7b] hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="space-y-2">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-gray-700">{u.nickname}</span>
                <span className="shrink-0 text-xs text-gray-400">{dateLabel(u.created_at)}</span>
              </div>
            ))}
            {recentUsers.length === 0 && <p className="text-sm text-gray-400">아직 사용자가 없습니다</p>}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-900">최근 주문</h2>
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-gray-700">{o.id}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      o.status === 'completed' || o.status === '완료'
                        ? 'bg-green-100 text-green-700'
                        : o.status === '분쟁' || o.status === 'dispute'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {orderStatusLabel(o.status)}
                  </span>
                  <span className="text-xs text-gray-400">{dateLabel(o.created_at)}</span>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && <p className="text-sm text-gray-400">아직 주문이 없습니다</p>}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">열린 신고</h2>
            <Link to="/admin/reports" className="text-xs text-[#007f7b] hover:underline">
              신고 관리
            </Link>
          </div>
          <div className="space-y-2">
            {recentOpenReports.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-gray-800">{item.reason}</p>
                  <p className="text-xs text-gray-400">{item.target_type}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">{dateLabel(item.created_at)}</span>
              </div>
            ))}
            {recentOpenReports.length === 0 && (
              <p className="text-sm text-gray-400">처리할 신고가 없습니다</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">미답변 문의 · 진행 분쟁</h2>
            <div className="flex gap-3">
              <Link to="/admin/inquiries" className="text-xs text-[#007f7b] hover:underline">
                문의
              </Link>
              <Link to="/admin/disputes" className="text-xs text-[#007f7b] hover:underline">
                분쟁
              </Link>
            </div>
          </div>
          <div className="space-y-2">
            {recentPendingInquiries.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-gray-800">{item.title}</p>
                  <p className="text-xs text-amber-600">문의</p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">{dateLabel(item.created_at)}</span>
              </div>
            ))}
            {recentOpenDisputes.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-gray-800">{item.reason || item.id}</p>
                  <p className="text-xs text-orange-600">분쟁</p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">{dateLabel(item.created_at)}</span>
              </div>
            ))}
            {recentPendingInquiries.length === 0 && recentOpenDisputes.length === 0 && (
              <p className="text-sm text-gray-400">대기 중인 문의·분쟁이 없습니다</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
