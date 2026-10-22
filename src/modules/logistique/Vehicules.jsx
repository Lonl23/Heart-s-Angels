import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, Empty, Loading, Flash, F } from '@/components/ui'
import {
  CATEGORIES, compteOuverts, totalOuverts, nomPersonne, quand, kmOuNull,
} from './vehicules'

export default function Vehicules() {
  const { id } = useParams()
  if (id) return <FicheVehicule id={id} />
  return <ListeVehicules />
}

function ListeVehicules() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { charger() }, [])

  async function charger() {
    setErr('')
    const { data: vehicules, error } = await supabase
      .from('plaques_vehicules')
      .select('id,plaque,libelle')
      .eq('actif', true)
      .order('plaque')
    if (error) { setErr(error.message); setRows([]); return }
    const ids = (vehicules || []).map(v => v.id)
    let ouverts = []
    if (ids.length) {
      const { data, error: errC } = await supabase
        .from('vehicule_constats')
        .select('vehicule_id,categorie,ouvert')
        .eq('ouvert', true)
        .in('vehicule_id', ids)
      if (errC) { setErr(errC.message); setRows([]); return }
      ouverts = data || []
    }
    const nom = v => (v.libelle || v.plaque || '').toLocaleLowerCase('fr')
    setRows((vehicules || []).map(v => ({
      ...v,
      n: compteOuverts(ouverts.filter(c => c.vehicule_id === v.id)),
    })).sort((a, b) => nom(a).localeCompare(nom(b), 'fr')))
  }

  return (
    <Page
      title="Véhicules"
      subtitle="Ce qui est signalé reste pour l’équipe suivante. Les photos des 4 côtés restent sur le souhait."
    >
      {err && <Flash kind="err">{err}</Flash>}
      {rows == null ? <Loading /> : rows.length === 0 ? (
        <Empty
          title="Aucun véhicule pour le moment"
          hint="Une plaque s’ajoute dans Configuration souhaits, ou quand un équipage l’enregistre sur un souhait."
        />
      ) : (
        <div className="ha-veh-liste">
          {rows.map(v => {
            const total = totalOuverts(v.n)
            const nom = v.libelle || v.plaque
            return (
              <Link key={v.id} to={`/app/logistique/vehicules/${v.id}`} className="ha-veh-ligne">
                <span>
                  <span className="ha-veh-nom">{nom}</span>
                  {v.libelle && <span className="ha-veh-plaque">{v.plaque}</span>}
                </span>
                <span className="ha-veh-apercu-pts">
                  {CATEGORIES.map(c => (
                    <span key={c.v} className={v.n[c.v] ? 'is-alerte' : 'is-ok'}>
                      {c.l} {v.n[c.v] ? v.n[c.v] : '✓'}
                    </span>
                  ))}
                </span>
                <span className="ha-veh-apercu-suite">
                  {total ? `${total} ouvert${total > 1 ? 's' : ''}` : 'Rien d’ouvert'}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </Page>
  )
}

function FicheVehicule({ id }) {
  const { user, profile } = useAuth()
  const [veh, setVeh] = useState(undefined)
  const [suivi, setSuivi] = useState(null)
  const [constats, setConstats] = useState([])
  const [noms, setNoms] = useState({})
  const [cat, setCat] = useState(null)
  const [texte, setTexte] = useState('')
  const [km, setKm] = useState('')
  const [err, setErr] = useState('')
  const [signale, setSignale] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { charger() }, [id])

  async function charger() {
    setErr('')
    const { data: v, error } = await supabase
      .from('plaques_vehicules')
      .select('id,plaque,libelle,actif')
      .eq('id', id)
      .maybeSingle()
    if (error || !v) { setVeh(null); setErr(error?.message || ''); return }
    const [{ data: s }, { data: cs, error: errC }] = await Promise.all([
      supabase.from('vehicule_suivi').select('dernier_km,desinfection_le,desinfection_par').eq('vehicule_id', id).maybeSingle(),
      supabase.from('vehicule_constats').select('id,categorie,libelle,ouvert,auteur_id,clos_le,created_at').eq('vehicule_id', id).order('created_at', { ascending: false }),
    ])
    if (errC) { setErr(errC.message); setVeh(v); return }
    const liste = cs || []
    const ids = [...new Set(liste.map(c => c.auteur_id).filter(Boolean))]
    let gens = {}
    if (ids.length) {
      const { data: profils } = await supabase.from('profiles').select('id,prenom,nom').in('id', ids)
      gens = Object.fromEntries((profils || []).map(p => [p.id, p]))
    }
    setVeh(v)
    setSuivi(s || null)
    setKm(s?.dernier_km == null ? '' : String(s.dernier_km))
    setConstats(liste)
    setNoms(gens)
  }

  const n = useMemo(() => compteOuverts(constats), [constats])
  const deLaCat = constats.filter(c => c.categorie === cat)
  const ouverts = deLaCat.filter(c => c.ouvert)
  const fermes = deLaCat.filter(c => !c.ouvert)

  async function sauverKm() {
    const valeur = kmOuNull(km)
    if (valeur === undefined) { setErr('Le kilométrage est un nombre entier.'); return }
    setErr('')
    setBusy(true)
    const { error } = await supabase.from('vehicule_suivi').upsert(
      { vehicule_id: id, dernier_km: valeur },
      { onConflict: 'vehicule_id' },
    )
    setBusy(false)
    if (error) { setErr(error.message); return }
    setSuivi(s => ({ ...(s || {}), dernier_km: valeur }))
  }

  async function desinfectionFaite() {
    setErr('')
    setBusy(true)
    const { data, error } = await supabase.from('vehicule_suivi').upsert(
      { vehicule_id: id, desinfection_le: new Date().toISOString(), desinfection_par: user?.id || null },
      { onConflict: 'vehicule_id' },
    ).select('dernier_km,desinfection_le,desinfection_par').maybeSingle()
    setBusy(false)
    if (error) { setErr(error.message); return }
    setSuivi(data)
  }

  async function signaler() {
    const libelle = texte.trim()
    if (!libelle || !cat) return
    setErr('')
    setBusy(true)
    const { data, error } = await supabase.from('vehicule_constats').insert({
      vehicule_id: id,
      categorie: cat,
      libelle,
      auteur_id: user.id,
    }).select('id,categorie,libelle,ouvert,auteur_id,created_at').single()
    setBusy(false)
    if (error) { setErr(error.message); return }
    setTexte('')
    setConstats(cs => [data, ...cs])
    setNoms(ns => user?.id ? { ...ns, [user.id]: { prenom: profile?.prenom, nom: profile?.nom } } : ns)
    setSignale(data)
  }

  async function reparer(constat) {
    setErr('')
    setBusy(true)
    const { error } = await supabase.from('vehicule_constats').update({ ouvert: false }).eq('id', constat.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setConstats(cs => cs.map(c => c.id === constat.id ? { ...c, ouvert: false, clos_le: new Date().toISOString() } : c))
  }

  if (veh === undefined) return <Page title="Véhicule"><Loading /></Page>
  if (!veh) return <Page title="Véhicule"><Empty title="Véhicule introuvable" /></Page>

  const nom = veh.libelle || veh.plaque
  const catLabel = CATEGORIES.find(c => c.v === cat)?.l

  return (
    <Page
      title={nom}
      subtitle={veh.libelle ? veh.plaque : 'L’état du véhicule, en un coup d’œil.'}
      action={<Link to="/app/logistique/vehicules" className="ha-veh-retour">Tous les véhicules</Link>}
    >
      {err && <Flash kind="err">{err}</Flash>}
      {!cat && (
        <>
          <div className="ha-veh-cats">
            {CATEGORIES.map(c => (
              <button key={c.v} type="button" className={'ha-veh-cat' + (n[c.v] ? ' is-alerte' : ' is-ok')} onClick={() => { setCat(c.v); setSignale(null) }}>
                <strong>{c.l}</strong>
                <span className="ha-veh-badge">{n[c.v] ? n[c.v] : '✓'}</span>
              </button>
            ))}
          </div>
          <Card style={{ marginTop: 14 }}>
            <F label="Dernier kilométrage" value={km} set={setKm} type="number" placeholder="Facultatif" />
            <Btn kind="soft" disabled={busy} onClick={sauverKm}>Enregistrer le km</Btn>
            <p className="ha-veh-note">
              {suivi?.desinfection_le
                ? `Dernière désinfection : ${quand(suivi.desinfection_le)}.`
                : 'Aucune désinfection enregistrée.'}
            </p>
            <Btn kind="ok" disabled={busy} onClick={desinfectionFaite}>Désinfection faite</Btn>
          </Card>
          <Etiquette nom={nom} plaque={veh.plaque} id={veh.id} />
        </>
      )}
      {cat && (
        <>
          <button type="button" className="ha-veh-retour" onClick={() => { setCat(null); setSignale(null) }}>
            Les trois volets
          </button>
          <h2 className="ha-veh-cat-titre">{catLabel}</h2>
          {signale && (
            <Card style={{ textAlign: 'center', borderColor: '#3B6D11', marginBottom: 14 }}>
              <div className="ha-veh-ok">✓</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--heading)' }}>Point signalé</div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{quand(signale.created_at)}</div>
              <p style={{ marginBottom: 0 }}>Constaté. Il reste pour l’équipe suivante.</p>
            </Card>
          )}
          {ouverts.length === 0 && !signale && (
            <p className="ha-veh-note">Rien d’ouvert dans ce volet.</p>
          )}
          <div className="ha-veh-points">
            {ouverts.map(c => (
              <Card key={c.id}>
                <div style={{ fontWeight: 700 }}>{c.libelle}</div>
                <div className="ha-veh-note">{quand(c.created_at)} · {nomPersonne(noms[c.auteur_id])}</div>
                <Btn kind="ok" disabled={busy} onClick={() => reparer(c)}>C’est réparé</Btn>
              </Card>
            ))}
          </div>
          <Card style={{ marginTop: 14 }}>
            <F
              label="Signaler un point"
              value={texte}
              set={setTexte}
              placeholder="Porte arrière qui ferme mal, rayure, matériel manquant…"
            />
            <Btn disabled={busy || !texte.trim()} onClick={signaler}>Signaler</Btn>
          </Card>
          {fermes.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="ha-veh-note" style={{ fontWeight: 700 }}>Déjà réparés</div>
              {fermes.map(c => (
                <div key={c.id} className="ha-veh-ferme">{c.libelle}</div>
              ))}
            </div>
          )}
        </>
      )}
    </Page>
  )
}

function Etiquette({ nom, plaque, id }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const url = `${window.location.origin}/app/logistique/vehicules/${id}`
    let cancel = false
    QRCode.toDataURL(url, { margin: 1, width: 280 }).then(data => { if (!cancel) setSrc(data) }).catch(() => {})
    return () => { cancel = true }
  }, [id])
  if (!src) return null
  return (
    <Card style={{ marginTop: 14, textAlign: 'center' }}>
      <div style={{ fontWeight: 700, color: 'var(--heading)' }}>Étiquette à coller</div>
      <p className="ha-veh-note">Le QR ouvre ce check dans l’application, après connexion.</p>
      <img src={src} alt={`QR ${plaque}`} width={160} height={160} />
      <div style={{ fontWeight: 700 }}>{nom}</div>
      <div className="ha-veh-note">{plaque}</div>
    </Card>
  )
}
