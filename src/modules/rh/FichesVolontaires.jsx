import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Pill, Empty, Loading } from '@/components/ui'
import FicheVolontaire from '@/modules/fiche/FicheVolontaire'
import { ROLES_ASBL } from '@/modules/fiche/ficheSchema'

const lblRole = v => ROLES_ASBL.find(r => r.v === v)?.l || v

export default function FichesVolontaires() {
  const [fiche, setFiche] = useState(null)
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('id,prenom,nom,email,role,actif,fiche').neq('role', 'partenaire').order('nom')
    setMembres(data || [])
    setLoading(false)
  }

  if (fiche) return <FicheVolontaire userId={fiche} onBack={() => { setFiche(null); load() }} />

  const needle = q.trim().toLowerCase()
  const visible = membres.filter(u => {
    if (!needle) return true
    const roles = (u.fiche?.roles_asbl || []).map(lblRole).join(' ')
    return `${u.prenom || ''} ${u.nom || ''} ${u.email || ''} ${roles}`.toLowerCase().includes(needle)
  })

  return (
    <Page title="Fiches volontaires" subtitle="Réservé à la coordination des bénévoles.">
      <input className="ha-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un volontaire" style={{ marginBottom: 14 }} />
      {loading ? <Loading /> : visible.length === 0 ? (
        <Empty title="Aucune fiche" hint={needle ? 'Aucun résultat pour cette recherche.' : 'Les volontaires inscrits apparaîtront ici.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(u => {
            const roles = u.fiche?.roles_asbl || []
            return (
              <Card key={u.id} clickable onClick={() => setFiche(u.id)} style={{ padding: '12px 16px', opacity: u.actif ? 1 : .55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, color: 'var(--text)' }}>{u.prenom} {u.nom}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{u.email || '—'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4 }}>{roles.length ? roles.map(lblRole).join(', ') : 'Aucun rôle ASBL'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {u.actif ? <Pill color="#3B6D11" bg="#EAF3DE">Actif</Pill> : <Pill color="#A32D2D" bg="#FCEBEB">Désactivé</Pill>}
                    <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>Ouvrir ›</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Page>
  )
}
