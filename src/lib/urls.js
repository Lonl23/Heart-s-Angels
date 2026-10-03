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

/** Écran de connexion public (volontaire ou partenaire). */
export function urlConnexion({ partenaire = false } = {}) {
  return partenaire ? `${urlBasePublique()}/login/partenaire` : `${urlBasePublique()}/login`
}

export function urlModeEmploi(typeBenevole) {
  const t = String(typeBenevole || '')
  const medical = t === 'medical' || t === 'volontaire_medical'
  const fichier = medical
    ? 'Mode-emploi-volontaire-medical.pdf'
    : 'Mode-emploi-volontaire-non-medical.pdf'
  return `${urlBasePublique()}/guides/${fichier}`
}

function libellePdfVolontaire(typeBenevole) {
  const t = String(typeBenevole || '')
  if (t === 'medical' || t === 'volontaire_medical') return 'du volontaire médical'
  if (t === 'non_medical' || t === 'volontaire_non_medical') return 'du volontaire non médical'
  return 'du volontaire (médical ou non médical, selon le type de l’invitation)'
}

/** Texte du mail d’invitation (envoi auto HTML : bouton « Crée ton compte »). */
export function messageInvitation({ prenom, partenaire, nomInstitution, typeBenevole } = {}) {
  if (partenaire) {
    const inst = nomInstitution ? ` « ${nomInstitution} »` : ''
    return `Bonjour${prenom ? ` ${prenom}` : ''},

Votre institution${inst} est reconnue comme partenaire de Heart's Angels.

Cliquez sur « Activer l’accès » dans le mail (valable 7 jours) pour choisir un mot de passe.

Ensuite, connectez-vous avec le nom exact de l’institution, votre e-mail professionnel et ce mot de passe.

Heart's Angels ASBL`
  }
  const salut = prenom ? `Bonjour ${prenom},` : 'Bonjour,'
  return `${salut}

Pour créer ton compte Heart's Angels, clique sur « Crée ton compte » dans le mail (valable 7 jours). Il te suffit ensuite de choisir un mot de passe.

Le mode d’emploi ${libellePdfVolontaire(typeBenevole)} se télécharge via le bouton du mail.

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
