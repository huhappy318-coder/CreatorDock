import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'apple-touch-icon-180x180.png',
        'creator-dock-mark.svg',
        'favicon.ico',
        'maskable-icon-512x512.png',
        'pwa-64x64.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      devOptions: {
        enabled: false,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{css,html,js,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
      manifest: {
        name: 'CreatorDock',
        short_name: 'CreatorDock',
        description: 'A private creator launchpad for your publishing workbench.',
        theme_color: '#f7f3ec',
        background_color: '#f7f3ec',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'creator-dock-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
