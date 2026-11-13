function initiales(p) {
  return `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase() || '?'
}

function hrefTel(tel) {
  const num = String(tel || '').replace(/[^\d+]/g, '')
  return num ? `tel:${num}` : ''
}

function mailAffiche(email) {
  const at = email.indexOf('@')
  if (at <= 0) return email
  return <>{email.slice(0, at)}<wbr />{email.slice(at)}</>
}

export default function OrganigrammeArbre({ arbre }) {
  if (!arbre?.length) return null
  return (
    <div className="ha-org-scroll">
      <ul className="ha-org">
        {arbre.map(n => <Branche key={n.key} noeud={n} />)}
      </ul>
    </div>
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
  const tel = hrefTel(p.telephone)
  return (
    <div className="ha-org-carte">
      <div className="ha-org-photo">
        {p.photo
          ? <img src={p.photo} alt="" />
          : <span className="ha-org-initiales">{initiales(p)}</span>}
      </div>
      <div className="ha-org-nom">{p.prenom} {p.nom}</div>
      {p.labels.map(l => <div key={l} className="ha-org-role">{l}</div>)}
      {p.niveau > 0 && (
        <div className="ha-org-niveaux">
          <div className="ha-org-niveau">N+{p.niveau}</div>
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
