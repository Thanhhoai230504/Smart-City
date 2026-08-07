import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Smart City Đà Nẵng',
        short_name: 'SmartCity',
        description: 'Hệ thống giám sát đô thị thông minh thành phố Đà Nẵng',
        start_url: '/',
        display: 'standalone',
        background_color: '#0F172A',
        theme_color: '#6C63FF',
        lang: 'vi',
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache chỉ shell cần để khởi động. Các chunk bản đồ/biểu đồ/export
        // được cache lúc người dùng mở, tránh tải ngầm toàn bộ ứng dụng (~2.7 MB).
        globPatterns: [
          '**/*.{css,html,ico,svg,woff2}',
          'assets/entry-*.js',
          'assets/chunk-react-vendor-*.js',
          'assets/chunk-mui-vendor-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/chunk-.*\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lazy-app-chunks',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/leaflet.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'leaflet-cdn',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Chỉ cache dữ liệu công khai, ít nhạy cảm. Không cache auth,
            // hồ sơ, thông báo hoặc dữ liệu quản trị trong service worker.
            urlPattern: ({ url, request }) => {
              if (request.method !== 'GET') return false
              return [
                '/api/statistics',
                '/api/places',
                '/api/environment',
                '/api/traffic',
              ].some((pathPrefix) => url.pathname.startsWith(pathPrefix))
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'public-api-cache',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 2 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/entry-[name]-[hash].js',
        chunkFileNames: 'assets/chunk-[name]-[hash].js',
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('leaflet')) return 'map-vendor'
          if (id.includes('recharts')) return 'chart-vendor'
          if (id.includes('xlsx') || id.includes('jspdf')) return 'export-vendor'
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui-vendor'
          if (
            id.includes('react-dom')
            || id.includes('react-router')
            || id.includes('react-redux')
            || id.includes('@reduxjs/toolkit')
          ) return 'react-vendor'
          return undefined
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
