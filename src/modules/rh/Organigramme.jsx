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
    supabase.from('profiles').select('id,prenom,nom,fiche,actif').neq('role', 'partenaire').eq('actif', true).order('nom')
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        setGens(data || [])
      })
  }, [])

  const arbre = useMemo(() => (gens ? construireArbre(gens) : []), [gens])

  if (gens === null) return <Page title="Organigramme"><Loading /></Page>

  return (
    <Page title="Organigramme">
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

function Branche({ noeud }) {
  return (
    <li>
      <div className="ha-org-cartes">
        {noeud.gens.map(p => <Carte key={p.id} p={p} />)}
      </div>
      {noeud.enfants.length > 0 && (
        <ul>
          {noeud.enfants.map(e => <Branche key={e.key} noeud={e} />)}
        </ul>
      )}
    </li>
  )
}

function Carte({ p }) {
  return (
    <div className="ha-org-carte">
      <div className="ha-org-photo">
        {p.photo
          ? <img src={p.photo} alt="" />
          : <span className="ha-org-initiales">{initiales(p)}</span>}
      </div>
      <div className="ha-org-nom">{p.prenom} {p.nom}</div>
      {p.labels.map(l => <div key={l} className="ha-org-role">{l}</div>)}
    </div>
  )
}
