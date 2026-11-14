/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Our own service worker (src/sw.ts) so we can add push notifications.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      // Icons, apple-touch-icon and iOS splash screens from pwa-assets.config.ts
      pwaAssets: { config: true, overrideManifestIcons: true, includeHtmlHeadLinks: true },
      manifest: {
        name: 'Family Hub',
        short_name: 'Family Hub',
        description: 'Chores, calendar, meals and shopping for the whole family.',
        theme_color: '#7B61FF',
        background_color: '#F7F5FF',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'en-GB',
        categories: ['lifestyle', 'productivity'],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Splash screens are only needed on first launch from the home screen.
        globIgnores: ['**/apple-splash-*'],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 400,
    rolldownOptions: {
      output: {
        // Split big libraries into their own files so they stay cached between app updates.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
