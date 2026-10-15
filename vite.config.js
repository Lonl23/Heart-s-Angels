import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function stampServiceWorker() {
  return {
    name: 'stamp-sw',
    apply: 'build',
    enforce: 'post',
    closeBundle: {
      sequential: true,
      order: 'post',
      handler() {
        const file = path.resolve(__dirname, 'dist/sw.js')
        if (!fs.existsSync(file)) return
        const id = Date.now().toString(36)
        const src = fs.readFileSync(file, 'utf8').replaceAll('__SW_BUILD__', id)
        fs.writeFileSync(file, src)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const p = id.replace(/\\/g, '/')
          if (!p.includes('/node_modules/')) return
          if (p.includes('/xlsx/')) return 'vendor-xlsx'
          if (p.includes('/qrcode/')) return 'vendor-qrcode'
          if (p.includes('/@supabase/')) return 'vendor-supabase'
          if (p.includes('/react-dom/') || p.includes('/react-router') || p.includes('/react/')) return 'vendor-react'
          return 'vendor'
        },
      },
    },
  },
})
