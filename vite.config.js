import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/simulate':        'http://127.0.0.1:5000',
      '/validate':        'http://127.0.0.1:5000',
      '/ai-query':        'http://127.0.0.1:5000',
      '/export':          'http://127.0.0.1:5000',
      '/health':          'http://127.0.0.1:5000',
      '/design':          'http://127.0.0.1:5000',
      '/optimize':        'http://127.0.0.1:5000',
      '/sensitivity':     'http://127.0.0.1:5000',
      '/reverse_solve':   'http://127.0.0.1:5000',
      '/verify_timestep': 'http://127.0.0.1:5000',
      '/feasibility':     'http://127.0.0.1:5000',
    }
  },
  build: {
    cssMinify: false
  }
})
