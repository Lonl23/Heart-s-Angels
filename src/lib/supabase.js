import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variables Supabase manquantes. Vérifiez votre fichier .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage:            localStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: true,
    // flowType 'pkce' supprimé — cause des blocages avec Firebase Hosting
  },
})

export async function logAccess(action, table, recordId = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('audit_logs').insert({
      user_id:    user.id,
      action,
      table_name: table,
      record_id:  recordId,
      created_at: new Date().toISOString(),
    })
  } catch {}
}

export async function uploadFile(bucket, path, file, options = {}) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: false, ...options })
  if (error) throw error
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function deleteFile(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}