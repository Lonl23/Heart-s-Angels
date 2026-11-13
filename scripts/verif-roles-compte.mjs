// Vérifie le split rôle de compte / qualifications (sans toucher à la base).
import {
  personneEstMedicale, qualsImplicites, ROLES_COMPTE, QUALIFS, lblRoleCompte,
} from '../src/modules/fiche/ficheSchema.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const quals = new Set(QUALIFS.map(q => q.v))
for (const q of ['infirmier', 'medecin', 'ambulancier']) {
  assert(quals.has(q), `${q} doit rester une qualification`)
  assert(!ROLES_COMPTE.some(r => r.v === q), `${q} ne doit pas être un rôle de compte`)
}
assert(!ROLES_COMPTE.some(r => r.v.startsWith('ambulancier_')), 'ambulancier_* hors rôle de compte')
for (const v of ['admin', 'president', 'coordinateur', 'tresorier', 'secretaire', 'volontaire_medical', 'volontaire_non_medical']) {
  assert(ROLES_COMPTE.some(r => r.v === v), `${v} doit rester un rôle de compte`)
}

const veronique = {
  role: 'volontaire_non_medical',
  fiche: { type_benevole: 'non_medical', qualifications: [], roles_asbl: ['recolteur_souhait'] },
}
assert(!personneEstMedicale(veronique), 'Véronique (non médical) ne doit pas être classée médicale')

const infi = {
  role: 'volontaire_medical',
  fiche: { type_benevole: 'medical', qualifications: ['infirmier'] },
}
assert(personneEstMedicale(infi), 'Un volontaire médical infirmier doit rester médical')
assert(qualsImplicites(infi.role, infi.fiche).includes('infirmier'), 'qualif infirmier lue depuis la fiche')
assert(!qualsImplicites('volontaire_medical', infi.fiche).includes('medecin'), 'pas de médecin implicite')

const admin = { role: 'admin', fiche: { type_benevole: 'medical', qualifications: ['ambulancier'] } }
assert(personneEstMedicale(admin), 'admin médical reste médical via type_benevole')

assert(lblRoleCompte('president') === 'Président', 'libellé président')
assert(lblRoleCompte('volontaire_non_medical') === 'Volontaire non médical', 'libellé VNM')

console.log('ok — split rôle de compte / qualifications')
