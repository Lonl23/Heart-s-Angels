import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Coquille from './Coquille'
import { lirePreventif, listerFiches, messageErreur } from './api'
import {
  etiquettesDeLactivite,
  formaterDateHeure,
  formaterPlage,
  libelleIdentite,
  libelleLieu,
  libelleOrientation,
} from './ficheModel'

export default function DetailPreventif() {
  const { id } = useParams()
  const [activite, setActivite] = useState(undefined)
  const [fiches, setFiches] = useState([])
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let actif = true
    Promise.all([lirePreventif(id), listerFiches(id)])
      .then(([row, liste]) => {
        if (!actif) return
        setActivite(row)
        setFiches(liste)
      })
      .catch(e => { if (actif) setErreur(messageErreur(e)) })
    return () => { actif = false }
  }, [id])

  return (
    <Coquille>
      <Link className="rt-back" to="/">← Préventifs</Link>
      {erreur && <div className="ha-flash ha-flash-err">{erreur}</div>}
      {activite === undefined && !erreur && <p className="rt-meta">Chargement…</p>}
      {activite === null && (
        <div className="ha-empty">
          <div style={{ fontWeight: 700, color: 'var(--text-2)' }}>Préventif introuvable</div>
          <p>RescueTrack n'ouvre une fiche que sur un préventif déjà présent.</p>
        </div>
      )}
      {activite && (
        <>
          <h1 style={{ marginBottom: 4 }}>{activite.titre}</h1>
          <p className="rt-meta">{libelleLieu(activite)}</p>
          <p className="rt-meta">{formaterPlage(activite.debut, activite.fin)}</p>
          {activite.organisateur_nom && <p className="rt-meta">Organisateur : {activite.organisateur_nom}</p>}
          <div className="rt-pills">
            {etiquettesDeLactivite(activite).map(e => <span key={e.cle} className="rt-pill">{e.label}</span>)}
          </div>
          <p className="rt-note" style={{ marginTop: 14 }}>
            Ce préventif se gère dans Heart's Angels. RescueTrack ne le modifie pas : il enregistre seulement les patients.
          </p>
          <div style={{ margin: '16px 0' }}>
            <Link className="rt-btn" to={`/p/${activite.id}/fiche/nouvelle`}>Nouvelle fiche</Link>
          </div>
          {fiches.length === 0 ? (
            <div className="ha-empty">
              <div style={{ fontWeight: 700, color: 'var(--text-2)' }}>Aucune fiche</div>
              <p>La première fiche recevra le numéro 1.</p>
            </div>
          ) : (
            <div className="rt-list">
              {fiches.map(f => (
                <Link key={f.id} className="rt-card" to={`/p/${activite.id}/fiche/${f.id}`}>
                  <div className="rt-fiche-top">
                    <strong>n° {f.numero_local ?? '—'}</strong>
                    <span>{libelleIdentite(f)}</span>
                  </div>
                  <div className="rt-meta">{f.motifs || 'Motif non précisé'}</div>
                  <div className="rt-meta">
                    {formaterDateHeure(f.heure_prise_en_charge) || 'Heure non précisée'}
                    {' · '}
                    {libelleOrientation(f.orientation) || 'Orientation non précisée'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </Coquille>
  )
}
