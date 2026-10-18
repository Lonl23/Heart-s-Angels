import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, Pill, Empty, Loading, Flash, inp } from '@/components/ui'
import { TYPES_LIEU, MODES, NATURES, VOLUMES_O2, PRESSION_PLEINE, PRESSION_ALERTE, lblLieu, lblMode, lblNature, natureDepuisMode, estMateriel, cheminLieux, enfantsDe, resteLabel, nomTypeO2 } from './stock/stockSchema'
import EntretienPiece from './stock/EntretienPiece'
import VueLots from './stock/VueLots'
import { aggregerLots, fmtDlc, dlcPassee, dlcProche, qteLotLabel, lotCorrespond } from './stock/lotsStock'
import { telechargerWord, telechargerCsv } from './stock/QrImg'
import { etatDotationLieu, correspondArticle, idsLieuxFiltres } from './stock/dotationStock'
import Scanner from './stock/Scanner'
import { PhotoArticle, PhotoArticleChamp } from './stock/photoStock'
import OngletFournisseurs from './stock/OngletFournisseurs'
import OngletAlertes from './stock/OngletAlertes'
import OngletRapportSortie from './stock/OngletRapportSortie'
import OngletTransferts, { FormReceptionGuide, FormSortieGuide, FormO2 } from './stock/OngletTransferts'
import { etiqLieu, etiqUnite, CarteQr, FormReception, FormTransfert, FormSortie } from './stock/formsStock'
import { exporterStockExcel, lireInventaireExcel, resumeImport, exporterLieuxParSacExcel, telechargerCsvLieuxParSac } from './stock/excelStock'

const ACCUEIL = [
  { v: 'unites', l: 'Inventaires' },
  { v: 'transferts', l: 'Transfert' },
  { v: 'reception', l: 'Réception' },
  { v: 'declasse', l: 'Déclassé' },
  { v: 'rapport', l: 'Rapport de sortie' },
]

const PLUS = [
  ['gestion', 'Gestion articles'],
  ['alertes', 'Alertes'],
  ['fournisseurs', 'Fournisseurs'],
  ['lieux', 'Lieux'],
]

const LBL_RUBRIQUE = {
  unites: 'Inventaires',
  transferts: 'Transfert',
  reception: 'Réception',
  declasse: 'Déclassé',
  rapport: 'Rapport de sortie',
  gestion: 'Gestion articles',
  alertes: 'Alertes',
  articles: 'Gestion articles',
  fournisseurs: 'Fournisseurs',
  lieux: 'Lieux',
  inventaire: 'Scan lieu',
  o2: 'Relevé oxygène',
}

const RETOUR_INVENTAIRES = new Set(['inventaire', 'o2'])

export default function Stock() {
  const { peutGererStock } = useAuth()
  const gerer = peutGererStock()
  const [tab, setTab] = useState('accueil')
  const [plus, setPlus] = useState(false)
  const [lieux, setLieux] = useState([])
  const [cats, setCats] = useState([])
  const [unites, setUnites] = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [dotations, setDotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [scan, setScan] = useState(null) // ranger | inventaire | null
  const [lieuCible, setLieuCible] = useState(null)
  const [flash, setFlash] = useState(null)
  const [err, setErr] = useState(null)
  const [inv, setInv] = useState(null)
  const [recv, setRecv] = useState(null)
  const [xfer, setXfer] = useState(null)
  const [sortie, setSortie] = useState(null)
  const [excelBusy, setExcelBusy] = useState(false)
  const [apercu, setApercu] = useState(null)
  const fileRef = useRef()

  useEffect(() => { load() }, [])
  async function load(silencieux) {
    if (silencieux !== true) setLoading(true)
    const page = 1000
    const selUnites = '*, stock_catalogue(nom,mode,nature,unite,volume_l,photo_path,fournisseur_id,entretien_mois), stock_lieux(nom), stock_unite_entretiens(date_fait,date_prochain,created_at)'
    const [a, b, c0, d, e] = await Promise.all([
      supabase.from('stock_lieux').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_catalogue').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_unites').select(selUnites).order('created_at', { ascending: false }).range(0, page - 1),
      supabase.from('stock_fournisseurs').select('*, stock_fournisseur_contacts(id,prenom,nom,telephone,email,ordre)').eq('actif', true).order('nom'),
      supabase.from('stock_dotation').select('id, lieu_id, catalogue_id'),
    ])
    const unitesBrutes = [...(c0.data || [])]
    if ((c0.data || []).length === page) {
      for (let from = page; from < 8000; from += page) {
        const { data: chunk, error } = await supabase.from('stock_unites')
          .select(selUnites).order('created_at', { ascending: false }).range(from, from + page - 1)
        if (error) break
        unitesBrutes.push(...(chunk || []))
        if (!chunk || chunk.length < page) break
      }
    }
    setLieux(a.data || [])
    setCats(b.data || [])
    setUnites(unitesBrutes.map(u => {
      const ents = [...(u.stock_unite_entretiens || [])].sort((a, b) => {
        const d = (b.date_fait || '').localeCompare(a.date_fait || '')
        return d || (b.created_at || '').localeCompare(a.created_at || '')
      })
      return {
        ...u,
        nom: u.stock_catalogue?.nom,
        mode: u.stock_catalogue?.mode,
        nature: u.stock_catalogue?.nature,
        unite: u.stock_catalogue?.unite,
        volume_l: u.volume_l || u.stock_catalogue?.volume_l,
        photo_path: u.photo_path || u.stock_catalogue?.photo_path,
        lieu_nom: u.stock_lieux?.nom,
        entretien_mois: u.stock_catalogue?.entretien_mois,
        entretien_dernier: ents[0]?.date_fait || null,
        entretien_prochain: ents[0]?.date_prochain || null,
      }
    }))
    setFournisseurs(d.error ? [] : (d.data || []))
    setDotations(e.error ? [] : (e.data || []))
    setLoading(false)
  }
  function ok(msg) { setFlash(msg); setErr(null); setTimeout(() => setFlash(null), 2500) }
  function aller(v) {
    setPlus(false)
    if (v === 'accueil') { setScan(null); setLieuCible(null) }
    setTab(v)
  }

  async function exporterExcel() {
    setExcelBusy(true)
    setErr(null)
    try {
      const { data, error } = await supabase.rpc('stock_export')
      if (error || data?.ok === false) { setErr(error?.message || data?.error || 'Export impossible'); return }
      const nom = await exporterStockExcel(data, lieux)
      ok('Fichier téléchargé : ' + nom)
    } catch (e) {
      setErr(e.message || 'Export Excel impossible')
    } finally {
      setExcelBusy(false)
    }
  }

  async function onFichierInventaire(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null)
    try {
      const parsed = await lireInventaireExcel(file)
      setApercu({ nom: file.name, parsed })
    } catch (ex) {
      setErr(ex.message || 'Fichier illisible')
      setApercu(null)
    }
  }

  async function appliquerInventaire() {
    if (!apercu?.parsed?.aRemplir?.length) {
      setErr('Aucune quantité comptée dans le fichier.')
      return
    }
    setExcelBusy(true)
    setErr(null)
    try {
      const { data, error } = await supabase.rpc('stock_inventaire_importer', { p_lignes: apercu.parsed.aRemplir })
      if (error || data?.ok === false) { setErr(error?.message || data?.error || 'Import impossible'); return }
      ok(data.message || 'Inventaire appliqué.')
      setApercu(null)
      load()
    } catch (ex) {
      setErr(ex.message || 'Import impossible')
    } finally {
      setExcelBusy(false)
    }
  }

  async function onScan(token) {
    if (scan === 'ranger') {
      if (token.startsWith('ha:l:')) {
        const { data } = await supabase.rpc('stock_scan', { p_token: token, p_action: 'lire', p_qte: 1, p_souhait: null, p_lieu: null })
        if (data?.lieu) { setLieuCible(data.lieu); ok('Lieu : ' + data.lieu.nom + ' — scannez maintenant l’article'); }
        else setErr(data?.error || 'Lieu inconnu')
        return
      }
      if (!lieuCible) { setErr('Scannez d’abord le QR du lieu.'); return }
      const { data, error } = await supabase.rpc('stock_scan', {
        p_token: token, p_action: 'ranger', p_qte: 1, p_souhait: null, p_lieu: lieuCible.id,
      })
      if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
      ok((data.unite?.nom || 'Article') + ' → ' + (lieuCible.nom))
      load()
      return
    }
    if (scan === 'inventaire') {
      const { data, error } = await supabase.rpc('stock_scan', { p_token: token, p_action: 'inventaire', p_qte: 1, p_souhait: null, p_lieu: null })
      if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
      setInv(data)
      setScan(null)
      setTab('inventaire')
    }
  }

  if (!gerer) {
    return (
      <Page title="Stock" subtitle="Réservé à la logistique.">
        <Empty title="Inventaire et recharge" hint="Le volontaire scanne le matériel utilisé depuis Mes souhaits. Les responsables suivent ici photos, mouvements, péremption et commandes." />
      </Page>
    )
  }

  return (
    <Page>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFichierInventaire} style={{ display:'none' }} />
      {flash && <Flash>{flash}</Flash>}
      {err && <Flash kind="err">{err}</Flash>}
      {apercu && (
        <Card style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', alignItems:'flex-start' }}>
            <div>
              <strong>{apercu.nom}</strong>
              <div style={{ fontSize:13.5, color:'var(--text-muted)', marginTop:4 }}>{resumeImport(apercu.parsed)}</div>
              <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:6 }}>
                Les cellules vides ne sont pas touchées. Ne modifiez pas les colonnes id et qr.
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <Btn kind="soft" onClick={() => setApercu(null)} disabled={excelBusy}>Annuler</Btn>
              <Btn onClick={appliquerInventaire} disabled={excelBusy || !apercu.parsed.aRemplir.length}>
                {excelBusy ? '…' : 'Appliquer les comptes'}
              </Btn>
            </div>
          </div>
        </Card>
      )}
      {lieuCible && scan === 'ranger' && (
        <div style={{ fontSize:13.5, marginBottom:10, color:'var(--heading)' }}>Lieu cible : <strong>{lieuCible.nom}</strong> — scannez les articles à y placer.</div>
      )}
      {recv && <FormReception cat={recv} lieux={lieux} unites={unites} onDone={() => { setRecv(null); load() }} onOk={ok} onErr={setErr} />}
      {xfer && <FormTransfert unite={xfer} lieux={lieux} onDone={() => { setXfer(null); load() }} onOk={ok} onErr={setErr} />}
      {sortie && <FormSortie unite={sortie} onDone={() => { setSortie(null); load() }} onOk={ok} onErr={setErr} />}
      {tab !== 'accueil' && (
        <div className="ha-xfer-bar">
          <button type="button" className="ha-xfer-bar-back" onClick={() => aller(RETOUR_INVENTAIRES.has(tab) ? 'unites' : 'accueil')}>
            {RETOUR_INVENTAIRES.has(tab) ? '‹ Inventaires' : '‹ Stock'}
          </button>
          <span className="ha-xfer-bar-titre">{LBL_RUBRIQUE[tab] || ''}</span>
        </div>
      )}

      {loading ? <Loading /> : (
        <>
          {tab === 'accueil' && (
            <div>
              <div className="ha-stock-home">
                {ACCUEIL.map(o => (
                  <button key={o.v} type="button" className="ha-xfer-opt" onClick={() => aller(o.v)}>
                    <span className="ha-xfer-opt-l">{o.l}</span>
                  </button>
                ))}
              </div>
              <nav className="ha-xfer-pied" aria-label="Autres rubriques stock">
                <button type="button" onClick={() => setPlus(p => !p)} aria-expanded={plus}>Plus</button>
                {plus && (
                  <div className="ha-xfer-plus">
                    {PLUS.map(([v, l]) => (
                      <button key={v} type="button" onClick={() => aller(v)}>{l}</button>
                    ))}
                  </div>
                )}
              </nav>
            </div>
          )}
          {tab === 'transferts' && (
            <OngletTransferts
              lieux={lieux} unites={unites}
              onChange={load} onOk={ok} onErr={setErr}
              onRanger={lieu => { setLieuCible(lieu || null); setScan('ranger') }} />
          )}
          {tab === 'reception' && (
            <FormReceptionGuide
              cats={cats} lieux={lieux} unites={unites}
              onOk={ok} onErr={setErr} onAller={setTab}
              onDone={() => load()} />
          )}
          {tab === 'declasse' && (
            <FormSortieGuide
              unites={unites} lieux={lieux}
              onOk={ok} onErr={setErr}
              onDone={() => load()} />
          )}
          {tab === 'rapport' && <OngletRapportSortie cats={cats} />}
          {(tab === 'gestion' || tab === 'articles') && (
            <OngletCatalogue cats={cats} lieux={lieux} unites={unites} fournisseurs={fournisseurs} dotations={dotations} onChange={load} onOk={ok} onErr={setErr} onRecv={setRecv} />
          )}
          {tab === 'unites' && (
            <>
              <div className="ha-stock-outils">
                <Btn kind="soft" onClick={exporterExcel} disabled={excelBusy}>{excelBusy && !apercu ? '…' : 'Excel'}</Btn>
                <Btn kind="soft" onClick={() => fileRef.current?.click()} disabled={excelBusy}>Importer</Btn>
                <Btn kind="soft" onClick={() => setScan('inventaire')}>Scan lieu</Btn>
                {((cats || []).some(c => c.mode === 'oxygene') || (unites || []).some(u => u.mode === 'oxygene')) && (
                  <Btn kind="soft" onClick={() => setTab('o2')}>Oxygène</Btn>
                )}
              </div>
              <OngletUnites unites={unites} lieux={lieux} onChange={load} onRefresh={() => load(true)} onOk={ok} onErr={setErr} onXfer={setXfer} onSortie={setSortie} />
            </>
          )}
          {tab === 'o2' && (
            <FormO2 unites={unites} lieux={lieux} onOk={ok} onErr={setErr} onDone={() => { setTab('unites'); load() }} />
          )}
          {tab === 'alertes' && (
            <OngletAlertes cats={cats} fournisseurs={fournisseurs} lieux={lieux} unites={unites} dotations={dotations}
              onOk={ok} onErr={setErr}
              onPerime={async (u) => {
                if (!confirm(`Retirer « ${u.nom} » du stock disponible (péremption) ?`)) return
                const { data, error } = await supabase.rpc('stock_marquer_perime', { p_unite: u.id, p_motif: 'périmé — retiré' })
                if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
                ok('Article marqué périmé.')
                load()
              }}
              onCommander={(cmd) => {
                const cat = cats.find(c => c.id === cmd.catalogue_id)
                if (cat) setRecv(cat)
              }} />
          )}
          {tab === 'fournisseurs' && <OngletFournisseurs fournisseurs={fournisseurs} cats={cats} onChange={load} onRefresh={() => load(true)} onOk={ok} onErr={setErr} />}
          {tab === 'lieux' && <OngletLieux lieux={lieux} unites={unites} cats={cats} dotations={dotations} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'inventaire' && inv && (
            <>
              <div className="ha-stock-outils">
                <Btn kind="soft" onClick={() => setScan('inventaire')}>Autre lieu</Btn>
              </div>
              <OngletInventaire inv={inv} onChange={load} />
            </>
          )}
        </>
      )}
      {scan && (
        <Scanner
          titre={scan === 'ranger' ? (lieuCible ? 'Article à ranger ici' : 'D’abord le QR du lieu') : 'QR de l’emplacement'}
          onCode={onScan}
          onClose={() => setScan(null)}
        />
      )}
    </Page>
  )
}

function OngletLieux({ lieux, unites, cats, dotations, onChange, onOk, onErr }) {
  const [edit, setEdit] = useState(null)
  const [etiq, setEtiq] = useState(null)
  const [dot, setDot] = useState(null)
  const [q, setQ] = useState('')
  const racines = enfantsDe(lieux, null)
  const keep = idsLieuxFiltres(lieux, q)
  async function supprimer(n) {
    const kids = enfantsDe(lieux, n.id)
    if (kids.length) { onErr?.('Supprimez d’abord les emplacements à l’intérieur.'); return }
    const nArt = (unites || []).filter(u => u.lieu_id === n.id && u.etat === 'dispo').length
    if (!confirm(nArt ? `Supprimer « ${n.nom} » ? ${nArt} article(s) y sont rangés (ils resteront sans lieu).` : `Supprimer « ${n.nom} » ?`)) return
    const { error } = await supabase.from('stock_lieux').update({ actif: false }).eq('id', n.id)
    if (error) { onErr?.(error.message); return }
    if (nArt) await supabase.from('stock_unites').update({ lieu_id: null }).eq('lieu_id', n.id)
    onOk?.('Emplacement retiré.')
    onChange()
  }
  return (
    <div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <Btn onClick={() => setEdit({ nom:'', type:'armoire', parent_id: racines[0]?.id || '' })}>+ Emplacement</Btn>
        <Btn kind="soft" onClick={() => telechargerWord(lieux.map(etiqLieu))} disabled={!lieux.length}>Word — QR lieux</Btn>
        <Btn kind="soft" onClick={() => telechargerCsvLieuxParSac(lieux)} disabled={!lieux.length}>CSV P-touch par sac</Btn>
        <Btn kind="soft" onClick={() => exporterLieuxParSacExcel(lieux)} disabled={!lieux.length}>Excel par sac</Btn>
      </div>
      <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 12px' }}>
        Pour chaque pochette : le contenu prévu (modifiable) et ce qui est réellement rangé. CSV / Excel : un tableau par sac. Étiquette 90,3 × 29 mm : QR en haut, nom en bas.
      </p>
      <label className="ha-stock-search-lab" htmlFor="stock-recherche-lieu">Rechercher un emplacement</label>
      <input id="stock-recherche-lieu" className="ha-search" value={q} onChange={e=>setQ(e.target.value)}
        placeholder="Sac, pochette, véhicule…" autoComplete="off" style={{ ...inp, marginBottom:12, width:'min(100%, 420px)' }} />
      {edit && <FormLieu item={edit} lieux={lieux} onDone={() => { setEdit(null); onChange() }} />}
      {dot && (
        <FormDotation lieu={dot} cats={cats} dotations={dotations}
          onDone={() => { setDot(null); onChange() }} onOk={onOk} onErr={onErr} />
      )}
      {etiq && <CarteQr lieu={etiq} onClose={() => setEtiq(null)} onOk={onOk} />}
      {racines.length === 0 ? <Empty title="Aucun lieu" hint="Créez la réserve, une armoire, un sac…" /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {racines.filter(l => !keep || keep.has(l.id)).map(l => (
            <NoeudLieu key={l.id} n={l} lieux={lieux} cats={cats} dotations={dotations} unites={unites}
              keep={keep} onEdit={setEdit} onQr={setEtiq} onDel={supprimer} onDot={setDot} />
          ))}
        </div>
      )}
    </div>
  )
}

function NoeudLieu({ n, lieux, cats, dotations, unites, keep, onEdit, onQr, onDel, onDot, profondeur = 0 }) {
  const kids = enfantsDe(lieux, n.id).filter(k => !keep || keep.has(k.id))
  const ici = etatDotationLieu(n, lieux, cats, dotations, unites, false)
  const arbre = profondeur === 0 ? etatDotationLieu(n, lieux, cats, dotations, unites, true) : null
  const badge = ici.nbPrevu
    ? `${ici.nbOk}/${ici.nbPrevu} en place`
    : (arbre?.nbPrevu ? `${arbre.nbOk}/${arbre.nbPrevu} dans les pochettes` : null)
  const badgeColor = (ici.nbPrevu ? ici.manque.length : arbre?.manque.length)
    ? '#A32D2D' : '#3B6D11'
  return (
    <div>
      <Card style={{ padding:'10px 14px', marginLeft: profondeur * 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:600, display:'flex', gap:8, flexWrap:'wrap', alignItems:'baseline' }}>
              {n.nom}
              {badge && <span style={{ fontSize:12, fontWeight:700, color: badgeColor }}>{badge}</span>}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{lblLieu(n.type)}</div>
            {ici.prevus.length > 0 && (
              <ul style={{ margin:'6px 0 0', paddingLeft:18, fontSize:13 }}>
                {ici.prevus.map(c => {
                  const la = ici.ok.some(x => x.id === c.id)
                  return (
                    <li key={c.id} className={la ? 'ha-stock-dotation-ok' : 'ha-stock-dotation-manque'}>
                      {c.nom}{la ? '' : ' — manque'}
                    </li>
                  )
                })}
              </ul>
            )}
            {ici.extraCats.length > 0 && ici.nbPrevu > 0 && (
              <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>
                Hors liste : {ici.extraCats.map(c => c.nom).join(', ')}
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <Btn kind="soft" onClick={() => onQr(n)} style={{ padding:'5px 10px' }}>QR</Btn>
            <Btn kind="soft" onClick={() => onDot(n)} style={{ padding:'5px 10px' }}>Contenu prévu</Btn>
            <Btn kind="soft" onClick={() => onEdit(n)} style={{ padding:'5px 10px' }}>Modifier</Btn>
            <Btn kind="soft" onClick={() => onEdit({ nom:'', type: n.type === 'sac' ? 'pochette' : 'armoire', parent_id: n.id })} style={{ padding:'5px 10px' }}>+ Dedans</Btn>
            <Btn kind="danger" onClick={() => onDel(n)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
          </div>
        </div>
      </Card>
      {kids.map(k => (
        <NoeudLieu key={k.id} n={k} lieux={lieux} cats={cats} dotations={dotations} unites={unites}
          keep={keep} onEdit={onEdit} onQr={onQr} onDel={onDel} onDot={onDot} profondeur={profondeur + 1} />
      ))}
    </div>
  )
}

function FormDotation({ lieu, cats, dotations, onDone, onOk, onErr }) {
  const deja = new Set((dotations || []).filter(d => d.lieu_id === lieu.id).map(d => d.catalogue_id))
  const [ids, setIds] = useState([...deja])
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const choisis = (cats || []).filter(c => ids.includes(c.id)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const propositions = (cats || [])
    .filter(c => !ids.includes(c.id) && correspondArticle(c, q))
    .slice(0, 12)
  async function save() {
    setSaving(true)
    const next = new Set(ids)
    const add = [...next].filter(id => !deja.has(id))
    const del = [...deja].filter(id => !next.has(id))
    if (add.length) {
      const { error } = await supabase.from('stock_dotation').insert(add.map(catalogue_id => ({ lieu_id: lieu.id, catalogue_id })))
      if (error) { setSaving(false); onErr?.(error.message); return }
    }
    if (del.length) {
      const { error } = await supabase.from('stock_dotation').delete().eq('lieu_id', lieu.id).in('catalogue_id', del)
      if (error) { setSaving(false); onErr?.(error.message); return }
    }
    setSaving(false)
    onOk?.('Contenu prévu enregistré.')
    onDone()
  }
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10, gap:8 }}>
        <strong>Contenu prévu — {lieu.nom}</strong>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 10px' }}>
        Types d’articles qui doivent se trouver ici (d’après les fiches papier). Ce n’est pas encore le stock réel : rangez ensuite les QR.
      </p>
      {choisis.length === 0 ? (
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>Rien de prévu pour l’instant.</div>
      ) : (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {choisis.map(c => (
            <button key={c.id} type="button" className="ha-stock-dotation-chip"
              onClick={() => setIds(s => s.filter(id => id !== c.id))}>
              {c.nom} ×
            </button>
          ))}
        </div>
      )}
      <label className="ha-stock-search-lab" htmlFor="dotation-ajout">Ajouter un type d’article</label>
      <input id="dotation-ajout" className="ha-search" value={q} onChange={e=>setQ(e.target.value)}
        placeholder="Nom (gants, compresses, O2…)" autoComplete="off" style={{ ...inp, marginBottom:8 }} />
      {q.trim() && propositions.map(c => (
        <button key={c.id} type="button" className="ha-stock-dotation-add"
          onClick={() => { setIds(s => s.includes(c.id) ? s : [...s, c.id]); setQ('') }}>
          + {c.nom}{c.categorie ? ` · ${c.categorie}` : ''}
        </button>
      ))}
      {q.trim() && propositions.length === 0 && (
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>Aucun type ne correspond — créez-le dans l’onglet Articles.</div>
      )}
      <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:8 }}>{saving ? '…' : 'Enregistrer'}</Btn>
    </Card>
  )
}

function FormLieu({ item, lieux, onDone }) {
  const [f, setF] = useState({ type:'armoire', ...item })
  const [saving, setSaving] = useState(false)
  const opts = [{ v:'', l:'— Racine —' }, ...lieux.filter(l => l.id !== f.id).map(l => ({ v:l.id, l: cheminLieux(lieux, l.id) }))]
  async function save() {
    if (!f.nom?.trim()) { alert('Nom requis.'); return }
    setSaving(true)
    const payload = { nom: f.nom.trim(), type: f.type, parent_id: f.parent_id || null }
    if (f.id) await supabase.from('stock_lieux').update(payload).eq('id', f.id)
    else await supabase.from('stock_lieux').insert(payload)
    setSaving(false); onDone()
  }
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>{f.id ? 'Modifier le lieu' : 'Nouvel emplacement'}</strong>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <F label="Nom" value={f.nom} set={v=>setF(s=>({ ...s, nom:v }))} required placeholder="Armoire A, Sac 1, Pochette avant…" />
      <Sel label="Type" value={f.type} set={v=>setF(s=>({ ...s, type:v }))} options={TYPES_LIEU} />
      <Sel label="Dans" value={f.parent_id || ''} set={v=>setF(s=>({ ...s, parent_id:v }))} options={opts} />
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : 'Enregistrer'}</Btn>
    </Card>
  )
}

function OngletCatalogue({ cats, lieux, unites, fournisseurs, dotations, onChange, onOk, onErr, onRecv }) {
  const [edit, setEdit] = useState(null)
  const [lotEdit, setLotEdit] = useState(null)
  const [q, setQ] = useState('')
  const [savingLot, setSavingLot] = useState(false)
  const lots = useMemo(() => aggregerLots(unites, lieux), [unites, lieux])
  const lotsParCat = useMemo(() => {
    const map = new Map()
    for (const l of lots) {
      const k = l.catalogue_id
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(l)
    }
    return map
  }, [lots])
  async function supprimer(c) {
    const n = (unites || []).filter(u => u.catalogue_id === c.id).length
    if (!confirm(n
      ? `Retirer « ${c.nom} » de la liste ? ${n} pièce(s) déjà créées restent (supprime-les à part si besoin).`
      : `Supprimer le type « ${c.nom} » ?`)) return
    const { error } = await supabase.from('stock_catalogue').update({ actif: false }).eq('id', c.id)
    if (error) { onErr?.(error.message); return }
    onOk?.('Type retiré.')
    onChange()
  }
  async function saveLot() {
    if (!lotEdit) return
    setSavingLot(true)
    const { data, error } = await supabase.rpc('stock_lot_mettre_a_jour', {
      p_catalogue: lotEdit.catalogue_id,
      p_lot: lotEdit.lot || null,
      p_nouveau_lot: lotEdit.nouveauLot,
      p_dlc: lotEdit.dlc || null,
    })
    setSavingLot(false)
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    onOk?.(data.nb ? `${data.nb} unité(s) mises à jour.` : 'Lot enregistré.')
    setLotEdit(null)
    onChange?.()
  }
  const fourById = Object.fromEntries((fournisseurs || []).map(f => [f.id, f]))
  const vis = (cats || []).filter(c => {
    if (correspondArticle(c, q)) return true
    return (lotsParCat.get(c.id) || []).some(l => lotCorrespond(l, (q || '').trim().toLowerCase()))
  })
  return (
    <div>
      <Btn onClick={() => setEdit({ nom:'', mode:'piece', unite:'pièce', qte_defaut:'', stock_minimal:0, stock_minimal_sacs:0, fournisseur_id:'', ref_fournisseur:'' })} style={{ marginBottom:12 }}>+ Type d’article</Btn>
      <label className="ha-stock-search-lab" htmlFor="stock-recherche-article">Rechercher un article</label>
      <input id="stock-recherche-article" className="ha-search" value={q} onChange={e=>setQ(e.target.value)}
        placeholder="Nom, lot, lieu, référence…" autoComplete="off" style={{ ...inp, marginBottom:12, width:'min(100%, 420px)' }} />
      {edit && <FormCatalogue item={edit} fournisseurs={fournisseurs} onDone={() => { setEdit(null); onChange() }} onOk={onOk} onErr={onErr} />}
      {lotEdit && (
        <Card style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10, gap:8 }}>
            <strong>Lot — {lotEdit.article}</strong>
            <Btn kind="soft" onClick={() => setLotEdit(null)}>Annuler</Btn>
          </div>
          <F label="N° de lot" value={lotEdit.nouveauLot} set={v => setLotEdit(s => ({ ...s, nouveauLot: v }))} placeholder="tel qu’imprimé sur la boîte" />
          <F label="Date de péremption" type="date" value={lotEdit.dlc || ''} set={v => setLotEdit(s => ({ ...s, dlc: v }))} />
          <Btn onClick={saveLot} disabled={savingLot} style={{ width:'100%' }}>{savingLot ? '…' : 'Enregistrer'}</Btn>
        </Card>
      )}
      {cats.length === 0 ? <Empty title="Aucun type" hint="Ex. Gants nitrile M (boîte), Compresse, O2 B2L / B5L / B10L. Ajoutez une photo pour reconnaître l’article." />
        : vis.length === 0 ? <Empty title="Aucun article pour cette recherche" hint="Essayez le nom, le n° de lot, le lieu ou la référence fournisseur." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {vis.map(c => {
            const ls = lotsParCat.get(c.id) || []
            return (
              <Card key={c.id} style={{ padding:'12px 14px' }}>
                <div className="ha-stock-row" style={{ alignItems:'flex-start' }}>
                  <PhotoArticle path={c.photo_path} size={64} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{c.nom}</div>
                        <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                          {c.categorie ? `${c.categorie} · ` : ''}
                          {lblMode(c.mode)}{c.mode === 'boite' && c.qte_defaut ? ` · ${Number(c.qte_defaut)} ${c.unite} / boîte` : ''}
                          {c.mode === 'oxygene' && c.volume_l ? ` · ${Number(c.volume_l)} L · ${PRESSION_PLEINE} bar à la livraison` : ''}
                          {c.mode !== 'oxygene' && (Number(c.stock_minimal) || Number(c.stock_minimal_sacs))
                            ? ` · mini réserve ${Number(c.stock_minimal) || 0} · mini sacs ${Number(c.stock_minimal_sacs) || 0}`
                            : ''}
                          {` · ${lblNature(natureDepuisMode(c.mode, c.nature))}`}
                          {estMateriel(c) && Number(c.entretien_mois) > 0 ? ` · entretien tous les ${Number(c.entretien_mois)} mois` : ''}
                          {c.fournisseur_id && fourById[c.fournisseur_id] ? ` · ${fourById[c.fournisseur_id].nom}` : ' · sans fournisseur'}
                          {c.ref_fournisseur ? ` · réf. ${c.ref_fournisseur}` : ''}
                        </div>
                        {(dotations || []).filter(d => d.catalogue_id === c.id).length > 0 && (
                          <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:4 }}>
                            {(dotations || []).filter(d => d.catalogue_id === c.id).map(d => cheminLieux(lieux, d.lieu_id)).filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <Btn onClick={() => onRecv?.(c)} style={{ padding:'5px 10px' }}>+ Réception</Btn>
                        <Btn kind="soft" onClick={() => setEdit(c)} style={{ padding:'5px 10px' }}>Modifier</Btn>
                        <Btn kind="danger" onClick={() => supprimer(c)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
                      </div>
                    </div>
                    {ls.length === 0 ? (
                      <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:8 }}>Aucun lot commencé — faites une réception.</div>
                    ) : (
                      <div className="ha-stock-lots">
                        <table className="ha-stock-table is-lots">
                          <thead>
                            <tr>
                              <th>N° de lot</th>
                              <th>Péremption</th>
                              <th>Qté</th>
                              <th>Lieu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ls.map((lot, i) => {
                              const perime = dlcPassee(lot.dlc)
                              const j15 = dlcProche(lot.dlc, 15)
                              const dlcColor = perime ? '#A32D2D' : j15 ? '#BA7517' : 'var(--text-muted)'
                              return (
                                <tr key={`${c.id}-${lot.lot || 'sans'}-${i}`} className={perime ? 'is-alerte' : ''}>
                                  <td>
                                    <button type="button" className="ha-stock-table-link" onClick={() => setLotEdit({
                                      catalogue_id: c.id, article: c.nom, lot: lot.lot || '',
                                      nouveauLot: lot.lot || '', dlc: lot.dlc || '',
                                    })}>
                                      {lot.lot || 'sans n°'}
                                    </button>
                                  </td>
                                  <td style={{ color: dlcColor, fontWeight: perime || j15 ? 700 : 400 }}>
                                    {fmtDlc(lot.dlc)}
                                    {perime ? ' · périmé' : j15 ? ' · J-15' : ''}
                                  </td>
                                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{qteLotLabel(lot)}</td>
                                  <td>
                                    {(lot.lieux || []).length
                                      ? (lot.lieux || []).map((x, j) => (
                                        <div key={x.lieu_id || j}>
                                          {x.chemin || x.nom || cheminLieux(lieux, x.lieu_id) || 'sans lieu'}
                                          {x.qte != null ? ` · ${Number(x.qte)}` : ''}
                                        </div>
                                      ))
                                      : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FormCatalogue({ item, fournisseurs, onDone, onOk, onErr }) {
  const [f, setF] = useState({
    unite: 'pièce', mode: 'piece', stock_minimal: 0, stock_minimal_sacs: 0, fournisseur_id: '', ref_fournisseur: '',
    ...item,
    nature: natureDepuisMode(item.mode, item.nature),
  })
  const [saving, setSaving] = useState(false)
  const [photoPath, setPhotoPath] = useState(item.photo_path || null)
  async function save() {
    if (f.mode === 'boite' && !(Number(f.qte_defaut) > 0)) { alert('Pour une boîte, indiquez le nombre par défaut dedans (ex. 100).'); return }
    if (f.mode === 'oxygene' && !Number(f.volume_l)) { alert('Choisissez 2, 5 ou 10 L.'); return }
    if (f.mode === 'oxygene' && !f.nom?.trim()) f.nom = nomTypeO2(f.volume_l)
    if (!f.nom?.trim()) { alert('Nom requis.'); return }
    setSaving(true)
    const payload = {
      nom: f.nom.trim() || (f.mode === 'oxygene' ? nomTypeO2(f.volume_l) : ''),
      categorie: f.mode === 'oxygene' ? 'oxygène' : (f.categorie || null),
      mode: f.mode,
      nature: natureDepuisMode(f.mode, f.nature),
      unite: f.mode === 'oxygene' ? 'L' : (f.unite || 'pièce'),
      qte_defaut: f.mode === 'boite' ? Number(f.qte_defaut) : null,
      volume_l: f.mode === 'oxygene' ? Number(f.volume_l) : null,
      stock_minimal: Number(f.stock_minimal) || 0,
      stock_minimal_sacs: Number(f.stock_minimal_sacs) || 0,
      fournisseur_id: f.fournisseur_id || null,
      ref_fournisseur: f.ref_fournisseur?.trim() || null,
      entretien_mois: estMateriel(f) && Number(f.entretien_mois) > 0 ? Number(f.entretien_mois) : null,
    }
    if (f.id) {
      const { error } = await supabase.from('stock_catalogue').update(payload).eq('id', f.id)
      setSaving(false)
      if (error) { onErr?.(error.message); return }
      onDone()
      return
    }
    const { data, error } = await supabase.from('stock_catalogue').insert(payload).select('id').single()
    setSaving(false)
    if (error) { onErr?.(error.message); return }
    setF(s => ({ ...s, id: data.id }))
    onOk?.('Type enregistré — ajoutez une photo si vous voulez.')
  }
  const optsF = [{ v:'', l:'— Aucun —' }, ...(fournisseurs || []).map(x => ({ v:x.id, l:x.nom }))]
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>{item.id || f.id ? 'Modifier le type' : 'Nouveau type'}</strong>
        <Btn kind="soft" onClick={onDone}>{f.id && !item.id ? 'Terminer' : 'Annuler'}</Btn>
      </div>
      <PhotoArticleChamp path={photoPath} catalogueId={f.id} onChange={setPhotoPath} onErr={onErr} />
      <F label="Nom" value={f.nom} set={v=>setF(s=>({ ...s, nom:v }))} required placeholder="Gants nitrile M, Compresse, O2 B5L" />
      <Sel label="Mode QR" value={f.mode} set={v=>setF(s=>({ ...s, mode:v, nature: v === 'boite' ? 'consommable' : (v === 'durable' || v === 'oxygene' ? 'materiel' : s.nature), ...(v==='oxygene' && !s.volume_l ? { volume_l:'5' } : {}) }))} options={MODES} />
      <Sel label="Nature" value={natureDepuisMode(f.mode, f.nature)} set={v=>setF(s=>({ ...s, nature:v }))} options={NATURES} />
      <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:-4, marginBottom:10 }}>
        La garantie d’une commande et les dates d’entretien concernent le matériel. Un consommable n’en a pas.
      </div>
      {estMateriel(f) && (
        <F label="Entretien tous les (mois)" type="number" value={f.entretien_mois ?? ''} set={v=>setF(s=>({ ...s, entretien_mois:v }))} placeholder="12 pour une batterie, vide si aucun rythme" />
      )}
      {f.mode === 'boite' && <F label="Nombre par défaut dans une boîte" type="number" value={f.qte_defaut} set={v=>setF(s=>({ ...s, qte_defaut:v }))} required />}
      {f.mode === 'oxygene' && (
        <Sel label="Volume de la bouteille" value={String(f.volume_l || '5')} set={v=>setF(s=>({ ...s, volume_l:v, nom: s.nom || nomTypeO2(v) }))} options={VOLUMES_O2} />
      )}
      {f.mode !== 'oxygene' && <F label="Unité" value={f.unite} set={v=>setF(s=>({ ...s, unite:v }))} />}
      {f.mode !== 'oxygene' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <F label="Stock mini réserve" type="number" value={f.stock_minimal} set={v=>setF(s=>({ ...s, stock_minimal:v }))} />
          <F label="Stock mini sacs" type="number" value={f.stock_minimal_sacs} set={v=>setF(s=>({ ...s, stock_minimal_sacs:v }))} />
        </div>
      )}
      {f.mode !== 'oxygene' && <F label="Catégorie" value={f.categorie} set={v=>setF(s=>({ ...s, categorie:v }))} placeholder="consommable, logistique…" />}
      <Sel label="Fournisseur habituel" value={f.fournisseur_id || ''} set={v=>setF(s=>({ ...s, fournisseur_id:v }))} options={optsF} />
      <F label="Référence fournisseur" value={f.ref_fournisseur} set={v=>setF(s=>({ ...s, ref_fournisseur:v }))} placeholder="SKU / n° article" />
      {f.mode === 'oxygene' && (
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>
          Livraison : {PRESSION_PLEINE} bar. Capacité pleine = volume × {PRESSION_PLEINE}
          {f.volume_l ? ` → ${Number(f.volume_l) * PRESSION_PLEINE} L` : ''}. Alerte à {PRESSION_ALERTE} bar ou à la péremption. Chaque bouteille a son QR.
        </div>
      )}
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : (f.id && !item.id ? 'Mettre à jour' : 'Enregistrer')}</Btn>
    </Card>
  )
}

function OngletUnites({ unites, lieux, onChange, onRefresh, onOk, onErr, onXfer, onSortie }) {
  const [etiq, setEtiq] = useState(null)
  const [entretienId, setEntretienId] = useState(null)
  const [filtre, setFiltre] = useState('')
  const [lieuFiltre, setLieuFiltre] = useState('')
  const [vue, setVue] = useState('lots')
  const [rpcLots, setRpcLots] = useState(null)
  useEffect(() => {
    let cancel = false
    supabase.rpc('stock_lots').then(({ data }) => {
      if (!cancel && data?.ok) setRpcLots(data.lots)
      else if (!cancel) setRpcLots(null)
    })
    return () => { cancel = true }
  }, [unites])
  const lots = rpcLots ?? aggregerLots(unites, lieux)
  const vis = unites.filter(u => {
    if (lieuFiltre && u.lieu_id !== lieuFiltre) return false
    const q = filtre.trim().toLowerCase()
    if (!q) return true
    const chemin = cheminLieux(lieux, u.lieu_id)
    return [u.nom, u.lot, u.lieu_nom, chemin, u.qr_token, u.date_peremption, u.numero_serie].some(x => (x || '').toLowerCase().includes(q))
  })
  const lotsVis = (lots || []).filter(l => {
    if (lieuFiltre && !(l.lieux || []).some(x => x.lieu_id === lieuFiltre)) return false
    return true
  })
  async function supprimer(u) {
    if (!confirm(`Supprimer « ${u.nom || 'cette pièce'} » et son QR ? L’historique de mouvements est conservé.`)) return
    const { error } = await supabase.from('stock_unites').delete().eq('id', u.id)
    if (error) { onErr?.(error.message); return }
    onOk?.('Entrée supprimée.')
    onChange()
  }
  async function perime(u) {
    if (!confirm(`Marquer « ${u.nom} » comme périmé et le retirer du stock disponible ?`)) return
    const { data, error } = await supabase.rpc('stock_marquer_perime', { p_unite: u.id, p_motif: 'mise en péremption' })
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    onOk?.('Article marqué périmé.')
    onChange()
  }
  async function perimeLot(lot) {
    const n = Number(lot.nb_unites) || 0
    if (!confirm(`Retirer du stock disponible les ${n} unité${n > 1 ? 's' : ''} du lot « ${lot.lot || 'sans n°'} » (${lot.article}) ?`)) return
    const { data, error } = await supabase.rpc('stock_marquer_perime_lot', {
      p_catalogue: lot.catalogue_id,
      p_lot: lot.lot || null,
      p_motif: 'périmé — lot retiré',
    })
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    onOk?.(`${data.nb} unité(s) marquées périmées.`)
    onChange()
  }
  function voirPiecesDuLot(lot) {
    setFiltre(lot)
    setVue('pieces')
  }
  return (
    <div>
      {etiq && <CarteQr unite={etiq} onClose={() => setEtiq(null)} onOk={onOk} />}
      <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:12, alignItems:'center' }}>
        <div className="ha-stock-vue">
          <button type="button" className={'ha-tab-like' + (vue === 'lots' ? ' is-on' : '')} onClick={() => setVue('lots')}>Par lot</button>
          <button type="button" className={'ha-tab-like' + (vue === 'pieces' ? ' is-on' : '')} onClick={() => setVue('pieces')}>Pièces (QR)</button>
        </div>
        {vue === 'pieces' && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Btn kind="soft" onClick={() => telechargerCsv(vis.map(etiqUnite))} disabled={!vis.length}>CSV P-touch ({vis.length})</Btn>
            <Btn kind="soft" onClick={() => telechargerWord(vis.map(etiqUnite))} disabled={!vis.length}>Word — visibles</Btn>
            <Btn kind="soft" onClick={() => telechargerWord(unites.map(etiqUnite))} disabled={!unites.length}>Word — tous</Btn>
          </div>
        )}
      </div>
      <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 12px' }}>
        {vue === 'lots'
          ? 'Un n° de lot = une DLC. Quantité restante et emplacements (où c’est rangé). Les QR restent une pièce / une boîte.'
          : 'Chaque QR est une pièce ou une boîte. Sur le matériel, le bouton Entretien renseigne le n° de série et les dates. Transfert, sortie et péremption restent tracés dans Mouvements.'}
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }} className="ha-stock-recv-lot">
        <div>
          <label className="ha-stock-search-lab" htmlFor="stock-recherche-lot">Rechercher</label>
          <input id="stock-recherche-lot" value={filtre} onChange={e=>setFiltre(e.target.value)}
            placeholder="N° de lot, n° de série, article ou lieu…" autoComplete="off" style={{ ...inp, marginBottom:0 }} />
        </div>
        <Sel label="Emplacement" value={lieuFiltre} set={setLieuFiltre}
          options={[{ v:'', l:'Tous les emplacements' }, ...lieux.map(l => ({ v:l.id, l: cheminLieux(lieux, l.id) || l.nom }))]} />
      </div>
      {vue === 'lots' ? (
        <VueLots lots={lotsVis} filtre={filtre} onVoirPieces={voirPiecesDuLot} onPerimeLot={perimeLot} />
      ) : vis.length === 0 ? (
        <Empty title="Aucune pièce" hint="Réceptionnez un type d’article pour générer un QR, ou cherchez un autre n° de lot." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {vis.map(u => {
            const perimeDlc = u.date_peremption && u.date_peremption < new Date().toISOString().slice(0,10)
            return (
              <Card key={u.id} style={{ padding:'12px 14px' }}>
                <div className="ha-stock-row" style={{ alignItems:'flex-start' }}>
                  <PhotoArticle path={u.photo_path} size={56} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600 }}>{u.nom}</div>
                    <div style={{ fontSize:12.5, color: (u.mode === 'oxygene' && Number(u.pression_bar) <= PRESSION_ALERTE) || perimeDlc ? '#A32D2D' : 'var(--text-muted)' }}>
                      {resteLabel(u)}{u.lot ? ` · lot ${u.lot}` : ''} · {cheminLieux(lieux, u.lieu_id) || u.lieu_nom || 'sans lieu'}
                      {u.date_peremption ? ` · DLC ${fmtDlc(u.date_peremption)}` : ''}
                    </div>
                    {estMateriel(u) && (
                      <div style={{ fontSize:12.5, color: u.entretien_prochain && u.entretien_prochain < new Date().toISOString().slice(0,10) ? '#A32D2D' : 'var(--text-muted)', marginTop:2 }}>
                        {u.numero_serie ? `n° ${u.numero_serie}` : 'sans n° de série'}
                        {u.entretien_prochain ? ` · prochain entretien ${fmtDlc(u.entretien_prochain)}` : ' · entretien non renseigné'}
                      </div>
                    )}
                    {u.etat !== 'dispo' && <div style={{ marginTop:4 }}><Pill color="#A32D2D" bg="#FCEBEB">{u.etat}</Pill></div>}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                      <Btn kind="soft" onClick={() => setEtiq(u)} style={{ padding:'5px 10px' }}>QR</Btn>
                      {estMateriel(u) && (
                        <Btn kind="soft" onClick={() => setEntretienId(entretienId === u.id ? null : u.id)} style={{ padding:'5px 10px' }}>Entretien</Btn>
                      )}
                      {u.etat === 'dispo' && <Btn kind="soft" onClick={() => onXfer?.(u)} style={{ padding:'5px 10px' }}>Transférer</Btn>}
                      {u.etat === 'dispo' && <Btn kind="soft" onClick={() => onSortie?.(u)} style={{ padding:'5px 10px' }}>Sortie</Btn>}
                      {u.etat === 'dispo' && <Btn kind="danger" onClick={() => perime(u)} style={{ padding:'5px 10px' }}>Péremption</Btn>}
                      <Btn kind="danger" onClick={() => supprimer(u)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
                    </div>
                    {entretienId === u.id && estMateriel(u) && (
                      <EntretienPiece unite={u} onOk={onOk} onErr={onErr} onChange={onRefresh || onChange} />
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OngletInventaire({ inv, onChange }) {
  const items = inv.items || []
  const [qtes, setQtes] = useState({})
  async function ajuster(u) {
    const n = qtes[u.id]
    if (n === '' || n == null) return
    const { data, error } = await supabase.rpc('stock_scan', {
      p_token: u.qr_token, p_action: 'ajuster', p_qte: Number(n), p_souhait: null, p_lieu: null,
    })
    if (error || data?.ok === false) { alert(error?.message || data?.error); return }
    onChange()
  }
  return (
    <div>
      <h3 style={{ margin:'0 0 12px', color:'var(--heading)' }}>{inv.lieu?.nom}</h3>
      {items.length === 0 ? <Empty title="Rien ici" hint="Rangez des articles en scannant le lieu puis les QR." /> : items.map(u => (
        <Card key={u.id} style={{ padding:'10px 14px', marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:600 }}>{u.nom}</div>
              <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{resteLabel(u)}{u.lot ? ` · lot ${u.lot}` : ''}{u.date_peremption ? ` · DLC ${u.date_peremption}` : ''} · {u.lieu_nom}</div>
            </div>
            {u.mode === 'boite' && (
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input type="number" placeholder="compté" value={qtes[u.id] ?? ''} onChange={e=>setQtes(s=>({ ...s, [u.id]: e.target.value }))}
                  style={{ ...inp, width:88, margin:0 }} />
                <Btn kind="soft" onClick={() => ajuster(u)}>Corriger</Btn>
              </div>
            )}
            {u.mode === 'oxygene' && (
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input type="number" placeholder="bar" value={qtes[u.id] ?? ''} onChange={e=>setQtes(s=>({ ...s, [u.id]: e.target.value }))}
                  style={{ ...inp, width:88, margin:0 }} />
                <Btn kind="soft" onClick={() => ajuster(u)}>Relevé bar</Btn>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
