import { supabase } from '@/lib/supabase'

export const BUCKET_DOCS_SEJOUR = 'mission-docs'
export const TAILLE_MAX_DOC_SEJOUR = 15 * 1024 * 1024

const MIME_OK = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const urlCache = new Map()

function extFichier(nom, mime) {
  const fromNom = String(nom || '').split('.').pop()
  if (fromNom && /^[a-z0-9]{1,8}$/i.test(fromNom)) return fromNom.toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if ((mime || '').startsWith('image/')) return 'jpg'
  return 'bin'
}

export async function uploadDocSejour(souhaitId, lieuId, file) {
  if (!file) throw new Error('Aucun fichier.')
  if (file.size > TAILLE_MAX_DOC_SEJOUR) throw new Error('Fichier trop lourd (15 Mo max).')
  const mime = file.type || ''
  if (mime && !MIME_OK.has(mime) && !mime.startsWith('image/')) {
    throw new Error('PDF ou image uniquement.')
  }
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const ext = extFichier(file.name, mime)
  const path = `${souhaitId}/${lieuId}/${id}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_DOCS_SEJOUR).upload(path, file, {
    contentType: mime || undefined,
    upsert: false,
  })
  if (error) throw error
  return {
    id,
    path,
    nom: file.name || `document.${ext}`,
    mime: mime || null,
    size: file.size,
    at: new Date().toISOString(),
  }
}

export async function signedDocSejour(path) {
  if (!path) return null
  const hit = urlCache.get(path)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from(BUCKET_DOCS_SEJOUR).createSignedUrl(path, 8 * 3600)
  if (error) throw error
  const url = data?.signedUrl || null
  if (url) urlCache.set(path, { url, exp: Date.now() + 6 * 3600 * 1000 })
  return url
}

export async function supprimerFichierSejour(path) {
  if (!path) return
  await supabase.storage.from(BUCKET_DOCS_SEJOUR).remove([path]).catch(() => {})
  urlCache.delete(path)
}
