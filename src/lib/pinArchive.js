/** PIN d’ouverture des dossiers archivés : 5 chiffres, sans suite, miroir ni doublon collé. */

export const PIN_LONGUEUR = 5

export const PIN_REGLES =
  '5 chiffres. Pas de suite (12345), pas de miroir (12321), pas deux fois le même chiffre d’affilée (11234).'

export function chiffresPin(brut) {
  return String(brut || '').replace(/\D/g, '').slice(0, PIN_LONGUEUR)
}

export function validerPinArchive(pin) {
  const p = chiffresPin(pin)
  if (p.length !== PIN_LONGUEUR) return 'Le code doit contenir exactement 5 chiffres.'
  for (let i = 1; i < p.length; i++) {
    if (p[i] === p[i - 1]) return 'Deux chiffres identiques ne peuvent pas se suivre.'
  }
  if (p === [...p].reverse().join('')) return 'Le code ne peut pas être un nombre miroir.'
  const diffs = []
  for (let i = 1; i < p.length; i++) diffs.push(Number(p[i]) - Number(p[i - 1]))
  if (diffs.every(d => d === 1) || diffs.every(d => d === -1)) {
    return 'Le code ne peut pas être une suite de chiffres.'
  }
  return null
}
