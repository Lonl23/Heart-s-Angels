import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Empty, Loading } from '@/components/ui'
import { ROLES_ASBL } from '@/modules/fiche/ficheSchema'

const lblRole = v => ROLES_ASBL.find(r => r.v === v)?.l || v

const GROUPES = [
  { id: 'presidence', titre: 'Présidence', roles: ['president', 'vice_president'] },
  { id: 'responsables', titre: 'Responsables', roles: [
    'tresorier', 'resp_logistique', 'coord_transport', 'coord_medical', 'coordinateur_medical',
    'coord_benevoles', 'relations_publiques', 'resp_informatique', 'administrateur_asbl',
  ]},
  { id: 'adjoints', titre: 'Adjoints', roles: [
    'tresorier_adjoint', 'resp_logistique_adjoint', 'coord_transport_adjoint', 'coord_medical_adjoint',
    'coord_benevoles_adjoint', 'relations_publiques_adjoint', 'resp_informatique_adjoint',
  ]},
  { id: 'volontaires', titre: 'Volontaires', roles: ['simple_volontaire'] },
]

function initiales(p) {
  return `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase() || '?'
}

export default function Organigramme() {
  const [gens, setGens] = useState(null)

  useEffect(() => {
    supabase.from('profiles').select('id,prenom,nom,fiche,actif').neq('role', 'partenaire').eq('actif', true).order('nom')
      .then(({ data }) => setGens(data || []))
  }, [])

  if (gens === null) return <Page title="Organigramme"><Loading /></Page>

  const placesPlusHaut = new Set()
  const groupes = GROUPES.map(g => {
    const membres = []
    for (const p of gens) {
      const roles = (p.fiche?.roles_asbl || []).filter(r => g.roles.includes(r))
      if (!roles.length) continue
      if (g.id === 'volontaires' && placesPlusHaut.has(p.id)) continue
      membres.push({ id: p.id, prenom: p.prenom, nom: p.nom, photo: p.fiche?.photo_url, labels: roles.map(lblRole) })
      if (g.id !== 'volontaires') placesPlusHaut.add(p.id)
    }
    membres.sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
    return { ...g, membres }
  }).filter(g => g.membres.length > 0)

  const vus = new Set(groupes.flatMap(g => g.membres.map(m => m.id)))
  const sansRole = gens.filter(p => !(p.fiche?.roles_asbl || []).length)
  const autres = gens.filter(p => !vus.has(p.id) && (p.fiche?.roles_asbl || []).length)
    .map(p => ({ id: p.id, prenom: p.prenom, nom: p.nom, photo: p.fiche?.photo_url, labels: (p.fiche.roles_asbl || []).map(lblRole) }))

  return (
    <Page title="Organigramme" subtitle="Qui porte quel rôle dans l’ASBL.">
      {groupes.length === 0 && sansRole.length === 0 && autres.length === 0 ? (
        <Empty title="Aucun volontaire actif" hint="Les rôles ASBL attribués sur les fiches s’affichent ici." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {groupes.map(g => (
            <section key={g.id}>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.35rem', color: 'var(--heading)' }}>{g.titre}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {g.membres.map(p => <Personne key={p.id + p.labels.join()} p={p} />)}
              </div>
            </section>
          ))}
          {autres.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.35rem', color: 'var(--heading)' }}>Autres rôles</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {autres.map(p => <Personne key={p.id} p={p} />)}
              </div>
            </section>
          )}
          {sansRole.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.35rem', color: 'var(--heading)' }}>Sans rôle attribué</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {sansRole.map(p => <Personne key={p.id} p={{ ...p, photo: p.fiche?.photo_url, labels: [] }} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </Page>
  )
}

function Personne({ p }) {
  return (
    <Card style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px' }}>
      <div style={{ width: 36, height: 36, borderRadius: 99, overflow: 'hidden', flexShrink: 0, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>
        {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initiales(p)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 650, color: 'var(--text)', fontSize: 14 }}>{p.prenom} {p.nom}</div>
        {p.labels?.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{p.labels.join(' · ')}</div>}
      </div>
    </Card>
  )
}
