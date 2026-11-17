// Analyse PDF / image médical (protocole détresse ou traitements) via Gemini.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Mode = 'protocole_detresse' | 'traitements' | 'infos_medicales'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST requis' }, 405)

  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Non authentifié' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: auth } } },
  )
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'Session invalide' }, 401)

  const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || ''
  if (!geminiKey) {
    return json({
      error: 'Analyse IA non configurée (secret GEMINI_API_KEY manquant sur Supabase).',
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
  const mime = body.mime || 'application/pdf'
  const base64 = String(body.base64 || '').replace(/^data:[^;]+;base64,/, '')
  if (!base64) return json({ error: 'Fichier manquant' }, 400)

  const schemaHint = mode === 'traitements'
    ? `{
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
    : mode === 'infos_medicales'
      ? `{
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
      : `{
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

  const prompt = `Tu es un assistant clinique pour Heart's Angels (soins palliatifs, Belgique).
Analyse le document joint (${body.nom || 'sans nom'}) et renvoie UNIQUEMENT un JSON valide, sans markdown, au schéma :
${schemaHint}
Mode: ${mode}.
Règles: français, dosages tels qu'écrits, n'invente rien. Si une info manque, utilise null ou [].`

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'
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
    return json({ error: msg }, 502)
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

  return json({ ok: true, mode, data: parsed })
})
