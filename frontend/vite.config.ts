import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/icon-192.svg', 'assets/icon-512.svg'],
      manifest: {
        name: 'Student Vault',
        short_name: 'Student Vault',
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
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@/types': path.resolve(__dirname, './src/types'),
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