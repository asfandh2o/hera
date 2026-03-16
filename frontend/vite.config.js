import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/auth': 'http://localhost:8001',
      '/employees': 'http://localhost:8001',
      '/prompts': 'http://localhost:8001',
      '/tasks': 'http://localhost:8001',
      '/projects': 'http://localhost:8001',
      '/tickets': 'http://localhost:8001',
      '/health': 'http://localhost:8001',
    },
  },
})
