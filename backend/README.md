# MarketPiePie Backend

## 요구사항

- Node.js **18+** (`npm run dev`의 `--watch` 사용)

## 설치

```bash
cd backend
npm install
```

`package.json`이 없으면 `npm install`이 실패합니다. 저장소에 `package.json`이 포함돼 있는지 확인하세요.

## 실행

```bash
npm run dev
```

- API: `http://localhost:3001/api/health`
- `.env`는 `.env.example`을 복사해 만듭니다. `DATABASE_URL`이 없어도 서버는 뜨고 `db: "skipped"` 로 응답합니다.

## 프론트와의 관계

현재 프론트엔드는 브라우저 저장소를 쓰며, 이 API와 자동으로 붙어 있지 않습니다. 연동 시 `VITE_API_BASE_URL` 등으로 호출을 추가하면 됩니다.
