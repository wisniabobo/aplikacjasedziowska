/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: aplikacja pod /aplikacjasedziowska/ (zmienna BASE_PATH pozwala zbudować pod inną ścieżką).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/aplikacjasedziowska/',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
