import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // prompt: show a UI toast when a new SW is waiting (UpdatePrompt.tsx).
      // Beats autoUpdate for a game — we don't want to silently reload while
      // the player is mid-level. NetworkFirst (below) ensures fresh HTML on
      // the next refresh anyway.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '南極大冒險：企鵝跑酷',
        short_name: '企鵝跑酷',
        description: '致敬 Konami 1983 經典遊戲，由阿凱老師為石門國小學生製作。',
        lang: 'zh-TW',
        theme_color: '#0a0a1a',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        // CRITICAL: NetworkFirst for HTML navigations means the browser tries the
        // network first (with a 3s timeout) before falling back to the precached
        // copy. Without this, the SW serves the OLD index.html — which references
        // hashed chunk filenames that no longer exist on the server, producing
        // 404s on lazy imports (e.g. LeaderboardModal-XXXX.js). See:
        // https://web.dev/articles/offline-cookbook#network_falling_back_to_cache
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        // skipWaiting NOT set — we want the user to confirm via the toast.
        // updateServiceWorker(true) call in UpdatePrompt.tsx handles skipWaiting + reload.
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'penguin-pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/firestore'],
          motion: ['motion/react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
