import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

/** Keeps React, TypeScript path aliases and the Tailwind v4/HeroUI stylesheet pipeline in one build. */
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],
})
