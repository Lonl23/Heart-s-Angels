import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { supabase } from '@/lib/supabase'
import { Btn } from '@/components/ui'
import { libellesRolesAsblPropres, lblRoleCompte } from '@/modules/fiche/ficheSchema'
import { DEPARTEMENTS, cheminDepartement, filtrerDepartements, moduleAutorise } from '@/navigation'
import { VignettesActualites } from '@/modules/actualites/Vignettes'

function estNuit(d) {
  const h = d.getHours()
  return h >= 22 || h < 5
}

const NUITS = [
  p => (p ? `${p}, ne serait-il pas temps d’aller dormir ?` : 'Ne serait-il pas temps d’aller dormir ?'),
  p => (p ? `${p}, les souhaits attendront demain matin.` : 'Les souhaits attendront demain matin.'),
  p => (p ? `Encore là, ${p} ? Le défibrillateur, lui, se repose.` : 'Encore là ? Le défibrillateur, lui, se repose.'),
  p => (p ? `${p}, à cette heure même les anges dorment.` : 'À cette heure, même les anges dorment.'),
  p => (p ? `Demain sera bien assez tôt, ${p}.` : 'Demain sera bien assez tôt.'),
]

function salutation(d, prenom) {
  if (estNuit(d)) {
    const i = (d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate()) % NUITS.length
    return NUITS[i](prenom)
  }
  const h = d.getHours()
  const base = h >= 18 ? 'Bonsoir' : h >= 12 ? 'Bon après-midi' : 'Bonjour'
  return prenom ? `${base}, ${prenom}` : base
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
  const { profile, canAccess } = auth
  const { nonLues, chargement, pushEtat, demanderPush } = useNotifications()
  const [missions, setMissions] = useState(null)
  const [dispos, setDispos] = useState(undefined)
  const departements = useMemo(
    () => filtrerDepartements(DEPARTEMENTS, key => moduleAutorise(key, auth)),
    [auth],
  )
  const maintenant = new Date()
  const dateLongue = maintenant.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const date = dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)
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
  const nbAlertes = chargement && nonLues.length === 0 ? null : nonLues.length
  const nbDispos = dispos === false ? false : (dispos == null ? null : disposMois)
  const premiereMission = ouvertes[0]
  const detailMissions = nbMissions == null
    ? 'Chargement'
    : premiereMission
      ? `${premiereMission.beneficiaire_prenom || 'Mission'} · ${missionsMois} ce mois`
      : (missionsMois ? `${missionsMois} ce mois` : 'Aucune à réaliser')
  const premiereAlerte = nonLues[0]
  const detailAlertes = nbAlertes == null
    ? 'Chargement'
    : premiereAlerte
      ? premiereAlerte.titre
      : 'Aucune non lue'

  return (
    <div className="ha-accueil">
      <header className="ha-accueil-salut">
        <Avatar url={photo} initiales={initiales} />
        <div className="ha-accueil-salut-txt">
          <h1>{salutation(maintenant, prenom)}</h1>
          <p>{date}{estNuit(maintenant) ? '' : ' · Voici un résumé de votre journée'}</p>
        </div>
      </header>

      <section className="ha-accueil-stats" aria-label="Résumé">
        <Stat
          to={canAccess('missions') ? '/app/missions' : undefined}
          tone="missions"
          ico="🎁"
          label="Missions"
          valeur={nbMissions}
          detail={detailMissions}
        />
        <Stat
          tone="alertes"
          ico="🔔"
          label="Alertes"
          valeur={nbAlertes}
          detail={detailAlertes}
          note={montrerPush ? (
            <span className="ha-accueil-stat-note">
              {pushEtat === 'denied'
                ? 'Notifications bloquées sur ce navigateur.'
                : 'Activez les notifications de ce téléphone.'}
              {pushEtat !== 'denied' && <Btn onClick={demanderPush} style={{ padding: '3px 8px', fontSize: 12 }}>Activer</Btn>}
            </span>
          ) : null}
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

function Stat({ to, tone, ico, label, valeur, detail, tiret, note }) {
  const corps = (
    <>
      <span className="ha-accueil-stat-ico" aria-hidden>{ico}</span>
      <span className="ha-accueil-stat-label">{label}</span>
      <span className="ha-accueil-stat-nb">{chiffre(valeur, tiret)}</span>
      <span className="ha-accueil-stat-detail">{detail}</span>
      {note}
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
