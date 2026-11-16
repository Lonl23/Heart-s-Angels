/** Liens d’affiliation famille — formes masculine / féminine. */

export const LIENS_FAMILLE = [
  { v: 'pere', l: 'Père', genre: 'homme', groupe: 'parents' },
  { v: 'mere', l: 'Mère', genre: 'femme', groupe: 'parents' },
  { v: 'fils', l: 'Fils', genre: 'homme', groupe: 'enfant' },
  { v: 'fille', l: 'Fille', genre: 'femme', groupe: 'enfant' },
  { v: 'beau_fils', l: 'Beau-fils', genre: 'homme', groupe: 'beau' },
  { v: 'belle_fille', l: 'Belle-fille', genre: 'femme', groupe: 'beau' },
  { v: 'conjoint', l: 'Conjoint', genre: 'homme', groupe: 'conjoint' },
  { v: 'conjointe', l: 'Conjointe', genre: 'femme', groupe: 'conjoint' },
  { v: 'ami', l: 'Ami', genre: 'homme', groupe: 'ami' },
  { v: 'amie', l: 'Amie', genre: 'femme', groupe: 'ami' },
  { v: 'autre', l: 'Autre (à préciser)', genre: '', groupe: 'autre' },
]

export const LIENS_FAMILLE_GROUPES = [
  { v: 'parents', l: 'Parents', m: 'pere', f: 'mere' },
  { v: 'enfant', l: 'Fils / fille', m: 'fils', f: 'fille' },
  { v: 'beau', l: 'Beau-fils / belle-fille', m: 'beau_fils', f: 'belle_fille' },
  { v: 'conjoint', l: 'Conjoint(e)', m: 'conjoint', f: 'conjointe' },
  { v: 'ami', l: 'Ami(e)', m: 'ami', f: 'amie' },
  { v: 'autre', l: 'Autre → à préciser', m: 'autre', f: 'autre' },
]

export function libelleLienFamille(v, precis = '') {
  if (!v) return ''
  if (v === 'autre') return (precis || '').trim() || 'Autre'
  return LIENS_FAMILLE.find(x => x.v === v)?.l || v
}

export function genreDepuisLien(v) {
  return LIENS_FAMILLE.find(x => x.v === v)?.genre || ''
}

export function lienDepuisGroupeGenre(groupe, genre) {
  const g = LIENS_FAMILLE_GROUPES.find(x => x.v === groupe)
  if (!g) return ''
  if (g.v === 'autre') return 'autre'
  return genre === 'femme' ? g.f : g.m
}
