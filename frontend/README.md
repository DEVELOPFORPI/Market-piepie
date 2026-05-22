# MarketPiePie UI Reference

MarketPiePie 마켓플레이스 UI 참고용 프로젝트입니다.

## 기술 스택

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

## 프로젝트 구조

```
src/
├── components/
│   ├── common/          # 공통 컴포넌트
│   │   ├── TopBar.tsx
│   │   ├── ListingCard.tsx
│   │   ├── SellerMiniCard.tsx
│   │   ├── OrderStatusChip.tsx
│   │   ├── BottomSheet.tsx
│   │   └── ...
│   └── navigation/
│       └── BottomTab.tsx
├── pages/               # 화면 컴포넌트
│   ├── Home.tsx
│   ├── Search.tsx
│   ├── ProductDetail.tsx
│   ├── Register.tsx
│   ├── ChatList.tsx
│   ├── ChatRoom.tsx
│   └── ...
├── types/
│   └── index.ts         # TypeScript 타입 정의
└── App.tsx              # 라우팅 설정
```

## 주요 기능

### 1. 홈 (동네 피드)
- 탭 전환 (최신/오늘거래/가격인하/인기)
- 카테고리 필터
- 그리드/리스트 레이아웃 전환
- 상품 카드 표시

### 2. 검색
- 검색어 입력
- 필터 (카테고리, 가격, 거래방식, KYC, 오늘거래)
- 최근 검색어 / 추천 검색어

### 3. 상품 상세
- 이미지 캐러셀
- 판매자 정보
- 거래 옵션 표시
- 채팅하기 / 구매 제안

### 4. 등록 (상품 올리기)
- 4단계 등록 프로세스
- 이미지 업로드 (최대 10장)
- KYC 게이트 (고가 상품)

### 5. 채팅
- 채팅 리스트
- 채팅방 + 오더 패널
- 상태별 액션 버튼

### 6. 거래 관리
- 구매 제안 작성
- 에스크로 결제
- 거래 타임라인
- 후기 작성
- 분쟁 신청

## 공통 컴포넌트

- **TopBar**: 상단 네비게이션 바
- **ListingCard**: 상품 카드 (그리드/리스트)
- **SellerMiniCard**: 판매자 미리보기 카드
- **OrderStatusChip**: 주문 상태 배지
- **BottomSheet**: 하단 시트 모달
- **KYCBadge**: KYC 인증 배지
- **TrustBadge**: 신뢰도 점수 배지

## 상태 관리

현재는 로컬 상태와 mock 데이터를 사용합니다. 실제 프로젝트에서는 상태 관리 라이브러리(Redux, Zustand 등)와 API 연동이 필요합니다.

## 스타일링

Tailwind CSS를 사용하여 반응형 모바일 우선 디자인을 구현했습니다.



