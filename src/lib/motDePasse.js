// Mot de passe institution / inscription : 10 caractères, majuscule, minuscule, chiffre, spécial.
export const MDP_AIDE = '10 caractères min., dont une majuscule, une minuscule, un chiffre et un caractère spécial.'

export function motDePasseValide(p) {
  const s = String(p || '')
  return s.length >= 10
    && /[A-Z]/.test(s)
    && /[a-z]/.test(s)
    && /[0-9]/.test(s)
    && /[^A-Za-z0-9]/.test(s)
}

export function motDePasseErreur(p) {
  if (motDePasseValide(p)) return null
  return `Mot de passe trop faible. ${MDP_AIDE}`
}

export function genCodeInvitation() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bloc = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `HA-${bloc()}-${bloc()}`
}
