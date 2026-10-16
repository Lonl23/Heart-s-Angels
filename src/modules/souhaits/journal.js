import { supabase } from '@/lib/supabase'

export async function journaliser(souhaitId, action, detail, profile) {
  if (!souhaitId || !profile?.id) return
  const personne = [profile.prenom, profile.nom].filter(Boolean).join(' ').trim()
  await supabase.from('souhait_journal').insert({
    souhait_id: souhaitId,
    profile_id: profile.id,
    personne: personne || null,
    action,
    detail: detail || null,
  })
}

const OMETTRE = new Set(['updated_at'])

export function clesModifiees(avant, apres) {
  const a = avant && typeof avant === 'object' ? avant : {}
  const b = apres && typeof apres === 'object' ? apres : {}
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out = []
  for (const k of keys) {
    if (OMETTRE.has(k)) continue
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k)
  }
  return out.sort()
}
