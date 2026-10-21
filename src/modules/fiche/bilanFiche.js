import { QUALIFS, SPECIALISATIONS_INF, lblRoleMission } from './ficheSchema'
import { libelleTypeActivite } from '@/modules/secours/activitesSecours'

const CAT_QUAL = {
  ambulancier: 'Secourisme',
  secouriste: 'Secourisme',
  chauffeur: 'Permis',
  infirmier: 'Soins',
  medecin: 'Soins',
  kine: 'Soins',
  psychologue: 'Soins',
}

export function pad(n) { return String(n).padStart(2, '0') }

export function asDate(v) {
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function fmtDate(v) {
  const d = asDate(v)
  if (!d) return ''
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

export function fmtQuand(v) {
  const d = asDate(v)
  if (!d) return ''
  const jour = fmtDate(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return jour
  return `${jour} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Heures entre début et fin. Null si la fin manque. */
export function heuresEntre(debut, fin) {
  const a = asDate(debut)
  const b = asDate(fin)
  if (!a || !b) return null
  const ms = b.getTime() - a.getTime()
  if (!(ms > 0)) return null
  return Math.round((ms / 3600000) * 100) / 100
}

export function fmtHeures(h) {
  if (h == null || Number.isNaN(h)) return '—'
  return String(h).replace('.', ',')
}

function etatExpiration(iso, maintenant = new Date()) {
  const d = asDate(iso)
  if (!d) return 'ok'
  const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  if (d < jour) return 'expiree'
  const limite = new Date(jour)
  limite.setDate(limite.getDate() + 60)
  if (d <= limite) return 'bientot'
  return 'ok'
}

export function libelleStatutCompetence(statut) {
  if (statut === 'expiree') return 'Expirée'
  if (statut === 'bientot') return 'Bientôt expirée'
  if (statut === 'secondaire') return 'Secondaire'
  return 'Principale'
}

/** Lignes du tableau de compétences, à partir de la fiche. */
export function lignesCompetence(f) {
  const rows = []
  const quals = Array.isArray(f?.qualifications) ? f.qualifications : []
  for (const q of quals) {
    const def = QUALIFS.find(x => x.v === q)
    let description = def?.l || q
    if (q === 'ambulancier' && f.ambulancier?.visa_atnup) description += ` · visa ${f.ambulancier.visa_atnup}`
    if (q === 'infirmier' && f.infirmier?.visa) description += ` · visa ${f.infirmier.visa}`
    rows.push({
      categorie: CAT_QUAL[q] || 'Autre',
      type: def?.l || q,
      description,
      expiration: 'Permanente',
      statut: 'principale',
    })
  }
  for (const s of f?.infirmier?.specialisations || []) {
    const def = SPECIALISATIONS_INF.find(x => x.v === s)
    rows.push({
      categorie: 'Soins',
      type: 'Spécialisation',
      description: def?.l || s,
      expiration: 'Permanente',
      statut: 'secondaire',
    })
  }
  if (f?.ambulancier?.badge_112) {
    rows.push({
      categorie: 'Secourisme',
      type: 'Badge 112',
      description: String(f.ambulancier.badge_112),
      expiration: 'Permanente',
      statut: 'principale',
    })
  }
  const permis = [
    ['B', 'Permis voiture'],
    ['C', 'Permis poids lourd'],
    ['E', 'Permis remorque'],
  ]
  for (const [k, label] of permis) {
    if (f?.permis?.[k]) {
      rows.push({ categorie: 'Permis', type: k, description: label, expiration: 'Permanente', statut: 'principale' })
    }
  }
  if (f?.permis?.selection_medicale) {
    const exp = f.permis.selection_validite
    const etat = etatExpiration(exp)
    rows.push({
      categorie: 'Permis',
      type: 'Sélection',
      description: 'Sélection médicale',
      expiration: exp ? fmtDate(exp) : 'Sans date',
      statut: etat === 'ok' ? 'principale' : etat,
    })
  }
  return rows
}

export function compterCompetences(lignes) {
  return {
    detenues: lignes.length,
    bientot: lignes.filter(l => l.statut === 'bientot').length,
    expirees: lignes.filter(l => l.statut === 'expiree').length,
  }
}

const CHAMPS_PROFIL = [
  ['photo', 'Photo'],
  ['naissance', 'Date de naissance'],
  ['lieu', 'Lieu de naissance'],
  ['adresse', 'Adresse'],
  ['telephone', 'Téléphone'],
  ['email', 'E-mail'],
  ['engagement', 'Date d’engagement'],
  ['prevenir', 'Personne à prévenir'],
]

/** Ce qui manque vraiment pour le bilan. Pas un pourcentage inventé. */
export function manquesProfil(prof, f) {
  const contact = (f?.contacts_urgence || []).some(c =>
    String(c?.telephone || '').trim() && (String(c?.prenom || '').trim() || String(c?.nom || '').trim()),
  )
  const ok = {
    photo: !!f?.photo_url,
    naissance: !!f?.date_naissance,
    lieu: !!String(f?.lieu_naissance || '').trim(),
    adresse: !!String(f?.adresse || '').trim(),
    telephone: !!String(f?.telephone || '').trim(),
    email: !!String(prof?.email || '').trim(),
    engagement: !!f?.date_engagement,
    prevenir: contact,
  }
  return CHAMPS_PROFIL.filter(([k]) => !ok[k]).map(([, l]) => l)
}

const STATUTS_ECARTES = new Set(['annule', 'non_realise', 'demande_info_externe'])

export function lignesActivites(activites, inscriptions) {
  const parId = new Map((activites || []).map(a => [a.id, a]))
  return (inscriptions || []).map(i => {
    const a = parId.get(i.activite_id)
    if (!a) return null
    return {
      id: `a-${a.id}`,
      lien: `/app/secours/activites/${a.id}`,
      date: a.debut,
      fin: a.fin,
      famille: libelleTypeActivite(a.type),
      cle: a.type || 'activite',
      titre: a.titre || 'Activité',
      lieu: a.lieu || '',
      fonction: '',
      heures: heuresEntre(a.debut, a.fin),
    }
  }).filter(Boolean)
}

export function lignesSouhaits(souhaits, personnel) {
  const parId = new Map((souhaits || []).map(s => [s.id, s]))
  return (personnel || []).map(p => {
    const s = parId.get(p.souhait_id)
    if (!s || s.fictif) return null
    if (STATUTS_ECARTES.has(s.statut)) return null
    const titre = [s.beneficiaire_prenom, s.description].filter(Boolean).join(' — ') || 'Souhait'
    return {
      id: `s-${s.id}`,
      lien: '',
      date: s.date_souhaitee,
      fin: s.date_fin,
      famille: 'Souhait',
      cle: 'souhait',
      titre,
      lieu: s.localisation || '',
      fonction: p.role_mission ? lblRoleMission(p.role_mission) : '',
      heures: null,
      statut: s.statut || '',
    }
  }).filter(Boolean)
}

export function fusionParticipations(activites, souhaits) {
  return [...activites, ...souhaits].sort((a, b) => {
    const da = asDate(a.date)?.getTime() || 0
    const db = asDate(b.date)?.getTime() || 0
    return db - da
  })
}

export function dansPeriode(ligne, periode, maintenant = new Date()) {
  const d = asDate(ligne.date)
  if (periode === 'toutes') return true
  if (!d) return false
  if (periode === 'a_venir') {
    const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
    const fin = asDate(ligne.fin) || d
    return fin >= jour
  }
  if (periode === 'mois') return d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth()
  if (periode === 'annee') return d.getFullYear() === maintenant.getFullYear()
  return true
}

export function compterParticipations(lignes, maintenant = new Date()) {
  return {
    total: lignes.length,
    aVenir: lignes.filter(l => dansPeriode(l, 'a_venir', maintenant)).length,
    mois: lignes.filter(l => dansPeriode(l, 'mois', maintenant)).length,
    annee: lignes.filter(l => dansPeriode(l, 'annee', maintenant)).length,
  }
}

export function anneesBilan(maintenant = new Date()) {
  const y = maintenant.getFullYear()
  return [y - 4, y - 3, y - 2, y - 1, y]
}

const FAMILLES = [
  ['activite', 'Activité'],
  ['garde', 'Garde'],
  ['manoeuvre', 'Manœuvre'],
  ['formation', 'Formation'],
  ['souhait', 'Souhait'],
]

/** Nombre de participations par famille et par année. Les zéros sont de vrais zéros. */
export function grilleAnnees(lignes, maintenant = new Date()) {
  const annees = anneesBilan(maintenant)
  const lignesGrille = FAMILLES.map(([cle, label]) => ({
    label,
    cellules: annees.map(an => lignes.filter(l => l.cle === cle && asDate(l.date)?.getFullYear() === an).length),
  }))
  const heures = annees.map(an => {
    const somme = lignes
      .filter(l => asDate(l.date)?.getFullYear() === an && l.heures != null)
      .reduce((s, l) => s + l.heures, 0)
    return Math.round(somme * 100) / 100
  })
  return { annees, lignes: lignesGrille, heures }
}

export function totalHeures(lignes) {
  const somme = lignes.reduce((s, l) => s + (l.heures || 0), 0)
  return Math.round(somme * 100) / 100
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

export function htmlLivret({
  organisation,
  adresse,
  logo,
  imprimePar,
  civilite,
  nom,
  prenom,
  photo,
  dateNaissance,
  lieuNaissance,
  adressePerso,
  telephone,
  email,
  dateEngagement,
  competences,
  operations,
  grille,
  heures,
}) {
  const titre = `${civilite ? civilite + ' ' : ''}${(nom || '').toUpperCase()} ${prenom || ''}`.trim()
  const quand = new Date()
  const imprime = `imprimé par ${imprimePar || 'Heart’s Angels'} le ${fmtDate(quand.toISOString())} à ${pad(quand.getHours())}:${pad(quand.getMinutes())}`
  const compRows = competences.length
    ? competences.map(c => `<tr><td>${esc(c.categorie)}</td><td>${esc(c.type)}</td><td>${esc(c.description)}</td><td>${esc(c.expiration)}</td></tr>`).join('')
    : '<tr><td colspan="4">Aucune compétence enregistrée.</td></tr>'
  const opRows = operations.length
    ? operations.map(o => `<tr><td>${esc(fmtDate(o.date) || '—')}</td><td>${esc(o.famille)}</td><td>${esc(o.titre)}${o.lieu ? ' · ' + esc(o.lieu) : ''}</td><td class="num">${esc(fmtHeures(o.heures))}</td><td>${esc(o.fonction || '—')}</td></tr>`).join('')
    : '<tr><td colspan="5">Aucune participation enregistrée.</td></tr>'
  const headAns = grille.annees.map(a => `<th>${a}</th>`).join('')
  const bodyAns = grille.lignes.map(l => `<tr><td>${esc(l.label)}</td>${l.cellules.map(n => `<td class="num">${n}</td>`).join('')}</tr>`).join('')
  const heuresAns = grille.heures.map(h => `<td class="num">${esc(fmtHeures(h))}${h ? ' h' : ''}</td>`).join('')
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Bilan d’activité — ${esc(titre)}</title>
<style>
  body { margin: 24px; color: #1A1514; font: 13px/1.4 "Segoe UI", system-ui, sans-serif; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: center; border-bottom: 3px solid #0E4A5A; padding-bottom: 10px; }
  header img { width: 64px; height: 64px; object-fit: contain; }
  header h1 { margin: 0; font-size: 16px; color: #0E4A5A; text-align: right; }
  header p { margin: 2px 0 0; text-align: right; color: #5c564f; }
  h2 { margin: 22px 0 8px; color: #0E4A5A; font-size: 22px; border-bottom: 3px solid #0E4A5A; display: flex; justify-content: space-between; align-items: baseline; }
  h2 span { font-size: 11px; font-weight: 500; color: #5c564f; }
  h3 { margin: 18px 0 8px; color: #0E4A5A; font-size: 15px; border-left: 4px solid #1BB0CE; padding-left: 8px; }
  .identite { display: flex; gap: 14px; background: #f4f7fb; border-radius: 8px; padding: 12px; }
  .identite img, .identite .ph { width: 92px; height: 110px; object-fit: cover; border-radius: 4px; background: #1BB0CE; color: #fff; display: grid; place-items: center; font-weight: 700; }
  .identite h3 { margin: 0 0 8px; border: none; padding: 0; font-size: 18px; }
  dl { display: grid; grid-template-columns: 140px 1fr 140px 1fr; gap: 3px 10px; margin: 0; }
  dt { color: #7A7470; }
  dd { margin: 0; font-weight: 650; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #0E4A5A; color: #fff; text-align: left; padding: 6px 8px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e3eaf3; }
  tr:nth-child(even) td { background: #f7fafc; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total { text-align: right; margin-top: 6px; font-size: 12px; }
  footer { margin-top: 28px; border-top: 1px solid #d5dee8; padding-top: 8px; display: flex; justify-content: space-between; color: #7A7470; font-size: 11px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<header>
  ${logo ? `<img src="${esc(logo)}" alt="">` : '<div></div>'}
  <div><h1>${esc(organisation)}</h1><p>${esc(adresse)}</p></div>
</header>
<h2>Bilan d’activité <span>${esc(imprime)}</span></h2>
<section class="identite">
  ${photo ? `<img src="${esc(photo)}" alt="">` : `<div class="ph">${esc(((prenom || ' ')[0] + (nom || ' ')[0]).toUpperCase())}</div>`}
  <div style="flex:1">
    <h3>${esc(titre)}</h3>
    <dl>
      <dt>Date de naissance</dt><dd>${esc(fmtDate(dateNaissance) || '—')}</dd>
      <dt>Lieu de naissance</dt><dd>${esc(lieuNaissance || '—')}</dd>
      <dt>Adresse</dt><dd>${esc(adressePerso || '—')}</dd>
      <dt>Date d’engagement</dt><dd>${esc(fmtDate(dateEngagement) || '—')}</dd>
      <dt>Téléphone</dt><dd>${esc(telephone || '—')}</dd>
      <dt>E-mail</dt><dd>${esc(email || '—')}</dd>
      <dt>Organisation</dt><dd>${esc(organisation)}</dd>
      <dt></dt><dd></dd>
    </dl>
  </div>
</section>
<h3>Compétences au ${esc(fmtDate(quand.toISOString()))}</h3>
<table><thead><tr><th>Catégorie</th><th>Type</th><th>Description</th><th>Expiration</th></tr></thead><tbody>${compRows}</tbody></table>
<h3>Participations</h3>
<table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Heures</th><th>Fonction</th></tr></thead><tbody>${opRows}</tbody></table>
<p class="total">Heures connues, quand le début et la fin sont encodés : ${esc(fmtHeures(heures))} h</p>
<h3>Participations sur 5 ans</h3>
<table><thead><tr><th>Type</th>${headAns}</tr></thead><tbody>
${bodyAns}
<tr><td>Heures connues</td>${heuresAns}</tr>
</tbody></table>
<footer><span>${esc(organisation)}${adresse ? ' · ' + esc(adresse) : ''}</span><span>Bilan d’activité</span></footer>
</body></html>`
}

export function ouvrirLivret(donnees) {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return false
  w.document.open()
  w.document.write(htmlLivret(donnees))
  w.document.close()
  w.addEventListener('load', () => w.print())
  return true
}

export function civiliteLibelle(v) {
  if (v === 'monsieur') return 'Monsieur'
  if (v === 'madame') return 'Madame'
  return ''
}
