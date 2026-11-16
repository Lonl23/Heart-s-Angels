import { normaliserNiss } from '@/modules/annuaire/annuaireSchema'

/**
 * Décode un numéro national belge (11 chiffres) → date de naissance + sexe.
 * Le NN est facultatif (nationalité étrangère).
 * Retourne null si le numéro est absent ou invalide.
 */
export function decoderNiss(v) {
  const d = normaliserNiss(v)
  if (d.length !== 11) return null

  const yy = Number(d.slice(0, 2))
  const mm = Number(d.slice(2, 4))
  const dd = Number(d.slice(4, 6))
  const seq = Number(d.slice(6, 9))
  const check = Number(d.slice(9, 11))
  if (!mm || mm > 12 || !dd || dd > 31) return null

  const base19 = Number(d.slice(0, 9))
  const base20 = Number(`2${d.slice(0, 9)}`)
  const ok19 = (97 - (base19 % 97)) === check
  const ok20 = (97 - (base20 % 97)) === check

  let year
  if (ok20 && !ok19) year = 2000 + yy
  else if (ok19 && !ok20) year = 1900 + yy
  else if (ok19 && ok20) year = yy <= 24 ? 2000 + yy : 1900 + yy
  else year = yy <= 30 ? 2000 + yy : 1900 + yy

  const mois = String(mm).padStart(2, '0')
  const jour = String(dd).padStart(2, '0')
  return {
    date_naissance: `${year}-${mois}-${jour}`,
    genre: seq % 2 === 1 ? 'homme' : 'femme',
    checksum_ok: ok19 || ok20,
  }
}
