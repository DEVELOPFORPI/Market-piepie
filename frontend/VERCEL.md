# Vercel 배포 (MarketPiePie 프론트)

## 1. GitHub에 푸시 후 Vercel 연결

1. [Vercel](https://vercel.com) → **Add New Project** → 저장소 선택  
2. **Root Directory** 를 반드시 **`frontend`** 로 설정 (모노레포이므로)  
3. **Framework Preset**: Vite (자동 감지되면 그대로)  
4. **Build Command**: `npm run build`  
5. **Output Directory**: `dist`  
6. **Install Command**: `npm install` (기본값)

## 2. 환경 변수 (Project → Settings → Environment Variables)

공개 앱 기준 예시 (`.env.production`과 맞춤):

| 변수 | Production 값 |
|------|----------------|
| `VITE_ENABLE_TEST_LOGIN` | 설정 안 해도 됨 — **프로덕션 빌드에서는 기본 OFF** (`/login` 테스트 계정 화면 숨김, 자동 게스트 세션) |
| `VITE_ENABLE_ADMIN` | `false` |

로컬 `npm run dev` 에서만 기본적으로 테스트 로그인 화면이 켜집니다. 프로덕션 빌드에서는 코드에서 강제로 꺼지므로 `VITE_ENABLE_TEST_LOGIN=true` 를 넣어도 테스트 화면은 켜지지 않습니다.

별도 API 도메인을 쓸 때만:

| 변수 | 예시 |
|------|------|
| `VITE_API_BASE_URL` | `https://api.도메인.com` |

> `VITE_ADMIN_API_KEY` 등은 **공개 앱 빌드에는 넣지 마세요.**

## 3. SPA 라우팅 (모바일·직접 URL·새로고침)

- **Root Directory = `frontend`** 인 경우: `frontend/vercel.json` 의 `rewrites` 가 적용됩니다.
- **Root Directory = 저장소 루트(`.`)** 인 경우: 저장소 루트의 `vercel.json` 이 빌드·`frontend/dist`·동일 `rewrites` 를 사용합니다.

모든 경로를 `index.html` 로 넘겨야 React Router가 `/product/123` 같은 주소에서도 화면이 뜹니다. 이 설정이 없으면 모바일에서 특정 경로로 들어가면 **빈 화면·404** 가 날 수 있습니다.

## 4. 배포 후 확인

- 사이트 열기 → 홈·상품 상세·채팅 등 직접 URL로 새로고침 시 404가 아니어야 합니다.

## 5. Pi 앱 — 도메인 인증 (`validation-key.txt`)

**Verify App Domain** 절차에 맞춰 Pi가 제공한 **인증 키 한 줄**을 넣은 파일을 사이트 **루트**에서 열 수 있어야 합니다.

| 항목 | 이 프로젝트에서의 위치 |
|------|------------------------|
| 파일 이름 | `validation-key.txt` |
| 저장 위치 | `frontend/public/validation-key.txt` |

Vite 빌드 시 `public/` 파일이 **`dist/` 루트**로 복사되므로, 배포 후 아래처럼 접속하면 **키 텍스트만** 보여야 합니다.

- **Vercel 배포 URL:** `https://piepie-market.vercel.app/validation-key.txt`
- 나중에 커스텀 도메인을 Vercel에 연결했다면: `https://<내-도메인>/validation-key.txt` (Pi에 등록한 호스트와 동일해야 함)

Pi 콘솔 앱/웹 도메인을 **`https://piepie-market.vercel.app`** 로 두었다면, 검증 시에도 **같은 호스트**의 위 URL로 확인합니다.

**체크리스트**

1. Pi 콘솔에 나온 키를 **그대로** `frontend/public/validation-key.txt` 에 붙여넣기 (파일명 오타 없이).
2. 변경 커밋·푸시 후 Vercel에 **재배포**.
3. 브라우저에서 **`https://piepie-market.vercel.app/validation-key.txt`** 를 열어 **키 한 줄**이 나오는지 확인.
4. Pi 앱/콘솔의 앱 도메인이 **`piepie-market.vercel.app`** (또는 연결한 커스텀 도메인)과 일치하는지 확인.
5. Pi 앱에서 **[Verify Domain]** 클릭.

> **데모 앱용 `.env` 안내**가 있다면, Pi 문서대로 별도 환경 변수에도 동일 키를 넣으면 됩니다. 웹 도메인 검증은 **URL로 `validation-key.txt` 가 열리는 것**이 핵심입니다.

> Vercel은 보통 **실제 파일이 있으면** SPA용 `rewrites` 보다 정적 파일을 먼저 제공합니다. `validation-key.txt` 가 404이면 배포 산출물(`dist` 루트)에 파일이 포함됐는지 확인하세요.
