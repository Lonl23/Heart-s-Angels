import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Empty, Loading, Pill } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { stInfo } from './souhaits/Souhaits'
import MissionExecution from './souhaits/MissionExecution'

const FILTRES = [
  { v:'a_faire', l:'À faire' },
  { v:'en_cours', l:'En cours' },
  { v:'terminees', l:'Terminées' },
]

export default function MesMissions() {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [filtre, setFiltre] = useState('a_faire')
  const [err, setErr] = useState(null)

  useEffect(() => { load() }, [session?.user?.id])
  async function load() {
    setLoading(true); setErr(null)
    const { data, error } = await supabase.rpc('mes_affectations')
    if (error) setErr(error.message)
    setItems(data || [])
    setLoading(false)
  }

  if (sel) return <MissionExecution souhaitId={sel} onBack={()=>{ setSel(null); load() }} />

  const visible = items.filter(m => {
    if (filtre === 'en_cours') return m.statut === 'en_cours'
    if (filtre === 'terminees') return m.statut === 'realise' || m.statut === 'non_realise'
    return m.statut !== 'realise' && m.statut !== 'non_realise'
  })
  const nbCours = items.filter(m => m.statut === 'en_cours').length

  return (
    <Page title="Mes missions" subtitle="Sur le terrain, étape par étape : votre véhicule, puis la prise en charge, le retour, la base.">
      {err && <div style={{ color:'#A32D2D', fontSize:13, marginBottom:10 }}>{err}</div>}
      <div className="ha-tabs" style={{ marginBottom:16 }}>
        {FILTRES.map(f => (
          <button key={f.v} type="button" className={'ha-tab' + (filtre===f.v ? ' is-on' : '')} onClick={()=>setFiltre(f.v)}>
            {f.l}{f.v==='en_cours' && nbCours > 0 && <span className="ha-tab-badge">{nbCours}</span>}
          </button>
        ))}
      </div>
      {loading ? <Loading />
        : items.length === 0 ? <Empty title="Aucune mission pour le moment" hint="La coordination vous affectera ici lorsqu'un équipage sera constitué." />
        : visible.length === 0 ? <Empty title="Rien dans cet onglet" hint="Changez de filtre, ou revenez quand une mission sera prête." />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {visible.map(m => {
              const st = stInfo(m.statut)
              return (
                <Card key={m.souhait_id} clickable onClick={()=>setSel(m.souhait_id)} style={{ padding:'16px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start' }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>
                        {m.beneficiaire_prenom || 'Mission'}
                      </div>
                      {m.description && (
                        <div style={{ fontSize:14, color:'var(--text-2)', marginTop:4, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{m.description}</div>
                      )}
                      <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:6 }}>
                        {m.date_souhaitee ? new Date(m.date_souhaitee).toLocaleDateString('fr-BE') : 'Date à définir'}
                        {m.lieu ? ` · ${m.lieu}` : ''}
                        {m.vehicule ? ` · ${m.vehicule}` : ''}
                        {m.role_mission ? ` · ${m.role_mission}` : ''}
                      </div>
                    </div>
                    <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
                  </div>
                  <div style={{ marginTop:10, fontSize:13.5, fontWeight:600, color:'var(--accent)' }}>
                    {m.statut === 'en_cours' ? 'Continuer ›' : m.statut === 'realise' ? 'Consulter ›' : 'Ouvrir ›'}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
    </Page>
  )
}
