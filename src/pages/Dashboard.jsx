import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { supabase } from '@/lib/supabase'
import { Btn } from '@/components/ui'
import { lblEtapeTerrain } from '@/modules/souhaits/missionSchema'
import { fmtDatesSouhait } from '@/modules/souhaits/datesSouhait'
import { iconTypeNotif } from '@/lib/notifications'
import { libellesRolesAsblPropres, lblRoleCompte } from '@/modules/fiche/ficheSchema'
import { DEPARTEMENTS, cheminDepartement, filtrerDepartements, moduleAutorise } from '@/navigation'
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

function salutation(d) {
  const h = d.getHours()
  if (h >= 18) return 'Bonsoir'
  if (h >= 12) return 'Bon après-midi'
  return 'Bonjour'
}

function ymd(d) {
  const z = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

function jour(iso) {
  return String(iso || '').slice(0, 10)
}

const STATUTS_FERMES = ['realise', 'non_realise', 'annule', 'demande_info_externe']

export default function Dashboard() {
  const auth = useAuth()
  const { profile, canAccess, peutReglerNotifications } = auth
  const { items, nonLues, chargement, marquerLues, traiter, pushEtat, demanderPush } = useNotifications()
  const [missions, setMissions] = useState(null)
  const [dispos, setDispos] = useState(undefined)
  const departements = useMemo(
    () => filtrerDepartements(DEPARTEMENTS, key => moduleAutorise(key, auth)),
    [auth],
  )
  const maintenant = new Date()
  const dateLongue = maintenant.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const date = dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)
  const alertes = (nonLues.length ? nonLues : items.filter(n => !n.lu)).slice(0, 6)
  const montrerPush = pushEtat === 'default' || pushEtat === 'denied' || pushEtat === 'absent'

  useEffect(() => {
    supabase.rpc('mes_affectations').then(({ data }) => setMissions(data || []))
  }, [])

  useEffect(() => {
    if (!profile?.id) return undefined
    let actif = true
    supabase.from('disponibilites')
      .select('id,date_debut,date_fin')
      .eq('user_id', profile.id)
      .then(({ data, error }) => {
        if (!actif) return
        setDispos(error ? false : (data || []))
      })
    return () => { actif = false }
  }, [profile?.id])

  const ouvertes = (missions || []).filter(m => !STATUTS_FERMES.includes(m.statut))
  const debutMois = ymd(new Date(maintenant.getFullYear(), maintenant.getMonth(), 1))
  const finMois = ymd(new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0))
  const aujourdhui = ymd(maintenant)
  const missionsMois = ouvertes.filter(m => {
    const d = jour(m.date_souhaitee)
    return d && d >= debutMois && d <= finMois
  }).length
  const disposListe = Array.isArray(dispos) ? dispos : []
  const disposMois = disposListe.filter(r => {
    const a = jour(r.date_debut)
    const b = jour(r.date_fin) || a
    return a && a <= finMois && b >= debutMois
  }).length
  const disposAVenir = disposListe.filter(r => (jour(r.date_fin) || jour(r.date_debut)) >= aujourdhui).length

  const prenom = profile?.prenom || ''
  const nom = profile?.nom || ''
  const photo = profile?.fiche?.photo_url || ''
  const roles = libellesRolesAsblPropres(profile?.fiche?.roles_asbl || [])
  const roleTxt = roles.length ? roles.join(' · ') : (profile?.role ? lblRoleCompte(profile.role) : 'Volontaire')
  const initiales = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '?'

  const nbMissions = missions == null ? null : ouvertes.length
  const nbAlertes = chargement && items.length === 0 ? null : nonLues.length
  const nbDispos = dispos === false ? false : (dispos == null ? null : disposMois)

  return (
    <div className="ha-accueil">
      <header className="ha-accueil-salut">
        <Avatar url={photo} initiales={initiales} />
        <div className="ha-accueil-salut-txt">
          <h1>{salutation(maintenant)}{prenom ? `, ${prenom}` : ''}</h1>
          <p>{date} · Voici un résumé de votre journée</p>
        </div>
      </header>

      <section className="ha-accueil-stats" aria-label="Résumé">
        <Stat
          to={canAccess('missions') ? '/app/missions' : undefined}
          tone="missions"
          ico="🎁"
          label="Missions"
          valeur={nbMissions}
          detail={nbMissions == null ? 'Chargement' : `${missionsMois} ce mois`}
        />
        <Stat
          tone="alertes"
          ico="🔔"
          label="Alertes"
          valeur={nbAlertes}
          detail={nbAlertes == null ? 'Chargement' : (nbAlertes ? 'Non lues' : 'Aucune non lue')}
        />
        <Stat
          to={canAccess('disponibilites') ? '/app/disponibilites' : undefined}
          tone="dispos"
          ico="📅"
          label="Disponibilités"
          valeur={nbDispos === false ? null : nbDispos}
          detail={dispos === false ? 'Lecture impossible' : (nbDispos == null ? 'Chargement' : `${disposAVenir} à venir`)}
          tiret={nbDispos === false}
        />
      </section>

      <nav className="ha-accueil-choix" aria-label="Départements">
        {departements.map(d => (
          <Link key={d.id} to={cheminDepartement(d)} className="ha-accueil-tuile" title={d.label}>
            <span className="ha-accueil-tuile-ico" aria-hidden>{d.icon}</span>
            <span className="ha-accueil-tuile-nom">{d.label}</span>
          </Link>
        ))}
      </nav>

      <div className="ha-accueil-bas">
        <section className="ha-accueil-carte" aria-label="Alertes">
          <div className="ha-accueil-carte-titre">
            <h2>Alertes</h2>
            {nonLues.length > 0 && (
              <button type="button" onClick={() => marquerLues()}>Tout marquer lu</button>
            )}
          </div>
          {montrerPush && (
            <p className="ha-accueil-note">
              {pushEtat === 'denied'
                ? 'Notifications bloquées sur ce navigateur.'
                : 'Activez les notifications de ce téléphone.'}
              {pushEtat !== 'denied' && <Btn onClick={demanderPush} style={{ padding: '3px 8px', fontSize: 12 }}>Activer</Btn>}
            </p>
          )}
          {alertes.length === 0 && !montrerPush && (
            <p className="ha-accueil-vide">Aucune alerte pour le moment.</p>
          )}
          <ul className="ha-accueil-liste">
            {alertes.map(n => (
              <li key={n.id} className={n.priorite === 'haute' ? 'is-haute' : undefined}>
                <Link to={n.lien || '/app'} onClick={() => { if (!n.groupe_id && !n.lu) marquerLues([n.id]) }}>
                  <span aria-hidden>{iconTypeNotif(n.type)}</span>
                  <span className="ha-accueil-liste-txt">
                    <strong>{n.titre}</strong>
                    <span>{ilYA(n.created_at)}</span>
                  </span>
                </Link>
                {n.groupe_id && (
                  <button type="button" onClick={() => traiter(n.id)}>Traitée</button>
                )}
              </li>
            ))}
          </ul>
          {peutReglerNotifications() && alertes.length > 0 && (
            <Link to="/app/profil" className="ha-accueil-suite">Régler les alertes</Link>
          )}
        </section>

        <section className="ha-accueil-carte" aria-label="Missions">
          <div className="ha-accueil-carte-titre">
            <h2>Missions</h2>
            {canAccess('missions') && <Link to="/app/missions">Voir tout</Link>}
          </div>
          {missions && ouvertes.length === 0 && (
            <p className="ha-accueil-vide">Aucune mission à réaliser.</p>
          )}
          {missions == null && <p className="ha-accueil-vide">Chargement…</p>}
          <ul className="ha-accueil-liste">
            {ouvertes.slice(0, 4).map(m => (
              <li key={m.souhait_id}>
                <Link to={`/app/missions/${m.souhait_id}`}>
                  <span aria-hidden>🎁</span>
                  <span className="ha-accueil-liste-txt">
                    <strong>{m.beneficiaire_prenom || 'Mission'}</strong>
                    <span>
                      {fmtDatesSouhait(m)}
                      {m.vehicule ? ` · ${m.vehicule}` : ''}
                      {m.etape_vehicule ? ` · ${lblEtapeTerrain(m.etape_vehicule, m.statut === 'realise' ? 'realise' : null)}` : ''}
                      {m.fictif ? ' · fictif' : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="ha-accueil-carte ha-accueil-profil" aria-label="Mon profil">
          <div className="ha-accueil-carte-titre">
            <h2>Mon profil</h2>
            <Link to="/app/profil">Ma fiche</Link>
          </div>
          <Avatar url={photo} initiales={initiales} grand />
          <p className="ha-accueil-profil-nom">{[prenom, nom].filter(Boolean).join(' ') || 'Profil'}</p>
          <p className="ha-accueil-profil-role">{roleTxt}</p>
        </section>
      </div>

      <VignettesActualites accueil />
    </div>
  )
}

function chiffre(valeur, tiret) {
  if (tiret) return '—'
  if (valeur == null) return '…'
  return Number(valeur).toLocaleString('fr-BE')
}

function Stat({ to, tone, ico, label, valeur, detail, tiret }) {
  const corps = (
    <>
      <span className="ha-accueil-stat-ico" aria-hidden>{ico}</span>
      <span className="ha-accueil-stat-label">{label}</span>
      <span className="ha-accueil-stat-nb">{chiffre(valeur, tiret)}</span>
      <span className="ha-accueil-stat-detail">{detail}</span>
    </>
  )
  if (to) return <Link to={to} className={`ha-accueil-stat is-${tone}`}>{corps}</Link>
  return <div className={`ha-accueil-stat is-${tone}`}>{corps}</div>
}

function Avatar({ url, initiales, grand }) {
  return (
    <div className={'ha-accueil-avatar' + (grand ? ' is-grand' : '')}>
      {url ? <img src={url} alt="" /> : <span>{initiales}</span>}
    </div>
  )
}
