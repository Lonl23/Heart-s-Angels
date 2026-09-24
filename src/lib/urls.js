import config from '@/app.config'

/** Origine publique (domaine configuré, sinon la fenêtre). Toujours le site, pas capacitor://. */
export function urlBasePublique() {
  const fromConfig = String(config.domaine || '').trim().replace(/\/$/, '')
  const fromWindow = typeof window !== 'undefined' ? window.location.origin : ''
  return fromConfig || fromWindow || 'https://heart-s-angels.web.app'
}

/** Adresse publique de l’espace partenaire, à coller sur le site ou à envoyer. */
export function urlAccesPartenaire() {
  return `${urlBasePublique()}/login/partenaire`
}

/** Lien d’inscription : le destinataire n’a plus qu’à choisir son mot de passe. */
export function urlInvitation(code, email, { partenaire = false } = {}) {
  const params = new URLSearchParams()
  const c = String(code || '').trim()
  const e = String(email || '').trim()
  if (c) params.set('code', c)
  if (e) params.set('email', e)
  const path = partenaire ? '/inscription/partenaire' : '/inscription'
  const q = params.toString()
  return q ? `${urlBasePublique()}${path}?${q}` : `${urlBasePublique()}${path}`
}

/** Texte prêt à coller dans un e-mail (envoi manuel tant qu’il n’y a pas de SMTP). */
export function messageInvitation({ prenom, lien, partenaire, nomInstitution } = {}) {
  if (partenaire) {
    const inst = nomInstitution ? ` « ${nomInstitution} »` : ''
    return `Bonjour${prenom ? ` ${prenom}` : ''},

Votre institution${inst} est reconnue comme partenaire de Heart's Angels.

Activez l’accès en choisissant un mot de passe (lien valable 7 jours) :

${lien || ''}

Ensuite, connectez-vous sur l’espace partenaires avec :
- le nom exact de l’institution
- votre e-mail professionnel
- le mot de passe que vous venez de choisir

Heart's Angels ASBL`
  }
  const salut = prenom ? `Bonjour ${prenom},` : 'Bonjour,'
  return `${salut}

Voici ton lien pour créer ton compte Heart's Angels (valable 7 jours) :

${lien || ''}

Il te suffit de choisir un mot de passe. Si le lien ne s’ouvre pas, va sur l’écran de connexion et utilise « J’ai une invitation ».

Heart's Angels ASBL`
}

export async function copierTexte(texte) {
  const t = String(texte || '')
  if (!t) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t)
      return true
    }
  } catch { /* repli ci-dessous */ }
  try {
    const el = document.createElement('textarea')
    el.value = t
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
