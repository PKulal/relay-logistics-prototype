/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Windows: a lowercase drive letter (c:\ vs C:\) can make Vite bundle two
  // copies of React ("Invalid hook call"). Force a single copy.
  // Every runtime library is pre-bundled up front: a library discovered mid-session
  // makes Vite re-optimise and reload ("Outdated Optimize Dep"), which is how a
  // second React copy crept in during Phase 0.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'react-i18next',
      'i18next',
      'lucide-react',
      'recharts',
      'radix-ui',
      'sonner',
      'input-otp',
      'zustand',
      'zustand/middleware',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    // Root-relative targets ("/src/…"), not absolute file paths: on Windows an absolute
    // path built from this file can carry a different drive-letter case than Vite's root,
    // and Vite then serves the same module under two URLs (/src/… and /@fs/c:/…) — two
    // stores, two i18n instances, and tab sync attached to the wrong one.
    alias: {
      '@shared': '/src/shared',
      '@apps': '/src/apps',
      '@data': '/src/data',
      '@': '/src',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Several suites build the full seed (~0.5 s alone, slower with 16 files in parallel)
    testTimeout: 15000,
  },
})
