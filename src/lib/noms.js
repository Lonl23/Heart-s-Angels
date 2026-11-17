/** Normalisation des noms / prénoms (souhaits, annuaire). */

function partiesNom(s) {
  return String(s || '')
    .trim()
    .split(/([\s\-']+)/)
    .filter(Boolean)
}

/** Prénom : 1ʳᵉ lettre de chaque partie en majuscule, reste en minuscule (Jean-Pierre, Marie-Claire). */
export function formaterPrenom(v) {
  const raw = String(v || '').trim()
  if (!raw) return ''
  return partiesNom(raw)
    .map(p => {
      if (/^[\s\-']+$/.test(p)) return p
      const lower = p.toLocaleLowerCase('fr-BE')
      return lower.charAt(0).toLocaleUpperCase('fr-BE') + lower.slice(1)
    })
    .join('')
}

/** Nom de famille : entièrement en majuscules. */
export function formaterNom(v) {
  const raw = String(v || '').trim()
  if (!raw) return ''
  return raw.toLocaleUpperCase('fr-BE')
}

export function formaterPrenomNom(prenom, nom) {
  return {
    prenom: formaterPrenom(prenom),
    nom: formaterNom(nom),
  }
}
