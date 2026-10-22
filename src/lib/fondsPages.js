import { supabase } from '@/lib/supabase'
import { compressImage } from '@/modules/souhaits/TerrainPhotos'

export const BUCKET_FONDS = 'fonds-app'

export const PAGES_FONDS = [
  { k: 'login', l: 'Connexion', hint: 'Connexion, inscription et mot de passe', groupe: 'Entrée' },
  { k: 'demande', l: 'Demande de souhait', hint: 'Formulaire public', groupe: 'Entrée' },
  { k: 'partenaire', l: 'Portail partenaire', hint: 'Espace des partenaires', groupe: 'Entrée' },
  { k: 'dashboard', l: 'Accueil', hint: 'Page du jour après connexion', groupe: 'Accueil' },
  { k: 'garde_rh', l: 'Gestion RH', hint: 'Page de garde', groupe: 'Pages de garde' },
  { k: 'garde_souhaits', l: 'Département souhaits', hint: 'Page de garde', groupe: 'Pages de garde' },
  { k: 'garde_secours', l: 'Département secours', hint: 'Page de garde', groupe: 'Pages de garde' },
  { k: 'garde_it', l: 'IT', hint: 'Page de garde', groupe: 'Pages de garde' },
  { k: 'garde_logistique', l: 'Département logistique', hint: 'Page de garde', groupe: 'Pages de garde' },
  { k: 'garde_tresorerie', l: 'Trésorerie', hint: 'Page de garde', groupe: 'Pages de garde' },
  { k: 'profil', l: 'Ma fiche', hint: 'Fiche du volontaire', groupe: 'Modules' },
  { k: 'volontaires', l: 'Fiches volontaires', hint: 'Liste des membres', groupe: 'Modules' },
  { k: 'defraiements', l: 'Défraiements', hint: 'Notes de frais', groupe: 'Modules' },
  { k: 'annuaire', l: 'Annuaire', hint: 'Bénéficiaires et institutions', groupe: 'Modules' },
  { k: 'organigramme', l: 'Organigramme', hint: 'Consultation', groupe: 'Modules' },
  { k: 'evenements', l: 'Événements internes', hint: 'Réunions ASBL', groupe: 'Modules' },
  { k: 'actualites', l: 'Actualités', hint: 'Lecture des nouvelles', groupe: 'Modules' },
  { k: 'souhaits', l: 'Préparation souhait', hint: 'Dossiers', groupe: 'Modules' },
  { k: 'missions', l: 'Mes souhaits', hint: 'Terrain', groupe: 'Modules' },
  { k: 'disponibilites', l: 'Disponibilités', hint: 'Agenda', groupe: 'Modules' },
  { k: 'activites_secours', l: 'Activités secours', hint: 'Inscriptions du personnel', groupe: 'Modules' },
  { k: 'helpdesk', l: 'Helpdesk', hint: 'Tickets', groupe: 'Modules' },
  { k: 'personnalisation', l: 'Personnalisation', hint: 'Cet écran', groupe: 'Modules' },
  { k: 'admin', l: 'Administration', hint: 'Partenaires et accès', groupe: 'Modules' },
  { k: 'organigramme_edition', l: 'Composition de l’organigramme', hint: 'IT', groupe: 'Modules' },
  { k: 'config_souhaits', l: 'Configuration souhaits', hint: 'Bases, institutions, matériel', groupe: 'Modules' },
  { k: 'actualites_edition', l: 'Rédaction des actualités', hint: 'IT', groupe: 'Modules' },
  { k: 'statistiques', l: 'Statistiques', hint: 'Graphiques', groupe: 'Modules' },
  { k: 'stock', l: 'Stock', hint: 'Matériel et mouvements', groupe: 'Modules' },
  { k: 'tresorerie', l: 'Suivi des notes', hint: 'Trésorerie', groupe: 'Modules' },
]

export function pageFondDepuisChemin(path) {
  const p = String(path || '')
  if (p === '/app' || p === '/app/') return 'dashboard'
  if (p.startsWith('/app/departement/rh')) return 'garde_rh'
  if (p.startsWith('/app/departement/souhaits')) return 'garde_souhaits'
  if (p.startsWith('/app/departement/secours')) return 'garde_secours'
  if (p.startsWith('/app/departement/it')) return 'garde_it'
  if (p.startsWith('/app/departement/logistique')) return 'garde_logistique'
  if (p.startsWith('/app/departement/tresorerie')) return 'garde_tresorerie'
  if (p.startsWith('/app/it/helpdesk')) return 'helpdesk'
  if (p.startsWith('/app/it/personnalisation')) return 'personnalisation'
  if (p.startsWith('/app/admin')) return 'admin'
  if (p.startsWith('/app/it/organigramme')) return 'organigramme_edition'
  if (p.startsWith('/app/rh/organigramme')) return 'organigramme'
  if (p.startsWith('/app/it/configuration')) return 'config_souhaits'
  if (p.startsWith('/app/it/actualites')) return 'actualites_edition'
  if (p.startsWith('/app/it/statistiques')) return 'statistiques'
  if (p.startsWith('/app/actualites')) return 'actualites'
  if (p.startsWith('/app/evenements')) return 'evenements'
  if (p.startsWith('/app/secours/activites')) return 'activites_secours'
  if (p.startsWith('/app/souhaits')) return 'souhaits'
  if (p.startsWith('/app/missions')) return 'missions'
  if (p.startsWith('/app/disponibilites')) return 'disponibilites'
  if (p.startsWith('/app/defraiements')) return 'defraiements'
  if (p.startsWith('/app/profil')) return 'profil'
  if (p.startsWith('/app/volontaires')) return 'volontaires'
  if (p.startsWith('/app/annuaire')) return 'annuaire'
  if (p.startsWith('/app/stock')) return 'stock'
  if (p.startsWith('/app/tresorerie')) return 'tresorerie'
  if (p.startsWith('/partenaire')) return 'partenaire'
  if (p.startsWith('/demande')) return 'demande'
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
