import { supabase } from '@/lib/supabase'

function fichierEnBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => {
      const s = String(fr.result || '')
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    fr.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    fr.readAsDataURL(file)
  })
}

/**
 * Analyse un PDF / image via l’edge function Gemini.
 * @param {'protocole_detresse'|'traitements'|'infos_medicales'} mode
 */
export async function analyserDocumentMedical(file, mode = 'protocole_detresse') {
  if (!file) throw new Error('Aucun fichier.')
  const base64 = await fichierEnBase64(file)
  const { data, error } = await supabase.functions.invoke('analyser-document-medical', {
    body: {
      mode,
      mime: file.type || 'application/pdf',
      nom: file.name || '',
      base64,
    },
  })
  if (error) {
    const detail = data?.error || error.message || 'Analyse impossible.'
    throw new Error(detail)
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.ok || !data?.data) throw new Error('Aucune donnée extraite.')
  return data.data
}

export function lignesDepuisAnalyseProtocole(data) {
  const rows = Array.isArray(data?.lignes) ? data.lignes : []
  return rows
    .map((r, i) => ({
      id: (crypto.randomUUID && crypto.randomUUID()) || `d-${i}-${Date.now()}`,
      medicament: String(r.medicament || '').trim(),
      contexte: String(r.contexte || '').trim(),
      dosage: String(r.doses?.[0]?.dosage || r.dosage || '').trim(),
      dosage_max: String(r.dosage_max || '').trim(),
      voie: String(r.voie || '').trim(),
      doses: Array.isArray(r.doses) && r.doses.length
        ? r.doses.map((d, j) => ({ ordre: Number(d.ordre) || j + 1, dosage: String(d.dosage || '').trim() }))
        : [{ ordre: 1, dosage: String(r.dosage || '').trim() }],
    }))
    .filter(r => r.medicament || r.doses.some(d => d.dosage))
}

export function medicamentsDepuisAnalyse(data) {
  const rows = Array.isArray(data?.medicaments) ? data.medicaments : []
  return rows
    .map(r => ({
      medicament: String(r.medicament || '').trim(),
      dosage: String(r.dosage || '').trim() || null,
      voie: String(r.voie || '').trim() || null,
      type_admin: r.type_admin === 'si_necessaire' ? 'si_necessaire' : 'programme',
      horaires: Array.isArray(r.horaires) ? r.horaires.map(String).filter(Boolean) : [],
      posologie_max: r.posologie_max ? String(r.posologie_max) : null,
      notes: r.notes ? String(r.notes) : null,
      perfusion: {},
    }))
    .filter(r => r.medicament)
}
