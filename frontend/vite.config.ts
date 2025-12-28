import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      'markd-v1.c9.ooo.ovh',
      'markd-v2.c9.ooo.ovh',
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8200',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8200',
        changeOrigin: true,
        ws: true,
      },
      '/yjs': {
        target: 'ws://localhost:1234',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/yjs/, ''),
      }
    }
  },
  define: {
    'import.meta.env.VITE_YJS_WS_URL': JSON.stringify(process.env.VITE_YJS_WS_URL || 'ws://localhost:1234'),
  }
})