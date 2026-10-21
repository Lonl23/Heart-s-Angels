// Titre du bloc « Coordination médicale » (contacts de mission).
// Le siège ASBL est partagé. La qualification de la fiche décide du métier.
// Un médecin reste « Médecin coordinateur ». Un infirmier ou une infirmière
// n’est pas présenté comme médecin.

const MASCULINS_EN_E = new Set([
  'andre', 'antoine', 'alexandre', 'auguste', 'baptiste', 'claude',
  'dominique', 'eustache', 'guillaume', 'herve', 'hippolyte', 'jerome',
  'maxime', 'pascal', 'philippe', 'pierre', 'rene', 'stephane',
])

function sansAccent(s) {
  return String(s || '')
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/** Vrai pour un prénom féminin usuel (Sylvie). Ludovic reste masculin. */
export function prenomFeminin(prenom) {
  const p = sansAccent(prenom)
  if (!p || MASCULINS_EN_E.has(p)) return false
  return /[ae]$/.test(p)
}

function qualificationsDe(personne) {
  const brut = personne?.qualifications
  if (Array.isArray(brut)) return brut
  if (typeof brut === 'string') {
    try {
      const p = JSON.parse(brut)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

export function detailCoordinationMedicale(personne) {
  const qs = qualificationsDe(personne)
  if (qs.includes('medecin')) return 'Médecin coordinateur / coordination médicale'
  if (qs.includes('infirmier')) {
    return prenomFeminin(personne?.prenom)
      ? 'Infirmière de la coordination médicale'
      : 'Infirmier de la coordination médicale'
  }
  return 'Coordination médicale'
}
