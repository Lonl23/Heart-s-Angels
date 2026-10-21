import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { supabase } from '@/lib/supabase'
import { Btn } from '@/components/ui'
import { lblEtapeTerrain } from '@/modules/souhaits/missionSchema'
import { fmtDatesSouhait } from '@/modules/souhaits/datesSouhait'
import { iconTypeNotif } from '@/lib/notifications'
import { DEPARTEMENTS, filtrerDepartements, moduleAutorise } from '@/navigation'
import { VignettesActualites } from '@/modules/actualites/Vignettes'

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
  const { items, nonLues, marquerLues, traiter, pushEtat, demanderPush } = useNotifications()
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

  const bande = montrerPush || alertes.length > 0 || aVenir.length > 0 || (missions && missions.length === 0 && canAccess('missions'))

  return (
    <div className="ha-accueil">
      <div className="ha-accueil-haut">
        <h1>Bonjour {profile?.prenom || ''}</h1>
        <p className="ha-accueil-date">{date}</p>
      </div>

      {bande && (
        <div className="ha-accueil-bande">
          {montrerPush && (
            <span className="ha-accueil-puce is-muted" style={{ maxWidth: '100%' }}>
              <span className="ha-accueil-puce-txt">
                {pushEtat === 'denied'
                  ? 'Notifications bloquées sur ce navigateur.'
                  : 'Activez les notifications de ce téléphone.'}
              </span>
              {pushEtat !== 'denied' && <Btn onClick={demanderPush} style={{ padding: '3px 8px', fontSize: 12 }}>Activer</Btn>}
            </span>
          )}
          {alertes.map(n => (
            <span
              key={n.id}
              className={'ha-accueil-puce' + (n.priorite === 'haute' ? ' is-haute' : '')}
              title={n.titre}
            >
              <Link to={n.lien || '/app'} onClick={() => { if (!n.groupe_id && !n.lu) marquerLues([n.id]) }} style={{ display:'inline-flex', alignItems:'center', gap:6, minWidth:0, color:'inherit', textDecoration:'none' }}>
                <span aria-hidden>{iconTypeNotif(n.type)}</span>
                <span className="ha-accueil-puce-txt">{n.titre}</span>
                <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>{ilYA(n.created_at)}</span>
              </Link>
              {n.groupe_id && (
                <button type="button" onClick={() => traiter(n.id)} style={{ border:0, background:'transparent', color:'var(--accent)', fontWeight:700, fontSize:12, cursor:'pointer', padding:0 }}>Traitée</button>
              )}
            </span>
          ))}
          {nonLues.length > 0 && (
            <button type="button" onClick={() => marquerLues()} className="ha-accueil-puce" style={{ cursor: 'pointer', color: 'var(--accent)' }}>
              Tout marquer lu
            </button>
          )}
          {peutReglerNotifications() && alertes.length > 0 && (
            <Link to="/app/profil" className="ha-accueil-puce is-muted">Régler les alertes</Link>
          )}
          {aVenir.map(m => (
            <Link key={m.souhait_id} to={`/app/missions/${m.souhait_id}`} className="ha-accueil-puce" title={m.beneficiaire_prenom}>
              <span aria-hidden>🎁</span>
              <span className="ha-accueil-puce-txt">
                {m.beneficiaire_prenom} · {fmtDatesSouhait(m)}
                {m.vehicule ? ` · ${m.vehicule}` : ''}
                {m.etape_vehicule ? ` · ${lblEtapeTerrain(m.etape_vehicule, m.statut === 'realise' ? 'realise' : null)}` : ''}
                {m.fictif ? ' · fictif' : ''}
              </span>
            </Link>
          ))}
          {missions && missions.length === 0 && canAccess('missions') && (
            <span className="ha-accueil-puce is-muted">Aucune mission à réaliser</span>
          )}
        </div>
      )}

      <div className="ha-accueil-corps">
        <VignettesActualites accueil />
        <nav className="ha-accueil-choix" aria-label="Menus">
          {departements.map(d => (
            <section key={d.id} className="ha-accueil-dept" aria-labelledby={`accueil-dept-${d.id}`}>
              <h2 id={`accueil-dept-${d.id}`}>
                <span aria-hidden>{d.icon}</span>
                <span>{d.label}</span>
              </h2>
              {d.modules.length === 0 ? (
                <p className="ha-accueil-vide">Aucun module pour le moment</p>
              ) : (
                <div className="ha-accueil-mods">
                  {d.modules.map(m => (
                    <Link key={m.key} to={m.to} className="ha-accueil-tuile" title={m.desc || m.label}>
                      <span className="ha-accueil-tuile-ico" aria-hidden>{m.icon}</span>
                      <span className="ha-accueil-tuile-nom">{m.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </nav>
      </div>
    </div>
  )
}
