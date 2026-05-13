import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config: dev server en 5173 (alineado con CORS_ORIGINS del backend)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy /api → backend, evita CORS en dev
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
