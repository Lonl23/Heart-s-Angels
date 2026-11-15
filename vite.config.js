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

function rescuetrackSpaFallback() {
  const rewrite = (req, _res, next) => {
    const raw = req.url || ''
    const chemin = raw.split('?')[0]
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
    const dernier = chemin.split('/').pop() || ''
    if (
      req.method === 'GET'
      && (chemin === '/rescuetrack' || chemin.startsWith('/rescuetrack/'))
      && !dernier.includes('.')
    ) {
      req.url = '/rescuetrack/index.html' + query
    }
    next()
  }
  return {
    name: 'rescuetrack-spa-fallback',
    configureServer(server) { server.middlewares.use(rewrite) },
    configurePreviewServer(server) { server.middlewares.use(rewrite) },
  }
}

export default defineConfig({
  plugins: [react(), stampServiceWorker(), rescuetrackSpaFallback()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const p = id.replace(/\\/g, '/')
          if (!p.includes('/node_modules/')) return
          if (p.includes('/qrcode/')) return 'vendor-qrcode'
          if (p.includes('/@supabase/')) return 'vendor-supabase'
          if (p.includes('/react-dom/') || p.includes('/react-router') || p.includes('/react/')) return 'vendor-react'
          return 'vendor'
        },
      },
    },
  },
})
