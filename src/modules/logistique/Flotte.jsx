import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Empty, Loading, Btn } from '@/components/ui'

export default function Flotte() {
  const auth = useAuth()
  const [vehicules, setVehicules] = useState(null)
  const [lieux, setLieux] = useState([])
  const [err, setErr] = useState(null)

  const ok = auth.canAccess?.('stock') || auth.peutGererStock?.()

  useEffect(() => {
    if (!ok) return
    Promise.all([
      supabase.from('plaques_vehicules').select('id,plaque,libelle,actif').order('plaque'),
      supabase.from('stock_lieux').select('id,nom,plaque').not('plaque', 'is', null),
    ]).then(([v, l]) => {
      if (v.error) setErr(v.error.message)
      else setVehicules(v.data || [])
      if (!l.error) setLieux(l.data || [])
    })
  }, [ok])

  if (!ok) return <Navigate to="/app" replace />

  const lieuParPlaque = Object.fromEntries(
    (lieux || []).filter(x => x.plaque).map(x => [String(x.plaque).toUpperCase(), x]),
  )

  return (
    <Page
      title="Flotte"
      subtitle="Véhicules (plaques) du département logistique. La configuration se fait aussi dans IT → Configuration souhaits."
      action={<Link to="/app/stock"><Btn kind="soft">Ouvrir le stock ›</Btn></Link>}
    >
      {err && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {vehicules === null ? <Loading /> : vehicules.length === 0 ? (
        <Empty title="Aucun véhicule" hint="Ajoutez des plaques dans IT → Configuration souhaits → Plaques." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vehicules.map(v => {
            const lieu = lieuParPlaque[String(v.plaque || '').toUpperCase()]
            return (
              <Card key={v.id} style={{ padding: '12px 16px', opacity: v.actif === false ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--heading)', letterSpacing: 0.3 }}>{v.plaque}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {v.libelle || 'Sans libellé'}
                      {lieu ? ` · stock : ${lieu.nom}` : ' · aucun lieu stock lié'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 650, borderRadius: 99, padding: '3px 8px',
                    color: v.actif === false ? '#7A7470' : '#0E4A5A',
                    background: v.actif === false ? 'var(--bg-alt)' : 'rgba(27,176,206,.15)',
                  }}>
                    {v.actif === false ? 'Inactif' : 'Actif'}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Page>
  )
}
