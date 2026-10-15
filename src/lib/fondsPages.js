import { supabase } from '@/lib/supabase'
import { compressImage } from '@/modules/souhaits/TerrainPhotos'

export const BUCKET_FONDS = 'fonds-app'

export const PAGES_FONDS = [
  { k: 'dashboard', l: 'Accueil', hint: 'Choix du département après connexion' },
  { k: 'disponibilites', l: 'Disponibilités', hint: 'Agenda' },
  { k: 'evenements', l: 'Événements internes', hint: 'Réunions ASBL' },
  { k: 'defraiements', l: 'Défraiements', hint: 'Notes de frais' },
  { k: 'profil', l: 'Ma fiche', hint: 'Fiche du volontaire' },
  { k: 'volontaires', l: 'Volontaires', hint: 'Liste des membres' },
  { k: 'login', l: 'Connexion', hint: 'Écran de connexion (ASBL et partenaire)' },
]

export function pageFondDepuisChemin(path) {
  const p = String(path || '')
  if (p === '/app' || p === '/app/') return 'dashboard'
  if (p.startsWith('/app/disponibilites')) return 'disponibilites'
  if (p.startsWith('/app/evenements')) return 'evenements'
  if (p.startsWith('/app/defraiements')) return 'defraiements'
  if (p.startsWith('/app/profil')) return 'profil'
  if (p.startsWith('/app/volontaires')) return 'volontaires'
  if (
    p.startsWith('/login')
    || p.startsWith('/mot-de-passe-oublie')
    || p.startsWith('/reinitialiser-mot-de-passe')
    || p.startsWith('/inscription')
  ) return 'login'
  return null
}

export function urlFondPublic(path) {
  if (!path) return ''
  const { data } = supabase.storage.from(BUCKET_FONDS).getPublicUrl(path)
  return data?.publicUrl || ''
}

export function styleFond(url, intensite = 22) {
  if (!url) return {}
  const voile = Math.max(20, Math.min(92, 100 - Number(intensite || 22)))
  const couche = `color-mix(in srgb, var(--bg) ${voile}%, transparent)`
  return {
    backgroundImage: `linear-gradient(${couche}, ${couche}), url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
}

let cache = null
let cacheAt = 0
let inflight = null

export function invaliderFondsPages() {
  cache = null
  cacheAt = 0
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ha-fonds-maj'))
}

export async function chargerFondsPages() {
  if (cache && Date.now() - cacheAt < 120000) return cache
  if (inflight) return inflight
  inflight = (async () => {
    const [{ data: images }, { data: pages }] = await Promise.all([
      supabase.from('app_fonds').select('*').order('created_at', { ascending: false }),
      supabase.from('app_fonds_pages').select('*'),
    ])
    cache = { images: images || [], pages: pages || [] }
    cacheAt = Date.now()
    inflight = null
    return cache
  })()
  try {
    return await inflight
  } catch (e) {
    inflight = null
    throw e
  }
}

export function fondPourPage(etat, page) {
  if (!etat || !page) return null
  const row = (etat.pages || []).find(p => p.page === page)
  if (!row?.fond_id) return null
  const img = (etat.images || []).find(i => i.id === row.fond_id)
  if (!img?.path) return null
  return { ...row, ...img, url: urlFondPublic(img.path) }
}

export async function compresserFond(file) {
  try {
    const bmp = await createImageBitmap(file)
    const max = 1920
    let w = bmp.width, h = bmp.height
    if (w > max || h > max) {
      const r = Math.min(max / w, max / h)
      w = Math.round(w * r)
      h = Math.round(h * r)
    }
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.8))
    bmp.close?.()
    return blob || compressImage(file)
  } catch {
    return compressImage(file)
  }
}
