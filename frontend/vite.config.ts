import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 배포 빌드에 API/실시간 서버 주소가 빠지면 화면은 뜨지만 모든 요청이 Vercel(index.html 로 되돌림)이나
// localhost:4001 로 가서 조용히 망가진다. 그래서 production 빌드에서는 두 값이 없으면 빌드를 멈춘다.
// 정말 같은 주소(리버스 프록시)로 배포한다면 SKIP_API_ENV_CHECK=1 로 끌 수 있다.
const REQUIRED_PROD_ENV = ['VITE_API_BASE', 'VITE_REALTIME_URL'] as const

function checkProductionEnv(mode: string, command: string) {
  if (command !== 'build' || mode !== 'production') return
  const env = loadEnv(mode, '.', '') // '' = .env* 파일 + 실행 환경(Vercel 대시보드 값) 전부
  const missing = REQUIRED_PROD_ENV.filter((key) => !(env[key] ?? '').trim())
  if (missing.length === 0) return
  const message =
    `[득근득근] 배포 빌드에 필요한 환경변수가 없습니다: ${missing.join(', ')}\n` +
    '  - Vercel: Project Settings > Environment Variables 에 추가하세요.\n' +
    '  - 로컬: frontend/.env.production 에 넣으세요.\n' +
    '  - 같은 주소로 API 를 돌려 주는 배포라면 SKIP_API_ENV_CHECK=1 로 이 검사를 끌 수 있습니다.'
  if (env.SKIP_API_ENV_CHECK === '1') {
    // tsconfig.node.json 은 lib 에 DOM 이 없어 console 타입이 없다(Vercel 의 tsc -b 에서 TS2584). globalThis 로 꺼내 쓴다.
    ;(globalThis as { console?: { warn: (msg: string) => void } }).console?.warn(message)
    return
  }
  throw new Error(message)
}

export default defineConfig(({ mode, command }) => {
  checkProductionEnv(mode, command)
  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '득근득근 MuscleUp',
        short_name: '득근득근',
        description: '게임형 피트니스 커뮤니티 앱',
        theme_color: '#1A1A1C',
        background_color: '#1A1A1C',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  }
})
