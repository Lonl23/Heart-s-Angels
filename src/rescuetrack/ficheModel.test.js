import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  estPreventif,
  sexeVersCode,
  sexeDepuisCode,
  etiquettesDispositifs,
  codesDispositifs,
  statutPreventif,
  libelleIdentite,
  heureLocaleVersIso,
  isoVersChampHeure,
  formaterDateHeure,
  payloadFiche,
  erreursFiche,
  LIBELLES_DISPOSITIF,
} from './ficheModel.js'

test('le module ne charge pas de client', () => {
  const src = readFileSync(new URL('./ficheModel.js', import.meta.url), 'utf8')
  assert.equal(/from\s+['"][^'"]*supabase/i.test(src), false)
  assert.equal(/require\(\s*['"][^'"]*supabase/i.test(src), false)
})

test('estPreventif reconnaît le type ou un dispositif', () => {
  assert.equal(estPreventif({ type: 'preventif', dispositif: null, dispositifs: [] }), true)
  assert.equal(estPreventif({ type: 'activite', dispositif: 'ps', dispositifs: ['ps'] }), true)
  assert.equal(estPreventif({ type: 'activite', dispositif: null, dispositifs: ['paps'] }), true)
  assert.equal(estPreventif({ type: 'activite', dispositif: null, dispositifs: [] }), false)
  assert.equal(estPreventif({ type: 'garde' }), false)
  assert.equal(estPreventif(null), false)
})

test('le sexe Homme/Femme/Indéterminé/X correspond à M/F/inconnu/X', () => {
  assert.equal(sexeVersCode('Homme'), 'M')
  assert.equal(sexeVersCode('Femme'), 'F')
  assert.equal(sexeVersCode('Indéterminé'), 'inconnu')
  assert.equal(sexeVersCode('X'), 'X')
  assert.equal(sexeVersCode('autre'), null)
  assert.equal(sexeDepuisCode('M'), 'Homme')
  assert.equal(sexeDepuisCode('F'), 'Femme')
  assert.equal(sexeDepuisCode('inconnu'), 'Indéterminé')
  assert.equal(sexeDepuisCode('X'), 'X')
})

test('les dispositifs en double sont numérotés PAPS 1, PAPS 2', () => {
  const et = etiquettesDispositifs(['paps', 'paps', 'ps'])
  assert.deepEqual(et.map(e => e.label), ['PAPS 1', 'PAPS 2', 'Poste de secours'])
  assert.deepEqual(et.map(e => e.index), [0, 1, 2])
  assert.equal(etiquettesDispositifs(['echo'])[0].label, 'Écho')
  assert.equal(etiquettesDispositifs(['pma_cat2'])[0].label, 'PMA cat. 2')
  assert.equal(etiquettesDispositifs(['pma_cat1'])[0].label, 'PMA cat. 1')
  assert.equal(etiquettesDispositifs(['pma_cat0'])[0].label, 'PMA cat. 0')
  assert.equal(etiquettesDispositifs(['ambu_112'])[0].label, 'Ambulance 112')
  assert.equal(etiquettesDispositifs(['ambu'])[0].label, 'Ambulance')
  assert.equal(etiquettesDispositifs(['ps'])[0].label, LIBELLES_DISPOSITIF.ps)
  assert.deepEqual(
    codesDispositifs({ dispositifs: ['paps', 'paps'], dispositif: 'ps' }),
    ['paps', 'paps'],
  )
  assert.deepEqual(codesDispositifs({ dispositifs: [], dispositif: 'ambu' }), ['ambu'])
})

test('le statut sépare en cours, à venir et passés', () => {
  const maintenant = new Date('2026-11-15T12:00:00Z')
  assert.equal(statutPreventif({ debut: '2026-11-20T12:00:00Z' }, maintenant), 'a_venir')
  assert.equal(statutPreventif({ debut: '2026-11-15T08:00:00Z', fin: '2026-11-15T18:00:00Z' }, maintenant), 'en_cours')
  assert.equal(statutPreventif({ debut: '2026-11-01T08:00:00Z', fin: '2026-11-02T18:00:00Z' }, maintenant), 'passe')
})

test('l’identité inconnue n’affiche pas de nom', () => {
  assert.equal(libelleIdentite({ nom: 'X', prenom: 'Y', contenu: { identite_inconnue: true } }), '« identité inconnue »')
  assert.equal(libelleIdentite({ nom: 'Martin', prenom: 'Léa', contenu: {} }), 'Martin Léa')
  assert.equal(libelleIdentite({ nom: null, prenom: null, contenu: {} }), '« identité inconnue »')
})

test('les heures de saisie sont celles de Bruxelles', () => {
  assert.equal(heureLocaleVersIso('2026-01-15T14:30'), '2026-01-15T13:30:00.000Z')
  assert.equal(heureLocaleVersIso('2026-07-15T14:30'), '2026-07-15T12:30:00.000Z')
  assert.equal(isoVersChampHeure('2026-01-15T13:30:00.000Z'), '2026-01-15T14:30')
  assert.match(formaterDateHeure('2026-01-15T13:30:00.000Z'), /15\/01\/2026/)
  assert.match(formaterDateHeure('2026-01-15T13:30:00.000Z'), /14:30/)
})

test('le payload met les champs cliniques dans contenu et les colonnes à part', () => {
  const payload = payloadFiche({
    identiteInconnue: false,
    sexe: 'Femme',
    nom: ' Martin ',
    prenom: 'Léa',
    dateNaissance: '1990-04-02',
    nationalite: 'BE',
    numeroNational: '90.04.02-123.45',
    adresse: 'Rue du Test 1',
    cp: '4000',
    localite: 'Liège',
    triage: 'U2',
    pathologie: 'Trauma',
    motif: 'Chute',
    remarques: 'Consciente',
    orientation: 'sur place',
    heureDebut: '2026-07-15T14:30',
    heureFin: '2026-07-15T15:00',
    dispositifCode: 'paps',
    dispositifIndex: 1,
  })
  assert.equal(payload.nom, 'Martin')
  assert.equal(payload.sexe, 'F')
  assert.equal(payload.motifs, 'Chute')
  assert.equal(payload.notes, 'Consciente')
  assert.equal(payload.heureDebut, '2026-07-15T12:30:00.000Z')
  assert.equal(payload.contenu.triage, 'U2')
  assert.equal(payload.contenu.pathologie, 'Trauma')
  assert.equal(payload.contenu.dispositif, 'paps')
  assert.equal(payload.contenu.dispositif_index, 1)
  assert.equal(payload.contenu.numero_national, '90.04.02-123.45')

  const inconnue = payloadFiche({
    identiteInconnue: true,
    sexe: 'Indéterminé',
    nom: 'Doe',
    prenom: 'Jane',
    numeroNational: 'ne-doit-pas-partir',
    triage: 'U3NH',
    dispositifCode: 'ps',
    dispositifIndex: 0,
  })
  assert.equal(inconnue.nom, null)
  assert.equal(inconnue.prenom, null)
  assert.equal(inconnue.sexe, 'inconnu')
  assert.equal(inconnue.contenu.identite_inconnue, true)
  assert.equal(inconnue.contenu.numero_national, undefined)
})

test('la fiche exige un triage et un dispositif quand il y en a', () => {
  const etiquettes = etiquettesDispositifs(['paps', 'paps'])
  assert.deepEqual(erreursFiche({ identiteInconnue: true }, etiquettes), [
    'Choisissez un triage.',
    'Choisissez le dispositif.',
  ])
  assert.deepEqual(erreursFiche({
    identiteInconnue: true,
    triage: 'U1',
    dispositifCode: 'paps',
    dispositifIndex: 0,
  }, etiquettes), [])
})
