# PiPi Market 개선 우선순위

> 대상: 비개발자도 이해할 수 있도록 짧게 정리
> 환경: 프론트 = Vercel · 백엔드 = AWS Lightsail · DB = Supabase · 파이브라우저 전용
> 현재 브랜치: `test`(테스트넷) → 정리 후 `main`(메인넷)으로 동일 환경 복제 예정

---

## 🚨 1순위 — 메인넷 전 반드시 (사고 직결)

### A. Pi SDK 모드 환경변수화 ✅ 완료
- 변경 전: `frontend/index.html`에 `Pi.init({ ..., sandbox: true })` **하드코딩**.
- 변경 후:
  - `index.html`에서 init 코드 제거, SDK 스크립트만 로드.
  - `frontend/src/utils/piSdk.ts`가 `import.meta.env.VITE_PI_SANDBOX`를 읽어 init.
  - `main.tsx`가 앱 시작 직후 `bootstrapPiSdk()` 호출.
- 운영 규칙:
  - `test` 브랜치 / Vercel Preview · 로컬 → `VITE_PI_SANDBOX=true` (테스트넷)
  - `main` 브랜치 / Vercel Production → `VITE_PI_SANDBOX=false` (메인넷)
  - 둘 다 안 넣으면 `DEV` 빌드는 sandbox=true, 프로덕션 빌드는 sandbox=false (안전 기본값).
- 효과: 브랜치 머지 한 줄 실수로 메인넷에서 가짜 파이 결제 발생하던 위험 차단.

### B. 백엔드 주소 환경변수화 (코드 부분 ✅ / 인프라 부분 ⏳)
- 변경 완료:
  - `frontend/vite.config.ts`의 IP를 **`DEV_API_TARGET` 환경변수**로 분리. 기본값 `http://localhost:4000`.
  - 프론트 코드(`api.ts`, `piAuth.ts`)는 이미 `VITE_API_URL`을 사용 중.
- 남은 작업 (사용자 직접 — 인프라):
  1. Lightsail 백엔드에 도메인 연결 (예: `api-test.example.com`, `api.example.com`).
  2. nginx + Let's Encrypt로 **HTTPS** 적용 (저장소에 `nginx-pipi-market.conf` 있음).
  3. `vercel.json` 의 `http://54.250.253.123:4000` → 도메인으로 교체. 브랜치별로 다른 도메인.
- 메인넷 전 필수: **HTTPS** 적용. http면 파이브라우저가 차단(혼합 콘텐츠) + 도청 위험.

> 키 관련 항목은 운영 정책에 따라 본 문서에서 제외.

---

## ⚠️ 2순위 — 배포 안정성 (메인넷 전 권장)

### C. 테스트넷·메인넷 환경 완전 분리
- **DB 분리**: Supabase 프로젝트를 `test`용·`main`용 **2개**로. 같은 DB 쓰면 테스트 글이 메인넷에 그대로 보입니다.
  - 절차: Supabase에서 새 프로젝트 생성 → `backend/supabase-schema.sql` 실행 → 백엔드 `.env` `DATABASE_URL` 교체 → 프론트 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 교체.
- **백엔드 분리**: Lightsail 인스턴스도 2개 (`backend-test`, `backend-prod`). 한쪽 죽어도 다른 쪽 영향 없음.
- **Vercel 환경변수 Scope**: Production / Preview / Development에 **각각 다른 값** 입력. 둘 다 체크하면 메인 사이트에 테스트 값이 들어갑니다.

### D. `main` 브랜치 보호
- GitHub Settings → Branches → `main` 보호 규칙: **PR 1명 이상 승인 + 직접 푸시 금지**.
- 검증 안 된 코드가 메인넷에 바로 올라가는 사고 차단.

### E. 모니터링 1개라도 켜기
- 무료 추천: **Uptime Robot** (백엔드 `/api/health` 5분마다 체크) + **Vercel Analytics**.
- 효과: 백엔드 죽었을 때 이메일/SMS로 즉시 알림. 사용자보다 먼저 압니다.

### F. Supabase 자동 백업
- Supabase 대시보드 → Database → Backups에서 **Daily backup** 활성화.
- 메인넷은 실제 거래 데이터가 쌓이므로 필수.

---

## 🛠 3순위 — 사용자 경험·코드 품질 (시간될 때)

### G. 첫 로딩 속도
- 현재 메인 JS 번들 **약 1.17MB** (gzip 252KB). 파이브라우저 모바일에서 첫 진입이 느립니다.
- 조치: 라우트별 `React.lazy` + `Suspense`로 코드 스플리팅. 관리자 화면 등은 일반 사용자가 안 받게.

### H. 새로고침 시 항상 Welcome으로 가는 동작
- 의도한 동작이지만, 사용자 입장에선 로그인이 자꾸 풀리는 느낌일 수 있음.
- 옵션: Pi 로그인 사용자만 자동 복원, 게스트는 매번 Welcome으로(현재 구조와 비슷). 정책으로 결정 필요.

### I. 작성 중 데이터 보호
- 판매글 작성 중 지역 변경으로 이동했다가 입력값이 사라지던 버그는 수정 완료.
- 같은 패턴(긴 글 작성 중 라우트 이동)이 있는 화면도 점검 필요: `PostWrite`, `InquiryWrite`, `Dispute` 등.

### J. 자동 테스트 0개
- 지금은 사람이 일일이 눌러서 확인. 메인넷에선 회귀 사고 위험.
- 작은 것부터: 결제 흐름(`approve` → `complete`) 백엔드 통합 테스트 1개만이라도 추가.

---

## ✅ 메인넷 오픈 전 마지막 체크 (한 화면 요약)

- [x] Pi SDK sandbox 플래그를 환경변수로 분리 (`VITE_PI_SANDBOX`)
- [x] `vite.config.ts`의 백엔드 IP 제거 (→ `DEV_API_TARGET`)
- [ ] Lightsail 백엔드에 도메인 + HTTPS 적용
- [ ] `vercel.json` 의 IP를 도메인으로 교체 (브랜치별)
- [ ] 테스트넷용·메인넷용 Supabase 프로젝트와 Lightsail 인스턴스 **각각 분리**
- [ ] Vercel 환경변수 Production / Preview **분리 입력 검증**
- [ ] `main` 브랜치 보호 규칙 ON
- [ ] Uptime Robot + Supabase Daily backup ON
- [ ] 결제 종단 테스트 (로그인 → 0.01 Pi 결제 → DB 기록까지) **수동 1회 통과**

> 한 줄: **"sandbox 플래그·백엔드 주소·DB — 이 셋만 환경변수로 분리하면 메인넷 사고 90% 차단."**
