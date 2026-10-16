import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Empty, Loading } from '@/components/ui'
import { construireArbre } from './organigrammeArbre'

function initiales(p) {
  return `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase() || '?'
}

export default function Organigramme() {
  const [gens, setGens] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.from('profiles').select('id,prenom,nom,email,telephone,fiche,actif').neq('role', 'partenaire').eq('actif', true).order('nom')
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        setGens(data || [])
      })
  }, [])

  const arbre = useMemo(() => (gens ? construireArbre(gens) : []), [gens])

  if (gens === null) return <Page title="Organigramme"><Loading /></Page>

  return (
    <Page
      title="Organigramme"
      subtitle="La personne juste au-dessus est le N+1, celle encore au-dessus le N+2. Le téléphone et l’e-mail servent à la joindre."
    >
      {err && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {arbre.length === 0 ? (
        <Empty title="Aucun responsable" hint="Les rôles ASBL attribués sur les fiches s’affichent ici." />
      ) : (
        <div className="ha-org-scroll">
          <ul className="ha-org">
            {arbre.map(n => <Branche key={n.key} noeud={n} />)}
          </ul>
        </div>
      )}
    </Page>
  )
}

function Branche({ noeud, chaine = [] }) {
  const responsable = noeud.gens[0]
  const auDessus = responsable ? [nomComplet(responsable), ...chaine] : chaine
  return (
    <li>
      <div className="ha-org-cartes">
        {noeud.gens.map(p => <Carte key={p.id} p={p} chaine={chaine} />)}
      </div>
      {noeud.enfants.length > 0 && (
        <ul>
          {noeud.enfants.map(e => <Branche key={e.key} noeud={e} chaine={auDessus} />)}
        </ul>
      )}
    </li>
  )
}

function nomComplet(p) {
  return `${p.prenom} ${p.nom}`.trim()
}

function hrefTel(tel) {
  const num = tel.replace(/[^\d+]/g, '')
  return num ? `tel:${num}` : ''
}

function mailAffiche(email) {
  const at = email.indexOf('@')
  if (at <= 0) return email
  return <>{email.slice(0, at)}<wbr />{email.slice(at)}</>
}

function Carte({ p, chaine }) {
  const tel = hrefTel(p.telephone || '')
  return (
    <div className="ha-org-carte">
      <div className="ha-org-photo">
        {p.photo
          ? <img src={p.photo} alt="" />
          : <span className="ha-org-initiales">{initiales(p)}</span>}
      </div>
      <div className="ha-org-nom">{p.prenom} {p.nom}</div>
      {p.labels.map(l => <div key={l} className="ha-org-role">{l}</div>)}
      {chaine.length > 0 && (
        <div className="ha-org-niveaux">
          {chaine.map((nom, i) => (
            <div key={`${i}-${nom}`} className="ha-org-niveau">N+{i + 1} · {nom}</div>
          ))}
        </div>
      )}
      {(tel || p.email) && (
        <div className="ha-org-contacts">
          {tel && <a className="ha-org-contact" href={tel}>{p.telephone}</a>}
          {p.email && <a className="ha-org-contact" href={`mailto:${p.email}`}>{mailAffiche(p.email)}</a>}
        </div>
      )}
    </div>
  )
}
