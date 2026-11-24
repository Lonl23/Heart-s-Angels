// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Envoie via le compte Gmail laurent@heartsangels.be.
// Expéditeur visible : app@heartsangels.be (alias).
// Réponses → app@heartsangels.be. Copie cachée vers laurent@heartsangels.be,
// sauf le code de connexion en deux étapes et le rapport médical,
// qui ne sont envoyés qu’au destinataire.
// Les liens ouvrent https://app.heartsangels.be.
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
const URL_APP_PROD = 'https://app.heartsangels.be'

function urlPublique(): string {
  return URL_APP_PROD
}
const ACCENT = '#1BB0CE'
const CCI = 'laurent@heartsangels.be'
const DEPUIS = `Heart's Angels <app@heartsangels.be>`
const REPONSE = 'app@heartsangels.be'

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

function urlInvitation(pub: string, code: string, email: string, partenaire: boolean) {
  const params = new URLSearchParams()
  if (code) params.set('code', code)
  if (email) params.set('email', email)
  const path = partenaire ? '/inscription/partenaire' : '/inscription'
  return `${pub}${path}?${params.toString()}`
}

function urlConnexion(pub: string, partenaire: boolean) {
  return partenaire ? `${pub}/login/partenaire` : `${pub}/login`
}

function estMedical(typeBenevole: string | null, role: string) {
  const t = String(typeBenevole || '')
  return t === 'medical' || t === 'volontaire_medical' || role === 'volontaire_medical'
}

function urlModeEmploi(pub: string, typeBenevole: string | null, role: string) {
  const nom = estMedical(typeBenevole, role)
    ? 'Mode-emploi-volontaire-medical.pdf'
    : 'Mode-emploi-volontaire-non-medical.pdf'
  return `${pub}/guides/${nom}`
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
  pub: string
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
  const lienPdf = urlModeEmploi(opts.pub, opts.typeBenevole, opts.role)
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

function mailCode2fa(opts: { prenom: string | null; code: string }) {
  const salut = opts.prenom ? `Bonjour ${opts.prenom}` : 'Bonjour'
  const texte = `${salut},

Ton code de connexion Heart's Angels : ${opts.code}

Il est valable 10 minutes. Si tu n’as pas demandé ce code, ignore ce message.

Heart's Angels ASBL`
  const html = cadreHtml(`
    <p style="margin:0 0 12px">${esc(salut)},</p>
    <p style="margin:0 0 12px">Ton code de connexion :</p>
    <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:.28em;color:${ACCENT}">${esc(opts.code)}</p>
    <p style="margin:16px 0 0;font-size:14px;color:#5A6F74">Il est valable 10 minutes. Si tu n’es pas à l’origine de cette demande, ignore ce message.</p>
  `)
  return { texte, html, sujet: 'Heart’s Angels — code de connexion' }
}

function mailBienvenue(opts: { prenom: string | null; partenaire: boolean; nomInstitution: string | null; pub: string }) {
  const lien = urlConnexion(opts.pub, opts.partenaire)
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
  let user = (Deno.env.get('SMTP_USER') || CCI).trim()
  const envPass = (Deno.env.get('SMTP_PASS') || '').trim()
  let pass = envPass
  let source: 'env' | 'vault' | 'none' = envPass ? 'env' : 'none'
  if (!pass) {
    const { data: cfg, error: cfgErr } = await admin.rpc('smtp_mail_config')
    if (cfgErr) {
      console.error('smtp_mail_config', cfgErr.message)
    }
    if (cfg?.ok && cfg.pass) {
      user = String(cfg.user || user).trim()
      pass = String(cfg.pass).trim()
      source = 'vault'
    }
  }
  return { user, pass, from: DEPUIS, replyTo: REPONSE, source }
}

function transporteur(smtp: { user: string; pass: string }) {
  return nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
    port: Number(Deno.env.get('SMTP_PORT') || 465),
    secure: true,
    auth: { user: smtp.user, pass: smtp.pass },
  })
}

async function envoyer(opts: {
  smtp: { user: string; pass: string; from: string; replyTo: string }
  to: string
  sujet: string
  texte: string
  html: string
  bcc?: boolean
  priority?: 'high' | 'normal'
  attachments?: { filename: string; content: Uint8Array; contentType?: string }[]
}) {
  const dest = String(opts.to || '').trim()
  const bcc = opts.bcc === false || dest.toLowerCase() === CCI.toLowerCase() ? undefined : CCI
  const high = opts.priority === 'high'
  await transporteur(opts.smtp).sendMail({
    from: opts.smtp.from,
    replyTo: opts.smtp.replyTo,
    to: dest,
    bcc,
    subject: opts.sujet,
    text: opts.texte,
    html: opts.html,
    priority: high ? 'high' : undefined,
    headers: high
      ? { 'X-Priority': '1', 'X-MSMail-Priority': 'High', Importance: 'high' }
      : undefined,
    attachments: (opts.attachments || []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || 'application/octet-stream',
    })),
  })
}

function mailBugHelpdesk(opts: {
  numero: number
  titre: string
  description: string
  auteurNom: string
  auteurEmail: string
  nPieces: number
  pub: string
}) {
  const ref = `B-${opts.numero}`
  const qui = opts.auteurNom || 'Volontaire'
  const mailQui = opts.auteurEmail ? ` (${opts.auteurEmail})` : ''
  const sujet = `[PRIORITÉ] Bug ${ref} — ${opts.titre}`
  const texte = [
    `Bug ${ref} signalé dans le helpdesk.`,
    `Signalé par : ${qui}${mailQui}`,
    '',
    opts.titre,
    '',
    opts.description,
    '',
    opts.nPieces > 0
      ? `${opts.nPieces} capture${opts.nPieces > 1 ? 's' : ''} en pièce jointe.`
      : 'Aucune capture jointe.',
    '',
    `Ouvrir le helpdesk : ${opts.pub}/app/it/helpdesk`,
  ].join('\n')
  const html = cadreHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#B42318;letter-spacing:.04em">BUG PRIORITAIRE</p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(ref)} — ${esc(opts.titre)}</h1>
    <p style="margin:0 0 16px;color:#4A5C61;font-size:15px">
      Signalé par <strong>${esc(qui)}</strong>${opts.auteurEmail ? ` &lt;${esc(opts.auteurEmail)}&gt;` : ''}
    </p>
    <div style="margin:0 0 18px;padding:14px 14px;background:#F7FBFB;border-radius:10px;border:1px solid #E3EBEC;white-space:pre-wrap">${esc(opts.description)}</div>
    <p style="margin:0 0 8px;color:#4A5C61;font-size:14px">
      ${opts.nPieces > 0
        ? `${opts.nPieces} capture${opts.nPieces > 1 ? 's' : ''} en pièce jointe.`
        : 'Aucune capture jointe.'}
    </p>
    ${boutonHtml(`${opts.pub}/app/it/helpdesk`, 'Ouvrir le helpdesk')}
  `)
  return { sujet, texte, html }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey)
    const body = await req.json().catch(() => ({})) as {
      action?: string
      origine?: unknown
      email?: string
      code?: string
      souhait_id?: string
      ticket_id?: string
      html?: string
      texte?: string
      destinataire_prenom?: string
      destinataire_nom?: string
      sujet?: string
    }
    const pub = urlPublique()
    const action = String(body?.action || 'invitation').trim()
    const smtp = await smtpAuth(admin)
    if (!smtp.pass) {
      return json({
        error: 'Envoi automatique pas encore branché.',
        detail: 'Mot de passe SMTP absent (secret Edge SMTP_PASS ou Vault ha_smtp_pass).',
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
          const lien = `${pub}/reinitialiser-mot-de-passe?token=${encodeURIComponent(hashed)}`
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

    // Diagnostic IT : vérifie l’auth Gmail sans envoyer de message.
    if (action === 'ping_smtp') {
      const { data: profPing } = await admin.from('profiles').select('role,fiche,actif').eq('id', user.id).maybeSingle()
      if (!profPing || profPing.actif === false || !peutGererApp(profPing.role, profPing.fiche)) {
        return json({ error: 'Accès refusé.' }, 403)
      }
      try {
        await transporteur(smtp).verify()
        return json({
          ok: true,
          action: 'ping_smtp',
          user: smtp.user,
          from: smtp.from,
          source: smtp.source,
          host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
        })
      } catch (envoi) {
        const msg = envoi instanceof Error ? envoi.message : String(envoi)
        console.error('ping_smtp', smtp.source, smtp.user, msg)
        return json({
          ok: false,
          action: 'ping_smtp',
          user: smtp.user,
          from: smtp.from,
          source: smtp.source,
          error: msg,
        }, 500)
      }
    }

    if (action === 'code_2fa') {
      const { data: prof } = await admin.from('profiles')
        .select('email,prenom,actif')
        .eq('id', user.id)
        .maybeSingle()
      if (!prof || prof.actif === false) return json({ error: 'Accès refusé.' }, 403)
      const dest = String(user.email || '').trim()
      if (!dest) return json({ error: 'Aucune adresse e-mail de connexion.' }, 400)
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
      const { data: pose, error: poseErr } = await admin.rpc('poser_code_email_2fa', {
        p_user: user.id,
        p_code: code,
      })
      if (poseErr || !pose?.ok) {
        const msg = pose?.erreur || 'Envoi impossible.'
        return json({ error: msg, attente: pose?.attente ?? null }, poseErr ? 500 : 429)
      }
      const mail = mailCode2fa({ prenom: prof.prenom, code })
      try {
        await envoyer({
          smtp,
          to: dest,
          sujet: mail.sujet,
          texte: mail.texte,
          html: mail.html,
          bcc: false,
        })
      } catch (envoi) {
        await admin.from('mfa_email_codes').delete().eq('user_id', user.id)
        const msg = envoi instanceof Error ? envoi.message : String(envoi)
        return json({ error: msg }, 500)
      }
      return json({ ok: true, action: 'code_2fa' })
    }

    if (action === 'bienvenue') {
      const { data: prof } = await admin.from('profiles').select('email,prenom,nom,role,partenaire_id,actif').eq('id', user.id).maybeSingle()
      if (!prof || prof.actif === false) return json({ error: 'Accès refusé.' }, 403)
      const partenaire = prof.role === 'partenaire'
      let nomInstitution: string | null = null
      if (partenaire && prof.partenaire_id) {
        const { data: org } = await admin.from('partenaires').select('nom').eq('id', prof.partenaire_id).maybeSingle()
        nomInstitution = org?.nom || null
      }
      const mail = mailBienvenue({ prenom: prof.prenom, partenaire, nomInstitution, pub })
      await envoyer({
        smtp,
        to: user.email || prof.email,
        sujet: mail.sujet,
        texte: mail.texte,
        html: mail.html,
      })
      return json({ ok: true, email: user.email || prof.email, action: 'bienvenue' })
    }

    if (action === 'rapport_medical') {
      const souhaitId = String(body?.souhait_id || '').trim()
      const dest = String(body?.email || '').trim()
      const destinatairePrenom = String(body?.destinataire_prenom || '').trim()
      const destinataireNom = String(body?.destinataire_nom || '').trim()
      const htmlBrut = String(body?.html || '')
      const texteBrut = String(body?.texte || '').trim() || 'Rapport médical — Heart’s Angels.'
      if (!souhaitId) return json({ error: 'Souhait manquant.' }, 400)
      if (!dest.includes('@')) return json({ error: 'Adresse e-mail manquante.' }, 400)
      if (!destinatairePrenom || !destinataireNom) {
        return json({ error: 'Indiquez le prénom et le nom du destinataire.' }, 400)
      }
      if (!htmlBrut) return json({ error: 'Rapport vide.' }, 400)
      const { data: autorise, error: authz } = await admin.rpc('autoriser_envoi_rapport', {
        p_souhait: souhaitId,
        p_user: user.id,
      })
      if (authz || autorise !== true) return json({ error: 'Envoi non autorisé.' }, 403)
      const alerteTxt =
        'DOCUMENT MÉDICAL STRICTEMENT CONFIDENTIEL.\n' +
        'Ce message est destiné uniquement au destinataire indiqué. S’il vous a été adressé par erreur, ' +
        'vous devez immédiatement le supprimer (y compris toute copie ou pièce jointe), n’en conserver aucune trace, ' +
        'et reprendre contact sans délai avec Heart’s Angels en répondant à cet e-mail (app@heartsangels.be).'
      const alerteHtml =
        '<div style="background:#FCEBEB;border:2px solid #A32D2D;padding:14px 16px;margin:0 0 18px;color:#7A1F1F;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45">' +
        '<strong>DOCUMENT MÉDICAL STRICTEMENT CONFIDENTIEL</strong><br/>' +
        'Ce message est destiné uniquement au destinataire indiqué. S’il vous a été adressé par erreur, ' +
        'vous devez <strong>immédiatement le supprimer</strong> (y compris toute copie ou pièce jointe), ' +
        'n’en conserver aucune trace, et <strong>reprendre contact sans délai</strong> avec Heart’s Angels ' +
        'en répondant à cet e-mail (<a href="mailto:app@heartsangels.be">app@heartsangels.be</a>).' +
        '</div>'
      // Toujours injecter dans <body> — jamais avant <!doctype>, sinon Gmail casse le HTML.
      const html = (() => {
        if (htmlBrut.includes('DOCUMENT MÉDICAL STRICTEMENT CONFIDENTIEL')) return htmlBrut
        const bodyOpen = htmlBrut.match(/<body[^>]*>/i)
        if (bodyOpen && bodyOpen.index != null) {
          const i = bodyOpen.index + bodyOpen[0].length
          return htmlBrut.slice(0, i) + alerteHtml + htmlBrut.slice(i)
        }
        return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body>${alerteHtml}${htmlBrut}</body></html>`
      })()
      const texte = texteBrut.includes('DOCUMENT MÉDICAL STRICTEMENT CONFIDENTIEL')
        ? texteBrut
        : `${alerteTxt}\n\n${texteBrut}`
      const { data: souch } = await admin
        .from('souhaits')
        .select('beneficiaire_prenom, beneficiaire_nom, date_souhaitee, date_fin')
        .eq('id', souhaitId)
        .maybeSingle()
      const nomBenef = [souch?.beneficiaire_prenom, souch?.beneficiaire_nom].filter(Boolean).join(' ').trim()
        || 'Bénéficiaire'
      const rawDate = String(souch?.date_souhaitee || souch?.date_fin || '').slice(0, 10)
      let dateLib = 'date non précisée'
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [y, mo, d] = rawDate.split('-').map(Number)
        dateLib = new Date(Date.UTC(y, mo - 1, d, 12)).toLocaleDateString('fr-BE', { timeZone: 'Europe/Brussels' })
      }
      const sujetClient = String(body?.sujet || '').trim()
      const sujet = sujetClient
        || `${nomBenef} : Rapport médical du souhait en date du ${dateLib}`
      await envoyer({ smtp, to: dest, sujet, texte, html, bcc: false })
      const { error: traceErr } = await admin.from('envois_rapport_medical').insert({
        souhait_id: souhaitId,
        expediteur_id: user.id,
        email: dest,
        destinataire_prenom: destinatairePrenom,
        destinataire_nom: destinataireNom,
      })
      if (traceErr) return json({ error: 'Le message est parti, la trace n’a pas pu être enregistrée.' }, 500)
      return json({ ok: true, action: 'rapport_medical' })
    }

    // Bug helpdesk → mail prioritaire à Laurent, avec captures en PJ.
    if (action === 'helpdesk_bug') {
      const ticketId = String(body?.ticket_id || '').trim()
      if (!ticketId) return json({ error: 'Ticket manquant.' }, 400)
      const { data: detail, error: detErr } = await admin.rpc('helpdesk_bug_pour_mail', {
        p_ticket: ticketId,
        p_user: user.id,
      })
      if (detErr || !detail?.ok) {
        return json({ error: detail?.error || detErr?.message || 'Ticket inaccessible.' }, 403)
      }
      const pieces = Array.isArray(detail.pieces) ? detail.pieces : []
      const attachments: { filename: string; content: Uint8Array; contentType?: string }[] = []
      for (let i = 0; i < pieces.length; i++) {
        const pe = pieces[i] as { path?: string; nom?: string; mime?: string }
        const path = String(pe?.path || '').trim()
        if (!path) continue
        const { data: blob, error: dlErr } = await admin.storage.from('helpdesk-captures').download(path)
        if (dlErr || !blob) {
          console.error('helpdesk_bug download', path, dlErr?.message)
          continue
        }
        const buf = new Uint8Array(await blob.arrayBuffer())
        const base = String(pe?.nom || `capture-${i + 1}.jpg`).replace(/[^\w.\- ()àâäéèêëïîôùûüç]+/gi, '_')
        attachments.push({
          filename: base || `capture-${i + 1}.jpg`,
          content: buf,
          contentType: String(pe?.mime || 'image/jpeg'),
        })
      }
      const mail = mailBugHelpdesk({
        numero: Number(detail.numero) || 0,
        titre: String(detail.titre || ''),
        description: String(detail.description || ''),
        auteurNom: String(detail.auteur_nom || ''),
        auteurEmail: String(detail.auteur_email || user.email || ''),
        nPieces: attachments.length,
        pub,
      })
      await envoyer({
        smtp,
        to: CCI,
        sujet: mail.sujet,
        texte: mail.texte,
        html: mail.html,
        bcc: false,
        priority: 'high',
        attachments,
      })
      return json({ ok: true, action: 'helpdesk_bug', pieces: attachments.length })
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

    const lien = urlInvitation(pub, inv.code, inv.email, partenaire)
    const mail = mailInvitation({
      prenom: inv.prenom,
      lien,
      partenaire,
      nomInstitution,
      typeBenevole: inv.type_benevole,
      role: inv.role,
      pub,
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
