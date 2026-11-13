// E-mail professionnel d’institution. Aligné sur public.email_est_professionnel().
const DOMAINES_PERSO = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'hotmail.be',
  'live.com', 'live.fr', 'live.be', 'msn.com',
  'yahoo.com', 'yahoo.fr', 'yahoo.be', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'protonmail.ch',
  'gmx.com', 'gmx.fr', 'gmx.net',
  'mail.com', 'aol.com',
  'skynet.be', 'telenet.be', 'scarlet.be', 'proximus.be', 'voo.be',
  'orange.fr', 'orange.be', 'wanadoo.fr', 'free.fr', 'laposte.net',
  'sfr.fr', 'bbox.fr',
])

export function domaineEmail(email) {
  const d = String(email || '').trim().split('@')[1]
  return d ? d.toLowerCase() : ''
}

export function emailEstProfessionnel(email) {
  const e = String(email || '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false
  return !DOMAINES_PERSO.has(domaineEmail(e))
}

export function emailPartenaireAutorise(email, { fictif, derogation } = {}) {
  if (fictif || derogation) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '').trim())
  }
  return emailEstProfessionnel(email)
}

export const EMAIL_PRO_AIDE =
  'E-mail professionnel de l’institution (pas Gmail, Outlook perso, Yahoo…).'
