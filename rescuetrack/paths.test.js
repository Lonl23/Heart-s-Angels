import test from 'node:test'
import assert from 'node:assert/strict'
import { prefixeRescuetrack, rt, estPageConnexion, apresConnexion } from '../public/rescuetrack/paths.js'

test('le préfixe suit l’origine', () => {
  assert.equal(prefixeRescuetrack('/rescuetrack/province.html'), '/rescuetrack')
  assert.equal(prefixeRescuetrack('/rescuetrack'), '/rescuetrack')
  assert.equal(prefixeRescuetrack('/province.html'), '')
  assert.equal(prefixeRescuetrack('/'), '')
})

test('les pages restent au bon endroit sur les deux sites', () => {
  assert.equal(rt('province.html', '/rescuetrack/index.html'), '/rescuetrack/province.html')
  assert.equal(rt('be.svg', '/'), '/be.svg')
  assert.equal(rt('evenements.html', '/province.html'), '/evenements.html')
})

test('la connexion est reconnue à la racine et sous /rescuetrack', () => {
  assert.equal(estPageConnexion('/'), true)
  assert.equal(estPageConnexion('/index.html'), true)
  assert.equal(estPageConnexion('/rescuetrack'), true)
  assert.equal(estPageConnexion('/rescuetrack/'), true)
  assert.equal(estPageConnexion('/rescuetrack/index.html'), true)
  assert.equal(estPageConnexion('/province.html'), false)
  assert.equal(estPageConnexion('/rescuetrack/province.html'), false)
})

test('le retour après connexion reste dans RescueTrack', () => {
  assert.equal(apresConnexion('/rescuetrack/patient.html', '/rescuetrack/index.html'), '/rescuetrack/patient.html')
  assert.equal(apresConnexion('/patient.html', '/rescuetrack/index.html'), '/rescuetrack/province.html')
  assert.equal(apresConnexion('/province.html', '/index.html'), '/province.html')
  assert.equal(apresConnexion('https://example.test', '/'), '/province.html')
  assert.equal(apresConnexion('//example.test', '/'), '/province.html')
})
