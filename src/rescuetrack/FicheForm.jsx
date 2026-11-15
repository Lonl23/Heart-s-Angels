import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Coquille from './Coquille'
import { enregistrerFiche, lireFiche, lirePreventif, messageErreur } from './api'
import {
  NATIONALITES,
  ORIENTATIONS,
  PATHOLOGIES,
  TRIAGES,
  SEXE_OPTIONS,
  erreursFiche,
  etiquettesDeLactivite,
  formulaireDepuisFiche,
  formulaireVide,
  payloadFiche,
} from './ficheModel'

export default function FicheForm() {
  const { id, ficheId } = useParams()
  const nav = useNavigate()
  const [activite, setActivite] = useState(undefined)
  const [form, setForm] = useState(null)
  const [numero, setNumero] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [busy, setBusy] = useState(false)

  const etiquettes = useMemo(() => etiquettesDeLactivite(activite || {}), [activite])

  useEffect(() => {
    let actif = true
    async function charger() {
      try {
        const row = await lirePreventif(id)
        if (!actif) return
        setActivite(row)
        if (!row) return
        const choix = etiquettesDeLactivite(row)
        if (!ficheId) {
          setForm(formulaireVide(choix))
          return
        }
        const fiche = await lireFiche(id, ficheId)
        if (!actif) return
        if (!fiche) {
          setErreur('Fiche introuvable.')
          setForm(formulaireVide(choix))
          return
        }
        setNumero(fiche.numero_local)
        setForm(formulaireDepuisFiche(fiche, choix))
      } catch (e) {
        if (actif) setErreur(messageErreur(e))
      }
    }
    charger()
    return () => { actif = false }
  }, [id, ficheId])

  function set(cle, valeur) {
    setForm(f => ({ ...f, [cle]: valeur }))
  }

  function basculerInconnue(coche) {
    setForm(f => ({
      ...f,
      identiteInconnue: coche,
      ...(coche ? { nom: '', prenom: '', dateNaissance: '', nationalite: '', numeroNational: '', adresse: '', cp: '', localite: '' } : {}),
    }))
  }

  async function enregistrer(e) {
    e.preventDefault()
    const problemes = erreursFiche(form, etiquettes)
    if (problemes.length) {
      setErreur(problemes[0])
      return
    }
    setBusy(true)
    setErreur(null)
    try {
      await enregistrerFiche({ activiteId: id, ficheId, payload: payloadFiche(form) })
      nav(`/p/${id}`)
    } catch (err) {
      setErreur(messageErreur(err))
      setBusy(false)
    }
  }

  const age = form?.dateNaissance ? ageAnnees(form.dateNaissance) : null

  return (
    <Coquille>
      <Link className="rt-back" to={`/p/${id}`}>← Retour au préventif</Link>
      <h1 style={{ marginBottom: 4 }}>{ficheId ? `Fiche n° ${numero ?? ''}` : 'Nouvelle fiche'}</h1>
      <p className="rt-lead">{activite?.titre || 'Préventif'}</p>
      {activite === null && <div className="ha-flash ha-flash-err">Ce préventif est introuvable. Aucune fiche ne peut être enregistrée.</div>}
      {erreur && <div className="ha-flash ha-flash-err">{erreur}</div>}
      {!form && activite !== null && <p className="rt-meta">Chargement de la fiche…</p>}
      {form && activite && (
        <form onSubmit={enregistrer}>
          <section className="rt-card-block">
            <h2>Identité</h2>
            <label className="rt-check">
              <input type="checkbox" checked={form.identiteInconnue} onChange={e => basculerInconnue(e.target.checked)} />
              Identité inconnue
            </label>
            <div className="rt-label" style={{ marginBottom: 6 }}>Sexe</div>
            <div className="rt-choices" style={{ marginBottom: 14 }}>
              {SEXE_OPTIONS.map(o => (
                <button key={o.code} type="button" className={'rt-choice' + (form.sexe === o.code ? ' is-on' : '')} onClick={() => set('sexe', form.sexe === o.code ? '' : o.code)}>
                  {o.libelle}
                </button>
              ))}
            </div>
            <div className="rt-grid2">
              <label className="rt-field">
                <span>Nom</span>
                <input value={form.nom} onChange={e => set('nom', e.target.value)} disabled={form.identiteInconnue} autoComplete="off" maxLength={120} />
              </label>
              <label className="rt-field">
                <span>Prénom</span>
                <input value={form.prenom} onChange={e => set('prenom', e.target.value)} disabled={form.identiteInconnue} autoComplete="off" maxLength={120} />
              </label>
            </div>
            <div className="rt-grid2">
              <label className="rt-field">
                <span>Date de naissance</span>
                <input type="date" value={form.dateNaissance} onChange={e => set('dateNaissance', e.target.value)} disabled={form.identiteInconnue} autoComplete="off" />
              </label>
              <div className="rt-field">
                <span>Âge</span>
                <div className="rt-age">{age == null ? '—' : `${age} an${age > 1 ? 's' : ''}`}</div>
              </div>
            </div>
            <div className="rt-grid2">
              <label className="rt-field">
                <span>Nationalité</span>
                <select value={form.nationalite} onChange={e => set('nationalite', e.target.value)} disabled={form.identiteInconnue}>
                  <option value="">Choisir</option>
                  {NATIONALITES.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
                </select>
              </label>
              <label className="rt-field">
                <span>Numéro national</span>
                <input value={form.numeroNational} onChange={e => set('numeroNational', e.target.value)} disabled={form.identiteInconnue} autoComplete="off" inputMode="text" maxLength={32} />
              </label>
            </div>
            <label className="rt-field">
              <span>Adresse</span>
              <input value={form.adresse} onChange={e => set('adresse', e.target.value)} disabled={form.identiteInconnue} autoComplete="off" maxLength={240} />
            </label>
            <div className="rt-grid2">
              <label className="rt-field">
                <span>Code postal</span>
                <input value={form.cp} onChange={e => set('cp', e.target.value)} disabled={form.identiteInconnue} autoComplete="off" inputMode="numeric" maxLength={12} />
              </label>
              <label className="rt-field">
                <span>Localité</span>
                <input value={form.localite} onChange={e => set('localite', e.target.value)} disabled={form.identiteInconnue} autoComplete="off" maxLength={120} />
              </label>
            </div>
          </section>

          <section className="rt-card-block">
            <h2>Clinique</h2>
            <div className="rt-label" style={{ marginBottom: 6 }}>Triage</div>
            <div className="rt-choices" style={{ marginBottom: 14 }}>
              {TRIAGES.map(t => (
                <button key={t} type="button" data-triage={t} className={'rt-choice' + (form.triage === t ? ' is-on' : '')} onClick={() => set('triage', t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="rt-label" style={{ marginBottom: 6 }}>Pathologie</div>
            <div className="rt-choices" style={{ marginBottom: 14 }}>
              {PATHOLOGIES.map(p => (
                <button key={p} type="button" className={'rt-choice' + (form.pathologie === p ? ' is-on' : '')} onClick={() => set('pathologie', form.pathologie === p ? '' : p)}>
                  {p}
                </button>
              ))}
            </div>
            <label className="rt-field">
              <span>Motif</span>
              <textarea value={form.motif} onChange={e => set('motif', e.target.value)} rows={3} maxLength={4000} />
            </label>
            <label className="rt-field">
              <span>Remarques</span>
              <textarea value={form.remarques} onChange={e => set('remarques', e.target.value)} rows={4} maxLength={8000} />
            </label>
          </section>

          <section className="rt-card-block">
            <h2>Orientation et heures</h2>
            <div className="rt-label" style={{ marginBottom: 6 }}>Orientation</div>
            <div className="rt-choices" style={{ marginBottom: 14 }}>
              {ORIENTATIONS.map(o => (
                <button key={o.v} type="button" className={'rt-choice' + (form.orientation === o.v ? ' is-on' : '')} onClick={() => set('orientation', form.orientation === o.v ? '' : o.v)}>
                  {o.l}
                </button>
              ))}
            </div>
            <div className="rt-grid2">
              <label className="rt-field">
                <span>Heure de début</span>
                <input type="datetime-local" value={form.heureDebut} onChange={e => set('heureDebut', e.target.value)} />
              </label>
              <label className="rt-field">
                <span>Heure de fin</span>
                <input type="datetime-local" value={form.heureFin} onChange={e => set('heureFin', e.target.value)} />
              </label>
            </div>
            {etiquettes.length > 0 && (
              <>
                <div className="rt-label" style={{ marginBottom: 6 }}>Dispositif</div>
                <div className="rt-choices">
                  {etiquettes.map(et => (
                    <button
                      key={et.cle}
                      type="button"
                      className={'rt-choice' + (form.dispositifIndex === et.index ? ' is-on' : '')}
                      onClick={() => setForm(f => ({ ...f, dispositifCode: et.code, dispositifIndex: et.index }))}
                    >
                      {et.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <div className="rt-savebar">
            <button className="rt-btn" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la fiche'}</button>
          </div>
        </form>
      )}
    </Coquille>
  )
}

function ageAnnees(dateNaissance, maintenant = new Date()) {
  const [y, m, d] = String(dateNaissance).split('-').map(Number)
  if (!y || !m || !d) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(maintenant).split('-').map(Number)
  let age = parts[0] - y
  if (parts[1] < m || (parts[1] === m && parts[2] < d)) age -= 1
  return age >= 0 && age < 130 ? age : null
}
