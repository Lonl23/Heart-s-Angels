import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { supabase } from '@/lib/supabase'
import { Card, Empty, Loading, Btn, PillFictif } from '@/components/ui'
import { lblEtapeTerrain } from '@/modules/souhaits/missionSchema'
import { fmtDatesSouhait } from '@/modules/souhaits/datesSouhait'
import { iconTypeNotif } from '@/lib/notifications'
import { DEPARTEMENTS, cheminDepartement, filtrerDepartements, moduleAutorise } from '@/navigation'

function ilYA(iso) {
  if (!iso) return ''
  const d = Date.now() - new Date(iso).getTime()
  const min = Math.round(d / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.round(h / 24)
  return `il y a ${j} j`
}

export default function Dashboard() {
  const auth = useAuth()
  const { profile, canAccess, peutReglerNotifications } = auth
  const { items, nonLues, marquerLues, pushEtat, demanderPush } = useNotifications()
  const [missions, setMissions] = useState(null)
  const departements = useMemo(
    () => filtrerDepartements(DEPARTEMENTS, key => moduleAutorise(key, auth)),
    [auth],
  )
  const date = new Date().toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long' })
  const alertes = (nonLues.length ? nonLues : items.filter(n => !n.lu)).slice(0, 8)
  const montrerPush = pushEtat === 'default' || pushEtat === 'denied' || pushEtat === 'absent'

  useEffect(() => {
    supabase.rpc('mes_affectations').then(({ data }) => setMissions(data || []))
  }, [])

  const aVenir = (missions || []).filter(m => m.statut !== 'realise' && m.statut !== 'non_realise' && m.statut !== 'annule' && m.statut !== 'demande_info_externe').slice(0, 3)

  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', width:'100%', boxSizing:'border-box' }}>
      <h1 style={{ fontSize:'1.9rem', color:'var(--heading)', marginBottom:4 }}>Bonjour {profile?.prenom || ''}</h1>
      <p style={{ color:'var(--text-muted)', marginBottom:22, textTransform:'capitalize' }}>{date}</p>

      {montrerPush && (
        <Card style={{ marginBottom:18, padding:'12px 16px', display:'flex', gap:12, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' }}>
          <div style={{ fontSize:13.5, color:'var(--text-2)' }}>
            {pushEtat === 'denied'
              ? 'Les notifications de ce navigateur sont bloquées. Autorisez-les dans les réglages du téléphone pour les recevoir hors de l’application.'
              : 'Activez les notifications sur ce téléphone pour être prévenu hors de l’application.'}
          </div>
          {pushEtat !== 'denied' && <Btn onClick={demanderPush} style={{ padding:'7px 12px' }}>Activer</Btn>}
        </Card>
      )}

      {alertes.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10, marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)' }}>
              Alertes{nonLues.length ? ` (${nonLues.length})` : ''}
            </div>
            {nonLues.length > 0 && (
              <button type="button" onClick={() => marquerLues()} style={{ background:'none', border:'none', color:'var(--accent)', fontWeight:600, fontSize:12.5, cursor:'pointer' }}>
                Tout marquer lu
              </button>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {alertes.map(n => (
              <Link
                key={n.id}
                to={n.lien || '/app'}
                onClick={() => { if (!n.lu) marquerLues([n.id]) }}
                style={{ textDecoration:'none' }}
              >
                <Card clickable style={{ padding:'12px 16px', borderColor: n.priorite === 'haute' ? '#E8A0A0' : undefined }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <div style={{ display:'flex', gap:10, minWidth:0 }}>
                      <span style={{ fontSize:18, lineHeight:1.2 }}>{iconTypeNotif(n.type)}</span>
                      <div>
                        <div style={{ fontWeight:600, color:'var(--text)' }}>{n.titre}</div>
                        {n.message && (
                          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2, whiteSpace:'pre-line' }}>
                            {String(n.message).split('\n').slice(0, 3).join('\n')}
                          </div>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize:12, color:'var(--text-faint)', whiteSpace:'nowrap' }}>{ilYA(n.created_at)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {peutReglerNotifications() && (
            <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:8 }}>
              Vous recevez l’ensemble des alertes. Choisissez celles que vous voulez dans <Link to="/app/profil">Ma fiche</Link>.
            </div>
          )}
        </div>
      )}

      {missions === null ? <Loading /> : aVenir.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Vos prochaines missions</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {aVenir.map(m => (
              <Link key={m.souhait_id} to={`/app/missions/${m.souhait_id}`} style={{ textDecoration:'none' }}>
                <Card clickable style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontWeight:600, color:'var(--text)' }}>Mission — {m.beneficiaire_prenom}</div>
                      <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>
                        {fmtDatesSouhait(m)}
                        {m.vehicule ? ` · ${m.vehicule}` : ''}
                        {m.etape_vehicule ? ` · ${lblEtapeTerrain(m.etape_vehicule, m.statut === 'realise' ? 'realise' : null)}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                      {m.fictif && <PillFictif />}
                      <span style={{ color:'var(--accent)', fontWeight:600, fontSize:13 }}>Ouvrir ›</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {missions && missions.length === 0 && canAccess('missions') && (
        <div style={{ marginBottom:24 }}>
          <Empty title="Aucune mission à réaliser" hint="Quand la coordination vous affectera à un souhait, il apparaîtra ici et dans Mes souhaits. Le souhait de formation fictif y est aussi, sans équipage à poser." />
        </div>
      )}

      <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Que voulez-vous faire ?</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
        {departements.map(d => (
          <Link key={d.id} to={cheminDepartement(d)} className="ha-click" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 16px', textDecoration:'none', display:'flex', flexDirection:'column', minHeight:132 }}>
            <div style={{ fontSize:'1.8rem', marginBottom:8 }}>{d.icon}</div>
            <div style={{ fontSize:15, fontWeight:650, color:'var(--text)' }}>{d.label}</div>
            <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4, flex:1 }}>
              {d.modules.length ? 'Choisir un module' : 'Aucun module pour le moment'}
            </div>
            <div style={{ marginTop:10, color:'var(--accent)', fontWeight:650, fontSize:13 }}>Choisir ›</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
