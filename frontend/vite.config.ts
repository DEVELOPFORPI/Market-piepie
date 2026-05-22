import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 기본은 HTTP → 브라우저 인증서 경고 없음 (http://localhost:5173).
// Pi Browser 등 로컬에서 HTTPS가 필요하면 터미널에서 LOCAL_HTTPS=true 후 실행:
//   PowerShell: $env:LOCAL_HTTPS="true"; npm run dev
const useLocalHttps = process.env.LOCAL_HTTPS === 'true'

// 로컬 dev 서버에서 /api, /socket.io 가 향할 백엔드 주소.
// 기본값: 같은 머신에 띄운 로컬 백엔드. Lightsail로 붙고 싶으면 .env 또는 셸에서 설정:
//   PowerShell: $env:DEV_API_TARGET="https://api-test.example.com"; npm run dev
const devApiTarget = process.env.DEV_API_TARGET || 'http://localhost:4000'

export default defineConfig({
  plugins: [
    react(),
    ...(useLocalHttps ? [basicSsl()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: devApiTarget,
        changeOrigin: true,
        ws: true,
        secure: false,
      },
      '/proxy/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/coingecko/, '/api/v3'),
        secure: true,
      },
    },
  }
})
