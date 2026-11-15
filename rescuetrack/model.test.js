import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estPreventif, provinceDepuisCp, unitesDuPreventif, codePatient, echapper, statutPreventif, ficheVersPatient,
} from '../public/rescuetrack/model.js'

test('une activité sans dispositif n’est pas un préventif', () => {
  assert.equal(estPreventif({ type: 'garde', dispositifs: [] }), false)
  assert.equal(estPreventif({ type: 'transport', dispositif: null, dispositifs: [] }), false)
})

test('un préventif se reconnaît au type ou au dispositif', () => {
  assert.equal(estPreventif({ type: 'preventif', dispositifs: [] }), true)
  assert.equal(estPreventif({ type: 'activite', dispositifs: ['ps'] }), true)
})

test('le code postal belge donne la province', () => {
  assert.equal(provinceDepuisCp('4000'), 'Liège')
  assert.equal(provinceDepuisCp('B-1000'), 'Bruxelles')
  assert.equal(provinceDepuisCp('6600'), 'Luxembourg')
  assert.equal(provinceDepuisCp(''), '')
})

test('les dispositifs en double sont numérotés', () => {
  assert.deepEqual(unitesDuPreventif({ dispositifs: ['paps', 'paps', 'ps'] }).map(u => u.name), ['PAPS 1', 'PAPS 2', 'Poste de secours'])
})

test('le code patient reste dans le format RescueTrack', () => {
  assert.equal(codePatient('26', 'Liège', 8, 1), '26LIE008001')
})

test('le texte affiché est échappé', () => {
  assert.equal(echapper('<b>'), '&lt;b&gt;')
})

test('le statut suit les dates du préventif', () => {
  const maintenant = new Date('2026-11-15T12:00:00Z')
  assert.equal(statutPreventif({ debut: '2026-11-20T12:00:00Z' }, maintenant), 'Prévu')
  assert.equal(statutPreventif({ debut: '2026-11-15T08:00:00Z', fin: '2026-11-15T18:00:00Z' }, maintenant), 'Ouvert')
})

test('une fiche préventif reste hors du dossier de souhait', () => {
  const patient = ficheVersPatient({
    id: '1', preventif_id: 'act', code_patient: '26LIE008001', numero_local: 1,
    nom: 'Martin', prenom: 'Léa', sexe: 'Femme', triage_actuel: 'U2',
    fiche: { pathology: 'Trauma', pmaName: 'PAPS 1' }, created_at: '2026-11-15T10:00:00Z',
  })
  assert.equal(patient.eventId, 'act')
  assert.equal(patient.secouristeBlock.pathology, 'Trauma')
  assert.equal('souhait_id' in patient, false)
})
