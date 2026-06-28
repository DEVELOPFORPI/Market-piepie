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
| `VITE_API_URL` | (보통 비움 — `vercel.json` `/api` 프록시 사용) |

## Vercel 도메인

| 환경 | 프론트 URL | Pi SDK |
|------|-----------|--------|
| **Production** (`main`) | `https://marketpiepie.vercel.app` | sandbox=false (자동) |
| **Preview** (`test`) | `https://marketpiepietest.vercel.app` | sandbox=true (자동) |

## 3. SPA 라우팅 (모바일·직접 URL·새로고침)

- **Root Directory = `frontend`** 인 경우: `frontend/vercel.json` 의 `rewrites` 가 적용됩니다.
- **Root Directory = 저장소 루트(`.`)** 인 경우: 저장소 루트의 `vercel.json` 이 빌드·`frontend/dist`·동일 `rewrites` 를 사용합니다.

모든 경로를 `index.html` 로 넘겨야 React Router가 `/product/123` 같은 주소에서도 화면이 뜹니다.

## 4. 배포 후 확인

- 사이트 열기 → 홈·상품 상세·채팅 등 직접 URL로 새로고침 시 404가 아니어야 합니다.

## 5. Pi 앱 — 도메인 인증 (`validation-key.txt`)

| 항목 | 위치 |
|------|------|
| 파일 이름 | `validation-key.txt` |
| 저장 위치 | `frontend/public/validation-key.txt` |

배포 후 확인 URL:

- **메인넷:** `https://marketpiepie.vercel.app/validation-key.txt`
- **테스트넷:** `https://marketpiepietest.vercel.app/validation-key.txt`

Pi 콘솔 앱 도메인과 **동일한 호스트**의 URL로 검증합니다.

**체크리스트**

1. Pi 콘솔 키를 `frontend/public/validation-key.txt` 에 붙여넣기.
2. 커밋·푸시 후 Vercel **재배포**.
3. 해당 도메인의 `/validation-key.txt` 에 키 한 줄이 보이는지 확인.
4. Pi 앱 도메인이 Vercel URL과 일치하는지 확인.
5. Pi 앱에서 **[Verify Domain]** 클릭.

> Vercel은 **실제 파일이 있으면** SPA `rewrites` 보다 정적 파일을 먼저 제공합니다.
