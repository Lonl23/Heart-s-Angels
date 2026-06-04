// Edge Function : rapatrie les logos partenaires (URL externes) dans Supabase Storage
// Déploiement : supabase functions deploy rapatrier-logos
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Récupérer tous les partenaires dont le logo est une URL externe (pas déjà dans notre storage)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const { data: partenaires } = await admin
      .from('partenaires')
      .select('id, nom, logo_url')
      .not('logo_url', 'is', null)

    const resultats: { nom: string; statut: string }[] = []

    for (const p of partenaires || []) {
      // Déjà hébergé chez nous ? on saute
      if (!p.logo_url || p.logo_url.includes(supabaseUrl)) {
        resultats.push({ nom: p.nom, statut: 'déjà hébergé' }); continue
      }
      try {
        // Télécharger l'image externe
        const resp = await fetch(p.logo_url)
        if (!resp.ok) { resultats.push({ nom: p.nom, statut: `échec téléchargement (${resp.status})` }); continue }
        const contentType = resp.headers.get('content-type') || 'image/png'
        const ext = contentType.includes('svg') ? 'svg'
                  : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
                  : contentType.includes('webp') ? 'webp' : 'png'
        const bytes = new Uint8Array(await resp.arrayBuffer())

        // Nom de fichier propre
        const slug = p.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
        const fileName = `partenaires/${slug}-${Date.now()}.${ext}`

        // Téléverser dans le bucket uploads
        const { error: upErr } = await admin.storage.from('uploads').upload(fileName, bytes, {
          contentType, cacheControl: '31536000', upsert: true,
        })
        if (upErr) { resultats.push({ nom: p.nom, statut: 'échec upload: ' + upErr.message }); continue }

        // URL publique
        const { data: urlData } = admin.storage.from('uploads').getPublicUrl(fileName)

        // Mettre à jour la base
        await admin.from('partenaires').update({ logo_url: urlData.publicUrl }).eq('id', p.id)
        resultats.push({ nom: p.nom, statut: '✓ rapatrié' })
      } catch (e) {
        resultats.push({ nom: p.nom, statut: 'erreur: ' + (e instanceof Error ? e.message : 'inconnue') })
      }
    }

    return new Response(JSON.stringify({ success: true, resultats }, null, 2), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})