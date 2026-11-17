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
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export const ALERTE_CONFIDENTIALITE_MAIL = `DOCUMENT MÉDICAL STRICTEMENT CONFIDENTIEL.
Ce message est destiné uniquement au destinataire indiqué. S’il vous a été adressé par erreur, vous devez immédiatement le supprimer (y compris toute copie ou pièce jointe), n’en conserver aucune trace, et reprendre contact sans délai avec Heart’s Angels en répondant à cet e-mail (app@heartsangels.be).`

/** HTML léger pour l’e-mail (pas de papier A4 / images base64). */
export function htmlEmailRapportMedical({ souhait, dar, cibles, meds, injections, destinatairePrenom, destinataireNom }) {
  const qui = [destinatairePrenom, destinataireNom].filter(Boolean).join(' ').trim()
  const inner = htmlRapportMedical({ souhait, dar, cibles, meds, injections })
  const alerte = `<div style="background:#FCEBEB;border:2px solid #A32D2D;padding:14px 16px;margin:0 0 18px;color:#7A1F1F;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45">
  <strong>DOCUMENT MÉDICAL STRICTEMENT CONFIDENTIEL</strong><br/>
  Ce message est destiné uniquement au destinataire indiqué${qui ? ` (${escHtml(qui)})` : ''}.
  S’il vous a été adressé par erreur, vous devez <strong>immédiatement le supprimer</strong>
  (y compris toute copie ou pièce jointe), n’en conserver aucune trace, et
  <strong>reprendre contact sans délai</strong> avec Heart’s Angels en répondant à cet e-mail
  (<a href="mailto:app@heartsangels.be">app@heartsangels.be</a>).
</div>`
  const salut = qui
    ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">Bonjour ${escHtml(qui)},</p>`
    : ''
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport médical</title>
<style>
  body{margin:0;padding:16px;background:#fff;color:#222;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45}
  h1{font-size:18px;color:#0E4A5A;margin:16px 0 8px}
  h2,h3{font-size:14px;color:#0E4A5A;margin:14px 0 6px}
  .secret{color:#A32D2D;font-weight:800}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  td,th{border:1px solid #e5e5e5;text-align:left;padding:6px;font-size:13px;vertical-align:top}
  th{width:2rem;text-align:center;background:#f7f7f7}
  ul{margin:6px 0 12px 18px;padding:0}
  p{margin:0 0 10px}
</style></head><body>
${alerte}
${salut}
${inner}
<p style="margin-top:24px;font-size:12px;color:#666">Heart’s Angels ASBL — message envoyé depuis app@heartsangels.be</p>
</body></html>`
}

export function texteEmailRapportMedical(opts) {
  const qui = [opts?.destinatairePrenom, opts?.destinataireNom].filter(Boolean).join(' ').trim()
  const corps = texteRapportMedical(htmlRapportMedical(opts))
  return [
    ALERTE_CONFIDENTIALITE_MAIL,
    '',
    qui ? `Bonjour ${qui},` : null,
    qui ? '' : null,
    corps,
    '',
    'Heart’s Angels ASBL — message envoyé depuis app@heartsangels.be',
  ].filter(x => x != null).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
