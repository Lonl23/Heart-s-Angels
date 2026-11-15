import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Coquille from './Coquille'
import { listerPreventifs, messageErreur } from './api'
import {
  etiquettesDeLactivite,
  formaterPlage,
  libelleLieu,
  statutPreventif,
} from './ficheModel'

const GROUPES = [
  { id: 'en_cours', titre: 'En cours' },
  { id: 'a_venir', titre: 'À venir' },
  { id: 'passe', titre: 'Passés' },
]

export default function ListePreventifs() {
  const [lignes, setLignes] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let actif = true
    listerPreventifs()
      .then(rows => { if (actif) setLignes(rows) })
      .catch(e => { if (actif) setErreur(messageErreur(e)) })
    return () => { actif = false }
  }, [])

  const groupes = GROUPES.map(g => ({
    ...g,
    items: (lignes || [])
      .filter(a => statutPreventif(a) === g.id)
      .sort((a, b) => {
        const da = new Date(g.id === 'passe' ? a.fin || a.debut : a.debut).getTime()
        const db = new Date(g.id === 'passe' ? b.fin || b.debut : b.debut).getTime()
        return g.id === 'a_venir' ? da - db : db - da
      }),
  })).filter(g => g.items.length)

  return (
    <Coquille>
      <h1 style={{ marginBottom: 4 }}>Préventifs</h1>
      <p className="rt-lead">
        RescueTrack n'enregistre les patients que sur les préventifs déjà présents. Les dispositifs se créent dans Heart's Angels.
      </p>
      {erreur && <div className="ha-flash ha-flash-err">{erreur}</div>}
      {lignes === null && !erreur && <p className="rt-meta">Chargement des préventifs…</p>}
      {lignes && lignes.length === 0 && (
        <div className="ha-empty">
          <div style={{ fontWeight: 700, color: 'var(--text-2)' }}>Aucun préventif</div>
          <p>Les préventifs se créent dans app.heartsangels.be. RescueTrack ne fait qu'enregistrer les patients.</p>
        </div>
      )}
      {groupes.map(g => (
        <section key={g.id}>
          <div className="rt-section">{g.titre}</div>
          <div className="rt-list">
            {g.items.map(a => {
              const etiquettes = etiquettesDeLactivite(a)
              return (
                <Link key={a.id} to={`/p/${a.id}`} className="rt-card">
                  <h2>{a.titre}</h2>
                  <div className="rt-meta">{libelleLieu(a)}</div>
                  <div className="rt-meta">{formaterPlage(a.debut, a.fin)}</div>
                  {etiquettes.length > 0 && (
                    <div className="rt-pills">
                      {etiquettes.map(e => <span key={e.cle} className="rt-pill">{e.label}</span>)}
                    </div>
                  )}
                  <div className="rt-meta" style={{ marginTop: 8, fontWeight: 700, color: 'var(--text)' }}>
                    {a.nbFiches === 0 ? 'Aucune fiche' : a.nbFiches === 1 ? '1 fiche' : `${a.nbFiches} fiches`}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </Coquille>
  )
}
