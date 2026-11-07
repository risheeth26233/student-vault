import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['assets/icon-192.svg', 'assets/icon-512.svg'],
      workbox: {
        // Optional decoration can fall back to CSS offline without delaying app caching.
        globIgnores: ['**/StudyGradient-*.js', '**/demo/**'],
      },
      manifest: {
        name: 'STUDENT VALUT',
        short_name: 'STUDENT VALUT',
        description: 'A browser-based study organizer for exam preparation',
        start_url: '/app/',
        display: 'standalone',
        background_color: '#f2f5f0',
        theme_color: '#177068',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'assets/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'assets/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        categories: ['education', 'productivity'],
        shortcuts: [
          {
            name: 'My Vault',
            short_name: 'Vault',
            description: 'View your study topics',
            url: '/app/vault',
            icons: [{ src: 'assets/icon-192.svg', sizes: '192x192' }],
          },
          {
            name: 'Attendance',
            short_name: 'Attendance',
            description: 'Track attendance',
            url: '/app/attendance',
            icons: [{ src: 'assets/icon-192.svg', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@/components': path.resolve(import.meta.dirname, './src/components'),
      '@/hooks': path.resolve(import.meta.dirname, './src/hooks'),
      '@/lib': path.resolve(import.meta.dirname, './src/lib'),
      '@/services': path.resolve(import.meta.dirname, './src/services'),
      '@/pages': path.resolve(import.meta.dirname, './src/pages'),
      '@/styles': path.resolve(import.meta.dirname, './src/styles'),
      '@/types': path.resolve(import.meta.dirname, './src/types'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
