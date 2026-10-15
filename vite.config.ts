import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.DEV_SERVER_PORT || '5173')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DEV_SERVER_PORT must be an integer between 1 and 65535.')
  }

  const target = new URL(env.API_PROXY_TARGET || 'http://localhost:8000')
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('API_PROXY_TARGET must use http or https.')
  }

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      proxy: {
        '/api': { target: target.origin, changeOrigin: true },
      },
    },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  }
})
