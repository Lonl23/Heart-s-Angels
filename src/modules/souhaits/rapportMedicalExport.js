import { escHtml } from './documentA4.js'

export const SUJET_RAPPORT_MEDICAL = '!!! SECRET MEDICAL !!! – INTERVENTION HEART’S ANGELS'

const GENRES = [
  { v: 'donnee', l: 'Données' },
  { v: 'action', l: 'Actions' },
  { v: 'resultat', l: 'Résultats' },
  { v: 'note', l: 'Note pour l’équipage' },
]

function dt(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
}

function liste(titre, items) {
  const rows = (items || []).map(x => String(x || '').trim()).filter(Boolean)
  if (!rows.length) return ''
  return `<h2>${escHtml(titre)}</h2><ul>${rows.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul>`
}

function tableauCible(c) {
  const lignes = [
    ['D', c.donnee],
    ['A', c.action],
    ['R', c.resultat],
  ].map(([k, t]) => `<tr><th>${k}</th><td>${escHtml(t || '')}</td></tr>`).join('')
  return `<h3>${escHtml(c.probleme || 'Problème')}</h3><table><tbody>${lignes}</tbody></table>`
}

export function htmlRapportMedical({ souhait, dar, cibles, meds, injections }) {
  const s = souhait || {}
  const m = s.mission || {}
  const nom = [s.beneficiaire_prenom, s.beneficiaire_nom].filter(Boolean).join(' ') || 'Bénéficiaire'
  const ddn = s.beneficiaire_ddn ? new Date(String(s.beneficiaire_ddn).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-BE') : ''
  const cats = m.categories || {}
  const blocs = (cibles || []).map(tableauCible).join('')
  const anciennes = (cibles || []).length
    ? []
    : (dar || []).filter(r => r.genre !== 'note')
  const lignesDar = anciennes.map(r => {
    const genre = GENRES.find(g => g.v === r.genre)?.l || r.genre
    const qui = [r.auteur_prenom, r.auteur_nom].filter(Boolean).join(' ')
    return `<tr><td>${escHtml(dt(r.created_at))}</td><td>${escHtml(genre)}</td><td>${escHtml(qui)}</td><td>${escHtml(r.texte)}</td></tr>`
  }).join('')
  const notes = (dar || []).filter(r => r.genre === 'note').map(r => {
    const qui = [r.auteur_prenom, r.auteur_nom].filter(Boolean).join(' ')
    return `<li>${escHtml(dt(r.created_at))} · ${escHtml(qui)} — ${escHtml(r.texte)}</li>`
  }).join('')
  const soins = (meds || []).map(md => `<li>${escHtml([md.medicament, md.dosage, md.voie].filter(Boolean).join(' · '))}</li>`).join('')
  const detresse = (injections || []).map(inj => `<li>${escHtml([dt(inj.at || inj.heure), inj.medicament || inj.produit, inj.dose, inj.voie].filter(Boolean).join(' · '))}</li>`).join('')
  return `<article class="ha-rapport-medical">
    <p class="secret">${escHtml(SUJET_RAPPORT_MEDICAL)}</p>
    <h1>Rapport médical — ${escHtml(nom)}</h1>
    <p>${escHtml([ddn && `Né(e) le ${ddn}`, s.beneficiaire_genre, s.description].filter(Boolean).join(' · '))}</p>
    ${liste('Pathologies', cats.pathologies)}
    ${liste('Activités', cats.activites)}
    ${s.notes_medicales ? `<h2>Notes médicales</h2><p>${escHtml(s.notes_medicales)}</p>` : ''}
    ${soins ? `<h2>Traitements prévus</h2><ul>${soins}</ul>` : ''}
    <h2>Transmissions ciblées</h2>
    ${blocs || (lignesDar ? `<table><thead><tr><th>Quand</th><th>Type</th><th>Auteur</th><th>Texte</th></tr></thead><tbody>${lignesDar}</tbody></table>` : '<p>Aucun problème noté.</p>')}
    ${notes ? `<h2>Notes pour l’équipage</h2><ul>${notes}</ul>` : ''}
    ${detresse ? `<h2>Protocole de détresse</h2><ul>${detresse}</ul>` : ''}
    ${m.rapport_medical ? `<h2>Récit</h2><p>${escHtml(m.rapport_medical)}</p>` : ''}
  </article>`
}

export function texteRapportMedical(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
