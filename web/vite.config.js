import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the build works from any folder (GitHub Pages, a static host, or opened locally)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
})
