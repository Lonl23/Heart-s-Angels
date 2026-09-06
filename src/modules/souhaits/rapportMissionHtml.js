import { fmtAdresse } from '@/components/ui'
import { lblRoleMission } from '@/modules/fiche/ficheSchema'
import { fmtDatesSouhait } from './datesSouhait'
import {
  PARCOURS_TERRAIN, heureEtapeVecteur, defsHorairesPartenaire,
  protocoleDetresse, injectionsDetresse, lblVoieDetresse,
  CHECKLISTS, itemsChecklistTous, lblStatutBase, estSurPlace,
} from './missionSchema'
import { COTES } from './TerrainPhotos'
import { escHtml, htmlDocument } from './documentA4'

function dt(v) {
  if (!v) return ''
  return new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }).replace(' ', ' · ')
}

function prisesAdministrees(md) {
  const p = md.prises
  if (Array.isArray(p)) return p.filter(x => x?.heure || x?.donne)
  if (p && typeof p === 'object') {
    if (Array.isArray(p.events)) return p.events.map(h => ({ heure: h }))
    return Object.entries(p).filter(([, x]) => x?.donne).map(([h, x]) => ({ heure: x.reelle || h }))
  }
  return []
}

function fld(l, v, wide) {
  if (v == null || v === '') return ''
  return `<span class="f${wide ? ' wide' : ''}"><span class="l">${escHtml(l)}</span><span class="v">${escHtml(v)}</span></span>`
}

function sec(titre, inner, allowBrk) {
  if (!inner) return ''
  return `<div class="sec${allowBrk ? ' allow-brk' : ''}"><div class="sec-h"><span class="t">${escHtml(titre)}</span></div>${inner}</div>`
}

function tbl(headers, rows) {
  if (!rows.length) return '<p class="muted">—</p>'
  return '<table class="tbl"><thead><tr>'
    + headers.map(h => `<th>${escHtml(h)}</th>`).join('')
    + '</tr></thead><tbody>'
    + rows.map(r => '<tr>' + r.map((c, i) => `<td${i === 0 ? '' : ''}>${c}</td>`).join('') + '</tr>').join('')
    + '</tbody></table>'
}

function imgSrc(url) {
  if (!url) return ''
  return escHtml(url)
}

function grilleCotes(coins, images) {
  return '<div class="coins">' + COTES.map(c => {
    const meta = coins?.[c.id]
    const url = meta?.path ? images[meta.path] : null
    const n = (meta?.marks || []).length
    return `<div class="coin"><div class="cl">${escHtml(c.l)}</div>`
      + (url
        ? `<img src="${imgSrc(url)}" alt="${escHtml(c.l)}">${n ? `<div class="badge">${n} dégât${n > 1 ? 's' : ''}</div>` : ''}`
        : '<div class="ph">Non photographié</div>')
      + (meta?.note ? `<div class="muted">${escHtml(meta.note)}</div>` : '')
      + '</div>'
  }).join('') + '</div>'
}

function masthead({ kicker, nom, wish, dateTxt, face, sous }) {
  return `<div class="masthead">
    <div>
      <div class="kicker">${escHtml(kicker)}</div>
      <div class="name">${escHtml(nom)}</div>
      ${wish ? `<div class="wish">« ${escHtml(wish)} »</div>` : ''}
      ${sous ? `<div class="vlabel">${escHtml(sous)}</div>` : ''}
    </div>
    <div class="badge"><span class="face">${escHtml(face)}</span>${dateTxt ? `<div class="date">${escHtml(dateTxt)}</div>` : ''}</div>
  </div>`
}

export const CSS_RAPPORT_A4 = `
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; background:#fff; }
  body { font-family:'Karla','Helvetica Neue',Arial,sans-serif; color:#243033; font-size:11.5px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:A4; margin:12mm; }
  .page { position:relative; background:#fff; padding:0; }
  .content { position:relative; z-index:1; }
  .wm { position:absolute; inset:0; z-index:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
  .wm span { transform:rotate(-45deg); font-size:52px; font-weight:800; letter-spacing:8px; white-space:pre; text-align:center; line-height:1.35; color:rgba(14,74,90,0.07); }
  .masthead { background:#0E4A5A !important; color:#fff; border-radius:12px; padding:15px 20px; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
  .masthead .kicker { font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:#8FCAD6; font-weight:700; }
  .masthead .name { font-family:'Newsreader',Georgia,serif; font-size:21px; margin-top:3px; font-weight:600; }
  .masthead .wish { font-style:italic; color:#CFE6EB; margin-top:4px; font-size:11.5px; max-width:480px; }
  .masthead .vlabel { margin-top:6px; font-size:10px; color:#8FCAD6; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
  .masthead .badge { text-align:right; max-width:42%; }
  .masthead .face { display:inline-block; background:#178FA6; color:#fff; padding:3px 12px; border-radius:99px; font-size:11px; font-weight:700; letter-spacing:1.5px; }
  .masthead .date { margin-top:7px; font-size:10.5px; color:#CFE6EB; line-height:1.35; }
  .sec { margin-bottom:11px; page-break-inside:avoid; }
  .sec.allow-brk { page-break-inside:auto; }
  .sec-h { background:#EDF4F5; border-left:4px solid #7E9B76; padding:5px 11px; border-radius:5px; margin-bottom:7px; }
  .sec-h .t { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; color:#0E4A5A; }
  .f { display:inline-block; width:49%; vertical-align:top; padding:1px 10px 3px 0; }
  .f.wide { width:100%; }
  .f .l { font-size:8px; text-transform:uppercase; letter-spacing:.7px; color:#8CA0A3; font-weight:700; display:block; }
  .f .v { font-size:11px; color:#243033; font-weight:600; line-height:1.25; white-space:pre-wrap; }
  table.tbl { width:100%; border-collapse:collapse; border-radius:7px; overflow:hidden; }
  table.tbl th { background:#0E4A5A !important; color:#fff; font-size:9px; text-transform:uppercase; letter-spacing:.6px; padding:6px 8px; text-align:left; font-weight:700; }
  table.tbl td { padding:5px 8px; font-size:10.5px; border-bottom:1px solid #EAF0F1; }
  table.tbl tr:nth-child(even) td { background:#F6FAFB; }
  .vec { border:1px solid #E7EEF0; border-left:4px solid #178FA6; border-radius:7px; padding:10px 12px; margin-bottom:10px; page-break-inside:avoid; }
  .vec .vh { font-weight:700; color:#0E4A5A; font-size:12.5px; }
  .vec .crew { margin-top:3px; color:#39494C; font-size:10.5px; margin-bottom:8px; }
  .coins { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0 4px; }
  .coin { page-break-inside:avoid; }
  .coin .cl { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#178FA6; margin-bottom:4px; }
  .coin img { width:100%; height:auto; max-height:48mm; object-fit:cover; border-radius:6px; border:1px solid #E3EBEC; display:block; }
  .coin .ph { min-height:28mm; border:1.4px dashed #C7D3D5; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#8CA0A3; font-size:10px; }
  .badge { font-size:9px; font-weight:700; color:#B23B3B; margin-top:3px; }
  .muted { color:#8CA0A3; font-size:10.5px; }
  .recit { font-size:11.5px; line-height:1.55; white-space:pre-wrap; color:#243033; }
  .pied { margin-top:18px; font-size:9px; color:#8CA0A3; border-top:1px solid #E3EBEC; padding-top:8px; }
`

export function cheminsPhotosMission(m) {
  const out = []
  for (const v of m?.vecteurs || []) {
    const p = (m.terrain_photos || {})[v.id] || {}
    for (const c of COTES) {
      if (p.coins?.[c.id]?.path) out.push(p.coins[c.id].path)
      if (p.coins_retour?.[c.id]?.path) out.push(p.coins_retour[c.id].path)
    }
    if (p.ticket_carburant_matin?.path) out.push(p.ticket_carburant_matin.path)
    if (p.ticket_carburant?.path) out.push(p.ticket_carburant.path)
  }
  return [...new Set(out)]
}

export function htmlRapportAsbl({ s, m, equipe, meds, conso, images, medical, notes }) {
  const patient = `${s?.beneficiaire_prenom || ''} ${s?.beneficiaire_nom || ''}`.trim() || 'Bénéficiaire'
  const ddn = s?.beneficiaire_ddn ? new Date(s.beneficiaire_ddn).toLocaleDateString('fr-BE') : ''
  const pec = m.pec_type === 'Domicile du patient' ? m.patient_adresse : m.pec_adresse
  const vecteurs = Array.isArray(m.vecteurs) ? m.vecteurs : []
  const titre = `Rapport de mission — ${patient}`

  let body = '<div class="page"><div class="wm"><span>CONFIDENTIEL</span></div><div class="content">'
  body += masthead({
    kicker: "Heart's Angels — Rapport de mission ASBL",
    nom: patient,
    wish: s?.description || '',
    dateTxt: fmtDatesSouhait(s),
    face: 'INTERNE ASBL',
    sous: 'Document de la journée — pas une fiche de préparation',
  })

  body += sec('Patient', [
    fld('Bénéficiaire', patient),
    fld('Né(e) le', ddn),
    fld('Date', fmtDatesSouhait(s) !== 'Date à définir' ? fmtDatesSouhait(s) : ''),
    fld('Réalisé le', s?.date_realisee ? new Date(s.date_realisee + 'T12:00:00').toLocaleDateString('fr-BE') : ''),
    fld('Mission démarrée', dt(m.demarre_le)),
    fld('Mission clôturée', dt(m.cloture_le)),
  ].join(''))

  body += sec('Lieux du jour', [
    fld('Prise en charge', m.pec_type),
    fld('Institution', m.pec_institution),
    fld('Adresse PEC', fmtAdresse(pec), true),
    fld('Destination', fmtAdresse(m.dest_adresse), true),
    fld('Retour', m.retour_type),
    fld('Précisions retour', m.retour_precisions, true),
  ].join(''))

  const lignesCrew = (equipe || []).map(e => {
    const vec = vecteurs.find(v => v.id === e.vecteur_id)
    const role = lblRoleMission(e.role_mission) || e.role_mission || ''
    const nom = `${e.profiles?.prenom || ''} ${e.profiles?.nom || ''}`.trim()
    const st = lblStatutBase(m.personnel_statuts?.[e.user_id]) || (estSurPlace(m.personnel_statuts?.[e.user_id]) ? 'Sur place' : '')
    return [
      escHtml(nom || '—'),
      escHtml(role),
      escHtml([vec?.nom, vec?.plaque].filter(Boolean).join(' · ')),
      escHtml(dt(m.personnel_heures?.[e.user_id]) || st || '—'),
    ]
  })
  body += sec('Équipage', tbl(['Volontaire', 'Rôle', 'Véhicule', 'Sur place base'], lignesCrew))

  for (const v of vecteurs) {
    const photos = (m.terrain_photos || {})[v.id] || {}
    const crew = (equipe || []).filter(e => e.vecteur_id === v.id)
    const vc = (m.vecteur_checklists || {})[v.id] || {}
    const heures = PARCOURS_TERRAIN.map(e => [escHtml(e.l), escHtml(dt(heureEtapeVecteur(m, v.id, e.id)) || '—')])
    const checks = Object.entries(CHECKLISTS).map(([secId, def]) => {
      const faits = itemsChecklistTous(secId, m).filter(it => vc[secId]?.[it])
      return faits.length ? `<div><strong>${escHtml(def.titre)} :</strong> ${escHtml(faits.join(', '))}</div>` : ''
    }).join('')

    body += `<div class="vec">
      <div class="vh">${escHtml([v.nom, v.type_transport, v.plaque].filter(Boolean).join(' · ') || 'Véhicule')}</div>
      <div class="crew">${escHtml(crew.map(e => `${e.profiles?.prenom || ''} ${e.profiles?.nom || ''}`.trim()).filter(Boolean).join(' · '))}</div>
      ${fld('KM départ', v.kms_depart != null && v.kms_depart !== '' ? String(v.kms_depart) : '')}
      ${fld('KM retour', v.kms_retour != null && v.kms_retour !== '' ? String(v.kms_retour) : '')}
      ${fld('Essence au départ', v.essence_pct != null && v.essence_pct !== '' ? `${v.essence_pct} %` : '')}
      <div class="sec-h" style="margin-top:8px"><span class="t">Horaires de tous les statuts</span></div>
      ${tbl(['Statut', 'Heure'], heures)}
      <div class="sec-h" style="margin-top:8px"><span class="t">Photos des 4 côtés — départ</span></div>
      ${grilleCotes(photos.coins || {}, images)}
      <div class="sec-h" style="margin-top:8px"><span class="t">Photos des 4 côtés — rentrée</span></div>
      ${grilleCotes(photos.coins_retour || {}, images)}
      ${checks ? `<div class="sec-h" style="margin-top:8px"><span class="t">Checklists cochées</span></div>${checks}` : ''}
    </div>`
  }

  body += sec('Comment s’est passée la journée', medical
    ? `<div class="recit">${escHtml(medical)}</div>`
    : '<p class="muted">Récit non encore rédigé.</p>', true)
  if (notes) body += sec('Notes logistiques', `<div class="recit">${escHtml(notes)}</div>`, true)

  const lignesMeds = (meds || []).map(md => {
    const prises = prisesAdministrees(md)
    return [
      escHtml([md.medicament, md.dosage].filter(Boolean).join(' · ')),
      escHtml(prises.length ? prises.map(p => p.heure || '?').join(', ') : 'Non administré'),
    ]
  })
  body += sec('Traitements administrés pendant la journée', tbl(['Médicament', 'Heures'], lignesMeds))

  const proto = protocoleDetresse(m)
  const lignesP = proto.lignes.filter(r => (r.medicament || '').trim() || (r.dosage || '').trim())
  const injs = injectionsDetresse(m)
  let det = ''
  if (lignesP.length) {
    det += lignesP.map(r => `<div><strong>${escHtml(r.medicament || '—')}</strong> · ${escHtml([r.dosage && `Dosage ${r.dosage}`, r.voie && `voie ${lblVoieDetresse(r.voie)}`].filter(Boolean).join(' · '))}</div>`).join('')
  }
  if (proto.notes) det += `<div class="recit" style="margin-top:6px">${escHtml(proto.notes)}</div>`
  if (injs.length) {
    det += '<div class="sec-h" style="margin-top:8px"><span class="t">Injections du jour</span></div>'
    det += injs.map(inj => `<div><strong>Injecté ${escHtml(dt(inj.injecte_le) || '—')}</strong> — ${escHtml([inj.par_nom, inj.medecin_coordinateur_prevenu && 'médecin coordinateur prévenu', inj.coordinateur_medical_prevenu && 'coordinateur médical prévenu'].filter(Boolean).join(' · '))}</div>`).join('')
  }
  if (det) body += sec('Protocole de détresse', det)

  if ((conso || []).length) {
    body += sec('Matériel utilisé', conso.map(it => {
      const extra = it.mode === 'oxygene' && it.pression_bar != null ? ` · ${it.pression_bar} bar` : (it.quantite != null && it.mode !== 'oxygene' ? ` · qté ${it.quantite}` : '')
      return `<div>${escHtml(it.nom || '')}${escHtml(extra)}${it.lot ? escHtml(` · lot ${it.lot}`) : ''}</div>`
    }).join(''))
  }

  let tickets = ''
  for (const v of vecteurs) {
    const p = (m.terrain_photos || {})[v.id] || {}
    const nom = [v.nom, v.plaque].filter(Boolean).join(' · ') || 'Véhicule'
    const matin = p.ticket_carburant_matin?.path ? images[p.ticket_carburant_matin.path] : null
    const soir = p.ticket_carburant?.path ? images[p.ticket_carburant.path] : null
    if (!matin && !soir) continue
    tickets += `<div class="vec"><div class="vh">${escHtml(nom)}</div>`
    if (matin) tickets += `<div class="cl" style="margin:6px 0 4px">Plein du matin</div><img src="${imgSrc(matin)}" alt="Ticket matin" style="max-width:70%; max-height:55mm; border-radius:6px; border:1px solid #E3EBEC">`
    if (soir) tickets += `<div class="cl" style="margin:6px 0 4px">Plein du retour</div><img src="${imgSrc(soir)}" alt="Ticket retour" style="max-width:70%; max-height:55mm; border-radius:6px; border:1px solid #E3EBEC">`
    tickets += '</div>'
  }
  if (tickets) body += sec('Tickets carburant', tickets, true)

  body += `<div class="pied">Heart's Angels ASBL — rapport interne généré le ${escHtml(dt(new Date().toISOString()))}. Ne pas diffuser hors de l'association.</div>`
  body += '</div></div>'

  return { titre, html: htmlDocument(titre, body, CSS_RAPPORT_A4) }
}

export function htmlRapportPartenaire({ s, images: _images, vecteursHoraires, deroulement, etat, observations }) {
  const prenom = s?.beneficiaire_prenom || [s?.beneficiaire_prenom, s?.beneficiaire_nom].filter(Boolean).join(' ') || 'Bénéficiaire'
  const titre = `Rapport de mission — ${prenom}`
  const defs = defsHorairesPartenaire()

  let body = '<div class="page"><div class="content">'
  body += masthead({
    kicker: "Heart's Angels — Rapport de mission",
    nom: prenom,
    wish: s?.description || '',
    dateTxt: fmtDatesSouhait(s),
    face: 'PARTENAIRE',
    sous: 'Trajet patient — sans données véhicule',
  })

  body += sec('La journée', [
    fld('Patient', prenom),
    fld('Date', fmtDatesSouhait(s) !== 'Date à définir' ? fmtDatesSouhait(s) : ''),
  ].join(''))

  for (const v of vecteursHoraires || []) {
    const rows = defs.map(e => [escHtml(e.l), escHtml(dt(v.heures?.[e.id]) || '—')])
    body += `<div class="vec"><div class="vh">${escHtml(v.nom || 'Véhicule')}</div>${tbl(['Statut', 'Heure'], rows)}</div>`
  }

  if (deroulement) body += sec('Comment s’est passée la journée', `<div class="recit">${escHtml(deroulement)}</div>`, true)
  if (etat) body += sec('État au retour', `<div class="recit">${escHtml(etat)}</div>`)
  if (observations) body += sec('Observations', `<div class="recit">${escHtml(observations)}</div>`, true)

  body += `<div class="pied">Heart's Angels ASBL — rapport à l'attention du partenaire. Généré le ${escHtml(dt(new Date().toISOString()))}.</div>`
  body += '</div></div>'

  return { titre, html: htmlDocument(titre, body, CSS_RAPPORT_A4) }
}

export function nomFichierRapport(s, kind) {
  const qui = ([s?.beneficiaire_prenom, s?.beneficiaire_nom].filter(Boolean).join(' ') || 'mission').replace(/[^\p{L}\p{N}]+/gu, '-')
  return `Rapport-mission-${kind}-${qui}.html`
}
