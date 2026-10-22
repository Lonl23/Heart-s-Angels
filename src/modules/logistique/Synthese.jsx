import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Flash, Loading } from '@/components/ui'
import { compteOuverts, quand } from './vehicules'
import {
  GRAVITES, cartesSynthese, conicGradient, filActivite, gravite, jour,
  libelleRepartition, lignesHygiene, lireStock, ordreParc, repartition,
} from './synthese'

const APERCU = 8

export default function Synthese() {
  const { peutGererStock } = useAuth()
  const gererStock = peutGererStock()
  const [etat, setEtat] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { charger() }, [gererStock])

  async function charger() {
    setErr('')
    const { data: vehicules, error } = await supabase
      .from('plaques_vehicules')
      .select('id,plaque,libelle')
      .eq('actif', true)
    if (error) { setErr(error.message); setEtat(vide()); return }
    const ids = (vehicules || []).map(v => v.id)
    const videListe = Promise.resolve({ data: [], error: null })
    const [cO, cF, suiviRes, stockRes] = await Promise.all([
      ids.length
        ? supabase.from('vehicule_constats').select('id,vehicule_id,categorie,libelle,ouvert,auteur_id,clos_le,clos_par,created_at').eq('ouvert', true).in('vehicule_id', ids).order('created_at', { ascending: false }).limit(100)
        : videListe,
      ids.length
        ? supabase.from('vehicule_constats').select('id,vehicule_id,categorie,libelle,ouvert,auteur_id,clos_le,clos_par,created_at').eq('ouvert', false).in('vehicule_id', ids).order('clos_le', { ascending: false }).limit(15)
        : videListe,
      ids.length
        ? supabase.from('vehicule_suivi').select('vehicule_id,dernier_km,desinfection_le,desinfection_par').in('vehicule_id', ids)
        : videListe,
      gererStock ? supabase.rpc('stock_alertes') : Promise.resolve({ data: null, error: null }),
    ])
    const errQ = cO.error || cF.error || suiviRes.error
    if (errQ) { setErr(errQ.message); setEtat(vide()); return }
    const ouverts = cO.data || []
    const fermes = cF.data || []
    const suivis = suiviRes.data || []
    const idsNoms = [
      ...ouverts.map(c => c.auteur_id),
      ...fermes.map(c => c.clos_par),
      ...suivis.map(s => s.desinfection_par),
    ].filter(Boolean)
    let noms = {}
    const uniques = [...new Set(idsNoms)]
    if (uniques.length) {
      const { data: profils } = await supabase.from('profiles').select('id,prenom,nom').in('id', uniques)
      noms = Object.fromEntries((profils || []).map(p => [p.id, p]))
    }
    const parVeh = Object.fromEntries(suivis.map(s => [s.vehicule_id, s]))
    const rows = (vehicules || []).map(v => ({
      ...v,
      n: compteOuverts(ouverts.filter(c => c.vehicule_id === v.id)),
      desinfection_le: parVeh[v.id]?.desinfection_le || null,
      dernier_km: parVeh[v.id]?.dernier_km ?? null,
    }))
    setEtat({
      rows,
      ouverts,
      activite: filActivite({ ouverts, fermes, suivis, vehicules, noms }),
      stock: lireStock(stockRes.data),
      stockErr: stockRes.error?.message || '',
    })
  }

  if (etat == null) return <Page title="Synthèse"><Loading /></Page>

  const cartes = cartesSynthese(etat.rows, etat.stock?.comptes)
  const rep = repartition(etat.rows)
  const parc = ordreParc(etat.rows)
  const hygiene = lignesHygiene(etat.rows)

  return (
    <Page
      title="Synthèse"
      subtitle={gererStock
        ? 'Le parc, les points ouverts, et les échéances du stock.'
        : 'Le parc et les points qui restent pour l’équipe suivante.'}
      action={<Link to="/app/logistique/vehicules" className="ha-veh-retour">Les checks</Link>}
    >
      {err && <Flash kind="err">{err}</Flash>}
      <div className="ha-syn">
        <div className="ha-syn-kpis">
          {cartes.map(c => (
            <Link key={c.cle} to={c.to} className={'ha-syn-kpi is-' + c.ton}>
              <span className="ha-syn-kpi-l">{c.label}</span>
              <span className="ha-syn-kpi-n">{c.n}</span>
              <span className="ha-syn-kpi-s">{c.hint}</span>
            </Link>
          ))}
        </div>
        <div className="ha-syn-corps">
          <section className="ha-syn-pan">
            <h2>Parc véhicule</h2>
            <div
              className="ha-syn-anneau"
              style={{ background: conicGradient(rep) }}
              role="img"
              aria-label={rep.total ? libelleRepartition(rep) : 'Aucun véhicule'}
            >
              <div className="ha-syn-anneau-trou">
                <strong>{rep.total}</strong>
                <span>{rep.total > 1 ? 'véhicules' : 'véhicule'}</span>
              </div>
            </div>
            <ul className="ha-syn-legende">
              {GRAVITES.map(g => (
                <li key={g.v}>
                  <i style={{ background: g.couleur }} />
                  <span>{g.l}</span>
                  <b>{rep[g.v]}</b>
                </li>
              ))}
            </ul>
            {parc.length === 0 ? (
              <p className="ha-syn-vide">Aucune plaque active. Elle s’ajoute dans Configuration souhaits, ou sur un souhait.</p>
            ) : (
              <div className="ha-syn-liste">
                {parc.map(v => {
                  const g = gravite(v.n)
                  const nom = v.libelle || v.plaque
                  const n = (v.n.hygiene || 0) + (v.n.materiel || 0) + (v.n.mecanique || 0)
                  return (
                    <Link key={v.id} to={`/app/logistique/vehicules/${v.id}`} className="ha-syn-veh">
                      <i className={'ha-syn-pastille is-' + g} />
                      <span>
                        <strong>{nom}</strong>
                        {v.libelle && <small>{v.plaque}</small>}
                      </span>
                      {n > 0 && <em>{n}</em>}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
          <div className="ha-syn-col">
            <section className="ha-syn-pan">
              <h2>Points ouverts</h2>
              {etat.ouverts.length === 0 ? (
                <p className="ha-syn-vide">Aucun point ouvert.</p>
              ) : (
                <div className="ha-syn-liste">
                  {etat.ouverts.slice(0, APERCU).map(c => {
                    const v = etat.rows.find(r => r.id === c.vehicule_id)
                    const cat = GRAVITES.find(g => g.v === c.categorie)
                    return (
                      <Link key={c.id} to={`/app/logistique/vehicules/${c.vehicule_id}`} className="ha-syn-point">
                        <span className={'ha-syn-etiquette is-' + c.categorie}>{cat?.l || 'Point'}</span>
                        <strong>{c.libelle}</strong>
                        <small>{(v?.libelle || v?.plaque || 'Véhicule')} · {quand(c.created_at)}</small>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
            <section className="ha-syn-pan">
              <h2>Hygiène</h2>
              <p className="ha-syn-note">La date est celle enregistrée. Aucun retard n’est calculé.</p>
              {hygiene.length === 0 ? (
                <p className="ha-syn-vide">Aucun véhicule.</p>
              ) : (
                <div className="ha-syn-liste">
                  {hygiene.slice(0, APERCU).map(v => (
                    <Link key={v.id} to={`/app/logistique/vehicules/${v.id}`} className="ha-syn-point">
                      <strong>{v.libelle || v.plaque}</strong>
                      <small>
                        {v.n.hygiene > 0 ? `${v.n.hygiene} ouvert${v.n.hygiene > 1 ? 's' : ''} · ` : ''}
                        {v.desinfection_le
                          ? `Dernière désinfection : ${quand(v.desinfection_le)}`
                          : 'Aucune désinfection enregistrée'}
                      </small>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
          <div className="ha-syn-col">
            {gererStock && (
              <section className="ha-syn-pan">
                <div className="ha-syn-entete">
                  <h2>Échéances</h2>
                  <Link to="/app/stock" className="ha-veh-retour">Le stock</Link>
                </div>
                {etat.stockErr && <p className="ha-syn-vide">{etat.stockErr}</p>}
                {!etat.stockErr && !etat.stock && <p className="ha-syn-vide">Les échéances du stock ne sont pas disponibles.</p>}
                {etat.stock && <Echeances stock={etat.stock} />}
              </section>
            )}
            {etat.stock?.commandes?.length > 0 && (
              <section className="ha-syn-pan">
                <h2>Commandes à suivre</h2>
                <div className="ha-syn-liste">
                  {etat.stock.commandes.slice(0, APERCU).map(c => (
                    <Link key={c.id} to="/app/stock" className="ha-syn-point">
                      <strong>{c.article || 'Article'}</strong>
                      <small>
                        {[
                          c.quantite != null ? String(c.quantite) : '',
                          c.fournisseur_nom || '',
                          c.date_rappel ? `rappel ${jour(c.date_rappel)}` : '',
                        ].filter(Boolean).join(' · ')}
                      </small>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            <section className="ha-syn-pan">
              <h2>Dernière activité</h2>
              {etat.activite.length === 0 ? (
                <p className="ha-syn-vide">Rien de récent sur le parc.</p>
              ) : (
                <div className="ha-syn-liste">
                  {etat.activite.map(e => (
                    <Link key={e.id} to={e.to} className="ha-syn-act">
                      <i className={'ha-syn-pastille is-' + e.kind} />
                      <span>
                        <strong>{e.titre}</strong>
                        <small>{e.detail}</small>
                      </span>
                      <span className="ha-syn-quand">
                        {e.qui}
                        <small>{quand(e.at)}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </Page>
  )
}

function vide() {
  return { rows: [], ouverts: [], activite: [], stock: null, stockErr: '' }
}

function Echeances({ stock }) {
  const blocs = [
    { t: 'Périmés', items: stock.perimes, ton: 'alerte', ligne: u => `${u.nom || 'Article'}${u.date_peremption ? ` · ${jour(u.date_peremption)}` : ''}` },
    { t: 'Dans les 15 jours', items: stock.j15, ton: 'bientot', ligne: u => `${u.nom || 'Article'}${u.date_peremption ? ` · ${jour(u.date_peremption)}` : ''}` },
    { t: 'Oxygène bas', items: stock.o2, ton: 'alerte', ligne: u => `${u.nom || 'Bouteille'}${u.pression_bar != null ? ` · ${u.pression_bar} bar` : ''}` },
    { t: 'Sous le seuil', items: stock.bas, ton: 'bientot', ligne: u => `${u.nom || 'Article'} · ${u.reste ?? 0} / ${u.stock_minimal ?? 0}${u.zone === 'sacs' ? ' · sacs' : ''}` },
  ].filter(b => b.items.length)
  if (!blocs.length) return <p className="ha-syn-vide">Aucune échéance en vue.</p>
  return (
    <div className="ha-syn-echeances">
      {blocs.map(b => (
        <div key={b.t}>
          <div className={'ha-syn-sous is-' + b.ton}>{b.t} ({b.items.length})</div>
          {b.items.slice(0, 4).map((u, i) => (
            <Link key={u.id || i} to="/app/stock" className="ha-syn-point">
              <strong>{b.ligne(u)}</strong>
              {(u.lieu_chemin || u.lieu_nom) && <small>{u.lieu_chemin || u.lieu_nom}</small>}
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}
