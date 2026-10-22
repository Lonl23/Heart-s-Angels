import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Flash, Loading } from '@/components/ui'
import { nomPersonne, quand } from './vehicules'
import {
  familleLieu, groupesLignes, idsLieuEtEnfants, ilYa, lignesDepuisStock,
  manquants, peremptionLibelle, progression,
} from './checkVehicule'

export function ChoisirChecklist({ vehiculeId, peutRelier, onChoisir, onFermer }) {
  const [lieux, setLieux] = useState(null)
  const [choix, setChoix] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { charger() }, [vehiculeId])

  async function charger() {
    const { data, error } = await supabase
      .from('stock_lieux')
      .select('id,nom,type,plaque_id,actif')
      .eq('actif', true)
      .order('nom')
    if (error) { setErr(error.message); setLieux([]); return }
    setLieux(data || [])
  }

  async function relier() {
    if (!choix) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.from('stock_lieux').update({ plaque_id: vehiculeId }).eq('id', choix)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setChoix('')
    charger()
  }

  if (lieux == null) return <Loading />
  const lies = lieux.filter(l => l.plaque_id === vehiculeId)
  const libres = lieux.filter(l => !l.plaque_id && ['sac', 'pochette', 'vehicule', 'armoire_vehicule'].includes(l.type))
  const sacs = lies.filter(l => familleLieu(l.type) === 'Sac')
  const appareils = lies.filter(l => familleLieu(l.type) !== 'Sac')

  return (
    <div className="ha-chk-feuille">
      <h2>Choisir une checklist</h2>
      <p className="ha-syn-note">Sélectionnez ce que vous souhaitez vérifier sur ce véhicule.</p>
      {err && <Flash kind="err">{err}</Flash>}
      <div className="ha-chk-famille">En lien avec ce véhicule</div>
      {lies.length === 0 && (
        <p className="ha-syn-vide">Aucun sac ni appareil n’est relié à ce véhicule.</p>
      )}
      {sacs.length > 0 && <Groupe titre="Sac" n={sacs.length} lieux={sacs} onChoisir={onChoisir} />}
      {appareils.length > 0 && <Groupe titre="Appareil" n={appareils.length} lieux={appareils} onChoisir={onChoisir} />}
      {peutRelier && (
        <div className="ha-chk-relier">
          <label className="ha-chk-label" htmlFor="relier-lieu">Relier un sac ou un appareil</label>
          <select id="relier-lieu" value={choix} onChange={e => setChoix(e.target.value)}>
            <option value="">Choisir…</option>
            {libres.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
          <Btn kind="soft" disabled={busy || !choix} onClick={relier}>Relier</Btn>
        </div>
      )}
      <button type="button" className="ha-chk-fermer" onClick={onFermer}>Fermer</button>
    </div>
  )
}

function Groupe({ titre, n, lieux, onChoisir }) {
  return (
    <div className="ha-chk-groupe">
      <div className="ha-chk-famille">{titre} <span>{n}</span></div>
      {lieux.map(l => (
        <button key={l.id} type="button" className="ha-chk-ligne" onClick={() => onChoisir(l)}>
          <strong>{l.nom}</strong>
          <small>{familleLieu(l.type)}</small>
        </button>
      ))}
    </div>
  )
}

export function CheckSac({ vehiculeId, lieu, user, profile, peutDater, onVehicule, onRetourListe }) {
  const [pret, setPret] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [vue, setVue] = useState('accueil')
  const [ouverte, setOuverte] = useState(null)
  const [lignes, setLignes] = useState([])
  const [derniere, setDerniere] = useState(null)
  const [dates, setDates] = useState([])
  const [datesCochees, setDatesCochees] = useState(false)
  const [filtre, setFiltre] = useState('')
  const [auteur, setAuteur] = useState('')
  const [stock, setStock] = useState({ lieux: [], unites: [], dots: [], articles: [] })

  useEffect(() => { charger() }, [lieu.id, vehiculeId])

  async function charger() {
    setErr('')
    const { data: lieux, error } = await supabase
      .from('stock_lieux')
      .select('id,parent_id,nom,type,actif')
      .eq('actif', true)
    if (error) { setErr(error.message); setPret(true); return }
    const ids = idsLieuEtEnfants(lieux || [], lieu.id)
    const [{ data: unites }, { data: dots }, { data: vers }] = await Promise.all([
      supabase.from('stock_unites').select('id,catalogue_id,lieu_id,qte_restante,date_peremption,etat,lot').in('lieu_id', ids).eq('etat', 'dispo'),
      supabase.from('stock_dotation').select('lieu_id,catalogue_id').in('lieu_id', ids),
      supabase.from('vehicule_verifications').select('id,ouverte,commence_le,valide_le,valide_par,auteur_id,dates_verifiees').eq('vehicule_id', vehiculeId).eq('lieu_id', lieu.id).order('commence_le', { ascending: false }).limit(8),
    ])
    const catIds = [...new Set([
      ...(dots || []).map(d => d.catalogue_id),
      ...(unites || []).map(u => u.catalogue_id),
    ].filter(Boolean))]
    let articles = []
    if (catIds.length) {
      const { data } = await supabase.from('stock_catalogue').select('id,nom,categorie,mode').in('id', catIds)
      articles = data || []
    }
    const session = (vers || []).find(v => v.ouverte) || null
    let ls = []
    if (session) {
      const { data } = await supabase.from('vehicule_verification_lignes').select('id,catalogue_id,categorie,libelle,qte,coche,date_peremption').eq('verification_id', session.id).order('libelle')
      ls = data || []
      const qui = session.auteur_id
      if (qui) {
        const { data: p } = await supabase.from('profiles').select('prenom,nom').eq('id', qui).maybeSingle()
        setAuteur(nomPersonne(p))
      }
    }
    setOuverte(session)
    setLignes(ls)
    setDatesCochees(!!session?.dates_verifiees)
    setDerniere((vers || []).find(v => v.valide_le) || null)
    setDates(unites || [])
    setStock({ lieux: lieux || [], unites: unites || [], dots: dots || [], articles })
    setPret(true)
  }

  const prevues = useMemo(() => lignesDepuisStock({
    lieuId: lieu.id,
    lieux: stock.lieux,
    dotations: stock.dots,
    unites: stock.unites,
    articles: stock.articles,
  }), [stock, lieu.id])

  const groupes = groupesLignes(filtre ? lignes.filter(l => l.categorie === filtre) : lignes)
  const prog = progression(lignes)
  const oublies = manquants(lignes)
  const perimes = dates.filter(u => peremptionLibelle(u.date_peremption).ton === 'alerte')

  async function commencer() {
    if (!prevues.length || !user?.id) return
    setBusy(true)
    setErr('')
    const { data: verif, error } = await supabase.from('vehicule_verifications').insert({
      vehicule_id: vehiculeId,
      lieu_id: lieu.id,
      auteur_id: user.id,
    }).select('id,ouverte,commence_le,auteur_id,dates_verifiees').single()
    if (error) {
      setBusy(false)
      setErr(error.code === '23505' ? 'Une vérification est déjà ouverte.' : error.message)
      return
    }
    const { error: errL } = await supabase.from('vehicule_verification_lignes').insert(prevues.map(l => ({
      verification_id: verif.id,
      catalogue_id: l.catalogue_id,
      categorie: l.categorie,
      libelle: l.libelle,
      qte: l.qte,
      date_peremption: l.date_peremption,
      coche: false,
    })))
    setBusy(false)
    if (errL) { setErr(errL.message); return }
    setAuteur(nomPersonne(profile))
    setOuverte(verif)
    setVue('liste')
    const { data } = await supabase.from('vehicule_verification_lignes').select('id,catalogue_id,categorie,libelle,qte,coche,date_peremption').eq('verification_id', verif.id).order('libelle')
    setLignes(data || [])
  }

  async function cocher(ligne) {
    const coche = !ligne.coche
    setLignes(ls => ls.map(l => l.id === ligne.id ? { ...l, coche } : l))
    const { error } = await supabase.from('vehicule_verification_lignes').update({ coche }).eq('id', ligne.id)
    if (error) { setErr(error.message); setLignes(ls => ls.map(l => l.id === ligne.id ? { ...l, coche: ligne.coche } : l)) }
  }

  async function annuler() {
    if (!ouverte) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.from('vehicule_verifications').delete().eq('id', ouverte.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setOuverte(null)
    setLignes([])
    setVue('accueil')
  }

  async function valider() {
    if (!ouverte) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.from('vehicule_verifications').update({
      valide_le: new Date().toISOString(),
      dates_verifiees: datesCochees,
    }).eq('id', ouverte.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setOuverte(null)
    setDerniere({ valide_le: new Date().toISOString(), valide_par: user?.id })
    setVue('accueil')
  }

  async function sauverDate(unite, valeur) {
    setErr('')
    const { error } = await supabase.from('stock_unites').update({
      date_peremption: valeur || null,
    }).eq('id', unite.id)
    if (error) { setErr(error.message); return }
    setDates(ds => ds.map(u => u.id === unite.id ? { ...u, date_peremption: valeur || null } : u))
  }

  if (!pret) return <Loading />

  const cats = [...new Set(lignes.map(l => l.categorie || 'Sans catégorie'))]

  return (
    <div className="ha-chk">
      {err && <Flash kind="err">{err}</Flash>}
      {vue === 'accueil' && (
        <>
          <button type="button" className="ha-veh-retour" onClick={onRetourListe}>Les checklists</button>
          <h2 className="ha-chk-titre">{lieu.nom}</h2>
          <p className="ha-syn-note">{familleLieu(lieu.type)}</p>
          <div className="ha-chk-meta">
            <span>Dernière vérification</span>
            <strong>{derniere?.valide_le ? ilYa(derniere.valide_le) : 'Jamais'}</strong>
            <span>Péremption</span>
            <strong className={perimes.length ? 'is-alerte' : ''}>{perimes.length ? `${perimes.length} périmé${perimes.length > 1 ? 's' : ''}` : 'Aucune alerte'}</strong>
          </div>
          <div className="ha-chk-actions">
            <button type="button" className="ha-chk-rond" disabled={busy || (!ouverte && !prevues.length)} onClick={() => ouverte ? setVue('liste') : commencer()}>
              <span>✓</span>Vérifier
            </button>
            <button type="button" className="ha-chk-rond" onClick={() => setVue('dates')}>
              <span>◷</span>Suivi des dates
            </button>
            <button type="button" className="ha-chk-rond" onClick={onVehicule}>
              <span>🚑</span>Véhicule
            </button>
          </div>
          {!prevues.length && !ouverte && (
            <p className="ha-syn-vide">Ce sac n’a pas encore de contenu. La logistique le prépare dans le stock.</p>
          )}
          {ouverte && (
            <div className="ha-chk-session">
              <div className="ha-chk-session-t">Vérification en cours</div>
              <p>Une session est déjà ouverte.</p>
              <div className="ha-chk-session-d">{quand(ouverte.commence_le)} · {auteur}</div>
              <div className="ha-chk-barre"><i style={{ width: `${prog.pct}%` }} /></div>
              <div className="ha-chk-pct">{prog.pct} %</div>
              <Btn disabled={busy} onClick={() => setVue('liste')}>Continuer</Btn>
              <button type="button" className="ha-chk-annuler" disabled={busy} onClick={annuler}>Annuler et repartir à zéro</button>
            </div>
          )}
        </>
      )}
      {vue === 'liste' && (
        <>
          <button type="button" className="ha-veh-retour" onClick={() => setVue('accueil')}>{lieu.nom}</button>
          <div className="ha-chk-chips">
            <button type="button" className={!filtre ? 'is-on' : ''} onClick={() => setFiltre('')}>Tout</button>
            {cats.map(c => (
              <button key={c} type="button" className={filtre === c ? 'is-on' : ''} onClick={() => setFiltre(c)}>{c}</button>
            ))}
          </div>
          {groupes.map(g => (
            <section key={g.categorie}>
              <h3>{g.categorie}</h3>
              {g.lignes.map(l => (
                <div key={l.id} className="ha-chk-item">
                  <span>
                    <strong>{l.libelle}</strong>
                    {l.date_peremption && <small className={peremptionLibelle(l.date_peremption).ton === 'alerte' ? 'is-alerte' : ''}>{peremptionLibelle(l.date_peremption).l}</small>}
                  </span>
                  {Number(l.qte) > 0 && <em>× {Number(l.qte)}</em>}
                  <button type="button" role="switch" aria-checked={l.coche} className={'ha-chk-switch' + (l.coche ? ' is-on' : '')} onClick={() => cocher(l)} />
                </div>
              ))}
            </section>
          ))}
          <div className="ha-chk-bas">
            <Btn onClick={() => setVue('validation')}>Valider</Btn>
          </div>
        </>
      )}
      {vue === 'validation' && (
        <>
          <button type="button" className="ha-veh-retour" onClick={() => setVue('liste')}>Revenir à la liste</button>
          <h2 className="ha-chk-titre">Validation</h2>
          {oublies.length > 0 && (
            <div className="ha-chk-alerte">
              <strong>Checklist incomplète</strong>
              <span>{oublies.length} article{oublies.length > 1 ? 's' : ''} non coché{oublies.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {oublies.length > 0 && (
            <div className="ha-chk-manquants">
              {oublies.map((l, i) => (
                <div key={l.id}><span>{i + 1}</span>{l.libelle}</div>
              ))}
            </div>
          )}
          <label className="ha-chk-coche">
            <input type="checkbox" checked={datesCochees} onChange={e => setDatesCochees(e.target.checked)} />
            Dates de péremption vérifiées
          </label>
          <p className="ha-syn-note">Validée au nom de {nomPersonne(profile)}. Une fois validée, la vérification ne peut plus être modifiée.</p>
          <Btn disabled={busy} onClick={valider}>Valider la vérification</Btn>
        </>
      )}
      {vue === 'dates' && (
        <>
          <button type="button" className="ha-veh-retour" onClick={() => setVue('accueil')}>{lieu.nom}</button>
          <h2 className="ha-chk-titre">Suivi des dates</h2>
          {dates.length === 0 && <p className="ha-syn-vide">Aucune pièce dans ce sac pour y noter une date.</p>}
          {dates.map(u => {
            const art = stock.articles.find(a => a.id === u.catalogue_id)
            const etat = peremptionLibelle(u.date_peremption)
            return (
              <div key={u.id} className="ha-chk-item">
                <span>
                  <strong>{art?.nom || 'Article'}</strong>
                  <small className={etat.ton === 'alerte' ? 'is-alerte' : ''}>{etat.l}</small>
                </span>
                {peutDater ? (
                  <input type="date" value={u.date_peremption ? String(u.date_peremption).slice(0, 10) : ''} onChange={e => sauverDate(u, e.target.value)} />
                ) : (
                  <small>La logistique note la date</small>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
