import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variables Supabase manquantes. Vérifiez votre fichier .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Stockage sécurisé : sessionStorage (effacé à la fermeture du navigateur)
    // plutôt que localStorage pour les données médicales sensibles
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // Protection CSRF — OAuth PKCE flow
  },
  global: {
    headers: {
      'X-Client-Info': 'hearts-angels/1.0.0',
    },
  },
  // Timeout raisonnable pour éviter les requêtes pendantes
  realtime: { timeout: 30000 },
})

// ── Helpers d'audit ──────────────────────────────────────────────────────────

/**
 * Log d'accès aux données sensibles (souhaits, bénéficiaires)
 * Enregistré dans la table audit_logs pour conformité RGPD
 */
export async function logAccess(action, table, recordId = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('audit_logs').insert({
    user_id:   user.id,
    action,
    table_name: table,
    record_id:  recordId,
    ip_hash:    null, // Pas de collecte d'IP côté client (RGPD)
    created_at: new Date().toISOString(),
  })
}

/**
 * Upload sécurisé d'un fichier (photo véhicule, justificatif)
 * Retourne l'URL publique signée (expiration 1h) ou l'URL permanente
 */
export async function uploadFile(bucket, path, file, options = {}) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      ...options,
    })
  if (error) throw error

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path)
  return urlData.publicUrl
}

/**
 * Suppression définitive d'un fichier (droit à l'oubli RGPD)
 */
export async function deleteFile(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}
