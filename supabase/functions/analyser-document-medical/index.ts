// Analyse PDF / image médical via Gemini (traitements, protocole, infos, stups).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Mode = 'protocole_detresse' | 'traitements' | 'infos_medicales' | 'stupefiants'

const MAX_B64 = 12_000_000 // ~9 Mo binaire

function schemaPour(mode: Mode): string {
  if (mode === 'traitements') {
    return `{
  "medicaments": [
    {
      "medicament": "string",
      "dosage": "string",
      "voie": "string",
      "type_admin": "programme|si_necessaire",
      "horaires": ["08:00","20:00"],
      "posologie_max": "string|null",
      "notes": "string|null"
    }
  ],
  "notes": "string|null"
}`
  }
  if (mode === 'infos_medicales') {
    return `{
  "pathologies_noms": ["string"],
  "antecedents": "string|null",
  "douleurs": "string|null",
  "allergies": ["string"],
  "notes_medicales": "string|null",
  "cible_saturation_o2": "string|null",
  "debit_o2": "string|null",
  "interface_o2": ["string"],
  "cible_ta": "string|null",
  "cible_fc": "string|null",
  "continence_urinaire": ["string"],
  "continence_fecale": ["string"],
  "precisions_continences": "string|null",
  "alimentation": ["string"],
  "deglutition": ["string"],
  "voie_acces": ["string"],
  "mobilisations": ["string"],
  "communication": ["string"]
}`
  }
  if (mode === 'stupefiants') {
    return `{
  "lignes": [
    {
      "produit": "string",
      "dosage": "string",
      "lot": "string|null",
      "dlc": "YYYY-MM-DD|null",
      "qte_remise": 0
    }
  ],
  "notes": "string|null"
}`
  }
  return `{
  "lignes": [
    {
      "medicament": "string",
      "contexte": "string",
      "voie": "IV|IM|SC|PO|SL|Autre|",
      "dosage_max": "string",
      "doses": [{ "ordre": 1, "dosage": "string" }]
    }
  ],
  "notes": "string|null"
}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST requis' }, 405)

  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Non authentifié' }, 401)

  const urlSb = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  const supabase = createClient(urlSb, anonKey, {
    global: { headers: { Authorization: auth } },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'Session invalide' }, 401)

  // Clé : secret Edge en priorité, sinon Vault (comme SMTP).
  let geminiKey = (Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || '').trim()
  let keySource: 'env' | 'vault' | 'none' = geminiKey ? 'env' : 'none'
  if (!geminiKey && serviceKey) {
    const admin = createClient(urlSb, serviceKey)
    const { data: cfg } = await admin.rpc('gemini_api_config')
    if (cfg?.ok && cfg.key) {
      geminiKey = String(cfg.key).trim()
      keySource = 'vault'
    }
  }
  if (!geminiKey) {
    return json({
      error: 'Analyse IA non configurée (secret GEMINI_API_KEY / Vault ha_gemini_api_key manquant).',
      code: 'no_gemini',
    }, 503)
  }

  let body: {
    mode?: Mode
    mime?: string
    base64?: string
    nom?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON invalide' }, 400)
  }

  const mode = (body.mode || 'protocole_detresse') as Mode
  if (!['protocole_detresse', 'traitements', 'infos_medicales', 'stupefiants'].includes(mode)) {
    return json({ error: 'Mode inconnu.' }, 400)
  }
  const mime = String(body.mime || 'application/pdf').trim() || 'application/pdf'
  const base64 = String(body.base64 || '').replace(/^data:[^;]+;base64,/, '')
  if (!base64) return json({ error: 'Fichier manquant' }, 400)
  if (base64.length > MAX_B64) {
    return json({ error: 'Fichier trop volumineux pour l’analyse IA (max ~9 Mo).' }, 413)
  }

  const schemaHint = schemaPour(mode)
  const prompt = `Tu es un assistant clinique pour Heart's Angels (soins palliatifs, Belgique).
Analyse le document joint (${body.nom || 'sans nom'}) et renvoie UNIQUEMENT un JSON valide, sans markdown, au schéma :
${schemaHint}
Mode: ${mode}.
Règles: français, dosages tels qu'écrits, n'invente rien. Si une info manque, utilise null ou [].
Pour stupefiants: ne garde que les médicaments stupéfiants / psychotropes contrôlés (morphine, fentanyl, midazolam, kétamine, etc.). qte_remise = quantité visible ou 1 si non précisée.`

  // gemini-2.0-flash retiré ; 3.5-flash-lite = stable + multimodal (PDF/images).
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`

  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  })

  const geminiJson = await geminiRes.json().catch(() => ({}))
  if (!geminiRes.ok) {
    const msg = geminiJson?.error?.message || `Gemini HTTP ${geminiRes.status}`
    return json({ error: msg, model }, 502)
  }

  const text = geminiJson?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return json({ error: 'Réponse IA illisible', raw: text.slice(0, 800) }, 502)
    try { parsed = JSON.parse(m[0]) } catch {
      return json({ error: 'JSON IA invalide', raw: text.slice(0, 800) }, 502)
    }
  }

  return json({ ok: true, mode, model, key_source: keySource, data: parsed })
})
