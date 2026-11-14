import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the build works from any folder (GitHub Pages, a static host, or opened locally)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
  // `npm run dev` talks to the API on :8000 (uvicorn server.main:app --port 8000)
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
