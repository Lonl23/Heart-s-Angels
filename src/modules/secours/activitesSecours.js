import { QUALIFS, qualsImplicites } from '@/modules/fiche/ficheSchema'

/** Nature de l’activité. Pas un rôle de compte. */
export const TYPES_ACTIVITE = [
  { v: 'activite', l: 'Activité' },
  { v: 'garde', l: 'Garde' },
  { v: 'manoeuvre', l: 'Manœuvre' },
  { v: 'formation', l: 'Formation' },
]

export function libelleTypeActivite(v) {
  return TYPES_ACTIVITE.find(t => t.v === v)?.l || 'Activité'
}

/** Type de dispositif prévisionnel. Choisi, pas calculé. */
export const DISPOSITIFS = [
  { v: 'paps', l: 'Point d’alerte et de premiers secours', court: 'PAPS' },
  { v: 'pe', l: 'DPS petite envergure', court: 'Petite envergure' },
  { v: 'me', l: 'DPS moyenne envergure', court: 'Moyenne envergure' },
  { v: 'ge', l: 'DPS grande envergure', court: 'Grande envergure' },
]

export function libelleDispositif(v, court = false) {
  const d = DISPOSITIFS.find(x => x.v === v)
  if (!d) return ''
  return court ? d.court : d.l
}

/** null si vide, nombre si valide, undefined si illisible. */
export function publicAttenduOuNull(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 500000) return undefined
  return n
}

/** La sélection médicale est échue et l’activité demande un chauffeur. */
export function selectionChauffeurEchue(profile, activite, maintenant = new Date()) {
  const req = Array.isArray(activite?.competences) ? activite.competences : []
  if (!req.includes('chauffeur')) return false
  const iso = profile?.fiche?.permis?.selection_validite
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false
  const [y, m, d] = String(iso).split('-').map(Number)
  const fin = new Date(y, m - 1, d, 23, 59, 59, 999)
  return maintenant.getTime() > fin.getTime()
}

/** Qualifications de la fiche, plus le type médical / non médical. */
export const COMPETENCES_ACTIVITE = [
  ...QUALIFS,
  { v: 'medical', l: 'Type médical' },
  { v: 'non_medical', l: 'Type non médical' },
]

const CLES = new Set(COMPETENCES_ACTIVITE.map(c => c.v))

export function libelleCompetence(v) {
  return COMPETENCES_ACTIVITE.find(c => c.v === v)?.l || v
}

export function competencesConnues(liste) {
  const vus = new Set()
  const out = []
  for (const c of Array.isArray(liste) ? liste : []) {
    if (!CLES.has(c) || vus.has(c)) continue
    vus.add(c)
    out.push(c)
  }
  return out
}

/** Ce que la fiche couvre vraiment : qualifications (et celles que l’app en déduit) et le type. */
export function competencesDuProfil(profile) {
  const fiche = profile?.fiche || {}
  const set = new Set(qualsImplicites(profile?.role, fiche))
  if (fiche.type_benevole === 'medical' || profile?.role === 'volontaire_medical') set.add('medical')
  if (fiche.type_benevole === 'non_medical' || profile?.role === 'volontaire_non_medical') set.add('non_medical')
  return set
}

export function requiertMesCompetences(activite, mes) {
  const req = Array.isArray(activite?.competences) ? activite.competences : []
  if (!req.length || !mes || mes.size === 0) return false
  return req.some(c => mes.has(c))
}

/**
 * a_venir : le début n’est pas encore passé.
 * en_cours : le début est passé et la fin, s’il y en a une, non.
 * terminee : la fin est passée, ou le début s’il n’y a pas de fin.
 */
export function statutActivite(activite, maintenant = new Date()) {
  const debut = new Date(activite?.debut)
  const fin = activite?.fin ? new Date(activite.fin) : null
  const t = maintenant.getTime()
  if (Number.isNaN(debut.getTime()) || t < debut.getTime()) return 'a_venir'
  if (fin && !Number.isNaN(fin.getTime()) && t <= fin.getTime()) return 'en_cours'
  return 'terminee'
}

export function libelleStatutActivite(statut) {
  if (statut === 'en_cours') return 'En cours'
  if (statut === 'terminee') return 'Terminée'
  return 'À venir'
}

/** Durée entre le début et la fin, ou null s’il n’y a pas de fin. */
export function dureeActivite(activite) {
  if (!activite?.debut || !activite?.fin) return null
  const ms = new Date(activite.fin).getTime() - new Date(activite.debut).getTime()
  if (!(ms > 0)) return null
  const min = Math.round(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h} h ${String(m).padStart(2, '0')}`
  if (h) return `${h} h`
  return `${m} min`
}

/** L’activité n’est pas terminée (la fin, ou le début s’il n’y a pas de fin). */
export function estAVenir(activite, maintenant = new Date()) {
  const fin = activite?.fin ? new Date(activite.fin) : new Date(activite?.debut)
  return !Number.isNaN(fin.getTime()) && fin.getTime() >= maintenant.getTime()
}

/** Le début tombe entre aujourd’hui (minuit local) et dans 30 jours, non compris. */
export function dansLes30Jours(debut, maintenant = new Date()) {
  const d = new Date(debut)
  if (Number.isNaN(d.getTime())) return false
  const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  const limite = new Date(jour)
  limite.setDate(limite.getDate() + 30)
  return d >= jour && d < limite
}

export function peutCreerActiviteSecours(profile) {
  const role = profile?.role
  if (!role || role === 'partenaire') return false
  if (role === 'admin' || role === 'president') return true
  const roles = profile?.fiche?.roles_asbl || []
  return roles.some(r => r === 'president' || r === 'vice_president')
}

export function indexInscriptions(inscriptions, userId) {
  const nombres = new Map()
  const miennes = new Set()
  for (const i of inscriptions || []) {
    nombres.set(i.activite_id, (nombres.get(i.activite_id) || 0) + 1)
    if (userId && i.user_id === userId) miennes.add(i.activite_id)
  }
  return { nombres, miennes }
}

/**
 * Compteurs de l’écran.
 * - possible : à venir, une place libre, je ne suis pas déjà inscrit
 * - competence : à venir, au moins une compétence requise est sur ma fiche
 * - bientot : le début est dans les 30 prochains jours
 */
export function compterActivites(activites, inscriptions, profile, maintenant = new Date()) {
  const { nombres, miennes } = indexInscriptions(inscriptions, profile?.id)
  const mes = competencesDuProfil(profile)
  let possible = 0
  let competence = 0
  let bientot = 0
  for (const a of activites || []) {
    const n = nombres.get(a.id) || 0
    const aVenir = estAVenir(a, maintenant)
    if (aVenir && n < Number(a.places) && !miennes.has(a.id)) possible += 1
    if (aVenir && requiertMesCompetences(a, mes)) competence += 1
    if (dansLes30Jours(a.debut, maintenant)) bientot += 1
  }
  return { possible, competence, bientot, nombres, miennes, mes }
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

/** Bilan de fin d’un dispositif, à partir des inscriptions réelles. */
export function htmlBilanDispositif({
  organisation,
  adresse,
  logo,
  imprimePar,
  numero,
  titre,
  type,
  dispositif,
  publicAttendu,
  debut,
  fin,
  duree,
  lieu,
  places,
  inscrits,
  competences,
  personnel,
  statut,
}) {
  const quand = new Date()
  const imprime = `imprimé par ${imprimePar || 'Heart’s Angels'} le ${quand.toLocaleDateString('fr-BE')} à ${String(quand.getHours()).padStart(2, '0')}:${String(quand.getMinutes()).padStart(2, '0')}`
  const lignes = (personnel || []).length
    ? personnel.map(p => `<tr><td>${escHtml(`${p.prenom || ''} ${p.nom || ''}`.trim() || 'Compte retiré')}</td><td>${escHtml(p.fonction || '—')}</td><td>${escHtml(p.couverture || '—')}</td></tr>`).join('')
    : '<tr><td colspan="3">Personne n’est inscrite.</td></tr>'
  const comps = (competences || []).length ? competences.map(escHtml).join(', ') : 'Aucune'
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Bilan de fin — ${escHtml(titre)}</title>
<style>
  body { margin: 24px; color: #1A1514; font: 13px/1.4 "Segoe UI", system-ui, sans-serif; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: center; border-bottom: 3px solid #0E4A5A; padding-bottom: 10px; }
  header img { width: 64px; height: 64px; object-fit: contain; }
  header h1 { margin: 0; font-size: 16px; color: #0E4A5A; text-align: right; }
  header p { margin: 2px 0 0; text-align: right; color: #5c564f; }
  h2 { margin: 22px 0 8px; color: #0E4A5A; font-size: 22px; border-bottom: 3px solid #0E4A5A; display: flex; justify-content: space-between; gap: 12px; }
  h2 span { font-size: 11px; font-weight: 500; color: #5c564f; }
  h3 { margin: 18px 0 8px; color: #0E4A5A; font-size: 15px; border-left: 4px solid #1BB0CE; padding-left: 8px; }
  dl { display: grid; grid-template-columns: 180px 1fr; gap: 4px 12px; margin: 0; }
  dt { color: #7A7470; }
  dd { margin: 0; font-weight: 650; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #0E4A5A; color: #fff; text-align: left; padding: 6px 8px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e3eaf3; }
  tbody tr:nth-child(even) td { background: #f7fafc; }
  .note { margin-top: 10px; color: #5c564f; font-size: 11.5px; }
  footer { margin-top: 28px; border-top: 1px solid #d5dee8; padding-top: 8px; color: #7A7470; font-size: 11px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<header>
  ${logo ? `<img src="${escHtml(logo)}" alt="">` : '<div></div>'}
  <div><h1>${escHtml(organisation)}</h1><p>${escHtml(adresse)}</p></div>
</header>
<h2>Bilan de fin <span>${escHtml(imprime)}</span></h2>
<h3>${escHtml(titre || 'Activité')}</h3>
<dl>
  <dt>N°</dt><dd>${escHtml(numero ?? '—')}</dd>
  <dt>Statut</dt><dd>${escHtml(statut || '—')}</dd>
  <dt>Type</dt><dd>${escHtml(type || '—')}</dd>
  <dt>Dispositif</dt><dd>${escHtml(dispositif || '—')}</dd>
  <dt>Public attendu</dt><dd>${escHtml(publicAttendu ?? '—')}</dd>
  <dt>Début</dt><dd>${escHtml(debut || '—')}</dd>
  <dt>Fin</dt><dd>${escHtml(fin || '—')}</dd>
  <dt>Durée</dt><dd>${escHtml(duree || '—')}</dd>
  <dt>Lieu</dt><dd>${escHtml(lieu || '—')}</dd>
  <dt>Équipe</dt><dd>${escHtml(inscrits)} / ${escHtml(places)}</dd>
  <dt>Compétences demandées</dt><dd>${escHtml(comps)}</dd>
</dl>
<h3>Équipe armée</h3>
<table><thead><tr><th>Personne</th><th>Fonction</th><th>Compétences demandées</th></tr></thead><tbody>${lignes}</tbody></table>
<p class="note">Document généré à partir des inscriptions. Il ne contient ni victime, ni devis, ni facture.</p>
<footer>${escHtml(organisation)}${adresse ? ' · ' + escHtml(adresse) : ''}</footer>
</body></html>`
}

function blobBilan(donnees) {
  return new Blob([htmlBilanDispositif(donnees)], { type: 'text/html;charset=utf-8' })
}

export function nomFichierBilan(titre) {
  const base = `bilan-dispositif-${titre || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base || 'bilan-dispositif'}.html`
}

export function telechargerBilan(donnees) {
  if (typeof document === 'undefined') return false
  const url = URL.createObjectURL(blobBilan(donnees))
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichierBilan(donnees.titre)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return true
}

export function ouvrirBilan(donnees) {
  if (typeof window === 'undefined') return false
  const url = URL.createObjectURL(blobBilan(donnees))
  const w = window.open(url, '_blank')
  if (!w) { URL.revokeObjectURL(url); return false }
  const tenter = () => { try { w.focus(); w.print() } catch { /* la fenêtre reste ouverte */ } }
  w.addEventListener('load', tenter)
  setTimeout(tenter, 400)
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return true
}
