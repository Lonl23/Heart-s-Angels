import { createClient } from '@supabase/supabase-js'
import config from '@/app.config'

const { url, anonKey } = config.supabase
if (!url || !anonKey || anonKey.startsWith('colle_ici')) {
  console.error('Configurez src/app.config.js (supabase.url et supabase.anonKey).')
}

export const supabase = createClient(url, anonKey, {
  auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
})
