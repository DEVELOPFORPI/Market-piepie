import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ToastHost } from './components/common/ToastHost';
import { SplashScreen } from './components/SplashScreen';
import { BottomTab } from './components/navigation/BottomTab';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Community } from './pages/Community';
import { PostDetail } from './pages/PostDetail';
import { PostWrite } from './pages/PostWrite';
import { Notifications } from './pages/Notifications';
import { BarterProductSelect } from './pages/BarterProductSelect';
import { BarterOfferWrite } from './pages/BarterOfferWrite';
import { BarterComplete } from './pages/BarterComplete';
import { Register } from './pages/Register';
import { ChatList } from './pages/ChatList';
import { My } from './pages/My';
import { ProductDetail } from './pages/ProductDetail';
import { SellerProfile } from './pages/SellerProfile';
import { ChatRoom } from './pages/ChatRoom';
import { Offer } from './pages/Offer';
import { OrderTimeline } from './pages/OrderTimeline';
import { ReviewWrite } from './pages/ReviewWrite';
import { Dispute } from './pages/Dispute';
import { ProfileEdit } from './pages/ProfileEdit';
import { MyProducts } from './pages/MyProducts';
import { MyFavorites } from './pages/MyFavorites';
import { MyOrders } from './pages/MyOrders';
import { MyDisputes } from './pages/MyDisputes';
import { MyReviews } from './pages/MyReviews';
import { MyPosts } from './pages/MyPosts';
import { MyInquiries } from './pages/MyInquiries';
import { Settings } from './pages/Settings';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDisputes } from './pages/AdminDisputes';
import { AdminHomePopup } from './pages/AdminHomePopup';
import { AdminNotices } from './pages/AdminNotices';
import { AdminUsers } from './pages/AdminUsers';
import { AdminData } from './pages/AdminData';
import { AdminInquiries } from './pages/AdminInquiries';
import { AdminProducts } from './pages/AdminProducts';
import { AdminPosts } from './pages/AdminPosts';
import { AdminReports } from './pages/AdminReports';
import { InquiryWrite } from './pages/InquiryWrite';
import { AdminPassword } from './pages/AdminPassword';
import { RegisterComplete } from './pages/RegisterComplete';
import { ShippingInfo } from './pages/ShippingInfo';
import { ShippingInfoInput } from './pages/ShippingInfoInput';
import { ShippingInfoRequest } from './pages/ShippingInfoRequest';
import { MeetupSchedule } from './pages/MeetupSchedule';
import { ReceiveConfirm } from './pages/ReceiveConfirm';
import { CompleteCheck } from './pages/CompleteCheck';
import { RegionSelect } from './pages/RegionSelect';
import { NoticeDetail } from './pages/NoticeDetail';
import { NoticeList } from './pages/NoticeList';
import { Welcome } from './pages/Welcome';
import { SignupProfile } from './pages/SignupProfile';
import { AppLogin } from './pages/AppLogin';
import { isLoggedIn, getCurrentUserId, ensureImplicitSession, isTestPresetUser } from './utils/authStorage';
import { isTestLoginEnabled } from './config/features';
import { api } from './utils/api';
import { initDBSync, syncProductsFromDB, syncNotificationsFromDB, syncChatRoomsFromDB } from './utils/dbSync';
import { isApiRateLimited } from './utils/api';
import { connectChatSocket, disconnectChatSocket, onRoomUpdated, onNewRoom, onNewMessage, onOrderUpdated, onProductFeedChange, onNotification } from './utils/chatSocket';
import { addRemoteMessage, addRemoteRoom, updateRoomFromRemote, getChatRoom } from './utils/chatStorage';
import { mergeRemoteOrder } from './utils/orderStorage';
import { removeProductLocally } from './utils/productStorage';
import {
  isOnboardingComplete,
  isOnboardingExemptPath,
  isUnauthenticatedAllowedPath,
  syncDeviceProfileOnceFromLegacyOnboarding,
} from './utils/onboardingStorage';
import { getDisputes } from './utils/disputeStorage';
import { preloadHeavyStorage } from './utils/heavyStorage';
import { syncActivityBadgesFromStats } from './utils/activityBadgeStorage';
import { pruneInvalidDisplayActivityBadge } from './utils/profileStorage';
import { isAdminVerified } from './utils/adminAccessStorage';

const HIDE_NAV_PATHS = [
  '/register',
  '/register/complete',
  '/community/write',
  '/login',
  '/notifications',
  '/notices',
  '/welcome',
  '/signup',
  '/login-app',
  '/settings',
  '/admin-auth',
  '/inquiry',
];

const HIDE_NAV_PREFIXES = [
  '/admin',
  '/register/edit/',
  '/product/',
  '/profile/edit',
  '/offer/',
  '/order/',
  '/my/products',
  '/my/orders',
  '/my/favorites',
  '/my/disputes',
  '/my/reviews',
  '/my/posts',
  '/my/inquiries',
  '/review/',
  '/region/',
  '/community/post/',
  '/community/edit/',
  '/dispute',
  '/notices/',
  '/receive/',
  '/complete-check/',
  '/meetup/',
];

function shouldHideNav(pathname: string, search: string): boolean {
  if (HIDE_NAV_PATHS.includes(pathname)) return true;
  if (HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (/^\/seller\/[^/]+$/.test(pathname)) return true;
  if (pathname === '/my' && new URLSearchParams(search).get('tab') === 'badges') return true;
  if (pathname.startsWith('/chat/') && pathname !== '/chat') return true;
  return false;
}

/** Open disputes filed by the counterparty (global alert banner) */
function getCounterpartyOpenDisputes() {
  const userId = getCurrentUserId();
  if (!userId) return [];
  return getDisputes().filter(
    (d) =>
      (d.buyerId === userId || d.sellerId === userId)
      && d.status !== 'RESOLVED'
      && d.openedByUserId
      && d.openedByUserId !== userId,
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    // Chat room manages its own scroll (latest messages at bottom).
    if (/^\/chat\/[^/]+$/.test(location.pathname)) return;
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  return null;
}

function AppContent({ showSplash, heavyReady }: { showSplash: boolean; heavyReady: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const testModeEnabled = isTestLoginEnabled();

  useEffect(() => {
    if (testModeEnabled) return;
    if (location.pathname.startsWith('/admin') || location.pathname === '/admin-auth') return;
    if (location.pathname === "/app-login" || location.pathname === "/welcome") return;
    if (typeof window !== "undefined" && /PiBrowser/i.test(navigator.userAgent) && !sessionStorage.getItem("currentUserId")) return;
    ensureImplicitSession();
  }, [testModeEnabled, location.pathname]);

  useEffect(() => {
    if (!heavyReady) return;
    const kick = async () => {
      await ensureImplicitSession();
      const userId = getCurrentUserId() || undefined;
      initDBSync(userId);
      connectChatSocket();
    };
    kick();
    return () => { disconnectChatSocket(); };
  }, [heavyReady]);

  useEffect(() => {
    if (!heavyReady) return;

    const productPollInterval = setInterval(() => {
      if (!isApiRateLimited()) syncProductsFromDB();
    }, 60000);

    const unsubProduct = onProductFeedChange((data) => {
      if (data.action === 'deleted') {
        removeProductLocally(data.productId);
      } else {
        syncProductsFromDB();
      }
    });

    // 로그인 세션이 이 시점에 아직 없어도 폴링·구독은 등록한다.
    // (uid는 매 tick마다 조회하므로 이후 로그인되면 자동으로 동작)
    const userId = getCurrentUserId() || undefined;
    console.log('[APP] socket/poll useEffect', { heavyReady, userId: userId ? userId.slice(-6) : 'NONE' });

    // 방이 로컬에 없으면 DB에서 방 목록을 먼저 받아온 뒤 반영 (메시지 유실 방지)
    const withRoomSynced = (roomId: string, apply: () => void) => {
      if (getChatRoom(roomId)) {
        apply();
        return;
      }
      const uid = getCurrentUserId();
      if (uid) void syncChatRoomsFromDB(uid).then(apply);
    };
    const unsubMsg = onNewMessage((data) => {
      withRoomSynced(data.roomId, () => addRemoteMessage(data.roomId, data.message));
    });
    const unsubUpdate = onRoomUpdated((data) => {
      withRoomSynced(data.roomId, () => updateRoomFromRemote(data.roomId, data.lastMessage, data.lastMessageTime));
    });
    const unsubNewRoom = onNewRoom((data) => {
      addRemoteRoom(data.room);
    });
    const unsubOrder = onOrderUpdated((data) => {
      if (data.order) mergeRemoteOrder(data.order as import('./types').Order);
    });
    const unsubNotif = onNotification(() => {
      const uid = getCurrentUserId();
      if (uid) syncNotificationsFromDB(uid);
    });

    // Fallback 알림 폴링 (10초마다) - Supabase Realtime이 실패해도 알림 받을 수 있게
    const notifPollInterval = setInterval(() => {
      const uid = getCurrentUserId();
      if (!uid || isApiRateLimited()) return;
      void syncNotificationsFromDB(uid);
    }, 30000);

    const chatPollInterval = setInterval(() => {
      const uid = getCurrentUserId();
      if (!uid || isApiRateLimited()) return;
      connectChatSocket();
      void syncChatRoomsFromDB(uid);
    }, 20000);

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const uid = getCurrentUserId();
      if (uid) void syncChatRoomsFromDB(uid);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disconnectChatSocket();
      unsubMsg();
      unsubUpdate();
      unsubNewRoom();
      unsubOrder();
      unsubProduct();
      unsubNotif();
      clearInterval(productPollInterval);
      clearInterval(notifPollInterval);
      clearInterval(chatPollInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [heavyReady]);
  const [myOpenDisputes, setMyOpenDisputes] = useState(getCounterpartyOpenDisputes());
  /** Dismissed dispute banner orderIds for this session */
  const [dismissedDisputeOrderIds, setDismissedDisputeOrderIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const refresh = () => setMyOpenDisputes(getCounterpartyOpenDisputes());
    refresh();
    window.addEventListener('disputesChanged', refresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'myDisputes') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('disputesChanged', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!heavyReady || isTestLoginEnabled()) return;
    syncDeviceProfileOnceFromLegacyOnboarding();
  }, [heavyReady]);

  /** Activity badges: sync stats after heavy storage ready and orders/posts/likes change */
  useEffect(() => {
    if (!heavyReady) return;
    const run = () => {
      syncActivityBadgesFromStats();
      pruneInvalidDisplayActivityBadge();
    };
    run();
    const events = [
      'ordersChanged',
      'postsChanged',
      'favoritesChanged',
      'postLikesChanged',
    ] as const;
    events.forEach((e) => window.addEventListener(e, run));
    return () => events.forEach((e) => window.removeEventListener(e, run));
  }, [heavyReady]);

  const hideNav = shouldHideNav(location.pathname, location.search);

  const loggedIn = isLoggedIn();
  const isAdminPath = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const isAdminAuthPage = location.pathname === '/admin-auth';

  if (!heavyReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }
  // Test mode: show Welcome until user picks Pi / Guest / local test account
  if (testModeEnabled && !loggedIn && !isUnauthenticatedAllowedPath(location.pathname)) {
    return <Navigate to="/welcome" replace />;
  }

  // Production: explicit log out → only welcome / signup / login-app / etc.
  if (
    !testModeEnabled &&
    !loggedIn &&
    !isUnauthenticatedAllowedPath(location.pathname)
  ) {
    return <Navigate to="/welcome" replace />;
  }

  // Production: incomplete onboarding → welcome flow
  if (
    !testModeEnabled &&
    loggedIn &&
    !isOnboardingComplete() &&
    !isOnboardingExemptPath(location.pathname)
  ) {
    return <Navigate to="/welcome" replace />;
  }

  if (isAdminPath && !isAdminVerified()) {
    const next = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/admin-auth?next=${encodeURIComponent(next)}`} replace />;
  }

  if (isAdminAuthPage && isAdminVerified()) {
    return <Navigate to="/admin/popup" replace />;
  }

  // Hide test user bar on post detail (match requested white header)
  const isPostDetailPage = /^\/community\/post\/[^/]+$/.test(location.pathname);
  const uid = getCurrentUserId();
  const showUserBar =
    isTestLoginEnabled() && loggedIn && isTestPresetUser(uid) && !isPostDetailPage;
  const disputeBannerTop = showUserBar ? 28 : 0;
  const hasDisputeBanner = loggedIn && myOpenDisputes.some((d) => !dismissedDisputeOrderIds.has(d.orderId));
  const mainPaddingTop = hasDisputeBanner ? disputeBannerTop + 28 : showUserBar ? 28 : 0;

  return (
    <div className="App">
      <ScrollToTop />
      {/* Test preset user bar (hidden on post detail) */}
      {showUserBar && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] text-center text-xs py-1 text-white font-medium"
          style={{ backgroundColor: uid === 'user1' ? '#00A8A3' : '#f59e0b' }}
        >
          {uid === 'user1' ? 'Seller Pingoo (user1)' : 'Buyer Pororo (user2)'}
          <button
            onClick={() => {
              sessionStorage.clear();
              window.location.href = '/welcome';
            }}
            className="ml-3 px-2 py-0.5 bg-white/20 rounded text-[10px] hover:bg-white/30"
          >
            Switch
          </button>
        </div>
      )}
      {/* Dispute opened by counterparty ??top banner */}
      {(() => {
        const firstUndismissed = myOpenDisputes.find((d) => !dismissedDisputeOrderIds.has(d.orderId));
        if (!loggedIn || !firstUndismissed) return null;
        return (
          <div
            className="fixed left-0 right-0 z-[9998] flex items-center justify-center gap-2 py-2 px-3 text-white text-xs font-medium shadow-md"
            style={{
              top: disputeBannerTop,
              backgroundColor: '#dc2626',
            }}
          >
            <span aria-hidden className="shrink-0">!</span>
            <span
              role="button"
              onClick={() => navigate(`/dispute/${firstUndismissed.orderId}?view=other`)}
              className="flex-1 text-center"
            >
              The other party opened a dispute. Please review.
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDismissedDisputeOrderIds((prev) => new Set(prev).add(firstUndismissed.orderId));
              }}
              className="shrink-0 px-2 py-1 rounded bg-white/20 hover:bg-white/30 font-medium"
            >
              OK
            </button>
          </div>
        );
      })()}
      <div style={{ paddingTop: mainPaddingTop }}>
        <Routes>
          <Route
            path="/login"
            element={<Navigate to={isTestLoginEnabled() ? '/welcome' : '/'} replace />}
          />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/signup" element={<SignupProfile />} />
          <Route path="/login-app" element={<AppLogin />} />
          <Route path="/admin-auth" element={<AdminPassword />} />
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/post/:id" element={<PostDetail />} />
          <Route path="/community/write" element={<PostWrite />} />
          <Route path="/community/edit/:postId" element={<PostWrite />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/notices" element={<NoticeList />} />
          <Route path="/notices/:id" element={<NoticeDetail />} />
          <Route path="/barter/select/:targetProductId" element={<BarterProductSelect />} />
          <Route path="/barter/offer/:targetProductId" element={<BarterOfferWrite />} />
          <Route path="/barter/complete/:orderId" element={<BarterComplete />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/edit/:id" element={<Register />} />
          <Route path="/register/complete" element={<RegisterComplete />} />
          <Route path="/chat" element={<ChatList />} />
          <Route path="/chat/:id" element={<ChatRoom />} />
          <Route path="/my" element={<My />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/seller/:id" element={<SellerProfile />} />
          <Route path="/offer/:productId" element={<Offer />} />
          <Route path="/order/:orderId" element={<OrderTimeline />} />
          <Route path="/review/:orderId" element={<ReviewWrite />} />
          <Route path="/dispute/:orderId" element={<Dispute />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
          <Route path="/my/products" element={<MyProducts />} />
          <Route path="/my/favorites" element={<MyFavorites />} />
          <Route path="/my/orders" element={<MyOrders />} />
          <Route path="/my/disputes" element={<MyDisputes />} />
          <Route path="/my/reviews" element={<MyReviews />} />
          <Route path="/my/posts" element={<MyPosts />} />
          <Route path="/my/inquiries" element={<MyInquiries />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/inquiry" element={<InquiryWrite />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="popup" replace />} />
            <Route path="popup" element={<AdminHomePopup />} />
            <Route path="notices" element={<AdminNotices />} />
            <Route path="disputes" element={<AdminDisputes />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="posts" element={<AdminPosts />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="data" element={<AdminData />} />
            <Route path="inquiries" element={<AdminInquiries />} />
          </Route>
          <Route path="/shipping/:orderId" element={<ShippingInfo />} />
          <Route path="/shipping-info/:orderId" element={<ShippingInfoInput />} />
          <Route path="/shipping-info-request/:orderId" element={<ShippingInfoRequest />} />
          <Route path="/meetup/:orderId" element={<MeetupSchedule />} />
          <Route path="/receive/:orderId" element={<ReceiveConfirm />} />
          <Route path="/complete-check/:orderId" element={<CompleteCheck />} />
          <Route path="/region/select" element={<RegionSelect />} />
          <Route path="/terms" element={<div className="p-4 min-h-screen">Terms of service</div>} />
          <Route path="/privacy" element={<div className="p-4 min-h-screen">Privacy policy</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!showSplash && !hideNav && <BottomTab />}
        <ToastHost />
      </div>
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [heavyReady, setHeavyReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const healthCheckSeq = useRef(0);
  const backendStatusRef = useRef<'checking' | 'online' | 'offline'>('checking');
  const healthFailStreak = useRef(0);

  useEffect(() => {
    preloadHeavyStorage().finally(() => setHeavyReady(true));
  }, []);

  const checkBackendHealth = async (showChecking = false, attempts = 1) => {
    const seq = ++healthCheckSeq.current;
    if (showChecking) setBackendStatus('checking');

    let online = false;
    let lastStatus = 0;
    let lastError: string | undefined;
    for (let i = 0; i < attempts; i++) {
      if (seq !== healthCheckSeq.current) return;
      const res = await api.health();
      lastStatus = res.status;
      lastError = res.error;
      // 429 = rate limit, not DB down — 앱 전체 차단하지 않음
      if (res.status === 429) {
        online = true;
        break;
      }
      online = !!(res.ok && res.data?.ok === true && res.data.db === 'connected');
      if (online) break;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 700));
      }
    }

    // 더 최신 체크가 있으면 이 결과는 버림 (Retry/폴링 경합으로 성공이 실패에 덮이는 것 방지)
    if (seq !== healthCheckSeq.current) return;

    if (online) {
      // #region agent log — 직전에 실패가 있었다면 복구 사실도 서버 로그로 보고 (session 0a2150)
      if (healthFailStreak.current > 0) {
        fetch(`/api/health?clientrecovered=${healthFailStreak.current}`, { cache: 'no-store' }).catch(() => {});
      }
      // #endregion
      healthFailStreak.current = 0;
    } else {
      healthFailStreak.current += 1;
      console.warn(
        `[health] check failed (streak=${healthFailStreak.current}, appStatus=${backendStatusRef.current}, httpStatus=${lastStatus}, error=${lastError ?? '-'})`,
      );
      // #region agent log — Pi Browser에는 콘솔이 없어 서버 로그로 실패를 보고한다.
      // 429 원인 검증 완료 후 제거 예정 (session 0a2150)
      fetch(`/api/health?clientfail=${lastStatus}&streak=${healthFailStreak.current}`, { cache: 'no-store' }).catch(() => {});
      // #endregion
      // 모바일 와이파이는 단발성 요청 실패가 흔하다. 이미 정상 사용 중이면
      // 2회 연속 실패가 확인될 때까지 앱을 차단하지 않는다.
      if (backendStatusRef.current === 'online' && healthFailStreak.current < 2) return;
    }

    const nextStatus = online ? 'online' : 'offline';
    backendStatusRef.current = nextStatus;
    setBackendStatus(nextStatus);
  };

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const run = async (initial = false) => {
      await checkBackendHealth(initial, initial ? 3 : (backendStatusRef.current === 'offline' ? 2 : 1));
      if (cancelled) return;
      timer = window.setTimeout(
        () => void run(false),
        backendStatusRef.current === 'offline' ? 12000 : 30000,
      );
    };

    void run(true);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const shouldBlockApp = backendStatus !== 'online';

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} duration={2000} />}
      {shouldBlockApp ? (
        <BackendUnavailable status={backendStatus} onRetry={() => void checkBackendHealth(true, 3)} />
      ) : (
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppContent showSplash={showSplash} heavyReady={heavyReady} />
        </BrowserRouter>
      )}
    </>
  );
}

function BackendUnavailable({
  status,
  onRetry,
}: {
  status: 'checking' | 'online' | 'offline';
  onRetry: () => void;
}) {
  const checking = status === 'checking';

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <img src="/LOGO_M.svg" alt="Market PiePie" className="h-16 w-auto object-contain mx-auto mb-6" />
        {checking ? (
          <>
            <div className="w-8 h-8 border-2 border-[#00A8A3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Connecting...</h1>
            <p className="text-sm text-gray-500">Checking the server and database.</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold">!</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Service unavailable</h1>
            <p className="text-sm text-gray-500 mb-6">
              The database is not reachable right now. Please try again shortly.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="w-full px-4 py-3 rounded-lg text-white font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
