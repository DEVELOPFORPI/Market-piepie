import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';
import { AdminPagination, useAdminPage } from '@/components/admin/AdminPagination';

interface ChatRoomRow {
  id: string;
  product_id: string | null;
  order_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  product_title: string | null;
  buyer_nickname: string | null;
  seller_nickname: string | null;
  message_count: number | string;
  deleted_message_count: number | string;
  dispute_count: number | string;
  open_dispute_count: number | string;
  report_count: number | string;
  last_message_time: string | null;
  created_at: string;
  admin_hidden?: boolean | number;
  admin_hidden_reason?: string | null;
}

interface AdminChatMessage {
  id: string;
  sender_id: string | null;
  sender_nickname: string | null;
  content: string | null;
  type: string;
  images: string[] | null;
  proposed_price: number | null;
  deleted_at: string | null;
  deleted_reason: string | null;
  created_at: string;
}

const TEAL = '#00A8A3';

const FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'dispute', label: '분쟁 연결' },
  { value: 'reported', label: '신고 접수' },
  { value: 'deleted', label: '가린 메시지 있음' },
  { value: 'hidden', label: '숨긴 채팅방' },
];

const num = (v: number | string | null | undefined): number => Number(v) || 0;
const isHidden = (v: boolean | number | string | null | undefined): boolean =>
  v === true || v === 1 || v === '1';

export const AdminChats: React.FC = () => {
  const [rooms, setRooms] = useState<ChatRoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<ChatRoomRow | null>(null);
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [messageError, setMessageError] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    if (search.trim()) params.set('q', search.trim());
    const res = await api.get<ChatRoomRow[]>(`/api/admin/chat-rooms?${params.toString()}`, {
      headers: adminPasswordHeaders(),
    });
    setRooms(res.ok && res.data ? res.data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const openRoom = async (room: ChatRoomRow) => {
    setSelected(room);
    setMessages([]);
    setMessageError('');
    setMessagesLoading(true);
    const res = await api.get<AdminChatMessage[]>(`/api/admin/chat-rooms/${room.id}/messages`, {
      headers: adminPasswordHeaders(),
    });
    setMessagesLoading(false);
    if (!res.ok) {
      setMessageError(res.error || `대화를 불러오지 못했습니다 (HTTP ${res.status})`);
      return;
    }
    setMessages(res.data || []);
  };

  const toggleMessageHidden = async (msg: AdminChatMessage) => {
    const hide = !msg.deleted_at;
    let reason: string | null = null;
    if (hide) {
      reason = prompt('가리는 사유를 남겨주세요. (선택)') ?? null;
    } else if (!confirm('이 메시지를 다시 보이게 할까요?')) {
      return;
    }
    const res = await api.put(`/api/admin/chat-messages/${msg.id}`,
      { deleted: hide, reason },
      { headers: adminPasswordHeaders() },
    );
    if (!res.ok) {
      alert(`처리 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    setMessages((prev) => prev.map((m) => (
      m.id === msg.id
        ? { ...m, deleted_at: hide ? new Date().toISOString() : null, deleted_reason: hide ? reason : null }
        : m
    )));
    load();
  };

  const handleHideRoom = async (room: ChatRoomRow) => {
    const hide = !isHidden(room.admin_hidden);
    let reason: string | null = null;
    if (hide) {
      reason = prompt('사용자에게 이 채팅방을 숨깁니다. 사유를 남겨주세요. (선택)') ?? null;
    } else if (!confirm('이 채팅방을 다시 보이게 할까요?')) {
      return;
    }
    const res = await api.put(`/api/admin/chat-rooms/${room.id}`,
      { hidden: hide, reason },
      { headers: adminPasswordHeaders() },
    );
    if (!res.ok) {
      alert(`처리 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    setSelected((cur) => (cur?.id === room.id ? { ...cur, admin_hidden: hide ? 1 : 0, admin_hidden_reason: hide ? reason : null } : cur));
    load();
  };

  const handleDeleteRoom = async (room: ChatRoomRow) => {
    const extra = (num(room.dispute_count) > 0 || num(room.report_count) > 0)
      ? '\n이 방에는 분쟁 또는 신고가 연결되어 있습니다.'
      : '';
    if (!confirm(`채팅방 ${room.id}를 삭제할까요?\n대화 내용이 모두 사라지며 되돌릴 수 없습니다.${extra}`)) return;
    const res = await api.delete(`/api/admin/chat-rooms/${room.id}`, { headers: adminPasswordHeaders() });
    if (!res.ok) {
      alert(`삭제 실패: ${res.error || `HTTP ${res.status}`}`);
      return;
    }
    setSelected(null);
    load();
  };

  const paged = useAdminPage(rooms, `${search}|${filter}|${rooms.length}`);
  const disputeRooms = useMemo(
    () => rooms.filter((r) => num(r.dispute_count) > 0).length,
    [rooms],
  );

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">채팅 관리</h1>
        <div className="flex items-center gap-3">
          {disputeRooms > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
              분쟁 연결 {disputeRooms}개
            </span>
          )}
          <span className="text-sm text-gray-500">{rooms.length}개</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-6">
        숨기면 사용자 목록에서만 빠지고 대화는 남습니다. 삭제는 대화를 통째로 지웁니다.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="상품명/닉네임/채팅방 ID 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
        </form>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button onClick={() => load()} className="px-4 py-2.5 text-sm text-white rounded-lg" style={{ backgroundColor: TEAL }}>
          검색
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
          불러오는 중…
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">조건에 맞는 채팅방이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paged.items.map((r) => (
            <div key={r.id} onClick={() => openRoom(r)}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {num(r.open_dispute_count) > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">분쟁중</span>
                    ) : num(r.dispute_count) > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">분쟁 이력</span>
                    ) : null}
                    {num(r.report_count) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                        신고 {num(r.report_count)}
                      </span>
                    )}
                    {num(r.deleted_message_count) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
                        가림 {num(r.deleted_message_count)}
                      </span>
                    )}
                    {isHidden(r.admin_hidden) && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white text-xs font-medium">숨김</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(r.last_message_time || r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1 truncate">
                    {r.product_title || '삭제된 상품'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span>구매자 {r.buyer_nickname || (r.buyer_id?.slice(0, 8) ?? '-')}</span>
                    <span>판매자 {r.seller_nickname || (r.seller_id?.slice(0, 8) ?? '-')}</span>
                    <span>메시지 {num(r.message_count)}개</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleHideRoom(r); }}
                    className="text-gray-600 text-xs font-medium hover:underline"
                  >
                    {isHidden(r.admin_hidden) ? '숨김 해제' : '숨기기'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteRoom(r); }}
                    className="text-red-500 text-xs font-medium hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
          <AdminPagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            onPageChange={paged.setPage}
          />
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">채팅방 상세</h2>
              <span className="text-xs text-gray-400">메시지 {num(selected.message_count)}개</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <span className="text-gray-400 text-xs">상품</span>
                <p className="font-medium truncate">{selected.product_title || '삭제된 상품'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">주문 ID</span>
                <p className="font-medium truncate">{selected.order_id || '-'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">구매자</span>
                <p className="font-medium">{selected.buyer_nickname || selected.buyer_id || '-'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">판매자</span>
                <p className="font-medium">{selected.seller_nickname || selected.seller_id || '-'}</p>
              </div>
            </div>

            {messageError ? (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-center text-sm text-gray-500">
                {messageError}
              </div>
            ) : messagesLoading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-6">
                <div className="w-5 h-5 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
                대화를 불러오는 중…
              </div>
            ) : (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto rounded-lg bg-gray-50 p-3">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">메시지가 없습니다.</p>
                ) : messages.map((m) => (
                  <div key={m.id} className={`rounded-lg border p-3 ${
                    m.deleted_at ? 'border-gray-200 bg-gray-100' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {m.sender_nickname || m.sender_id?.slice(0, 8) || '시스템'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                      {m.deleted_at && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-300 text-gray-700 text-[11px]">가려짐</span>
                      )}
                      <button
                        onClick={() => toggleMessageHidden(m)}
                        className={`ml-auto text-xs font-medium hover:underline ${
                          m.deleted_at ? 'text-gray-600' : 'text-red-500'
                        }`}
                      >
                        {m.deleted_at ? '되돌리기' : '가리기'}
                      </button>
                    </div>
                    <p className={`text-sm whitespace-pre-wrap ${m.deleted_at ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {m.content || '(내용 없음)'}
                    </p>
                    {m.images && m.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto mt-2">
                        {m.images.map((img, idx) => (
                          <a key={idx} href={img} target="_blank" rel="noreferrer">
                            <img src={img} alt="" className="w-20 h-20 object-cover rounded border border-gray-200 hover:opacity-80" />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.deleted_reason && (
                      <p className="text-[11px] text-gray-500 mt-1">사유: {m.deleted_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-400 break-all mt-3">ID: {selected.id}</div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                닫기
              </button>
              <button onClick={() => handleHideRoom(selected)}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                {isHidden(selected.admin_hidden) ? '숨김 해제' : '채팅방 숨기기'}
              </button>
              <button onClick={() => handleDeleteRoom(selected)}
                className="flex-1 py-2.5 text-sm text-white font-medium rounded-lg bg-red-500 hover:bg-red-600">
                채팅방 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
