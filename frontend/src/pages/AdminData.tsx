import React, { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

interface Stats {
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
  inquiries?: number;
  recentUsers: { id: string; nickname: string; created_at: string }[];
  recentOrders: { id: string; status: string; created_at: string }[];
}

const TEAL = '#00A8A3';

function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: '완료',
    complete: '완료',
    pending_offer: '제안 대기',
    accepted: '수락됨',
    received: '수령 확인',
    dispute: '분쟁',
  };
  return map[status.toLowerCase()] || status;
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold" style={{ color: color || '#1a1a1a' }}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export const AdminData: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await api.get<Stats>('/api/admin/stats', { headers: adminPasswordHeaders() });
        if (!res.ok || !res.data) {
          setLoadError(res.error || '통계를 불러오지 못했습니다. API 서버 또는 관리자 비밀번호를 확인하세요.');
          setStats(null);
        } else {
          setStats(res.data);
        }
      } catch (e) {
        console.error('Stats load error:', e);
        setLoadError('통계를 불러오지 못했습니다.');
        setStats(null);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-10 flex items-center gap-2 text-gray-500 text-sm">
        <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
        대시보드 불러오는 중…
      </div>
    );
  }

  if (!stats && !loading) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">대시보드</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError || '통계를 불러올 수 없습니다.'}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const recentUsers = stats.recentUsers ?? [];
  const recentOrders = stats.recentOrders ?? [];

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>
      <p className="text-xs text-gray-500 mb-4">
        앱과 동일한 API 서버 DB 기준입니다. (Supabase 대시보드 숫자와 다를 수 있습니다.)
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="전체 사용자" value={stats.users} color={TEAL} />
        <StatCard label="상품" value={stats.products} sub={`무료 나눔 ${stats.freeShareProducts}개`} />
        <StatCard label="주문" value={stats.orders} sub={`완료 ${stats.completedOrders}건`} />
        <StatCard label="게시물" value={stats.posts} />
        <StatCard label="채팅방" value={stats.chatRooms} />
        <StatCard label="분쟁" value={stats.disputes} color={stats.openDisputes > 0 ? '#ef4444' : undefined} sub={`진행 중 ${stats.openDisputes}건`} />
        <StatCard label="리뷰" value={stats.reviews} />
        <StatCard label="문의" value={stats.inquiries ?? 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">최근 가입 사용자</h2>
          <div className="space-y-2">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{u.nickname}</span>
                <span className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {recentUsers.length === 0 && <p className="text-sm text-gray-400">아직 사용자가 없습니다</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">최근 주문</h2>
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate max-w-[150px]">{o.id}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    o.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>{orderStatusLabel(o.status)}</span>
                  <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && <p className="text-sm text-gray-400">아직 주문이 없습니다</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
