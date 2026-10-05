// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Envoie les mails d’invitation et de bienvenue depuis laurent@heartsangels.be.
// Chaque envoi met laurent@heartsangels.be en copie cachée.
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
const ACCENT = '#1BB0CE'
const CCI = 'laurent@heartsangels.be'

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

function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function urlInvitation(code: string, email: string, partenaire: boolean) {
  const params = new URLSearchParams()
  if (code) params.set('code', code)
  if (email) params.set('email', email)
  const path = partenaire ? '/inscription/partenaire' : '/inscription'
  return `${PUB()}${path}?${params.toString()}`
}

function urlConnexion(partenaire: boolean) {
  return partenaire ? `${PUB()}/login/partenaire` : `${PUB()}/login`
}

function estMedical(typeBenevole: string | null, role: string) {
  const t = String(typeBenevole || '')
  return t === 'medical' || t === 'volontaire_medical' || role === 'volontaire_medical'
}

function urlModeEmploi(typeBenevole: string | null, role: string) {
  const nom = estMedical(typeBenevole, role)
    ? 'Mode-emploi-volontaire-medical.pdf'
    : 'Mode-emploi-volontaire-non-medical.pdf'
  return `${PUB()}/guides/${nom}`
}

function boutonHtml(href: string, label: string) {
  return `<p style="margin:28px 0 8px;text-align:left">
  <a href="${esc(href)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700;font-size:16px;font-family:Georgia,serif">${esc(label)}</a>
</p>`
}

function cadreHtml(inner: string) {
  return `<div style="background:#F4F8F9;padding:24px 12px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #E3EBEC;font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#1a1a1a">
    <p style="margin:0 0 18px;color:${ACCENT};font-weight:700;font-size:15px;letter-spacing:.02em">Heart's Angels</p>
    ${inner}
    <p style="margin:28px 0 0;color:#8AA0A6;font-size:13px">Heart's Angels ASBL</p>
  </div>
</div>`
}

function mailInvitation(opts: {
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
    const texte = `Bonjour${prenom},

Votre institution${inst} est reconnue comme partenaire de Heart's Angels.

Cliquez sur « Activer l’accès » (valable 7 jours) pour choisir un mot de passe.

Ensuite, connectez-vous avec le nom exact de l’institution, votre e-mail professionnel et ce mot de passe.

Heart's Angels ASBL`
    const html = cadreHtml(`
      <p style="margin:0 0 12px">Bonjour${esc(prenom)},</p>
      <p style="margin:0 0 12px">Votre institution${esc(inst)} est reconnue comme partenaire de Heart's Angels.</p>
      <p style="margin:0">Cliquez ci-dessous (valable 7 jours) pour choisir un mot de passe.</p>
      ${boutonHtml(opts.lien, 'Activer l’accès')}
      <p style="margin:16px 0 0;font-size:14px;color:#5A6F74">Ensuite, connectez-vous avec le nom exact de l’institution, votre e-mail professionnel et ce mot de passe.</p>
    `)
    return { texte, html, sujet: `Heart’s Angels — activez l’accès${opts.nomInstitution ? ` ${opts.nomInstitution}` : ''}` }
  }
  const salut = opts.prenom ? `Bonjour ${opts.prenom}` : 'Bonjour'
  const lienPdf = urlModeEmploi(opts.typeBenevole, opts.role)
  const texte = `${salut},

Pour créer ton compte Heart's Angels, clique sur « Crée ton compte » (valable 7 jours). Il te suffit ensuite de choisir un mot de passe.

Télécharge ensuite le mode d’emploi : ${lienPdf}

Heart's Angels ASBL`
  const html = cadreHtml(`
    <p style="margin:0 0 12px">${esc(salut)},</p>
    <p style="margin:0">Pour créer ton compte Heart's Angels, clique ci-dessous (valable 7 jours). Il te suffit ensuite de choisir un mot de passe.</p>
    ${boutonHtml(opts.lien, 'Crée ton compte')}
    <p style="margin:20px 0 0">Le mode d’emploi se télécharge ici :</p>
    ${boutonHtml(lienPdf, 'Télécharger le mode d’emploi')}
  `)
  return { texte, html, sujet: 'Heart’s Angels — crée ton compte' }
}

function mailReset(opts: { prenom: string | null; lien: string }) {
  const salut = opts.prenom ? `Bonjour ${opts.prenom}` : 'Bonjour'
  const texte = `${salut},

Tu as demandé à réinitialiser ton mot de passe Heart's Angels.

Clique sur « Réinitialiser le mot de passe » (valable 1 heure), puis encode deux fois le nouveau mot de passe.

Si tu n’es pas à l’origine de cette demande, ignore ce message.

Heart's Angels ASBL`
  const html = cadreHtml(`
    <p style="margin:0 0 12px">${esc(salut)},</p>
    <p style="margin:0">Tu as demandé à réinitialiser ton mot de passe Heart's Angels. Clique ci-dessous (valable 1 heure), puis encode deux fois le nouveau mot de passe.</p>
    ${boutonHtml(opts.lien, 'Réinitialiser le mot de passe')}
    <p style="margin:16px 0 0;font-size:14px;color:#5A6F74">Si tu n’es pas à l’origine de cette demande, ignore ce message.</p>
  `)
  return { texte, html, sujet: 'Heart’s Angels — réinitialise ton mot de passe' }
}

function mailBienvenue(opts: { prenom: string | null; partenaire: boolean; nomInstitution: string | null }) {
  const lien = urlConnexion(opts.partenaire)
  if (opts.partenaire) {
    const inst = opts.nomInstitution ? ` « ${opts.nomInstitution} »` : ''
    const prenom = opts.prenom ? ` ${opts.prenom}` : ''
    const texte = `Bonjour${prenom},

L’accès de votre institution${inst} est activé.

Cliquez sur « Accéder à l’application » puis connectez-vous avec le nom de l’institution, votre e-mail et votre mot de passe.

Heart's Angels ASBL`
    const html = cadreHtml(`
      <p style="margin:0 0 12px">Bonjour${esc(prenom)},</p>
      <p style="margin:0">L’accès de votre institution${esc(inst)} est activé. Cliquez ci-dessous pour vous connecter avec le nom de l’institution, votre e-mail et votre mot de passe.</p>
      ${boutonHtml(lien, 'Accéder à l’application')}
    `)
    return { texte, html, sujet: 'Heart’s Angels — votre accès est prêt', lien }
  }
  const salut = opts.prenom ? `Bonjour ${opts.prenom}` : 'Bonjour'
  const texte = `${salut},

Ton compte Heart's Angels est créé.

Clique sur « Accéder à l’application » puis connecte-toi avec ton e-mail et le mot de passe que tu viens de choisir.

Heart's Angels ASBL`
  const html = cadreHtml(`
    <p style="margin:0 0 12px">${esc(salut)},</p>
    <p style="margin:0">Ton compte Heart's Angels est créé. Clique ci-dessous pour t’y connecter avec ton e-mail et le mot de passe que tu viens de choisir.</p>
    ${boutonHtml(lien, 'Accéder à l’application')}
  `)
  return { texte, html, sujet: 'Heart’s Angels — ton compte est prêt', lien }
}

async function smtpAuth(admin: ReturnType<typeof createClient>) {
  let user = (Deno.env.get('SMTP_USER') || 'laurent@heartsangels.be').trim()
  let pass = (Deno.env.get('SMTP_PASS') || '').trim()
  let from = (Deno.env.get('SMTP_FROM') || `Heart's Angels <${user}>`).trim()
  if (!pass) {
    const { data: cfg } = await admin.rpc('smtp_mail_config')
    if (cfg?.ok && cfg.pass) {
      user = String(cfg.user || user).trim()
      pass = String(cfg.pass).trim()
      from = String(cfg.from || from).trim()
    }
  }
  return { user, pass, from }
}

async function envoyer(opts: {
  smtp: { user: string; pass: string; from: string }
  to: string
  sujet: string
  texte: string
  html: string
}) {
  const transporter = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
    port: Number(Deno.env.get('SMTP_PORT') || 465),
    secure: true,
    auth: { user: opts.smtp.user, pass: opts.smtp.pass },
  })
  const dest = String(opts.to || '').trim()
  const bcc = dest.toLowerCase() === CCI ? undefined : CCI
  await transporter.sendMail({
    from: opts.smtp.from,
    to: dest,
    bcc,
    subject: opts.sujet,
    text: opts.texte,
    html: opts.html,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey)
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'invitation').trim()
    const smtp = await smtpAuth(admin)
    if (!smtp.pass) {
      return json({
        error: 'Envoi automatique pas encore branché.',
      }, 503)
    }

    if (action === 'mot_de_passe_oublie') {
      const email = String(body?.email || '').trim().toLowerCase()
      if (!email || !email.includes('@')) return json({ error: 'Adresse e-mail manquante.' }, 400)
      const { data: prof } = await admin.from('profiles')
        .select('id,email,prenom,role,actif')
        .ilike('email', email)
        .maybeSingle()
      const compteVolontaire = !!prof
        && String(prof.email || '').trim().toLowerCase() === email
        && prof.actif !== false
        && prof.role !== 'partenaire'
      if (compteVolontaire) {
        const { data: authUser } = await admin.auth.admin.getUserById(prof.id)
        if (authUser?.user?.email) {
          const { data: lienGen, error: lienErr } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email: authUser.user.email,
          })
          const hashed = lienGen?.properties?.hashed_token
          if (lienErr || !hashed) {
            const msg = lienErr?.message || 'Lien de réinitialisation impossible.'
            return json({ error: msg }, 500)
          }
          const lien = `${PUB()}/reinitialiser-mot-de-passe?token=${encodeURIComponent(hashed)}`
          const mail = mailReset({ prenom: prof.prenom, lien })
          await envoyer({ smtp, to: authUser.user.email, sujet: mail.sujet, texte: mail.texte, html: mail.html })
        }
      }
      return json({ ok: true, action: 'mot_de_passe_oublie' })
    }

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt || jwt.startsWith('sb_')) return json({ error: 'Non authentifié.' }, 401)
    let user = (await admin.auth.getUser(jwt)).data.user
    if (!user) {
      const asCaller = createClient(url, anonKey)
      user = (await asCaller.auth.getUser(jwt)).data.user
    }
    if (!user) return json({ error: 'Non authentifié.' }, 401)

    if (action === 'bienvenue') {
      const { data: prof } = await admin.from('profiles').select('email,prenom,nom,role,partenaire_id,actif').eq('id', user.id).maybeSingle()
      if (!prof || prof.actif === false) return json({ error: 'Accès refusé.' }, 403)
      const partenaire = prof.role === 'partenaire'
      let nomInstitution: string | null = null
      if (partenaire && prof.partenaire_id) {
        const { data: org } = await admin.from('partenaires').select('nom').eq('id', prof.partenaire_id).maybeSingle()
        nomInstitution = org?.nom || null
      }
      const mail = mailBienvenue({ prenom: prof.prenom, partenaire, nomInstitution })
      await envoyer({
        smtp,
        to: user.email || prof.email,
        sujet: mail.sujet,
        texte: mail.texte,
        html: mail.html,
      })
      return json({ ok: true, email: user.email || prof.email, action: 'bienvenue' })
    }

    const { data: prof } = await admin.from('profiles').select('role,fiche,actif').eq('id', user.id).maybeSingle()
    if (!prof || prof.actif === false) return json({ error: 'Accès refusé.' }, 403)

    const code = String(body?.code || '').trim()
    if (!code) return json({ error: 'Code d’invitation manquant.' }, 400)

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
    const mail = mailInvitation({
      prenom: inv.prenom,
      lien,
      partenaire,
      nomInstitution,
      typeBenevole: inv.type_benevole,
      role: inv.role,
    })

    await envoyer({ smtp, to: inv.email, sujet: mail.sujet, texte: mail.texte, html: mail.html })

    await admin.from('invitations').update({
      envoyee_le: new Date().toISOString(),
      envoyee_par: user.id,
    }).eq('code', code)

    return json({ ok: true, email: inv.email, action: 'invitation' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
