# Market PiePie 배포 분석 문서

> 목적: Vercel에 안정적으로 배포하고, 테스트넷과 메인넷을 브랜치로 나눠 운영하기 위한 준비
> 대상: 비개발자도 이해할 수 있도록 쉬운 말로 작성
> 작성 시점: 2026-05-08

---

## 0. 가장 급한 보안 경고 (분석보다 먼저 처리)

과거 환경변수/문서에 **실제 운영 비밀번호가 평문으로 노출된 흔적**이 있습니다. 저장소가 공개(public)이거나 GitHub에 이미 푸시된 적이 있다면 외부인이 볼 수 있었던 상태로 봐야 합니다.

```
PORT=4000
DATABASE_URL=<REDACTED>
PI_API_KEY=<REDACTED>
ADMIN_PASSWORD=<REDACTED>
CORS_ORIGIN=https://piepie-market.vercel.app
DB_SSL_REJECT_UNAUTHORIZED=false
```

**메인넷 오픈 전에 반드시 해야 할 일:**

- [ ] Supabase DB 비밀번호 즉시 재설정
- [ ] Pi Network API 키 재발급
- [ ] 관리자 비밀번호 변경
- [ ] `.env.save` 같은 비밀 파일이 git에 올라간 적이 있으면 삭제 + 커밋 히스토리에서도 제거 (`git filter-repo` 등)
- [x] `.gitignore`에 `.env`, `.env.*` 차단 규칙 추가
- [x] `.vercelignore`에 `.env`, `.env.*` 차단 규칙 추가

이 작업은 메인넷 이전에 무조건 1순위입니다. 메인넷에는 실제 돈(파이 코인)이 오갑니다.

---

## 1. 현재 구조 이해 (쉬운 설명)

### 지금 구조는 "한 집에 가게(프론트)와 창고(백엔드)가 같이 있는 모양"

```
Market-piepie/
├── frontend/                  ← 손님이 보는 가게 (React + Vite)
├── backend/                   ← 물건 보관 창고 + 계산대 (Express + Socket.IO)
├── dist/                      ← 옛날에 만들어둔 가게 인테리어 (문제 있음, 뒤에 설명)
├── vercel.json                ← Vercel에게 "이렇게 가게 차려줘" 라고 적은 메모
├── nginx-marketpiepie.conf    ← Lightsail 서버 설정 파일
└── package.json               ← 뿌리 폴더의 이름표
```

이런 구조를 **모노레포(monorepo)** 라고 부릅니다. 한 저장소(repo) 안에 여러 프로젝트가 모여 있다는 뜻입니다. 같이 관리하기 편한 대신, 배포할 때 **"어느 폴더를 어디에 올릴지"** 를 정확히 알려줘야 합니다.

### 프론트와 백엔드가 같이 있을 때 주의점

| 헷갈림 포인트 | 쉬운 설명 |
| --- | --- |
| Vercel이 백엔드까지 빌드하려 함 | Vercel은 가게(프론트) 전문이다. 창고(백엔드)도 같이 보면 헷갈려서 빌드가 깨지거나, 비밀이 바깥으로 나갈 수 있다. |
| 환경변수가 섞임 | 가게 안내문(프론트 env)과 창고 금고 비번(백엔드 env)을 같은 서랍에 두면 가게 손님이 금고 비번을 보게 된다. 관리자 비밀번호는 백엔드 env에만 두어야 한다. |
| 배포 트리거 오작동 | 백엔드만 고쳤는데 Vercel이 프론트를 다시 빌드해서 배포해 버린다. 반대로 프론트 작업 중 Lightsail 백엔드가 자동 배포되지 않아 **둘 사이 버전이 안 맞는 사고**가 자주 난다. |

---

## 2. Vercel 배포 관점 분석

### 지금 `vercel.json` 내용

```json
{
  "env": { "NPM_CONFIG_PRODUCTION": "false" },
  "installCommand": "npm ci",
  "buildCommand": "npm run build && ((test -d frontend/dist && rm -rf dist && cp -R frontend/dist dist) || test -d dist)",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [
    { "source": "/api/:path*", "destination": "http://54.250.253.123:4000/api/:path*" },
    { "source": "/proxy/coingecko/:path*", "destination": "https://api.coingecko.com/api/v3/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

해석하면 — "루트에서 `npm run build`를 돌리면 `frontend/dist/`가 만들어지는데, 그걸 다시 루트의 `dist/`에 복사해라" 라는 좀 빙빙 도는 구조입니다. 그리고 `/api/...` 호출은 전부 Lightsail의 **고정 IP `54.250.253.123:4000`** 으로 흘려보냅니다.

### 문제점 정리

1. **루트 디렉토리는 그대로 두되 `outputDirectory`만 잡으면 더 깔끔합니다.**
   - 추천: `installCommand: "cd frontend && npm ci"`, `buildCommand: "cd frontend && npm run build"`, `outputDirectory: "frontend/dist"`
   - 또는 Vercel 프로젝트 설정에서 **Root Directory를 `frontend/`로 지정** → 위 옵션이 자동.
   - 참고: `test` 브랜치의 `vercel.json`이 이미 이 단순한 형태입니다. main이 더 복잡한 쪽입니다.

2. **`dist/` 폴더가 git에 65개 파일 커밋되어 있습니다.**
   - 빌드 결과물(`dist/`)은 절대 git에 올리면 안 됩니다. 같은 이름의 폴더가 있으니 Vercel 빌드 스크립트가 `rm -rf dist && cp ...`로 강제 덮어쓰는 트릭을 쓰고 있습니다. 위험한 습관입니다.
   - **조치**: `.gitignore`에 `dist/` 추가 → git에서 `dist/` 삭제 후 커밋.

3. **백엔드는 절대 Vercel에 올리지 마세요. (지금 안 올리고 있음 — 잘 하고 계심)**
   - `backend/`는 Socket.IO(실시간 채팅)와 PostgreSQL 커넥션 풀이 필요해서, **Vercel 같은 서버리스(짧게 켜졌다 꺼지는 함수형 서버)에는 잘 맞지 않습니다**. Lightsail 유지가 정답입니다.

4. **백엔드 IP가 vercel.json에 박혀 있습니다 (`54.250.253.123:4000`).**
   - 메인넷에서는 **다른 백엔드 서버**를 쓸 가능성이 높은데, 이 값이 코드에 박혀 있으면 브랜치마다 매번 직접 수정해야 합니다 → 사고 1순위.
   - 또한 `http://`(보안 X) 입니다. Vercel은 `https://`인데 백엔드만 http면 브라우저가 차단(혼합 콘텐츠)하거나, 중간자가 데이터를 엿볼 수 있습니다. **메인넷 전에는 도메인 + HTTPS(Let's Encrypt) 필수.**

### 정리: Vercel에는 무엇을 올릴 것인가

| 대상 | 어디에 | 비고 |
| --- | --- | --- |
| `frontend/` | Vercel | Root Directory를 `frontend/`로 지정 추천 |
| `backend/` | Lightsail (지금 그대로) | 도메인 + HTTPS만 추가 |
| `dist/` | 올리지 않음 (git에서도 제거) | Vercel이 매번 새로 만든다 |
| `nginx-marketpiepie.conf` | Lightsail 서버에서만 사용 | git에 두는 건 OK |

---

## 3. 브랜치 전략 분석

### 지금 상태

- `main` 브랜치: Pi SDK `sandbox: false` (= 메인넷 모드)
- `test` 브랜치: Pi SDK `sandbox: true` (= 테스트넷 모드)

이미 분리는 시작된 상태입니다. 다만 **"브랜치마다 무엇이 다른지"** 가 코드 안에 직접 박혀 있어서(예: `index.html`, `vercel.json`) 위험합니다.

### 추천: `develop → test → main` 3단 구조

비유: **"내 노트 → 친구한테 보여주기 → 출판사에 넘기기"** 흐름이라고 보면 됩니다.

```
develop  (개발 중인 거 막 올리는 곳, 매번 깨져도 OK)
   ↓ PR
test     (테스트넷 자동 배포, 사용자 테스트용)
   ↓ PR (검증 끝난 것만)
main     (메인넷 자동 배포, 실제 돈이 오감)
```

| 브랜치 | Vercel 배포 | Pi SDK | 백엔드 |
| --- | --- | --- | --- |
| `develop` | Preview (자동, 매 PR마다 임시 URL) | sandbox: true | Lightsail 테스트 인스턴스 (또는 test와 공유) |
| `test` | piepie-market-test.vercel.app | sandbox: true | Lightsail 테스트넷 서버 |
| `main` | piepie-market.vercel.app | sandbox: false | Lightsail 메인넷 서버 (별도 인스턴스) |

`staging`이라는 이름도 흔하지만, 이미 `test` 브랜치를 쓰고 계시니 `test`를 그대로 살리는 게 깔끔합니다.

### 비개발자가 흔히 실수하는 포인트

1. **`main`에 직접 푸시** → 메인넷에 검증 안 된 코드가 바로 올라감.
   - GitHub에서 `main` 브랜치 보호(Branch Protection) 켜기 → "PR로만 머지 가능"으로 설정.
2. **테스트 브랜치에서 메인넷용 비밀번호를 실수로 사용** → 가장 흔한 사고.
   - Vercel에서 환경변수를 **Production / Preview / Development**로 분리해서 넣어야 합니다.
3. **`test`에서 작업한 걸 `main`에 머지할 때 `sandbox: true`도 같이 넘어감.**
   - `index.html`에 박지 말고 환경변수로 빼야 안전합니다.

---

## 4. 환경변수 / 도메인 / 빌드 리스크

### 테스트넷과 메인넷에서 반드시 분리해야 할 값

| 변수 이름 | 어디에 | 테스트넷 | 메인넷 | 이유 |
| --- | --- | --- | --- | --- |
| `VITE_API_URL` | Vercel 프론트 | `https://api-test.piepie.market` (예시) | `https://api.piepie.market` (예시) | 백엔드 주소 분리 |
| Pi SDK sandbox | `index.html` → 환경변수로 빼기 권장 | `true` | `false` | 가짜 파이 vs 진짜 파이 |
| `PI_API_KEY` | Lightsail 백엔드 | 테스트넷 키 | 메인넷 키 (Pi 개발자 포털에서 별도 발급) | 결제 승인 호출 |
| `DATABASE_URL` | Lightsail 백엔드 | 테스트 DB | 메인넷 DB (별도 Supabase 프로젝트 권장) | 실제 거래 데이터 보호 |
| `ADMIN_PASSWORD` | Lightsail 백엔드 | 별도 비번 | 새로 만든 강한 비번 | `.env.save` 노출 비번 폐기 |
| `CORS_ORIGIN` | Lightsail 백엔드 | `https://piepie-market-test.vercel.app` | `https://piepie-market.vercel.app` | 허용된 가게만 창고에 출입 |
| `VITE_ENABLE_TEST_LOGIN` | Vercel 프론트 | `true` | `false` | 테스트 계정 로그인 메뉴 숨기기 |

### Vercel에서 헷갈리기 쉬운 설정 (사고 단골)

1. **환경변수 Scope (Production / Preview / Development)**
   - Vercel 프로젝트 설정 → Environment Variables 화면에서 변수마다 **"어느 환경에서 쓸지"** 체크박스가 있습니다.
   - **메인넷 변수는 "Production"에만 체크**, 테스트 변수는 "Preview"에만 체크. 둘 다 체크하면 메인 사이트에 테스트 값이 들어갑니다.

2. **`VITE_` 접두사 = 브라우저에 100% 노출됩니다.**
   - 관리자 비밀번호처럼 숨겨야 하는 값은 `VITE_` 환경변수에 넣으면 안 됩니다.
   - 현재 구조는 프론트가 입력받은 관리자 비밀번호를 세션에만 보관하고, 백엔드 `ADMIN_PASSWORD`와 API 호출 시 비교합니다.

3. **Branch별 자동 배포 매핑**
   - Vercel → Settings → Git → "Production Branch"를 `main`으로, **"Preview Branches"에 `test`, `develop`** 등을 켜면 됩니다.
   - 안 그러면 `test` 푸시가 Production으로 가는 사고가 납니다.

4. **`vercel.json`은 브랜치마다 다르게 둘 수 있습니다.**
   - 지금 `main`의 `vercel.json`과 `test`의 `vercel.json`이 다르게 관리되고 있는데(확인됨), `rewrites`의 백엔드 주소는 **환경변수로 빼기 어렵습니다**(rewrites는 정적 JSON이라 env 보간이 제한적). 가장 안전한 방법은 **프론트 코드에서 `fetch(import.meta.env.VITE_API_URL + '/api/...')`로 직접 호출**하는 패턴 (지금 코드는 이미 일부 그렇게 되어 있습니다).

### 잘못 배포될 가능성이 높은 포인트 TOP 5

1. `main`에 머지했는데 `sandbox: true`가 그대로 남아 있어 **메인넷 사용자에게 가짜 파이로 결제** 시도.
2. 메인넷 프론트가 **테스트넷 백엔드 IP**를 보고 있어서 거래 데이터가 잘못된 DB에 쌓임.
3. `.env.save`처럼 비밀이 들어 있는 파일을 또 커밋.
4. `dist/` 폴더가 git에 있어서 **옛날 빌드본**이 사용자에게 노출 (Vercel 빌드가 실패하면 fallback으로 옛 dist가 올라갈 위험).
5. CORS_ORIGIN이 `*` 또는 테스트 도메인이라 **악의적인 사이트가 백엔드를 호출**할 수 있음.

---

## 5. 최종 제안

### 지금 당장 해야 할 것 5가지 (순서대로)

1. **노출된 비밀 전부 교체**: Supabase DB 비번, Pi API 키, 관리자 비번. `backend/.env.save` 삭제 + git 히스토리에서도 제거. `.gitignore`에 `.env*` 추가.
2. **`dist/` 폴더 git에서 제거** + `.gitignore`에 `dist/`, `frontend/dist/` 추가.
3. **관리자 비밀번호 프론트 번들 노출 금지**: 프론트 env에는 넣지 않고, 백엔드 `ADMIN_PASSWORD`만 사용.
4. **Pi SDK sandbox 플래그를 환경변수화**: `index.html`에서 빼고 `main.tsx`에서 `import.meta.env.VITE_PI_SANDBOX === 'true'`로 분기. 그래야 브랜치 머지 사고가 줄어듭니다.
5. **Vercel 프로젝트 설정 정리**:
   - Root Directory → `frontend`
   - Production Branch → `main`
   - Preview Branches → `test`, `develop`
   - 환경변수 3종(Production / Preview / Development) 분리 입력
   - `main` 브랜치에 GitHub Branch Protection 활성화

### 추천 브랜치 구조

```
develop  ──►  test (테스트넷)  ──►  main (메인넷)
  ▲              ▲                    ▲
  │              │                    │
feature/* ─────► │                    │
                 └─ Vercel Preview     └─ Vercel Production
                    Pi sandbox=true       Pi sandbox=false
                    Lightsail-test        Lightsail-prod
```

- 새 기능: `feature/xxx` 브랜치 → PR → `develop` 머지
- 사용자 테스트 준비: `develop` → PR → `test` 머지 (자동 테스트넷 배포)
- 메인넷 릴리즈: `test` → PR → `main` 머지 (자동 메인넷 배포)

### 추천 배포 흐름

1. 작업 → `feature/...` 브랜치에서 작업
2. PR 올리면 Vercel이 **임시 Preview URL** 자동 생성 → 본인이 확인
3. `test`에 머지 → **테스트넷 도메인**에 자동 배포 → 베타 사용자 확인
4. 1~3일 안정 운영 확인 후 `main`에 PR → **승인 1명 이상 + CI 통과 시에만 머지 가능**으로 보호
5. `main` 머지 → 메인넷 자동 배포 → 백엔드는 Lightsail에서 별도 수동/스크립트 배포

### 메인넷 오픈 전 체크리스트

- [ ] `.env.save`에 노출됐던 모든 비밀 키/비번 교체 완료
- [ ] `.gitignore`에 `.env*`, `dist/`, `frontend/dist/` 추가 완료
- [ ] git 히스토리에서 비밀 정보 제거 (`git filter-repo` 또는 GitHub Support 요청)
- [ ] Lightsail 메인넷용 인스턴스 별도 분리 (테스트넷과 DB·서버 모두 별개)
- [ ] 메인넷 백엔드에 **도메인 + HTTPS(Let's Encrypt)** 적용 → IP 직접 노출 X
- [ ] `vercel.json`의 백엔드 주소를 도메인으로 변경 (브랜치마다 다른 도메인)
- [ ] Pi 개발자 포털에서 **메인넷용 앱 등록 + API 키 발급**
- [ ] `VITE_PI_SANDBOX` 등 환경변수 분리, `index.html`에서 직접 분기 제거
- [x] `VITE_ADMIN_PASSWORD` 프론트 의존 제거, 백엔드 `ADMIN_PASSWORD` 검증으로 변경
- [ ] Vercel 환경변수가 Production/Preview에 정확히 매핑되어 있는지 한 번 더 확인
- [ ] `main` 브랜치 보호 규칙 활성화 (직접 푸시 금지, PR + 리뷰 필수)
- [ ] CORS_ORIGIN을 메인넷 도메인으로 정확히 지정 (`*` 금지)
- [ ] DB 백업 정책 설정 (Supabase Daily backup 활성화)
- [ ] 결제 흐름 종단 테스트: 로그인 → 결제 → 승인 → 완료 → DB 기록까지 한 사이클 통과
- [ ] 모니터링/알림 1개 이상 (Vercel Analytics, Lightsail CloudWatch, 또는 Uptime Robot 무료 플랜)

---

## 추천 운영 방식 (한 줄 요약)

> **"한 저장소, 두 환경, 세 브랜치"** 로 운영하세요.

- **저장소**: 지금처럼 모노레포 1개 유지 (frontend + backend 같이)
- **두 환경**:
  - 테스트넷 = `test` 브랜치 + Vercel Preview용 도메인 + Lightsail 테스트 인스턴스 + Pi sandbox=true
  - 메인넷 = `main` 브랜치 + Vercel Production 도메인 + Lightsail 메인 인스턴스 + Pi sandbox=false
- **세 브랜치**: `develop`(개발) → `test`(테스트넷) → `main`(메인넷). PR로만 위로 올라가기.
- **Vercel은 프론트 전용**, 백엔드는 Lightsail 그대로. Vercel Root Directory는 `frontend`로 지정.
- **차이값은 전부 환경변수로**: API 주소, Pi sandbox 여부, 관리자 인증, Supabase 키 등. 코드에 박지 말 것.
- **비밀은 절대 git에 두지 않기**: `.env*` gitignore + Vercel/Lightsail 콘솔에서만 입력.
- **`main` 브랜치 보호 + PR 리뷰 1명 필수**로 메인넷 사고 차단.
- **메인넷 오픈 전 마지막 게이트** = 위의 체크리스트 14항목 모두 OK.

가장 급한 건 **노출된 비밀 키 교체와 `.env.save` 제거**입니다. 다른 모든 일보다 먼저 처리하시는 걸 강력히 권합니다.
