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
  const existing = await trouverBeneficiaire(f)
  if (existing) {
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
  let existing = null
  const niss = normaliserNiss(f.niss)
  if (niss) {
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
