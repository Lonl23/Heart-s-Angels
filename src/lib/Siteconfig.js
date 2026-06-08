// src/lib/siteConfig.js
// Charge UNE seule fois la table site_images (images de fond + motif),
// avec CACHE LOCAL (localStorage) pour un affichage instantané dès la 2e visite,
// puis rafraîchissement en arrière-plan, réessai réseau, et préchargement d'images.
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const LS_KEY = 'ha_site_config_v1'

let _promise = null
let _cache = null   // map en mémoire (vivante pour la session)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Lecture immédiate du cache local (synchrone, zéro latence)
function lireCacheLocal() {
  if (_cache) return _cache
  try {
    const brut = localStorage.getItem(LS_KEY)
    if (brut) { _cache = JSON.parse(brut); return _cache }
  } catch { /* localStorage indisponible */ }
  return null
}

function ecrireCacheLocal(map) {
  _cache = map
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)) } catch { /* ignore */ }
}

async function fetchAll(retry = 2) {
  try {
    const { data, error } = await supabase.from('site_images').select('cle, image_url')
    if (error) throw error
    const map = {}
    ;(data || []).forEach(r => { map[r.cle] = r.image_url })
    return map
  } catch (e) {
    if (retry > 0) { await sleep(700); return fetchAll(retry - 1) }
    throw e
  }
}

// Précharge une image dans le cache du navigateur (priorité haute)
export function preloadImage(url) {
  if (!url || typeof document === 'undefined') return
  // Évite les doublons
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return
  const link = document.createElement('link')
  link.rel = 'preload'; link.as = 'image'; link.href = url
  link.fetchPriority = 'high'
  document.head.appendChild(link)
  // Décode aussi en mémoire
  const img = new Image()
  img.src = url
}

// Lance la requête réseau une seule fois (partagée), met à jour le cache local
export function loadSiteConfig() {
  if (!_promise) {
    _promise = fetchAll()
      .then(map => {
        ecrireCacheLocal(map)
        // Précharger toutes les images de fond connues
        Object.entries(map).forEach(([cle, url]) => { if (cle.startsWith('hero_')) preloadImage(url) })
        return map
      })
      .catch(() => { _promise = null; return lireCacheLocal() || {} })
  }
  return _promise
}

// Hook : renvoie la config. Initialisé AVEC le cache local → instantané dès la 2e visite.
export function useSiteConfig() {
  const [cfg, setCfg] = useState(() => lireCacheLocal())
  useEffect(() => {
    let monté = true
    // Toujours rafraîchir en arrière-plan (capte les changements faits en interne)
    loadSiteConfig().then(map => { if (monté && map) setCfg({ ...map }) })
    return () => { monté = false }
  }, [])
  return cfg
}

// Hook : une image précise. Précharge dès qu'on connaît l'URL.
export function useSiteImage(cle, fallback = null) {
  const cfg = useSiteConfig()
  const url = cfg ? (cfg[cle] || fallback) : fallback
  useEffect(() => { if (url) preloadImage(url) }, [url])
  return url
}

// Hook : motif de séparation
export function useMotif() {
  const cfg = useSiteConfig()
  if (!cfg) return 'vague1'
  return cfg['motif_separateur'] || 'vague1'
}