import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5373,
    host: true,
    allowedHosts: [
      'markd-v3.c9.ooo.ovh',
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8300',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8300',
        changeOrigin: true,
        ws: true,
      },
      '/yjs': {
        target: 'ws://localhost:1235',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/yjs/, ''),
      }
    }
  },
  define: {
    'import.meta.env.VITE_YJS_WS_URL': JSON.stringify(process.env.VITE_YJS_WS_URL || 'ws://localhost:1235'),
  }
})