// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Envoie l’invitation depuis laurent@heartsangels.be (SMTP Google Workspace).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const ADMINS = ['admin', 'president']
const ROLES_ACCES_TOTAL = [
  'president', 'vice_president',
  'resp_informatique', 'resp_informatique_adjoint', 'administrateur_asbl',
]
const ROLES_GERER_APP = [
  'president', 'vice_president',
  'resp_informatique', 'resp_informatique_adjoint',
]
const ROLES_FICHES = ['coord_benevoles', 'coord_benevoles_adjoint']
const PUB = () => (Deno.env.get('APP_PUBLIC_URL') || 'https://heart-s-angels.web.app').replace(/\/$/, '')

function rolesAsbl(fiche: unknown): string[] {
  const r = (fiche as { roles_asbl?: unknown } | null)?.roles_asbl
  return Array.isArray(r) ? r.map(String) : []
}
function accesTotal(role: string, fiche: unknown) {
  if (ADMINS.includes(role)) return true
  return rolesAsbl(fiche).some((r) => ROLES_ACCES_TOTAL.includes(r))
}
function peutGererFiches(role: string, fiche: unknown) {
  return accesTotal(role, fiche) || rolesAsbl(fiche).some((r) => ROLES_FICHES.includes(r))
}
function peutGererApp(role: string, fiche: unknown) {
  if (!role || role === 'partenaire') return false
  if (ADMINS.includes(role)) return true
  return rolesAsbl(fiche).some((r) => ROLES_GERER_APP.includes(r))
}

function urlInvitation(code: string, email: string, partenaire: boolean) {
  const params = new URLSearchParams()
  if (code) params.set('code', code)
  if (email) params.set('email', email)
  const path = partenaire ? '/inscription/partenaire' : '/inscription'
  return `${PUB()}${path}?${params.toString()}`
}

function estMedical(typeBenevole: string | null, role: string) {
  const t = String(typeBenevole || '')
  return t === 'medical' || t === 'volontaire_medical' || role === 'volontaire_medical'
}

function libellePdf(typeBenevole: string | null, role: string) {
  if (estMedical(typeBenevole, role)) return 'du volontaire médical'
  return 'du volontaire non médical'
}

function texteInvitation(opts: {
  prenom: string | null
  lien: string
  partenaire: boolean
  nomInstitution: string | null
  typeBenevole: string | null
  role: string
}) {
  if (opts.partenaire) {
    const inst = opts.nomInstitution ? ` « ${opts.nomInstitution} »` : ''
    const prenom = opts.prenom ? ` ${opts.prenom}` : ''
    return `Bonjour${prenom},

Votre institution${inst} est reconnue comme partenaire de Heart's Angels.

Activez l’accès en choisissant un mot de passe (lien valable 7 jours) :

${opts.lien}

Ensuite, connectez-vous sur l’espace partenaires avec :
- le nom exact de l’institution
- votre e-mail professionnel
- le mot de passe que vous venez de choisir

Heart's Angels ASBL`
  }
  const salut = opts.prenom ? `Bonjour ${opts.prenom},` : 'Bonjour,'
  return `${salut}

Voici ton lien pour créer ton compte Heart's Angels (valable 7 jours) :

${opts.lien}

Il te suffit de choisir un mot de passe. Si le lien ne s’ouvre pas, va sur l’écran de connexion et utilise « J’ai une invitation ».

Le mode d’emploi ${libellePdf(opts.typeBenevole, opts.role)} est en pièce jointe (PDF).

Heart's Angels ASBL`
}

function htmlInvitation(texte: string, lien: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const blocs = texte.split('\n\n').map((p) => {
    const withLink = p.split(lien).map(esc).join(`<a href="${esc(lien)}">${esc(lien)}</a>`)
    return `<p style="margin:0 0 12px;line-height:1.5">${withLink.replace(/\n/g, '<br>')}</p>`
  })
  return `<div style="font-family:Georgia,serif;font-size:16px;color:#1a1a1a">${blocs.join('')}</div>`
}

async function chargerPdf(nom: string) {
  const bases = [
    Deno.env.get('GUIDE_PDF_BASE'),
    'https://raw.githubusercontent.com/Lonl23/Heart-s-Angels/cursor/cloud-agent-1788358417819-vm6fv/docs',
    'https://raw.githubusercontent.com/Lonl23/Heart-s-Angels/main/docs',
  ].filter(Boolean) as string[]
  for (const b of bases) {
    try {
      const r = await fetch(`${b.replace(/\/$/, '')}/${nom}`)
      if (!r.ok) continue
      const buf = new Uint8Array(await r.arrayBuffer())
      if (buf.length > 1000 && buf[0] === 0x25 && buf[1] === 0x50) return buf
    } catch { /* essai suivant */ }
  }
  throw new Error('PDF du mode d’emploi introuvable côté serveur.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization') || ''
    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await asCaller.auth.getUser()
    if (uErr || !user) return json({ error: 'Non authentifié.' }, 401)

    const admin = createClient(url, serviceKey)
    const { data: prof } = await admin.from('profiles').select('role,fiche,actif').eq('id', user.id).maybeSingle()
    if (!prof || prof.actif === false) return json({ error: 'Accès refusé.' }, 403)

    const body = await req.json().catch(() => ({}))
    const code = String(body?.code || '').trim()
    if (!code) return json({ error: 'Code d’invitation manquant.' }, 400)

    let smtpUser = (Deno.env.get('SMTP_USER') || 'laurent@heartsangels.be').trim()
    let smtpPass = (Deno.env.get('SMTP_PASS') || '').trim()
    let smtpFrom = (Deno.env.get('SMTP_FROM') || `Heart's Angels <${smtpUser}>`).trim()
    if (!smtpPass) {
      const { data: cfg } = await admin.rpc('smtp_mail_config')
      if (cfg?.ok && cfg.pass) {
        smtpUser = String(cfg.user || smtpUser).trim()
        smtpPass = String(cfg.pass).trim()
        smtpFrom = String(cfg.from || smtpFrom).trim()
      }
    }
    if (!smtpPass) {
      return json({
        error: 'Envoi automatique pas encore branché. Dans le compte Google laurent@heartsangels.be : Sécurité → Validation en 2 étapes → Mots de passe des applications. Crée « Heart’s Angels » et transmets le code de 16 lettres.',
      }, 503)
    }

    const { data: inv } = await admin.from('invitations').select('*').eq('code', code).maybeSingle()
    if (!inv) return json({ error: 'Invitation introuvable.' }, 404)
    if (inv.utilise) return json({ error: 'Cette invitation a déjà été utilisée.' }, 400)
    if (inv.expire_le && new Date(inv.expire_le) < new Date()) return json({ error: 'Cette invitation est expirée.' }, 400)

    const partenaire = !!inv.partenaire_id
    if (partenaire) {
      if (!peutGererApp(prof.role, prof.fiche)) return json({ error: 'Accès refusé.' }, 403)
    } else if (!peutGererFiches(prof.role, prof.fiche)) {
      return json({ error: 'Accès refusé.' }, 403)
    }

    let nomInstitution: string | null = null
    if (partenaire && inv.partenaire_id) {
      const { data: org } = await admin.from('partenaires').select('nom').eq('id', inv.partenaire_id).maybeSingle()
      nomInstitution = org?.nom || null
    }

    const lien = urlInvitation(inv.code, inv.email, partenaire)
    const texte = texteInvitation({
      prenom: inv.prenom,
      lien,
      partenaire,
      nomInstitution,
      typeBenevole: inv.type_benevole,
      role: inv.role,
    })
    const sujet = partenaire
      ? `Heart’s Angels — accès partenaire${nomInstitution ? ` ${nomInstitution}` : ''}`
      : 'Heart’s Angels — crée ton compte volontaire'

    const attachments: { filename: string; content: Uint8Array; contentType: string }[] = []
    if (!partenaire) {
      const medical = estMedical(inv.type_benevole, inv.role)
      const filename = medical
        ? 'Mode-emploi-volontaire-medical.pdf'
        : 'Mode-emploi-volontaire-non-medical.pdf'
      attachments.push({
        filename,
        content: await chargerPdf(filename),
        contentType: 'application/pdf',
      })
    }

    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
      port: Number(Deno.env.get('SMTP_PORT') || 465),
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    })
    await transporter.sendMail({
      from: smtpFrom,
      to: inv.email,
      subject: sujet,
      text: texte,
      html: htmlInvitation(texte, lien),
      attachments,
    })

    await admin.from('invitations').update({
      envoyee_le: new Date().toISOString(),
      envoyee_par: user.id,
    }).eq('code', code)

    return json({ ok: true, email: inv.email })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
