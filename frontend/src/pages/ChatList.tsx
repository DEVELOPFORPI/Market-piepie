import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChatRooms, getOtherUser, leaveChatRoom, addRemoteMessage, addRemoteRoom, updateRoomFromRemote, isChatRoomEnded } from '@/utils/chatStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { getProductById } from '@/utils/productStorage';
import { ChatRoom } from '@/types';
import { displayChatMessageContent, relativeTimeShort } from '@/locale/enUI';
import { connectChatSocket, onNewMessage, onRoomUpdated, onNewRoom } from '@/utils/chatSocket';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';
import { resolveDisplayNickname, resolveProfileAvatarUrl } from '@/utils/profileStorage';
import { UserAvatarImage } from '@/components/common/UserAvatarImage';
import { NotificationBellButton } from '@/components/common/NotificationBellButton';
import { syncChatRoomsFromDB, syncNotificationsFromDB } from '@/utils/dbSync';
import { useLanguage } from '@/hooks/useLanguage';
import { LocalizedRegionText } from '@/hooks/useLocalizedRegion';

export const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  useGuestPageGuard('chat');

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [contextMenu, setContextMenu] = useState<{ roomId: string; x: number; y: number } | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const loadRooms = () => {
    const all = getChatRooms();
    all.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    setRooms(all);
  };

  useEffect(() => {
    loadRooms();
    connectChatSocket();

    window.addEventListener('chatRoomsChanged', loadRooms);
    window.addEventListener('userProfilesChanged', loadRooms);
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'all_chatrooms' || e.key === 'all_products' || e.key?.startsWith('user_profile_')) loadRooms();
    };
    window.addEventListener('storage', handleStorageChange);

    const unsubMsg = onNewMessage((data) => {
      addRemoteMessage(data.roomId, data.message);
      loadRooms();
    });
    const unsubUpdate = onRoomUpdated((data) => {
      updateRoomFromRemote(data.roomId, data.lastMessage, data.lastMessageTime);
      loadRooms();
    });
    const unsubNewRoom = onNewRoom((data) => {
      addRemoteRoom(data.room);
      loadRooms();
    });

    const uid = getCurrentUserId();
    let intervalId: number | undefined;
    const pullChatsFromServer = () => {
      if (!uid) return Promise.resolve();
      return syncChatRoomsFromDB(uid).then(() => loadRooms());
    };
    if (uid) {
      syncNotificationsFromDB(uid);
      void pullChatsFromServer();
      // Realtime can miss rooms; polling keeps seller (and buyer) lists aligned with DB
      intervalId = window.setInterval(() => void pullChatsFromServer(), 25000);
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void pullChatsFromServer();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('chatRoomsChanged', loadRooms);
      window.removeEventListener('userProfilesChanged', loadRooms);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalId != null) window.clearInterval(intervalId);
      unsubMsg();
      unsubUpdate();
      unsubNewRoom();
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const userId = getCurrentUserId();

  const exitDeleteMode = () => {
    setDeleteMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selectedIds.size > 0 && selectedIds.size === rooms.length;
  const handleSelectAllToggle = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(rooms.map((r) => r.id)));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t('leaveNChatsConfirm', { n: selectedIds.size }))) return;
    selectedIds.forEach((id) => { leaveChatRoom(id); });
    loadRooms();
    setSelectedIds(new Set());
    setDeleteMode(false);
  };

  const handleTouchStart = useCallback((roomId: string, e: React.TouchEvent) => {
    if (deleteMode) return;
    longPressTriggered.current = false;
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setContextMenu({ roomId, x, y });
    }, 500);
  }, [deleteMode]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback((roomId: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    navigate(`/chat/${roomId}`);
  }, [navigate]);

  const handleLeaveRoom = (roomId: string) => {
    setContextMenu(null);
    if (confirm(t('leaveChatConfirm'))) {
      void leaveChatRoom(roomId).then(() => loadRooms());
    }
  };

  const handleContextMenu = useCallback((roomId: string, e: React.MouseEvent) => {
    if (deleteMode) return;
    e.preventDefault();
    setContextMenu({ roomId, x: e.clientX, y: e.clientY });
  }, [deleteMode]);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <h1 className="text-lg font-bold text-gray-900">{t('chatsTitle')}</h1>
          <div className="flex items-center gap-1">
            {deleteMode ? (
              <>
                <button
                  onClick={handleSelectAllToggle}
                  className="text-sm font-medium px-2"
                  style={{ color: '#00A8A3' }}
                >
                  {allSelected ? t('unselectAll') : t('selectAll')}
                </button>
                <button onClick={exitDeleteMode} className="text-sm font-medium text-gray-600 px-2">
                  {t('cancel')}
                </button>
              </>
            ) : (
              <>
                <NotificationBellButton />
                {rooms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteMode(true)}
                    className="p-2 text-gray-700"
                    aria-label={t('deleteAria')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat Rooms */}
      <div>
        {rooms.map((room) => {
          const other = getOtherUser(room);
          const isRead = room.readStatus ? room.readStatus[userId || ''] !== false : (room.isRead ?? true);
          const productDeleted = room.product?.id ? !getProductById(room.product.id) : false;
          const roomEnded = isChatRoomEnded(room);
          const muted = productDeleted || roomEnded;
          const selected = selectedIds.has(room.id);

          return (
            <div
              key={room.id}
              onClick={() => {
                if (deleteMode) {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(room.id)) next.delete(room.id);
                    else next.add(room.id);
                    return next;
                  });
                } else {
                  handleClick(room.id);
                }
              }}
              onContextMenu={(e) => handleContextMenu(room.id, e)}
              onTouchStart={(e) => handleTouchStart(room.id, e)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              className={`border-b border-gray-100 cursor-pointer select-none transition-colors ${
                muted ? 'bg-gray-50 opacity-70' : selected ? 'bg-gray-100' : 'hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              {productDeleted && (
                <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
                  <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                  </svg>
                  <span className="text-xs text-red-400 font-medium">{t('listingUnavailable')}</span>
                </div>
              )}
              {roomEnded && !productDeleted && (
                <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
                  <span className="text-xs text-gray-400 font-medium">{t('ended')}</span>
                </div>
              )}

              <div className="flex items-center gap-3 px-4 py-4">
                {deleteMode && (
                  <button
                    type="button"
                    onClick={(e) => toggleSelect(room.id, e)}
                    className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      selected ? 'border-[#00A8A3] bg-[#00A8A3]' : 'border-gray-300 hover:border-[#00A8A3]'
                    }`}
                    aria-label={t('selectAria')}
                  >
                    {selected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                {room.product ? (
                  <div className={`relative w-14 h-14 flex-shrink-0 ${muted ? 'opacity-60' : ''}`}>
                    <div className={`w-14 h-14 rounded-xl overflow-hidden bg-gray-100 ${muted ? 'grayscale' : ''}`}>
                      <img
                        src={room.product.images[0] || '/placeholder.jpg'}
                        alt={room.product.title}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-sm">
                      <UserAvatarImage
                        src={resolveProfileAvatarUrl(other.id, other.profileImage)}
                        alt={resolveDisplayNickname(other.id, other.nickname)}
                        imgClassName="w-full h-full object-cover"
                        iconClassName="w-3.5 h-3.5 text-gray-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div className={`relative w-14 h-14 flex-shrink-0 rounded-full overflow-hidden bg-gray-200 ${muted ? 'opacity-60 grayscale' : ''}`}>
                    <UserAvatarImage
                      src={resolveProfileAvatarUrl(other.id, other.profileImage)}
                      alt={resolveDisplayNickname(other.id, other.nickname)}
                      imgClassName="w-full h-full object-cover"
                      iconClassName="w-7 h-7 text-gray-400"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-sm font-bold truncate ${muted ? 'text-gray-400' : 'text-gray-900'}`}>
                      {resolveDisplayNickname(other.id, other.nickname)}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {room.product?.region ? (
                        <>
                          <LocalizedRegionText region={room.product.region} />
                          {' · '}
                        </>
                      ) : null}
                      {relativeTimeShort(room.lastMessageTime)}
                    </span>
                  </div>
                  <p className={`text-sm truncate ${muted ? 'text-gray-400' : 'text-gray-500'}`}>
                    {room.lastMessage ? displayChatMessageContent(room.lastMessage) : t('sayHello')}
                  </p>
                </div>

                {!deleteMode && !isRead && !roomEnded && (
                  <span
                    className="min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: '#00A8A3' }}
                  >
                    N
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {rooms.length === 0 && (
        <div className="text-center py-16">
          <svg className="w-14 h-14 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm text-gray-400">{t('noChatsYet')}</p>
        </div>
      )}

      {/* Delete floating button — 화면 하단 가운데 팝업 */}
      {deleteMode && selectedIds.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[60]" style={{ bottom: '80px' }}>
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-white rounded-full shadow-lg"
            style={{ backgroundColor: '#ef4444' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t('leaveNChats', { n: selectedIds.size })}
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && !deleteMode && (
        <div
          className="fixed z-[70] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 160),
            top: Math.min(contextMenu.y, window.innerHeight - 50),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleLeaveRoom(contextMenu.roomId)}
            className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('leaveChat')}
          </button>
        </div>
      )}
    </div>
  );
};
