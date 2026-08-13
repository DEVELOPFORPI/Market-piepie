import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

function IconUser() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconGavel() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2m4-4l2 2m-6 6l6-6M5 5l4 4" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 19V5m4 14V9m4 10v-6m4 8V7" />
    </svg>
  );
}

function IconInquiry() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function IconPopup() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z M8 9h8M8 13h5" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm2 9h4" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 21V4m0 0h13l-2 4 2 4H3" />
    </svg>
  );
}

function IconPrice() {
  return (
    <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M4 7a3 3 0 013-3h6l7 7-9 9-7-7V7z" />
    </svg>
  );
}

const asideLink =
  'mx-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors';

/**
 * 관리자 전용 셸: 좌측 다크 사이드바 + 우측 메인(목업과 동일한 구조).
 */
export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${asideLink} ${
      isActive
        ? 'bg-white/20 text-white shadow-sm'
        : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="flex min-h-screen bg-[#f0f2f5]" lang="ko">
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-[#008f8b] bg-[#00A8A3] text-white">
        <div className="flex flex-col items-center border-b border-white/10 px-4 py-8">
          <img
            src="/LOGO_M.svg"
            alt="Market PiePie"
            className="mb-4 h-14 w-14 shrink-0 object-contain"
          />
          <span className="text-[15px] font-semibold tracking-tight">관리자 패널</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 py-4">
          <NavLink to="/admin/data" className={linkClass}>
            <IconChart />
            대시보드
          </NavLink>
          <NavLink to="/admin/users" className={linkClass}>
            <IconUser />
            사용자
          </NavLink>
          <NavLink to="/admin/payments" className={linkClass}>
            <IconCard />
            결제 내역
          </NavLink>
          <NavLink to="/admin/prices" className={linkClass}>
            <IconPrice />
            요금 설정
          </NavLink>
          <NavLink to="/admin/products" className={linkClass}>
            <IconBox />
            상품
          </NavLink>
          <NavLink to="/admin/posts" className={linkClass}>
            <IconDocument />
            게시물
          </NavLink>
          <NavLink to="/admin/disputes" className={linkClass}>
            <IconGavel />
            분쟁
          </NavLink>
          <NavLink to="/admin/reports" className={linkClass}>
            <IconFlag />
            신고
          </NavLink>
          <NavLink to="/admin/inquiries" className={linkClass}>
            <IconInquiry />
            문의사항
          </NavLink>
          <NavLink to="/admin/notices" className={linkClass}>
            <IconDocument />
            공지
          </NavLink>
          <NavLink to="/admin/popup" className={linkClass}>
            <IconPopup />
            홈 팝업
          </NavLink>
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full rounded-lg py-2.5 text-center text-xs font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            앱으로 돌아가기
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
