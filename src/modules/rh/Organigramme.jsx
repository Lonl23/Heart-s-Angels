import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Empty, Loading } from '@/components/ui'
import { EQUIPES_ASBL, canonRoleAsbl, lblRoleAsbl } from '@/modules/fiche/ficheSchema'

function initiales(p) {
  return `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase() || '?'
}

function rolesDe(p) {
  return [...new Set((p.fiche?.roles_asbl || []).map(canonRoleAsbl).filter(Boolean))]
}

export default function Organigramme() {
  const [gens, setGens] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.from('profiles').select('id,prenom,nom,fiche,actif').neq('role', 'partenaire').eq('actif', true).order('nom')
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        setGens(data || [])
      })
  }, [])

  if (gens === null) return <Page title="Organigramme"><Loading /></Page>

  const equipes = EQUIPES_ASBL.map(equipe => {
    const roles = new Set(equipe.roles.map(canonRoleAsbl))
    const membres = gens
      .map(p => {
        const siens = rolesDe(p).filter(r => roles.has(r))
        if (!siens.length) return null
        return { id: p.id, prenom: p.prenom, nom: p.nom, photo: p.fiche?.photo_url, labels: siens.map(lblRoleAsbl) }
      })
      .filter(Boolean)
      .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
    return { ...equipe, membres }
  }).filter(g => g.membres.length > 0)

  const dansEquipe = new Set(equipes.flatMap(g => g.membres.map(m => m.id)))
  const volontaires = gens
    .filter(p => !dansEquipe.has(p.id) && rolesDe(p).includes('simple_volontaire'))
    .map(p => ({ id: p.id, prenom: p.prenom, nom: p.nom, photo: p.fiche?.photo_url, labels: ['Simple volontaire'] }))
  const sansRole = gens.filter(p => !rolesDe(p).length)

  return (
    <Page title="Organigramme" subtitle="Qui porte quel rôle dans l’ASBL.">
      {err && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {equipes.length === 0 && volontaires.length === 0 && sansRole.length === 0 ? (
        <Empty title="Aucun volontaire actif" hint="Les rôles ASBL attribués sur les fiches s’affichent ici." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {equipes.map(g => (
            <section key={g.v}>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.35rem', color: 'var(--heading)' }}>{g.l}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {g.membres.map(p => <Personne key={g.v + p.id} p={p} />)}
              </div>
            </section>
          ))}
          {volontaires.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.35rem', color: 'var(--heading)' }}>Volontaires</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {volontaires.map(p => <Personne key={p.id} p={p} />)}
              </div>
            </section>
          )}
          {sansRole.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.35rem', color: 'var(--heading)' }}>Sans rôle attribué</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
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
