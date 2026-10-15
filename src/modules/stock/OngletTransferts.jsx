import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, F, Sel, Empty } from '@/components/ui'
import { cheminLieux, resteLabel, PRESSION_ALERTE, capaciteO2 } from './stockSchema'
import { fmtDlc } from './lotsStock'
import { correspondArticle } from './dotationStock'
import { PhotoArticle } from './photoStock'
import Scanner from './Scanner'
import ScanEmport from './ScanEmport'
import { FormReception } from './formsStock'
import { fmtDatesSouhait } from '@/modules/souhaits/datesSouhait'

const TYPES_VECTEUR = new Set(['sac', 'pochette', 'vehicule', 'armoire_vehicule'])
const TYPES_RETOUR = new Set(['reserve', 'armoire'])

const OPTIONS = [
  { v: 'ranger', l: 'Ranger', hint: 'Lieu, puis articles' },
  { v: 'doter', l: 'Doter sac / vecteur', hint: 'Sac, pochette, véhicule' },
  { v: 'emporter', l: 'Emporter', hint: 'Mission, sans consommer' },
  { v: 'retour', l: 'Retour', hint: 'Vers la réserve' },
  { v: 'interne', l: 'Transfert interne', hint: 'Autre emplacement' },
]

function unitesDispo(unites, { o2 = false } = {}) {
  return (unites || []).filter(u => {
    if (u.etat && u.etat !== 'dispo') return false
    if (o2) return u.mode === 'oxygene'
    return true
  })
}

function chercheUnites(list, q, lieux) {
  const t = (q || '').trim().toLowerCase()
  if (!t) return list.slice(0, 8)
  return list.filter(u => {
    const chemin = cheminLieux(lieux, u.lieu_id)
    return [u.nom, u.lot, u.lieu_nom, chemin, u.qr_token].some(x => (x || '').toLowerCase().includes(t))
  }).slice(0, 8)
}

function optsLieux(lieux, pred, extra = []) {
  const vis = (lieux || []).filter(pred)
  return [...extra, ...vis.map(l => ({ v: l.id, l: cheminLieux(lieux, l.id) || l.nom }))]
}

function defautLieu(lieux, pred) {
  const hit = (lieux || []).find(pred)
  return hit?.id || ''
}

function memeLotIci(unites, u) {
  if (!u) return []
  const lot = (u.lot || '').trim().toLowerCase()
  return (unites || []).filter(x =>
    x.id !== u.id
    && x.etat === 'dispo'
    && x.catalogue_id === u.catalogue_id
    && x.lieu_id === u.lieu_id
    && (x.lot || '').trim().toLowerCase() === lot
  )
}

function RecapUnite({ u, lieux }) {
  if (!u) return null
  return (
    <div className="ha-stock-row" style={{ marginBottom:12 }}>
      <PhotoArticle path={u.photo_path} size={48} />
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:700 }}>{u.nom}</div>
        <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
          {resteLabel(u)}
          {u.lot ? ` · lot ${u.lot}` : ''}
          {u.date_peremption ? ` · DLC ${fmtDlc(u.date_peremption)}` : ''}
          {' · '}
          {cheminLieux(lieux, u.lieu_id) || u.lieu_nom || 'sans lieu'}
        </div>
      </div>
    </div>
  )
}

function PickUnite({ unites, lieux, q, setQ, onPick, onScan, placeholder = 'Article, lot, lieu…' }) {
  const hits = chercheUnites(unites, q, lieux)
  return (
    <div>
      <Btn onClick={onScan} style={{ width:'100%', minHeight:48, fontSize:15.5, marginBottom:12 }}>
        Scanner le QR
      </Btn>
      <label className="ha-stock-search-lab" htmlFor="xfer-recherche-unite">Ou chercher</label>
      <input id="xfer-recherche-unite" className="ha-search" value={q} onChange={e=>setQ(e.target.value)}
        placeholder={placeholder} autoComplete="off" style={{ width:'100%', marginBottom:8 }} />
      {hits.length === 0 ? (
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8 }}>Aucun article disponible ne correspond.</div>
      ) : hits.map(u => (
        <button key={u.id} type="button" className="ha-pick-row" onClick={() => onPick(u)}>
          <div className="ha-stock-row">
            <PhotoArticle path={u.photo_path} size={40} />
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:600 }}>{u.nom}</div>
              <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                {resteLabel(u)}{u.lot ? ` · lot ${u.lot}` : ''} · {cheminLieux(lieux, u.lieu_id) || u.lieu_nom || 'sans lieu'}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

async function lireScan(token) {
  const { data, error } = await supabase.rpc('stock_scan', {
    p_token: token, p_action: 'lire', p_qte: 1, p_souhait: null, p_lieu: null,
  })
  if (error || data?.ok === false) return { error: error?.message || data?.error || 'Scan refusé' }
  return { data }
}

async function transfererUnites(ids, lieu, motif) {
  let lastErr = null
  let n = 0
  for (const id of ids) {
    const { data, error } = await supabase.rpc('stock_transfert', {
      p_unite: id, p_lieu: lieu || null, p_motif: motif || null,
    })
    if (error || data?.ok === false) { lastErr = error?.message || data?.error; break }
    n++
  }
  return { n, error: lastErr }
}

function EnteteEtape({ titre, hint, onBack }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start', marginBottom:12 }}>
      <div>
        <div style={{ fontWeight:700, color:'var(--heading)', fontSize:'1.05rem' }}>{titre}</div>
        {hint && <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>{hint}</div>}
      </div>
      <Btn kind="soft" onClick={onBack}>Retour</Btn>
    </div>
  )
}

function FormRanger({ lieux, onRanger, onErr }) {
  const [lieuId, setLieuId] = useState('')
  const [scan, setScan] = useState(false)
  const opts = optsLieux(lieux, () => true, [{ v:'', l:'— Choisir un lieu —' }])

  async function onCode(token) {
    const { data, error } = await lireScan(token)
    setScan(false)
    if (error) { onErr?.(error); return }
    if (data.kind === 'lieu' && data.lieu) {
      onRanger(data.lieu)
      return
    }
    onErr?.('Scannez d’abord le QR du lieu (étiquette de l’emplacement).')
  }

  const lieu = lieux.find(l => l.id === lieuId)
  return (
    <div>
      <p style={{ fontSize:13.5, color:'var(--text-muted)', margin:'0 0 12px' }}>
        D’abord l’emplacement, ensuite les articles. Comme coller une étiquette, puis scanner.
      </p>
      <Btn onClick={() => setScan(true)} style={{ width:'100%', minHeight:48, fontSize:15.5, marginBottom:12 }}>
        Scanner le QR du lieu
      </Btn>
      <Sel label="Ou choisir l’emplacement" value={lieuId} set={setLieuId} options={opts} />
      <Btn
        onClick={() => lieu && onRanger(lieu)}
        disabled={!lieu}
        style={{ width:'100%', minHeight:48, fontSize:15.5 }}>
        Ranger ici — scanner les articles
      </Btn>
      {scan && <Scanner titre="QR de l’emplacement" onCode={onCode} onClose={() => setScan(false)} />}
    </div>
  )
}

function FormDeplacer({
  titre, hint, unites, lieux, destPred, destDefaut, motifDefaut, placeholderMotif,
  onOk, onErr, onDone, lotPossible = false,
}) {
  const [q, setQ] = useState('')
  const [unite, setUnite] = useState(null)
  const [dest, setDest] = useState('')
  const [motif, setMotif] = useState(motifDefaut || '')
  const [toutLot, setToutLot] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scan, setScan] = useState(false)
  const dispo = useMemo(() => unitesDispo(unites), [unites])
  const freres = unite ? memeLotIci(unites, unite) : []
  const opts = optsLieux(
    lieux,
    l => (destPred ? destPred(l) : true) && (!unite || l.id !== unite.lieu_id),
    [{ v:'', l:'— Choisir —' }],
  )

  useEffect(() => {
    if (unite && destDefaut) {
      const id = destDefaut(lieux, unite)
      if (id && id !== unite.lieu_id) setDest(id)
    }
  }, [unite])

  async function onCode(token) {
    const { data, error } = await lireScan(token)
    setScan(false)
    if (error) { onErr?.(error); return }
    if (data.kind !== 'unite' || !data.unite) {
      onErr?.('Scannez le QR d’un article.')
      return
    }
    const u = dispo.find(x => x.id === data.unite.id) || { ...data.unite, nom: data.unite.nom }
    if (u.etat && u.etat !== 'dispo') { onErr?.('Cet article n’est plus disponible.'); return }
    setUnite(u)
  }

  async function save() {
    if (!unite) { onErr?.('Choisissez un article.'); return }
    if (!dest) { onErr?.('Choisissez la destination.'); return }
    if (dest === unite.lieu_id) { onErr?.('Déjà à cet emplacement.'); return }
    setSaving(true)
    const ids = toutLot && freres.length
      ? [unite.id, ...freres.map(x => x.id)]
      : [unite.id]
    const { n, error } = await transfererUnites(ids, dest, motif || motifDefaut || null)
    setSaving(false)
    if (error) { onErr?.(error); return }
    onOk?.(n > 1 ? `${n} articles transférés.` : 'Transfert enregistré.')
    onDone()
  }

  return (
    <div>
      <EnteteEtape titre={titre} hint={hint} onBack={onDone} />
      {!unite ? (
        <PickUnite unites={dispo} lieux={lieux} q={q} setQ={setQ} onPick={setUnite} onScan={() => setScan(true)} />
      ) : (
        <>
          <RecapUnite u={unite} lieux={lieux} />
          <Btn kind="soft" onClick={() => { setUnite(null); setToutLot(false) }} style={{ marginBottom:12 }}>Changer d’article</Btn>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:6 }}>De</div>
          <div className="ha-chip-sum" style={{ marginBottom:12 }}>
            {cheminLieux(lieux, unite.lieu_id) || unite.lieu_nom || 'sans lieu'}
          </div>
          {opts.filter(o => o.v).length === 0 ? (
            <div style={{ fontSize:13.5, color:'var(--text-muted)', marginBottom:12 }}>
              Aucune destination possible. Créez le lieu dans l’onglet Lieux.
            </div>
          ) : (
            <Sel label="Vers" value={dest} set={setDest} options={opts} />
          )}
          {lotPossible && freres.length > 0 && (
            <label className="ha-xfer-check">
              <input type="checkbox" checked={toutLot} onChange={e => setToutLot(e.target.checked)} />
              Déplacer tout le lot ici ({freres.length + 1} pièces)
            </label>
          )}
          <F label="Motif (facultatif)" value={motif} set={setMotif} placeholder={placeholderMotif} />
          <Btn onClick={save} disabled={saving} style={{ width:'100%', minHeight:48, fontSize:15.5 }}>
            {saving ? '…' : (toutLot && freres.length ? `Transférer ${freres.length + 1} pièces` : 'Enregistrer le transfert')}
          </Btn>
        </>
      )}
      {scan && <Scanner titre="QR de l’article" onCode={onCode} onClose={() => setScan(false)} />}
    </div>
  )
}

export function FormSortieGuide({ unites, lieux, onOk, onErr, onDone }) {
  const [q, setQ] = useState('')
  const [unite, setUnite] = useState(null)
  const [qte, setQte] = useState('')
  const [motif, setMotif] = useState('')
  const [saving, setSaving] = useState(false)
  const [scan, setScan] = useState(false)
  const dispo = useMemo(() => unitesDispo(unites), [unites])

  async function onCode(token) {
    const { data, error } = await lireScan(token)
    setScan(false)
    if (error) { onErr?.(error); return }
    if (data.kind !== 'unite' || !data.unite) { onErr?.('Scannez le QR d’un article.'); return }
    const u = dispo.find(x => x.id === data.unite.id) || data.unite
    setUnite(u)
    setQte(u.mode === 'boite' ? '' : '1')
  }

  async function save() {
    if (!unite) { onErr?.('Choisissez un article.'); return }
    const n = unite.mode === 'boite' ? Number(qte) : Number(unite.qte_restante || 1)
    if (!(n > 0)) { onErr?.('Indiquez la quantité sortie.'); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('stock_sortie_manuelle', {
      p_unite: unite.id, p_qte: n, p_motif: motif || null,
    })
    setSaving(false)
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    onOk?.('Sortie enregistrée.')
    setUnite(null)
    setMotif('')
    setQte('')
    onDone?.()
  }

  return (
    <div>
      {!unite ? (
        <PickUnite unites={dispo} lieux={lieux} q={q} setQ={setQ} onPick={u => { setUnite(u); setQte(u.mode === 'boite' ? '' : '1') }} onScan={() => setScan(true)} />
      ) : (
        <>
          <RecapUnite u={unite} lieux={lieux} />
          <Btn kind="soft" onClick={() => setUnite(null)} style={{ marginBottom:12 }}>Changer d’article</Btn>
          {unite.mode === 'boite' && <F label="Quantité sortie" type="number" value={qte} set={setQte} required />}
          <F label="Motif" value={motif} set={setMotif} placeholder="Casse, don, destruction…" />
          <Btn onClick={save} disabled={saving} style={{ width:'100%', minHeight:48, fontSize:15.5 }}>
            {saving ? '…' : 'Enregistrer la sortie'}
          </Btn>
        </>
      )}
      {scan && <Scanner titre="QR de l’article" onCode={onCode} onClose={() => setScan(false)} />}
    </div>
  )
}

export function FormO2({ unites, lieux, onOk, onErr, onDone }) {
  const [q, setQ] = useState('')
  const [unite, setUnite] = useState(null)
  const [bar, setBar] = useState('')
  const [saving, setSaving] = useState(false)
  const [scan, setScan] = useState(false)
  const bouteilles = useMemo(() => unitesDispo(unites, { o2: true }), [unites])

  function prendre(u) {
    setUnite(u)
    setBar(u.pression_bar == null ? '' : String(u.pression_bar))
  }

  async function onCode(token) {
    const { data, error } = await lireScan(token)
    setScan(false)
    if (error) { onErr?.(error); return }
    if (data.kind !== 'unite' || data.unite?.mode !== 'oxygene') {
      onErr?.('Scannez le QR d’une bouteille d’oxygène.')
      return
    }
    prendre(bouteilles.find(x => x.id === data.unite.id) || data.unite)
  }

  async function save() {
    if (!unite) { onErr?.('Choisissez une bouteille.'); return }
    const n = Number(bar)
    if (Number.isNaN(n) || n < 0) { onErr?.('Indiquez la pression au manomètre (bar).'); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('stock_scan', {
      p_token: unite.qr_token, p_action: 'ajuster', p_qte: n, p_souhait: null, p_lieu: null,
    })
    setSaving(false)
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    onOk?.(data.message || `Relevé : ${n} bar.`)
    if (n <= PRESSION_ALERTE) onErr?.('Pression ≤ 50 bar : cette bouteille doit partir en recharge.')
    onDone()
  }

  return (
    <div>
      {!unite ? (
        <PickUnite unites={bouteilles} lieux={lieux} q={q} setQ={setQ} onPick={prendre} onScan={() => setScan(true)} placeholder="O2, lot, lieu…" />
      ) : (
        <>
          <RecapUnite u={unite} lieux={lieux} />
          <div style={{ fontSize:13.5, color:'var(--text-muted)', marginBottom:10 }}>
            {Number(unite.volume_l) || '?'} L
            {bar !== '' && Number.isFinite(Number(bar))
              ? ` · ${Number(bar)} bar · ${capaciteO2(unite.volume_l, bar)} L restants`
              : ''}
            {Number(bar) <= PRESSION_ALERTE && Number(bar) >= 0 ? ' — alerte ≤ 50 bar' : ''}
          </div>
          <Btn kind="soft" onClick={() => setUnite(null)} style={{ marginBottom:12 }}>Changer de bouteille</Btn>
          <F label="Pression (bar)" type="number" value={bar} set={setBar} />
          <Btn onClick={save} disabled={saving} style={{ width:'100%', minHeight:48, fontSize:15.5 }}>
            {saving ? '…' : 'Enregistrer le relevé'}
          </Btn>
        </>
      )}
      {scan && <Scanner titre="QR de la bouteille" onCode={onCode} onClose={() => setScan(false)} />}
    </div>
  )
}

export function FormReceptionGuide({ cats, lieux, unites, onOk, onErr, onDone, onAller }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(null)
  const vis = (cats || []).filter(c => correspondArticle(c, q)).slice(0, 12)
  if (cat) {
    return (
      <div>
        <EnteteEtape titre="Réception fournisseur" hint="Lot, DLC, quantité, puis le lieu de rangement." onBack={() => setCat(null)} />
        <FormReception cat={cat} lieux={lieux} unites={unites} onDone={() => { setCat(null); onDone?.() }} onOk={onOk} onErr={onErr} />
      </div>
    )
  }
  return (
    <div>
      <label className="ha-stock-search-lab" htmlFor="xfer-recherche-cat">Type d’article</label>
      <input id="xfer-recherche-cat" className="ha-search" value={q} onChange={e=>setQ(e.target.value)}
        placeholder="Gants, compresses, O2…" autoComplete="off" style={{ width:'100%', marginBottom:8 }} />
      {vis.length === 0 ? (
        <Empty
          title="Aucun type"
          hint="Créez d’abord le type d’article."
          action={onAller ? <Btn kind="soft" onClick={() => onAller('gestion')}>Gestion articles</Btn> : null} />
      ) : vis.map(c => (
        <button key={c.id} type="button" className="ha-pick-row" onClick={() => setCat(c)}>
          <div className="ha-stock-row">
            <PhotoArticle path={c.photo_path} size={40} />
            <div>
              <div style={{ fontWeight:600 }}>{c.nom}</div>
              {c.categorie && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{c.categorie}</div>}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function FormEmporter({ onDone, onOk, onErr, onChange }) {
  const [missions, setMissions] = useState(null)
  const [choix, setChoix] = useState(null)

  useEffect(() => {
    let stop = false
    async function load() {
      const { data, error } = await supabase.from('souhaits')
        .select('id, beneficiaire_prenom, beneficiaire_nom, date_souhaitee, date_fin, dates_possibles, statut')
        .not('statut', 'in', '(realise,non_realise,annule)')
        .order('date_souhaitee', { ascending: true, nullsFirst: false })
        .limit(40)
      if (stop) return
      if (error) { setMissions([]); return }
      setMissions(data || [])
    }
    load()
    return () => { stop = true }
  }, [])

  if (choix) {
    return (
      <div>
        <EnteteEtape
          titre="Emporter en mission"
          hint={`${(choix.beneficiaire_prenom || '')} ${(choix.beneficiaire_nom || '')}`.trim() || 'Mission'}
          onBack={() => setChoix(null)} />
        <ScanEmport
          souhaitId={choix.id}
          onFlash={() => { onOk?.('Emport enregistré.'); onChange?.() }}
          onErr={onErr} />
      </div>
    )
  }

  return (
    <div>
      <EnteteEtape titre="Emporter en mission" hint="Scanner ce qui part, sans le consommer. Au retour, utilisez « Retour »." onBack={onDone} />
      {missions == null ? (
        <div style={{ fontSize:13.5, color:'var(--text-muted)' }}>Chargement…</div>
      ) : missions.length === 0 ? (
        <Empty
          title="Aucune mission à venir"
          hint="L’emport se fait aussi au départ depuis Mes missions. Pour placer du matériel dans un sac ou un véhicule, utilisez « Doter »." />
      ) : missions.map(s => (
        <button key={s.id} type="button" className="ha-pick-row" onClick={() => setChoix(s)}>
          <div style={{ fontWeight:600 }}>{`${s.beneficiaire_prenom || ''} ${s.beneficiaire_nom || ''}`.trim() || 'Mission'}</div>
          <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{fmtDatesSouhait(s)}</div>
        </button>
      ))}
    </div>
  )
}

export default function OngletTransferts({
  lieux, unites, onChange, onOk, onErr, onRanger,
}) {
  const [etape, setEtape] = useState(null)

  function fermer(msg) {
    if (msg) onOk?.(msg)
    setEtape(null)
    onChange?.()
  }

  if (etape === 'ranger') {
    return (
      <div>
        <EnteteEtape titre="Ranger / mise en stock" hint="D’abord le lieu, ensuite les QR des articles." onBack={() => setEtape(null)} />
        <FormRanger lieux={lieux} onRanger={lieu => onRanger?.(lieu)} onErr={onErr} />
      </div>
    )
  }
  if (etape === 'doter') {
    return (
      <FormDeplacer
        titre="Doter un sac / vecteur"
        hint="L’article quitte son lieu actuel pour un sac, une pochette ou un véhicule."
        unites={unites} lieux={lieux}
        destPred={l => TYPES_VECTEUR.has(l.type)}
        destDefaut={ls => defautLieu(ls, l => l.type === 'sac')}
        motifDefaut="dotation"
        placeholderMotif="Dotation sac 1, recharge véhicule…"
        onOk={onOk} onErr={onErr} onDone={() => fermer()}
        lotPossible />
    )
  }
  if (etape === 'retour') {
    return (
      <FormDeplacer
        titre="Retour"
        hint="Ramener vers la réserve ou une armoire. Le lieu actuel est déjà indiqué."
        unites={unites} lieux={lieux}
        destPred={l => TYPES_RETOUR.has(l.type) || l.type === 'autre'}
        destDefaut={ls => defautLieu(ls, l => l.type === 'reserve') || defautLieu(ls, l => l.type === 'armoire')}
        motifDefaut="retour"
        placeholderMotif="Retour réserve, fin de mission…"
        onOk={onOk} onErr={onErr} onDone={() => fermer()}
        lotPossible />
    )
  }
  if (etape === 'interne') {
    return (
      <FormDeplacer
        titre="Transfert interne"
        hint="D’un emplacement vers un autre. Cochez « tout le lot » s’il y a plusieurs pièces au même endroit."
        unites={unites} lieux={lieux}
        destPred={() => true}
        destDefaut={() => ''}
        motifDefaut="transfert de stock"
        placeholderMotif="Réorganisation, recharge…"
        onOk={onOk} onErr={onErr} onDone={() => fermer()}
        lotPossible />
    )
  }
  if (etape === 'emporter') {
    return <FormEmporter onDone={() => setEtape(null)} onOk={onOk} onErr={onErr} onChange={onChange} />
  }

  return (
    <div className="ha-xfer-menu">
      {OPTIONS.map(o => (
        <button key={o.v} type="button" className="ha-xfer-opt" onClick={() => setEtape(o.v)}>
          <span className="ha-xfer-opt-l">{o.l}</span>
          <span className="ha-xfer-opt-h">{o.hint}</span>
        </button>
      ))}
    </div>
  )
}
