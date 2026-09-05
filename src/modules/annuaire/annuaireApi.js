import { supabase } from '@/lib/supabase'
import { emptyToNull, normaliserNiss } from './annuaireSchema'

function adresseOuNull(a) {
  if (!a || typeof a !== 'object') return null
  const t = [a.rue, a.numero, a.cp, a.localite, a.pays].some(x => String(x || '').trim())
  return t ? a : null
}

function identite(f) {
  const niss = normaliserNiss(f.niss)
  return {
    nom: emptyToNull(f.nom),
    prenom: emptyToNull(f.prenom),
    niss: niss || null,
    tel_gsm: emptyToNull(f.tel_gsm),
    tel_fixe: emptyToNull(f.tel_fixe),
    genre: emptyToNull(f.genre),
    date_naissance: emptyToNull(f.date_naissance),
    lien: emptyToNull(f.lien),
    telephone: emptyToNull(f.telephone) || emptyToNull(f.tel_gsm) || emptyToNull(f.tel_fixe),
  }
}

async function trouverBeneficiaire(f) {
  const niss = normaliserNiss(f.niss)
  if (niss) {
    const { data } = await supabase.from('annuaire').select('id,data,niss,genre')
      .eq('categorie', 'beneficiaire').eq('niss', niss).maybeSingle()
    if (data) return data
  }
  const nom = (f.nom || '').trim()
  const prenom = (f.prenom || '').trim()
  const ddn = emptyToNull(f.date_naissance)
  if (!nom || !prenom || !ddn) return null
  const { data } = await supabase.from('annuaire').select('id,data,niss,genre')
    .eq('categorie', 'beneficiaire')
    .ilike('nom', nom)
    .ilike('prenom', prenom)
    .eq('date_naissance', ddn)
    .limit(1)
  return data?.[0] || null
}

export async function upsertBeneficiaire(f, { created_by } = {}) {
  if (!emptyToNull(f.nom) && !emptyToNull(f.prenom)) return null
  const ident = identite(f)
  const dataExtra = {
    adresse: adresseOuNull(f.adresse),
    email: f.email || '',
    notes: f.notes || '',
    telephone: ident.telephone || '',
    tel_gsm: ident.tel_gsm || '',
    tel_fixe: ident.tel_fixe || '',
  }
  const existing = f.id
    ? (await supabase.from('annuaire').select('id,data,niss,genre').eq('id', f.id).maybeSingle()).data
    : await trouverBeneficiaire(f)
  if (existing?.id) {
    const rec = {
      ...ident,
      niss: ident.niss || existing.niss || null,
      genre: ident.genre || existing.genre || null,
      data: { ...(existing.data || {}), ...dataExtra },
    }
    const { error } = await supabase.from('annuaire').update(rec).eq('id', existing.id)
    if (error) throw error
    return existing.id
  }
  const { data, error } = await supabase.from('annuaire').insert({
    categorie: 'beneficiaire',
    ...ident,
    data: dataExtra,
    created_by: created_by || null,
  }).select('id').single()
  if (error && error.code === '23505') {
    const again = await trouverBeneficiaire(f)
    if (again) {
      await supabase.from('annuaire').update({
        ...ident,
        niss: ident.niss || again.niss || null,
        genre: ident.genre || again.genre || null,
        data: { ...(again.data || {}), ...dataExtra },
      }).eq('id', again.id)
      return again.id
    }
  }
  if (error) throw error
  return data?.id || null
}

export async function upsertContactRattache(beneficiaireId, f, { created_by } = {}) {
  if (!beneficiaireId || (!emptyToNull(f.nom) && !emptyToNull(f.prenom))) return null
  const ident = identite(f)
  const dataExtra = {
    adresse: adresseOuNull(f.adresse),
    email: f.email || '',
    lien: ident.lien || '',
    telephone: ident.telephone || '',
    tel_gsm: ident.tel_gsm || '',
    tel_fixe: ident.tel_fixe || '',
  }
  const nom = (f.nom || '').trim()
  const prenom = (f.prenom || '').trim()
  let existing = f.id
    ? (await supabase.from('annuaire').select('id,data,niss').eq('id', f.id).maybeSingle()).data
    : null
  const niss = normaliserNiss(f.niss)
  if (!existing && niss) {
    const { data } = await supabase.from('annuaire').select('id,data,niss')
      .eq('categorie', 'accompagnant').eq('beneficiaire_id', beneficiaireId).eq('niss', niss).maybeSingle()
    existing = data
  }
  if (!existing && nom && prenom) {
    const q = supabase.from('annuaire').select('id,data,niss')
      .eq('categorie', 'accompagnant').eq('beneficiaire_id', beneficiaireId)
      .ilike('nom', nom).ilike('prenom', prenom).limit(1)
    const { data } = await q
    existing = data?.[0] || null
  }
  if (existing) {
    const { error } = await supabase.from('annuaire').update({
      ...ident,
      niss: ident.niss || existing.niss || null,
      data: { ...(existing.data || {}), ...dataExtra },
    }).eq('id', existing.id)
    if (error) throw error
    return existing.id
  }
  const { data, error } = await supabase.from('annuaire').insert({
    categorie: 'accompagnant',
    beneficiaire_id: beneficiaireId,
    ...ident,
    data: dataExtra,
    created_by: created_by || null,
  }).select('id').single()
  if (error) throw error
  return data?.id || null
}

export function ficheVersBeneficiaire(r) {
  if (!r) return {}
  const d = r.data || {}
  return {
    id: r.id,
    nom: r.nom || '',
    prenom: r.prenom || '',
    date_naissance: r.date_naissance ? String(r.date_naissance).slice(0, 10) : '',
    niss: r.niss || d.niss || '',
    tel_gsm: r.tel_gsm || d.tel_gsm || '',
    tel_fixe: r.tel_fixe || d.tel_fixe || '',
    genre: r.genre || d.genre || '',
    adresse: d.adresse || null,
    email: d.email || '',
    data: d,
  }
}

export function ficheVersContact(r) {
  if (!r) return {}
  const d = r.data || {}
  return {
    id: r.id,
    nom: r.nom || '',
    prenom: r.prenom || '',
    lien: r.lien || d.lien || '',
    date_naissance: r.date_naissance ? String(r.date_naissance).slice(0, 10) : '',
    niss: r.niss || d.niss || '',
    tel_gsm: r.tel_gsm || d.tel_gsm || '',
    tel_fixe: r.tel_fixe || d.tel_fixe || '',
    adresse: d.adresse || null,
    email: d.email || '',
    telephone: r.telephone || d.telephone || '',
  }
}

export async function listerBeneficiaires() {
  const { data, error } = await supabase.from('annuaire').select('*').eq('categorie', 'beneficiaire').order('nom')
  if (error) throw error
  return data || []
}

export async function listerContacts(beneficiaireId) {
  if (!beneficiaireId) return []
  const { data, error } = await supabase.from('annuaire').select('*')
    .eq('categorie', 'accompagnant').eq('beneficiaire_id', beneficiaireId).order('nom')
  if (error) throw error
  return data || []
}

export function telGeneralFiche(r) {
  if (!r) return ''
  const d = r.data || {}
  return r.telephone || r.tel_fixe || r.tel_gsm || d.telephone || d.tel_fixe || d.tel_gsm || ''
}

export async function listerPartenairesExternes() {
  const [{ data: fiches }, { data: orgs }] = await Promise.all([
    supabase.from('annuaire').select('*').in('categorie', ['institution', 'externe_souhait']).order('nom'),
    supabase.from('partenaires').select('*').eq('actif', true).order('nom'),
  ])
  const rows = []
  const seenOrg = new Set()
  for (const a of fiches || []) {
    rows.push({
      key: `a:${a.id}`,
      annuaire_id: a.id,
      partenaire_id: a.partenaire_id || null,
      nom: a.nom || '(sans nom)',
      categorie: a.categorie,
      tel: telGeneralFiche(a),
      email: a.data?.email || '',
      contact: a.data?.contact_personne || '',
      fiche: a,
    })
    if (a.partenaire_id) seenOrg.add(a.partenaire_id)
  }
  for (const p of orgs || []) {
    if (seenOrg.has(p.id) || rows.some(r => r.annuaire_id && r.annuaire_id === p.annuaire_id)) continue
    rows.push({
      key: `p:${p.id}`,
      annuaire_id: p.annuaire_id || null,
      partenaire_id: p.id,
      nom: p.nom,
      categorie: 'partenaire',
      tel: p.tel_general || p.contact_tel || '',
      email: p.email_general || p.contact_email || '',
      contact: p.contact_nom || '',
      fiche: null,
    })
  }
  return rows
}

export async function assurerPartenaireDepuisAnnuaire(fiche) {
  if (!fiche?.id) return null
  const d = fiche.data || {}
  const tel = telGeneralFiche(fiche)
  const email = emptyToNull(d.email)
  let q = supabase.from('partenaires').select('id').eq('annuaire_id', fiche.id).limit(1)
  const { data: byAnn } = await q
  let exist = byAnn?.[0]
  if (!exist && fiche.partenaire_id) {
    const { data: byId } = await supabase.from('partenaires').select('id').eq('id', fiche.partenaire_id).maybeSingle()
    exist = byId
  }
  if (!exist) {
    const { data: byNom } = await supabase.from('partenaires').select('id').ilike('nom', fiche.nom || '').limit(1)
    exist = byNom?.[0]
  }
  if (exist?.id) {
    await supabase.from('partenaires').update({
      nom: fiche.nom || undefined,
      tel_general: tel || null,
      email_general: email,
      contact_tel: tel || null,
      contact_email: email,
      contact_nom: emptyToNull(d.contact_personne),
      ville: emptyToNull(d.adresse?.localite),
      annuaire_id: fiche.id,
    }).eq('id', exist.id)
    await supabase.from('annuaire').update({ partenaire_id: exist.id }).eq('id', fiche.id)
    return exist.id
  }
  const { data, error } = await supabase.from('partenaires').insert({
    nom: fiche.nom || 'Institution',
    type: 'institution',
    ville: emptyToNull(d.adresse?.localite),
    contact_nom: emptyToNull(d.contact_personne),
    contact_email: email,
    contact_tel: tel || null,
    tel_general: tel || null,
    email_general: email,
    annuaire_id: fiche.id,
  }).select('id').single()
  if (error) throw error
  await supabase.from('annuaire').update({ partenaire_id: data.id }).eq('id', fiche.id)
  return data.id
}

export async function upsertInstitution(f, { created_by } = {}) {
  const nom = emptyToNull(f.nom)
  if (!nom) throw new Error('Nom de l’institution requis.')
  const tel = emptyToNull(f.telephone) || emptyToNull(f.tel_general)
  const email = emptyToNull(f.email) || emptyToNull(f.email_general)
  const data = {
    ...(typeof f.data === 'object' && f.data ? f.data : {}),
    type_institution: f.type_institution || '',
    email: email || '',
    telephone: tel || '',
    adresse: adresseOuNull(f.adresse),
    notes: f.notes || '',
    contact_personne: f.contact_personne || '',
  }
  const rec = {
    categorie: f.categorie === 'externe_souhait' ? 'externe_souhait' : 'institution',
    nom,
    telephone: tel,
    tel_fixe: tel,
    data,
  }
  if (f.id) {
    const { error } = await supabase.from('annuaire').update(rec).eq('id', f.id)
    if (error) throw error
    const { data: row } = await supabase.from('annuaire').select('*').eq('id', f.id).single()
    const pid = await assurerPartenaireDepuisAnnuaire(row)
    return { id: f.id, partenaire_id: pid }
  }
  const { data: row, error } = await supabase.from('annuaire').insert({
    ...rec, created_by: created_by || null,
  }).select('*').single()
  if (error) throw error
  const pid = await assurerPartenaireDepuisAnnuaire(row)
  return { id: row.id, partenaire_id: pid }
}

export async function upsertPointContact(institutionId, f, { created_by } = {}) {
  if (!institutionId) return null
  const ident = identite(f)
  const dataExtra = {
    fonction: f.fonction || f.lien || '',
    email: f.email || '',
    telephone: ident.telephone || '',
    tel_gsm: ident.tel_gsm || '',
    tel_fixe: ident.tel_fixe || '',
  }
  const rec = {
    categorie: 'point_contact',
    institution_id: institutionId,
    ...ident,
    lien: emptyToNull(f.fonction) || emptyToNull(f.lien),
    data: dataExtra,
  }
  if (f.id) {
    const { error } = await supabase.from('annuaire').update(rec).eq('id', f.id)
    if (error) throw error
    return f.id
  }
  const { data, error } = await supabase.from('annuaire').insert({
    ...rec, created_by: created_by || null,
  }).select('id').single()
  if (error) throw error
  return data?.id || null
}

