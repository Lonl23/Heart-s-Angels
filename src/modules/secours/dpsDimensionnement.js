/**
 * Dimensionnement DPS (indicateurs type RNMSC-DPS / arrêté 7 nov. 2006).
 * Aide à la décision — l’autorité compétente reste décisionnaire.
 */

export const P2_ACTIVITE = [
  { v: 'assis', l: 'Assis', detail: 'Spectacles, cérémonies culturelles, réunions publiques…', poids: 0.25 },
  { v: 'debout_1', l: 'Debout 1', detail: 'Cérémonies, expositions, foires…', poids: 0.30 },
  { v: 'debout_2', l: 'Debout 2', detail: 'Spectacle public statique, carnaval, sport sans protection publique…', poids: 0.35 },
  { v: 'debout_3', l: 'Debout 3', detail: 'Public dynamique (danse, fête de rue, défilé) ou multi-jours avec hébergement', poids: 0.40 },
]

export const E1_ENVIRONNEMENT = [
  { v: 'dur', l: 'Bâtiment / salle en dur', detail: 'Voies publiques, accès clairs et faciles', poids: 0.25 },
  { v: 'non_permanent', l: 'Structures non permanentes', detail: 'Gradins, chapiteaux ; ≤ 2 ha ; brancardage 150–300 m', poids: 0.30 },
  { v: 'nature_2_5', l: 'Espace naturel 2–5 ha', detail: 'Brancardage 300–600 m ; accès difficiles', poids: 0.35 },
  { v: 'nature_5', l: 'Espace naturel > 5 ha', detail: 'Brancardage > 600 m ; pentes, escaliers, public gênant', poids: 0.40 },
]

export const E2_DELAI = [
  { v: 'd10', l: '≤ 10 minutes', poids: 0.25 },
  { v: 'd20', l: '10 à 20 minutes', poids: 0.30 },
  { v: 'd30', l: '20 à 30 minutes', poids: 0.35 },
  { v: 'd30p', l: '> 30 minutes', poids: 0.40 },
]

export const DPS_DIMENSION_VIDE = {
  public_declare: 0,
  acteurs_equivalent: 0,
  acteurs_descriptif: '',
  p2: '',
  e1: '',
  e2: '',
}

export function poidsDe(liste, v) {
  return liste.find(x => x.v === v)?.poids ?? null
}

/**
 * i = (N / 1000) × P2 × E1 × E2
 * secouristes_public ≈ ceil(i) (plancher 0)
 * encadrement ≈ ceil(secouristes / 10) si secouristes ≥ 4
 */
export function calculerDimensionnement(dim) {
  const n = Math.max(0, Number(dim?.public_declare) || 0)
  const acteurs = Math.max(0, Number(dim?.acteurs_equivalent) || 0)
  const p2 = poidsDe(P2_ACTIVITE, dim?.p2)
  const e1 = poidsDe(E1_ENVIRONNEMENT, dim?.e1)
  const e2 = poidsDe(E2_DELAI, dim?.e2)
  const complet = p2 != null && e1 != null && e2 != null
  const indice = complet ? (n / 1000) * p2 * e1 * e2 : 0
  const secouristesPublic = complet ? Math.ceil(indice) : 0
  const encadrement = secouristesPublic >= 4 ? Math.max(1, Math.ceil(secouristesPublic / 10)) : 0
  const total = secouristesPublic + acteurs + encadrement
  let message = 'Cf. autorité compétente.'
  if (!complet) message = 'Sélectionnez P2, E1 et E2 pour obtenir une estimation.'
  else if (secouristesPublic === 0 && acteurs === 0) message = 'Cf. autorité compétente. Pas de dispositif minimal estimé.'
  else message = `Indice i ≈ ${indice.toFixed(3)}. Estimation indicative — valider avec l’autorité compétente.`
  return {
    complet,
    indice,
    secouristesPublic,
    acteurs,
    encadrement,
    total,
    message,
    p2,
    e1,
    e2,
  }
}

export function normaliserDimensionnement(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  return {
    public_declare: Number.isFinite(Number(d.public_declare)) ? Math.max(0, Math.floor(Number(d.public_declare))) : 0,
    acteurs_equivalent: Number.isFinite(Number(d.acteurs_equivalent)) ? Math.max(0, Math.floor(Number(d.acteurs_equivalent))) : 0,
    acteurs_descriptif: typeof d.acteurs_descriptif === 'string' ? d.acteurs_descriptif.slice(0, 2000) : '',
    p2: P2_ACTIVITE.some(x => x.v === d.p2) ? d.p2 : '',
    e1: E1_ENVIRONNEMENT.some(x => x.v === d.e1) ? d.e1 : '',
    e2: E2_DELAI.some(x => x.v === d.e2) ? d.e2 : '',
  }
}
