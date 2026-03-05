import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy SAP B1 Service Layer requests to avoid CORS.
      // The SAP server uses a self-signed cert so secure: false is required.
      '/b1s': {
        target: 'https://47.250.53.233:50000',
        secure: false,
        changeOrigin: true,
      },
    },
  },
})
