import { escHtml } from './documentA4.js'

/** Ancien libellé (bannières / compat). Préférer sujetRapportMedical(souhait). */
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

function dateBe(v) {
  if (!v) return ''
  const d = new Date(String(v).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('fr-BE')
}

export function nomBeneficiaire(souhait) {
  return [souhait?.beneficiaire_prenom, souhait?.beneficiaire_nom].filter(Boolean).join(' ').trim() || 'Bénéficiaire'
}

/** Objet du mail : « Prénom Nom : Rapport médical du souhait en date du … » */
export function sujetRapportMedical(souhait) {
  const nom = nomBeneficiaire(souhait)
  const date = dateBe(souhait?.date_souhaitee) || dateBe(souhait?.date_fin) || 'date non précisée'
  return `${nom} : Rapport médical du souhait en date du ${date}`
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

/** Normalise prises → liste { heure, prevue? }. */
export function administrationsDepuisMed(md) {
  const p = md?.prises
  const out = []
  if (Array.isArray(p)) {
    for (const x of p) {
      if (x?.donne && (x.heure || x.reelle || x.prevue)) {
        out.push({ heure: x.heure || x.reelle || x.prevue, prevue: x.prevue || '' })
      }
    }
    return out
  }
  if (!p || typeof p !== 'object') return out
  if (Array.isArray(p.events)) {
    for (const h of p.events) {
      if (h) out.push({ heure: String(h), prevue: '' })
    }
  }
  for (const [k, v] of Object.entries(p)) {
    if (k === 'events') continue
    if (v && typeof v === 'object' && v.donne) {
      out.push({ heure: v.reelle || k, prevue: k })
    }
  }
  return out.sort((a, b) => String(a.heure).localeCompare(String(b.heure)))
}

function lignesInjections(injections) {
  const out = []
  for (const inj of injections || []) {
    const quand = dt(inj.injecte_le || inj.at || inj.heure)
    const lignes = Array.isArray(inj.lignes) && inj.lignes.length
      ? inj.lignes
      : [{ medicament: inj.medicament || inj.produit, dosage: inj.dose || inj.dosage, voie: inj.voie }]
    for (const l of lignes) {
      out.push([quand, l.medicament || l.produit, l.dosage || l.dose, l.voie, inj.par_nom].filter(Boolean).join(' · '))
    }
  }
  return out
}

function resumeSouhaitHtml(souhait) {
  const s = souhait || {}
  const m = s.mission || {}
  const pec = m.pec || {}
  const dest = m.destination || {}
  const base = m.base || m.base_depart || {}
  const lignes = [
    s.date_souhaitee && `Date du souhait : ${dateBe(s.date_souhaitee)}${s.date_fin && s.date_fin !== s.date_souhaitee ? ` → ${dateBe(s.date_fin)}` : ''}`,
    s.description && `Description : ${s.description}`,
    s.localisation && `Localisation / activités : ${s.localisation}`,
    (base.nom || base.adresse) && `Base : ${[base.nom, typeof base.adresse === 'string' ? base.adresse : ''].filter(Boolean).join(' — ')}`,
    (pec.type || pec.institution || pec.adresse) && `Prise en charge : ${[pec.type, pec.institution, pec.service, pec.chambre && `ch. ${pec.chambre}`].filter(Boolean).join(' · ')}`,
    (dest.adresse || dest.precisions) && `Destination : ${[typeof dest.adresse === 'string' ? dest.adresse : '', dest.precisions].filter(Boolean).join(' — ')}`,
    s.besoins_specifiques && `Besoins spécifiques : ${s.besoins_specifiques}`,
  ].filter(Boolean)
  if (!lignes.length) return ''
  return `<h2>Résumé du souhait</h2><ul>${lignes.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul>`
}

export function htmlRapportMedical({ souhait, dar, cibles, meds, injections }) {
  const s = souhait || {}
  const m = s.mission || {}
  const nom = nomBeneficiaire(s)
  const ddn = s.beneficiaire_ddn ? dateBe(s.beneficiaire_ddn) : ''
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
  const soins = (meds || []).map(md => {
    const base = [md.medicament, md.dosage, md.voie, md.frequence].filter(Boolean).join(' · ')
    const type = md.type_admin === 'si_necessaire' ? ' (si nécessaire)' : ''
    return `<li>${escHtml(base + type)}</li>`
  }).join('')
  const adminLignes = []
  for (const md of meds || []) {
    const acts = administrationsDepuisMed(md)
    for (const a of acts) {
      adminLignes.push(`<li>${escHtml([a.heure, md.medicament, md.dosage, md.voie, a.prevue && a.prevue !== a.heure ? `(prévu ${a.prevue})` : ''].filter(Boolean).join(' · '))}</li>`)
    }
  }
  const detresse = lignesInjections(injections).map(x => `<li>${escHtml(x)}</li>`).join('')
  return `<article class="ha-rapport-medical">
    <p class="secret">${escHtml(sujetRapportMedical(s))}</p>
    <h1>Rapport médical — ${escHtml(nom)}</h1>
    <p>${escHtml([ddn && `Né(e) le ${ddn}`, s.beneficiaire_genre].filter(Boolean).join(' · '))}</p>
    ${resumeSouhaitHtml(s)}
    ${liste('Pathologies', cats.pathologies)}
    ${liste('Activités', cats.activites)}
    ${s.notes_medicales ? `<h2>Notes médicales</h2><p>${escHtml(s.notes_medicales)}</p>` : ''}
    ${soins ? `<h2>Traitements prévus</h2><ul>${soins}</ul>` : ''}
    ${adminLignes.length ? `<h2>Traitements administrés</h2><ul>${adminLignes.join('')}</ul>` : '<h2>Traitements administrés</h2><p>Aucune administration enregistrée.</p>'}
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
