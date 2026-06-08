// src/lib/paiement.js
// Génération de la communication structurée belge (+++XXX/XXXX/XXXXX+++)
// et des références de paiement.

// Génère une communication structurée à partir d'un nombre de base (10 chiffres).
// Les 2 derniers chiffres sont le contrôle = base mod 97 (97 si le reste est 0).
export function communicationStructuree(base10) {
  // base10 : chaîne ou nombre de 10 chiffres
  let base = String(base10).replace(/\D/g, '').padStart(10, '0').slice(-10)
  let reste = BigInt(base) % 97n
  let controle = reste === 0n ? 97n : reste
  const ctrl = String(controle).padStart(2, '0')
  const douze = base + ctrl // 12 chiffres
  // Format +++XXX/XXXX/XXXXX+++
  return `+++${douze.slice(0,3)}/${douze.slice(3,7)}/${douze.slice(7,12)}+++`
}

// Construit un nombre de base à partir d'un identifiant d'événement + compteur.
// On veut un nombre stable et unique par inscription.
export function baseDepuisInscription(evenementSeq, inscriptionSeq) {
  // evenementSeq : petit entier (ex: hash court de l'événement, 0-9999)
  // inscriptionSeq : entier croissant (timestamp réduit)
  const ev = String(Math.abs(evenementSeq) % 10000).padStart(4, '0')
  const ins = String(Math.abs(inscriptionSeq) % 1000000).padStart(6, '0')
  return ev + ins // 10 chiffres
}

// Hash court (0-9999) déterministe à partir d'une chaîne (id événement)
export function hashCourt(str) {
  let h = 0
  for (let i = 0; i < String(str).length; i++) {
    h = (h * 31 + String(str).charCodeAt(i)) % 10000
  }
  return h
}

// Communication libre (lisible) en repli si structurée non souhaitée
export function communicationLibre(evenementTitre, nom) {
  return `${(evenementTitre || 'Événement').slice(0, 30)} - ${nom || ''}`.trim()
}