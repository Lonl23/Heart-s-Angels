import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { lbl } from '@/components/ui'
import { recolteursDuSouhait, nomsRecolteurs, estProfilRecolteur } from './missionSchema'

export async function listerRecolteurs() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,prenom,nom,fiche')
    .eq('actif', true)
    .neq('role', 'partenaire')
    .order('nom')
  if (error) return []
  return (data || [])
    .filter(p => estProfilRecolteur(p))
    .map(p => ({ id: p.id, prenom: p.prenom || '', nom: p.nom || '' }))
}

export function RecolteursPicker({ m, setM }) {
  const { profile } = useAuth()
  const [pool, setPool] = useState([])
  useEffect(() => { listerRecolteurs().then(setPool) }, [])

  const choisis = recolteursDuSouhait(m)
  const ids = new Set(choisis.map(r => r.id).filter(Boolean))
  const moi = estProfilRecolteur(profile) ? profile : null
  const jeSuis = !!(moi && ids.has(moi.id))

  function appliquer(next) {
    setM(o => ({ ...o, recolteurs: next, recolteur: nomsRecolteurs({ recolteurs: next }) }))
  }
  function toggle(p) {
    if (!p?.id) return
    const on = ids.has(p.id)
    appliquer(on
      ? choisis.filter(r => r.id !== p.id)
      : [...choisis.filter(r => r.id), { id: p.id, prenom: p.prenom, nom: p.nom }])
  }
  function toggleMoi() {
    if (!moi) return
    toggle({ id: moi.id, prenom: moi.prenom, nom: moi.nom })
  }

  const ancien = (m?.recolteur || '').trim()
  const texteListe = nomsRecolteurs(m)
  const orphelin = ancien && (!texteListe || !texteListe.includes(ancien.split(',')[0].trim()))

  return (
    <div style={{ gridColumn: '1 / -1', margin: '8px 0 12px' }}>
      <label style={lbl}>Récolteurs de souhait</label>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>
        Ce n’est pas l’équipage : les récolteurs s’inscrivent eux-mêmes. Plusieurs personnes peuvent récolter le même souhait.
      </div>
      {moi && (
        <button
          type="button"
          onClick={toggleMoi}
          style={{
            marginBottom: 10,
            padding: '10px 14px',
            borderRadius: 10,
            border: jeSuis ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: jeSuis ? '#E6F7FA' : 'var(--card)',
            color: 'var(--heading)',
            fontWeight: 700,
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
          }}
        >
          {jeSuis ? '✓ Vous récoltez ce souhait — toucher pour se retirer' : 'Je récolte ce souhait'}
        </button>
      )}
      {pool.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Aucun profil n’a encore le rôle « Récolteur de souhait » dans sa fiche.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {pool.map(p => {
            const on = ids.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 99,
                  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent)' : 'var(--card)',
                  color: on ? '#fff' : 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {on ? '✓ ' : ''}{[p.prenom, p.nom].filter(Boolean).join(' ')}
              </button>
            )
          })}
        </div>
      )}
      {orphelin && !choisis.some(r => r.id) && (
        <div style={{ fontSize: 12.5, color: '#BA7517', marginTop: 8 }}>
          Ancien nom saisi : {ancien}. Choisissez les récolteurs dans la liste.
        </div>
      )}
    </div>
  )
}

export function BoutonJeRecolte({ s, onMaj }) {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!estProfilRecolteur(profile) || !s?.id) return null
  const choisis = recolteursDuSouhait(s.mission)
  const on = choisis.some(r => r.id === profile.id)

  async function go(e) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    const next = on
      ? choisis.filter(r => r.id !== profile.id)
      : [...choisis.filter(r => r.id), { id: profile.id, prenom: profile.prenom, nom: profile.nom }]
    const { data: fresh } = await supabase.from('souhaits').select('mission').eq('id', s.id).single()
    const base = fresh?.mission || s.mission || {}
    const mission = { ...base, recolteurs: next, recolteur: nomsRecolteurs({ recolteurs: next }) }
    const { error } = await supabase.from('souhaits').update({ mission }).eq('id', s.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    onMaj?.(mission)
  }

  return (
    <button
      type="button"
      className="ha-kanban-open"
      onClick={go}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      onPointerCancel={e => e.stopPropagation()}
      disabled={busy}
      style={{ marginTop: 6, background: on ? '#E6F7FA' : undefined }}
    >
      {busy ? '…' : on ? '✓ Vous récoltez — se retirer' : 'Je récolte ce souhait'}
    </button>
  )
}
