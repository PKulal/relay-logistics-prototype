/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Windows: a lowercase drive letter (c:\ vs C:\) can make Vite bundle two
  // copies of React ("Invalid hook call"). Force a single copy.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'react-i18next', 'lucide-react'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@shared': src('shared'),
      '@apps': src('apps'),
      '@data': src('data'),
      '@': src(''),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
