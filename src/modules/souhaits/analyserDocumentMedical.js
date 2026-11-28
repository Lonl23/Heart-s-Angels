const VOIES = [
  { re: /\b(s\.?\s*c\.?|sous-?cutan[eé]e?|sc)\b/i, v: 'SC' },
  { re: /\b(i\.?\s*v\.?|intra-?veineuse?|iv)\b/i, v: 'IV' },
  { re: /\b(i\.?\s*m\.?|intra-?musculaire|im)\b/i, v: 'IM' },
  { re: /\b(p\.?\s*o\.?|per\s*os|oral(?:e)?)\b/i, v: 'PO' },
  { re: /\b(s\.?\s*l\.?|sublinguale?|sl)\b/i, v: 'SL' },
]

const STOP = /^(le|la|les|des|une?|du|au|aux|et|ou|si|pour|avec|sans|chez|dans|sur|par|de|à|a|the|patient|patiente|nom|prenom|prénom|date|signature|page|protocole|traitement|ordonnance|asbl|heart|angels|matin|midi|soir|coucher|douleur|dyspn[eé]e|anxi[eé]t[eé]|agit(?:ation)?|besoin|n[eé]cessaire|dose|cas)$/i

function nettoyerLignes(texte) {
  return String(texte || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function detecterVoie(ligne) {
  for (const v of VOIES) {
    if (v.re.test(ligne)) return v.v
  }
  return ''
}

function dosagesDans(ligne) {
  const found = []
  const re = /(\d+(?:[.,]\d+)?)\s*(mg|µg|ug|mcg|g|ml|UI|iu|mEq|mmol|%|µg\/h|ug\/h|mg\/h|ml\/h)\b/gi
  let m
  while ((m = re.exec(ligne))) {
    found.push(`${m[1].replace(',', '.')}${m[2]}`)
  }
  return found
}

function horairesDans(ligne) {
  const h = new Set()
  const re = /\b([01]?\d|2[0-3])\s*[h:]\s*([0-5]\d)?\b/gi
  let m
  while ((m = re.exec(ligne))) {
    const hh = String(m[1]).padStart(2, '0')
    const mm = m[2] ? String(m[2]).padStart(2, '0') : '00'
    h.add(`${hh}:${mm}`)
  }
  if (/\bmatin\b/i.test(ligne)) h.add('08:00')
  if (/\bmidi\b/i.test(ligne)) h.add('12:00')
  if (/\bsoir\b/i.test(ligne)) h.add('18:00')
  if (/\bcoucher\b/i.test(ligne)) h.add('22:00')
  return [...h].sort()
}

function nomMedicament(ligne) {
  let s = ligne
    .replace(/\b\d+(?:[.,]\d+)?\s*(mg|µg|ug|mcg|g|ml|UI|iu|mEq|mmol|%|µg\/h|ug\/h|mg\/h|ml\/h)\b/gi, ' ')
    .replace(/\b(s\.?\s*c\.?|i\.?\s*v\.?|i\.?\s*m\.?|p\.?\s*o\.?|s\.?\s*l\.?|sous-?cutan[eé]e?|intra-?veineuse?|intra-?musculaire|per\s*os|sublinguale?)\b/gi, ' ')
    .replace(/\b([01]?\d|2[0-3])\s*[h:]\s*([0-5]\d)?\b/gi, ' ')
    .replace(/[•\-–—*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const mots = s.split(' ').filter(w => w.length > 1 && !STOP.test(w))
  if (!mots.length) return ''
  return mots.slice(0, 4).join(' ')
}

function contexteDans(ligne) {
  const m = ligne.match(/\b(?:si|en cas de|si besoin|si n[eé]cessaire)\s*[:\-]?\s*(.+)$/i)
  if (!m) return ''
  return m[1].replace(/\b\d+(?:[.,]\d+)?\s*(mg|µg|ug|mcg|g|ml)\b/gi, '').trim().slice(0, 80)
}

function ligneUtileMedicament(ligne) {
  if (dosagesDans(ligne).length) return true
  if (detecterVoie(ligne) && /[A-Za-zÀ-ÿ]{3,}/.test(ligne)) return true
  return false
}

function extraireLignesMedicaments(texte) {
  const out = []
  for (const ligne of nettoyerLignes(texte)) {
    if (!ligneUtileMedicament(ligne)) continue
    const medicament = nomMedicament(ligne)
    if (!medicament || medicament.length < 3) continue
    const doses = dosagesDans(ligne)
    const voie = detecterVoie(ligne)
    const horaires = horairesDans(ligne)
    const siNec = /\bsi\s+(besoin|n[eé]cessaire|douleur|dyspn[eé]e|anxi[eé]t[eé]|agit)\b/i.test(ligne)
    out.push({
      medicament,
      dosage: doses[0] || '',
      doses: doses.length ? doses.map((d, i) => ({ ordre: i + 1, dosage: d })) : [{ ordre: 1, dosage: doses[0] || '' }],
      dosage_max: doses.length > 1 ? doses[doses.length - 1] : '',
      voie,
      contexte: contexteDans(ligne),
      type_admin: siNec ? 'si_necessaire' : 'programme',
      horaires,
      notes: null,
    })
  }
  const seen = new Set()
  return out.filter(r => {
    const k = `${r.medicament}|${r.dosage}|${r.voie}`.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function extraireInfosMedicales(texte) {
  const t = String(texte || '')
  const lignes = nettoyerLignes(t)
  const data = {
    pathologies_noms: [],
    antecedents: null,
    douleurs: null,
    allergies: [],
    notes_medicales: null,
    cible_saturation_o2: null,
    debit_o2: null,
    interface_o2: [],
    cible_ta: null,
    cible_fc: null,
    continence_urinaire: [],
    continence_fecale: [],
    precisions_continences: null,
    alimentation: [],
    deglutition: [],
    voie_acces: [],
    mobilisations: [],
    communication: [],
  }

  const spo2 = t.match(/sp[o0]2[^0-9]{0,12}(\d{2,3})\s*%?/i) || t.match(/saturation[^0-9]{0,12}(\d{2,3})\s*%/i)
  if (spo2) data.cible_saturation_o2 = `${spo2[1]} %`

  const debit = t.match(/(\d+(?:[.,]\d+)?)\s*l(?:itres?)?\s*\/\s*min/i) || t.match(/d[eé]bit[^0-9]{0,10}(\d+(?:[.,]\d+)?)/i)
  if (debit) data.debit_o2 = String(debit[1]).replace(',', '.')

  if (/lunettes/i.test(t)) data.interface_o2.push('Lunettes')
  if (/masque\s*60/i.test(t)) data.interface_o2.push('Masque 60%')
  if (/masque\s*100|haute\s*concentration|non\s*rebreath/i.test(t)) data.interface_o2.push('Masque 100%')

  const ta = t.match(/\bTA\b[^0-9]{0,8}(\d{2,3}\s*[\/\-]\s*\d{2,3})/i) || t.match(/tension[^0-9]{0,8}(\d{2,3}\s*[\/\-]\s*\d{2,3})/i)
  if (ta) data.cible_ta = ta[1].replace(/\s/g, '')

  const fc = t.match(/\bFC\b[^0-9]{0,8}(\d{2,3})/i) || t.match(/fr[eé]quence\s*cardiaque[^0-9]{0,8}(\d{2,3})/i)
  if (fc) data.cible_fc = fc[1]

  if (/allerg/i.test(t)) {
    for (const l of lignes) {
      if (!/allerg/i.test(l)) continue
      const part = l.split(/allergies?\s*[:\-]?\s*/i)[1] || l
      part.split(/[,;]/).map(x => x.trim()).filter(x => x.length > 2 && x.length < 40).forEach(a => {
        if (!/allerg/i.test(a)) data.allergies.push(a)
      })
    }
  }

  const pathoHints = /(n[eé]oplasie|cancer|m[eé]tasta|glioblastome|SLA|SEP|BPCO|insuffisance|cirrhose|cardiopathie|pneumopathie|alzheimer|parkinson)/ig
  let pm
  while ((pm = pathoHints.exec(t))) {
    const start = Math.max(0, pm.index - 20)
    const chunk = t.slice(start, pm.index + 40).replace(/\n/g, ' ')
    const label = chunk.match(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{3,40})/)
    if (label) data.pathologies_noms.push(label[1].trim())
  }
  data.pathologies_noms = [...new Set(data.pathologies_noms)].slice(0, 8)

  if (/sonde\s*urin/i.test(t)) data.continence_urinaire.push('Sonde urinaire')
  if (/cystocath/i.test(t)) data.continence_urinaire.push('Cystocath')
  if (/protection/i.test(t) && /urin/i.test(t)) data.continence_urinaire.push('Protection')
  if (/stomie/i.test(t) && /f[eé]cal|digest/i.test(t)) data.continence_fecale.push('Stomie')
  if (/mix[eé]e/i.test(t)) data.alimentation.push('Mixée')
  if (/sonde\s*gastr/i.test(t) || /gastrostom/i.test(t)) data.alimentation.push('Sonde gastrique')
  if (/port[-\s]?a[-\s]?cath|pac\b/i.test(t)) data.voie_acces.push('Port-à-cath')
  if (/picc|pic-line/i.test(t)) data.voie_acces.push('Pic-line')
  if (/mid-?line/i.test(t)) data.voie_acces.push('Mid-line')
  if (/fauteuil/i.test(t)) data.mobilisations.push('Fauteuil')
  if (/lit\s*strict/i.test(t)) data.mobilisations.push('Lit strict')
  else if (/\blit\b/i.test(t) && /mobil/i.test(t)) data.mobilisations.push('Lit')

  const notes = lignes.filter(l => l.length > 40 && !/^page\b/i.test(l)).slice(0, 4).join('\n')
  if (notes) data.notes_medicales = notes.slice(0, 1200)

  return data
}

async function texteDepuisPdf(file) {
  const [{ getDocument, GlobalWorkerOptions }, workerUrl] = await Promise.all([
    import('pdfjs-dist/build/pdf.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url').then(m => m.default),
  ])
  GlobalWorkerOptions.workerSrc = workerUrl
  const buf = await file.arrayBuffer()
  const doc = await getDocument({ data: buf }).promise
  const parts = []
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    parts.push(content.items.map(it => it.str || '').join(' '))
  }
  return parts.join('\n')
}

async function texteDepuisFichier(file) {
  const mime = file.type || ''
  const nom = (file.name || '').toLowerCase()
  if (mime === 'application/pdf' || nom.endsWith('.pdf')) {
    const texte = await texteDepuisPdf(file)
    if ((texte || '').replace(/\s/g, '').length < 20) {
      const err = new Error('PDF sans texte extractible (scan).')
      err.code = 'pdf_scan'
      throw err
    }
    return texte
  }
  if (mime.startsWith('image/')) {
    const err = new Error('Image : analyse locale impossible.')
    err.code = 'image'
    throw err
  }
  const raw = await file.text().catch(() => '')
  if ((raw || '').trim().length > 20) return raw
  throw new Error('Format non pris en charge pour l’analyse locale.')
}

function mimeFichier(file) {
  const mime = String(file?.type || '').trim()
  if (mime) return mime
  const nom = String(file?.name || '').toLowerCase()
  if (nom.endsWith('.pdf')) return 'application/pdf'
  if (nom.endsWith('.png')) return 'image/png'
  if (nom.endsWith('.jpg') || nom.endsWith('.jpeg')) return 'image/jpeg'
  if (nom.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

async function fichierEnBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function resultatLocalVide(data, mode) {
  if (mode === 'traitements') return !(data?.medicaments || []).length
  if (mode === 'infos_medicales') {
    return !(data?.pathologies_noms || []).length
      && !(data?.allergies || []).length
      && !data?.notes_medicales
      && !data?.antecedents
  }
  if (mode === 'stupefiants') return !(data?.lignes || []).length
  return !(data?.lignes || []).length
}

/** Appel Edge Function Gemini (clé côté Supabase). */
export async function analyserDocumentGemini(file, mode = 'protocole_detresse') {
  if (!file) throw new Error('Aucun fichier.')
  const { supabase } = await import('@/lib/supabase')
  const config = (await import('@/app.config')).default
  const { data: refreshed } = await supabase.auth.refreshSession()
  const token = refreshed?.session?.access_token
    || (await supabase.auth.getSession()).data?.session?.access_token
  if (!token) throw new Error('Session expirée. Reconnectez-vous puis réessayez.')

  const base64 = await fichierEnBase64(file)
  const url = `${String(config.supabase.url).replace(/\/$/, '')}/functions/v1/analyser-document-medical`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabase.anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mode,
      mime: mimeFichier(file),
      base64,
      nom: file.name || 'document',
    }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload?.ok) {
    const err = new Error(payload?.error || payload?.message || 'Analyse IA impossible.')
    err.code = payload?.code || 'gemini_error'
    throw err
  }
  return { ...payload.data, _source: 'gemini', _model: payload.model }
}

function analyserTexteLocal(texte, mode) {
  if (mode === 'traitements') {
    const medicaments = extraireLignesMedicaments(texte).map(r => ({
      medicament: r.medicament,
      dosage: r.dosage || null,
      voie: r.voie || null,
      type_admin: r.type_admin,
      horaires: r.horaires || [],
      posologie_max: r.dosage_max || null,
      notes: null,
    }))
    return { medicaments, notes: null }
  }
  if (mode === 'infos_medicales') {
    return extraireInfosMedicales(texte)
  }
  const lignes = extraireLignesMedicaments(texte).map(r => ({
    medicament: r.medicament,
    contexte: r.contexte || '',
    voie: r.voie || '',
    dosage_max: r.dosage_max || '',
    doses: r.doses,
  }))
  return { lignes, notes: null }
}

/**
 * Analyse d’un PDF / image :
 * 1) heuristiques locales (PDF texte, gratuit)
 * 2) sinon Gemini via Edge Function (scans, photos, stups)
 * @param {'protocole_detresse'|'traitements'|'infos_medicales'|'stupefiants'} mode
 * @param {{ forcerGemini?: boolean }} [opts]
 */
export async function analyserDocumentMedical(file, mode = 'protocole_detresse', opts = {}) {
  if (!file) throw new Error('Aucun fichier.')

  if (mode === 'stupefiants' || opts.forcerGemini) {
    return analyserDocumentGemini(file, mode)
  }

  let localErr = null
  try {
    const texte = await texteDepuisFichier(file)
    const data = analyserTexteLocal(texte, mode)
    if (!resultatLocalVide(data, mode)) {
      return { ...data, _source: 'local' }
    }
    localErr = new Error('Analyse locale sans résultat utile.')
  } catch (e) {
    localErr = e
  }

  try {
    return await analyserDocumentGemini(file, mode)
  } catch (e) {
    if (e?.code === 'no_gemini') {
      throw new Error(
        (localErr?.message ? `${localErr.message} ` : '') +
        'L’analyse IA n’est pas encore configurée (clé Gemini manquante sur Supabase). Encodez à la main ou ajoutez GEMINI_API_KEY.',
      )
    }
    if (localErr?.code === 'pdf_scan' || localErr?.code === 'image') {
      throw new Error(e.message || 'Analyse IA impossible sur ce scan.')
    }
    throw new Error(
      e.message
      || localErr?.message
      || 'Aucun médicament détecté. Vérifiez le document ou encodez à la main.',
    )
  }
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

/** Lignes stups depuis Gemini (ou local). */
export function stupefiantsDepuisAnalyse(data) {
  const rows = Array.isArray(data?.lignes) ? data.lignes : []
  return rows
    .map(r => ({
      produit: String(r.produit || r.medicament || '').trim(),
      dosage: String(r.dosage || '').trim(),
      lot: r.lot ? String(r.lot).trim() : '',
      dlc: r.dlc ? String(r.dlc).slice(0, 10) : '',
      justification: r.justification ? String(r.justification).trim() : '',
      qte_remise: Number(r.qte_remise) > 0 ? Number(r.qte_remise) : 1,
    }))
    .filter(r => r.produit)
}
