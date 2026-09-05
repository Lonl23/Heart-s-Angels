import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, Tabs, Pill, Empty, Loading, Flash, inp, lbl } from '@/components/ui'
import { TYPES_LIEU, MODES, VOLUMES_O2, PRESSION_PLEINE, PRESSION_ALERTE, lblLieu, lblMode, cheminLieux, enfantsDe, resteLabel } from './stock/stockSchema'
import VueLots from './stock/VueLots'
import { aggregerLots, lotConnuPour, fmtDlc } from './stock/lotsStock'
import { ApercuEtiq, telechargerWord, telechargerPng, copierPng, telechargerCsv } from './stock/QrImg'
import Scanner from './stock/Scanner'
import { PhotoArticle, PhotoArticleChamp } from './stock/photoStock'
import OngletMouvements from './stock/OngletMouvements'
import OngletFournisseurs from './stock/OngletFournisseurs'
import OngletAlertes from './stock/OngletAlertes'
import { exporterStockExcel, lireInventaireExcel, resumeImport } from './stock/excelStock'

export default function Stock() {
  const { peutGererStock } = useAuth()
  const gerer = peutGererStock()
  const [tab, setTab] = useState('unites')
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
  async function load() {
    setLoading(true)
    const [a, b, c, d, e] = await Promise.all([
      supabase.from('stock_lieux').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_catalogue').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_unites').select('*, stock_catalogue(nom,mode,unite,volume_l,photo_path,fournisseur_id), stock_lieux(nom)').order('created_at', { ascending: false }).limit(400),
      supabase.from('stock_fournisseurs').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_dotation').select('id, lieu_id, catalogue_id'),
    ])
    setLieux(a.data || [])
    setCats(b.data || [])
    setUnites((c.data || []).map(u => ({
      ...u,
      nom: u.stock_catalogue?.nom,
      mode: u.stock_catalogue?.mode,
      unite: u.stock_catalogue?.unite,
      volume_l: u.volume_l || u.stock_catalogue?.volume_l,
      photo_path: u.photo_path || u.stock_catalogue?.photo_path,
      lieu_nom: u.stock_lieux?.nom,
    })))
    setFournisseurs(d.error ? [] : (d.data || []))
    setDotations(e.error ? [] : (e.data || []))
    setLoading(false)
  }
  function ok(msg) { setFlash(msg); setErr(null); setTimeout(() => setFlash(null), 2500) }

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
        <Empty title="Inventaire et recharge" hint="Le volontaire scanne le matériel utilisé depuis Mes missions. Les responsables suivent ici photos, mouvements, péremption et commandes." />
      </Page>
    )
  }

  return (
    <Page title="Stock" subtitle="Suivi par n° de lot et DLC, emplacement, quantité restante, mouvements et commandes."
      action={<div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Btn kind="soft" onClick={exporterExcel} disabled={excelBusy}>{excelBusy && !apercu ? '…' : 'Excel'}</Btn>
        <Btn kind="soft" onClick={() => fileRef.current?.click()} disabled={excelBusy}>Importer inventaire</Btn>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFichierInventaire} style={{ display:'none' }} />
        <Btn kind="soft" onClick={() => { setLieuCible(null); setScan('ranger') }}>Ranger (scan)</Btn>
        <Btn onClick={() => setScan('inventaire')}>Inventaire (scan lieu)</Btn>
      </div>}>
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
      <Tabs items={[
        { v:'unites', l:'Inventaire' },
        { v:'mouvements', l:'Mouvements' },
        { v:'alertes', l:'Alertes' },
        { v:'articles', l:'Articles' },
        { v:'fournisseurs', l:'Fournisseurs' },
        { v:'lieux', l:'Lieux' },
        ...(inv ? [{ v:'inventaire', l:'Scan lieu' }] : []),
      ]} value={tab} onChange={setTab} />

      {loading ? <Loading /> : (
        <>
          {tab === 'unites' && <OngletUnites unites={unites} lieux={lieux} onChange={load} onOk={ok} onErr={setErr} onXfer={setXfer} onSortie={setSortie} />}
          {tab === 'mouvements' && <OngletMouvements cats={cats} />}
          {tab === 'alertes' && (
            <OngletAlertes cats={cats} fournisseurs={fournisseurs} onOk={ok} onErr={setErr}
              onPerime={async (u) => {
                if (!confirm(`Retirer « ${u.nom} » du stock disponible (péremption) ?`)) return
                const { data, error } = await supabase.rpc('stock_marquer_perime', { p_unite: u.id, p_motif: 'périmé — retiré' })
                if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
                ok('Article marqué périmé.')
                load()
              }}
              onCommander={(cmd) => {
                const cat = cats.find(c => c.id === cmd.catalogue_id)
                if (cat) { setRecv(cat); setTab('articles') }
              }} />
          )}
          {tab === 'articles' && <OngletCatalogue cats={cats} lieux={lieux} unites={unites} fournisseurs={fournisseurs} dotations={dotations} onChange={load} onOk={ok} onErr={setErr} onRecv={setRecv} />}
          {tab === 'fournisseurs' && <OngletFournisseurs fournisseurs={fournisseurs} cats={cats} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'lieux' && <OngletLieux lieux={lieux} unites={unites} cats={cats} dotations={dotations} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'inventaire' && inv && <OngletInventaire inv={inv} onChange={load} />}
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

function etiqLieu(l) {
  return { titre: l.nom, ligne2: lblLieu(l.type), lot: '', token: l.qr_token }
}
function etiqUnite(u) {
  const titre = u.mode === 'oxygene' && u.volume_l
    ? `${u.nom || 'Oxygène'} ${Number(u.volume_l)} L`
    : (u.nom || 'Article')
  return {
    titre,
    lot: u.lot || '',
    ligne2: u.lot ? `Lot ${u.lot}` : (u.date_peremption ? `DLC ${u.date_peremption}` : ''),
    token: u.qr_token,
  }
}

function articlesPrevus(dotations, cats, lieuId) {
  const ids = (dotations || []).filter(d => d.lieu_id === lieuId).map(d => d.catalogue_id)
  return ids.map(id => (cats || []).find(c => c.id === id)).filter(Boolean)
}

function OngletLieux({ lieux, unites, cats, dotations, onChange, onOk, onErr }) {
  const [edit, setEdit] = useState(null)
  const [etiq, setEtiq] = useState(null)
  const racines = enfantsDe(lieux, null)
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
        <Btn kind="soft" onClick={() => telechargerCsv(lieux.map(etiqLieu))} disabled={!lieux.length}>CSV P-touch</Btn>
      </div>
      <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 12px' }}>Nom sous le QR pour savoir où coller. Le contenu prévu (types d’articles) s’affiche sous chaque poche — lots et quantités plus tard, à l’inventaire.</p>
      {edit && <FormLieu item={edit} lieux={lieux} onDone={() => { setEdit(null); onChange() }} />}
      {etiq && <CarteQr lieu={etiq} onClose={() => setEtiq(null)} onOk={onOk} />}
      {racines.length === 0 ? <Empty title="Aucun lieu" hint="Créez la réserve, une armoire, un sac…" /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {racines.map(l => <NoeudLieu key={l.id} n={l} lieux={lieux} cats={cats} dotations={dotations} onEdit={setEdit} onQr={setEtiq} onDel={supprimer} />)}
        </div>
      )}
    </div>
  )
}

function NoeudLieu({ n, lieux, cats, dotations, onEdit, onQr, onDel, profondeur = 0 }) {
  const kids = enfantsDe(lieux, n.id)
  const prevus = articlesPrevus(dotations, cats, n.id)
  return (
    <div>
      <Card style={{ padding:'10px 14px', marginLeft: profondeur * 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:600 }}>{n.nom}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{lblLieu(n.type)}</div>
            {prevus.length > 0 && (
              <ul style={{ margin:'6px 0 0', paddingLeft:18, fontSize:13, color:'var(--text-2)' }}>
                {prevus.map(c => <li key={c.id}>{c.nom}</li>)}
              </ul>
            )}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <Btn kind="soft" onClick={() => onQr(n)} style={{ padding:'5px 10px' }}>QR</Btn>
            <Btn kind="soft" onClick={() => onEdit(n)} style={{ padding:'5px 10px' }}>Modifier</Btn>
            <Btn kind="soft" onClick={() => onEdit({ nom:'', type: n.type === 'sac' ? 'pochette' : 'armoire', parent_id: n.id })} style={{ padding:'5px 10px' }}>+ Dedans</Btn>
            <Btn kind="danger" onClick={() => onDel(n)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
          </div>
        </div>
      </Card>
      {kids.map(k => <NoeudLieu key={k.id} n={k} lieux={lieux} cats={cats} dotations={dotations} onEdit={onEdit} onQr={onQr} onDel={onDel} profondeur={profondeur + 1} />)}
    </div>
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

function CarteQr({ lieu, unite, onClose, onOk }) {
  const e = lieu ? etiqLieu(lieu) : etiqUnite(unite)
  async function copier() {
    const ok = await copierPng(e)
    onOk?.(ok ? 'Étiquette copiée — colle-la dans P-touch ou Word (Ctrl+V).' : 'Copie impossible : télécharge le PNG.')
  }
  return (
    <Card style={{ marginBottom:12, maxWidth:360 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>Étiquette 23 × 23 mm</strong>
        <Btn kind="soft" onClick={onClose}>Fermer</Btn>
      </div>
      <ApercuEtiq titre={e.titre} ligne2={e.ligne2} token={e.token} />
      <p style={{ fontSize:12.5, color:'var(--text-muted)', margin:'10px 0' }}>
        QR + nom{unite ? ' + lot' : ''} : pour coller la bonne étiquette au bon endroit. Après, on scanne le QR.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <Btn onClick={() => telechargerPng(e)}>PNG pour Brother</Btn>
        <Btn kind="soft" onClick={() => telechargerCsv([e])}>CSV P-touch</Btn>
        <Btn kind="soft" onClick={() => telechargerWord([e])}>Word (planche 23 mm)</Btn>
        <Btn kind="soft" onClick={copier}>Copier l’image</Btn>
      </div>
    </Card>
  )
}

function OngletCatalogue({ cats, lieux, unites, fournisseurs, dotations, onChange, onOk, onErr, onRecv }) {
  const [edit, setEdit] = useState(null)
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
  const fourById = Object.fromEntries((fournisseurs || []).map(f => [f.id, f]))
  return (
    <div>
      <Btn onClick={() => setEdit({ nom:'', mode:'piece', unite:'pièce', qte_defaut:'', stock_minimal:0, fournisseur_id:'', ref_fournisseur:'' })} style={{ marginBottom:12 }}>+ Type d’article</Btn>
      {edit && <FormCatalogue item={edit} fournisseurs={fournisseurs} onDone={() => { setEdit(null); onChange() }} onOk={onOk} onErr={onErr} />}
      {cats.length === 0 ? <Empty title="Aucun type" hint="Ex. Gants nitrile M (boîte), Compresse, Oxygène 2 / 5 / 10 L. Ajoutez une photo pour reconnaître l’article." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {cats.map(c => (
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
                        {c.stock_minimal ? ` · seuil ${Number(c.stock_minimal)}` : ''}
                        {c.fournisseur_id && fourById[c.fournisseur_id] ? ` · ${fourById[c.fournisseur_id].nom}` : ''}
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
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function FormCatalogue({ item, fournisseurs, onDone, onOk, onErr }) {
  const [f, setF] = useState({ unite:'pièce', mode:'piece', stock_minimal:0, fournisseur_id:'', ref_fournisseur:'', ...item })
  const [saving, setSaving] = useState(false)
  const [photoPath, setPhotoPath] = useState(item.photo_path || null)
  async function save() {
    if (f.mode === 'boite' && !(Number(f.qte_defaut) > 0)) { alert('Pour une boîte, indiquez le nombre par défaut dedans (ex. 100).'); return }
    if (f.mode === 'oxygene' && !Number(f.volume_l)) { alert('Choisissez 2, 5 ou 10 L.'); return }
    if (f.mode === 'oxygene' && !f.nom?.trim()) f.nom = `Oxygène ${Number(f.volume_l)} L`
    if (!f.nom?.trim()) { alert('Nom requis.'); return }
    setSaving(true)
    const payload = {
      nom: f.nom.trim() || (f.mode === 'oxygene' ? `Oxygène ${Number(f.volume_l)} L` : ''),
      categorie: f.mode === 'oxygene' ? 'oxygène' : (f.categorie || null),
      mode: f.mode,
      unite: f.mode === 'oxygene' ? 'L' : (f.unite || 'pièce'),
      qte_defaut: f.mode === 'boite' ? Number(f.qte_defaut) : null,
      volume_l: f.mode === 'oxygene' ? Number(f.volume_l) : null,
      stock_minimal: Number(f.stock_minimal) || 0,
      fournisseur_id: f.fournisseur_id || null,
      ref_fournisseur: f.ref_fournisseur?.trim() || null,
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
      <F label="Nom" value={f.nom} set={v=>setF(s=>({ ...s, nom:v }))} required placeholder="Gants nitrile M, Compresse, Oxygène 5 L" />
      <Sel label="Mode QR" value={f.mode} set={v=>setF(s=>({ ...s, mode:v, ...(v==='oxygene' && !s.volume_l ? { volume_l:'5' } : {}) }))} options={MODES} />
      {f.mode === 'boite' && <F label="Nombre par défaut dans une boîte" type="number" value={f.qte_defaut} set={v=>setF(s=>({ ...s, qte_defaut:v }))} required />}
      {f.mode === 'oxygene' && (
        <Sel label="Volume de la bouteille" value={String(f.volume_l || '5')} set={v=>setF(s=>({ ...s, volume_l:v, nom: s.nom || `Oxygène ${v} L` }))} options={VOLUMES_O2} />
      )}
      {f.mode !== 'oxygene' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <F label="Unité" value={f.unite} set={v=>setF(s=>({ ...s, unite:v }))} />
          <F label="Seuil d’alerte (total)" type="number" value={f.stock_minimal} set={v=>setF(s=>({ ...s, stock_minimal:v }))} />
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

function FormReception({ cat, lieux, unites, onDone, onOk, onErr }) {
  const [f, setF] = useState({
    qte: cat.mode === 'boite' ? (cat.qte_defaut || '') : '1',
    lot:'', dlc:'', lieu_id: lieux[0]?.id || '',
    pression: String(PRESSION_PLEINE),
  })
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)
  const [dlcLiee, setDlcLiee] = useState(false)
  const [hintLot, setHintLot] = useState('')
  const [warnDlc, setWarnDlc] = useState('')

  function appliquerLotConnu(connu, dlcSaisie) {
    if (!connu?.dlc) {
      setDlcLiee(false)
      setHintLot(connu?.nb
        ? `Lot déjà en stock (${connu.nb} unité${connu.nb > 1 ? 's' : ''}) — saisissez la DLC, elle restera liée à ce n°.`
        : '')
      setWarnDlc('')
      return
    }
    setDlcLiee(true)
    setHintLot(`DLC du lot : ${fmtDlc(connu.dlc)} — même n° de lot = même péremption.`)
    if (dlcSaisie && dlcSaisie !== connu.dlc) {
      setWarnDlc(`La DLC saisie (${fmtDlc(dlcSaisie)}) diffère. On utilise ${fmtDlc(connu.dlc)}.`)
    } else {
      setWarnDlc(connu.dlc_incoherente
        ? `Attention : des unités de ce lot ont des DLC différentes (${connu.dlcs.map(fmtDlc).join(', ')}).`
        : '')
    }
    setF(s => s.dlc === connu.dlc ? s : { ...s, dlc: connu.dlc })
  }

  async function onLotChange(v) {
    setF(s => ({ ...s, lot: v }))
    const connu = lotConnuPour(unites, cat.id, v)
    appliquerLotConnu(connu, f.dlc)
  }

  async function onLotBlur() {
    const lot = (f.lot || '').trim()
    if (!lot) { setDlcLiee(false); setHintLot(''); setWarnDlc(''); return }
    let connu = lotConnuPour(unites, cat.id, lot)
    if (!connu) {
      const { data } = await supabase.from('stock_unites')
        .select('date_peremption, qte_restante, etat, lot')
        .eq('catalogue_id', cat.id)
        .limit(80)
      const same = (data || []).filter(u => (u.lot || '').trim().toLowerCase() === lot.toLowerCase())
      if (same.length) connu = lotConnuPour(same.map(u => ({ ...u, catalogue_id: cat.id })), cat.id, lot)
    }
    appliquerLotConnu(connu, f.dlc)
  }

  async function save() {
    if (cat.mode === 'boite' && !(Number(f.qte) > 0)) { onErr?.('Indiquez combien il y a dans la boîte.'); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('stock_creer_unite', {
      p_catalogue: cat.id,
      p_qte: Number(f.qte) || 1,
      p_lot: f.lot || null,
      p_dlc: f.dlc || null,
      p_lieu: f.lieu_id || null,
      p_notes: null,
      p_pression: cat.mode === 'oxygene' ? (Number(f.pression) || PRESSION_PLEINE) : 200,
    })
    setSaving(false)
    if (error || data?.ok === false) {
      if (data?.dlc_connue) {
        setF(s => ({ ...s, dlc: data.dlc_connue }))
        setDlcLiee(true)
      }
      onErr?.(error?.message || data?.error)
      return
    }
    setCreated(data.unite)
    onOk?.('Réception enregistrée — imprimez l’étiquette.')
  }
  if (created) {
    return <CarteQr unite={created} onClose={onDone} onOk={onOk} />
  }
  const optsLieu = [{ v:'', l:'— Pas encore rangé —' }, ...lieux.map(l => ({ v:l.id, l: cheminLieux(lieux, l.id) }))]
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:10, alignItems:'flex-start' }}>
        <div className="ha-stock-row">
          <PhotoArticle path={cat.photo_path} size={48} />
          <strong>Réception — {cat.nom}</strong>
        </div>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      {cat.mode === 'boite' && (
        <F label="Combien dans cette boîte ?" type="number" value={f.qte} set={v=>setF(s=>({ ...s, qte:v }))} required />
      )}
      {cat.mode === 'oxygene' && (
        <div>
          <F label="Pression à la livraison (bar)" type="number" value={f.pression} set={v=>setF(s=>({ ...s, pression:v }))} />
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
            {Number(cat.volume_l)} L × {Number(f.pression) || PRESSION_PLEINE} bar = {(Number(cat.volume_l) || 0) * (Number(f.pression) || PRESSION_PLEINE)} L d’oxygène. Une étiquette QR par bouteille.
          </div>
        </div>
      )}
      <div className="ha-stock-recv-lot" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div style={{ marginBottom:10 }}>
          <label style={lbl}>N° de lot</label>
          <input value={f.lot} onChange={e=>onLotChange(e.target.value)} onBlur={onLotBlur}
            placeholder="ex. A23-481" autoComplete="off" style={inp} />
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={lbl}>{dlcLiee ? 'Péremption — liée au lot' : 'Péremption (DLC)'}</label>
          <input type="date" value={f.dlc || ''} readOnly={dlcLiee}
            onChange={e => { if (!dlcLiee) setF(s => ({ ...s, dlc: e.target.value })) }}
            style={{ ...inp, background: dlcLiee ? 'var(--bg-alt)' : inp.background }} />
        </div>
      </div>
      {hintLot && <div style={{ fontSize:12.5, color:'var(--heading)', margin:'-4px 0 10px' }}>{hintLot}</div>}
      {warnDlc && <div style={{ fontSize:12.5, color:'#A32D2D', margin:'-4px 0 10px' }}>{warnDlc}</div>}
      <Sel label="Ranger dans" value={f.lieu_id} set={v=>setF(s=>({ ...s, lieu_id:v }))} options={optsLieu} />
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : 'Créer et imprimer le QR'}</Btn>
    </Card>
  )
}

function OngletUnites({ unites, lieux, onChange, onOk, onErr, onXfer, onSortie }) {
  const [etiq, setEtiq] = useState(null)
  const [filtre, setFiltre] = useState('')
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
    const q = filtre.trim().toLowerCase()
    if (!q) return true
    const chemin = cheminLieux(lieux, u.lieu_id)
    return [u.nom, u.lot, u.lieu_nom, chemin, u.qr_token, u.date_peremption].some(x => (x || '').toLowerCase().includes(q))
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
          : 'Chaque QR est une pièce ou une boîte. Transfert, sortie et péremption restent tracés dans Mouvements.'}
      </p>
      <label className="ha-stock-search-lab" htmlFor="stock-recherche-lot">Rechercher un n° de lot</label>
      <input id="stock-recherche-lot" value={filtre} onChange={e=>setFiltre(e.target.value)}
        placeholder="N° de lot, article ou lieu…" autoComplete="off" style={{ ...inp, marginBottom:12 }} />
      {vue === 'lots' ? (
        <VueLots lots={lots} filtre={filtre} onVoirPieces={voirPiecesDuLot} />
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
                    {u.etat !== 'dispo' && <div style={{ marginTop:4 }}><Pill color="#A32D2D" bg="#FCEBEB">{u.etat}</Pill></div>}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                      <Btn kind="soft" onClick={() => setEtiq(u)} style={{ padding:'5px 10px' }}>QR</Btn>
                      {u.etat === 'dispo' && <Btn kind="soft" onClick={() => onXfer?.(u)} style={{ padding:'5px 10px' }}>Transférer</Btn>}
                      {u.etat === 'dispo' && <Btn kind="soft" onClick={() => onSortie?.(u)} style={{ padding:'5px 10px' }}>Sortie</Btn>}
                      {u.etat === 'dispo' && <Btn kind="danger" onClick={() => perime(u)} style={{ padding:'5px 10px' }}>Péremption</Btn>}
                      <Btn kind="danger" onClick={() => supprimer(u)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
                    </div>
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

function FormTransfert({ unite, lieux, onDone, onOk, onErr }) {
  const [lieu, setLieu] = useState(unite.lieu_id || '')
  const [motif, setMotif] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    const { data, error } = await supabase.rpc('stock_transfert', {
      p_unite: unite.id, p_lieu: lieu || null, p_motif: motif || null,
    })
    setSaving(false)
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    onOk?.('Transfert enregistré.')
    onDone()
  }
  const opts = [{ v:'', l:'— Sans lieu —' }, ...lieux.map(l => ({ v:l.id, l: cheminLieux(lieux, l.id) }))]
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>Transfert — {unite.nom}</strong>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <Sel label="Nouvel emplacement" value={lieu} set={setLieu} options={opts} />
      <F label="Motif" value={motif} set={setMotif} placeholder="Recharge véhicule, retour réserve…" />
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : 'Enregistrer le transfert'}</Btn>
    </Card>
  )
}

function FormSortie({ unite, onDone, onOk, onErr }) {
  const [qte, setQte] = useState(unite.mode === 'boite' ? '' : '1')
  const [motif, setMotif] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    const n = unite.mode === 'boite' ? Number(qte) : Number(unite.qte_restante || 1)
    if (!(n > 0)) { onErr?.('Indiquez la quantité sortie.'); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('stock_sortie_manuelle', {
      p_unite: unite.id, p_qte: n, p_motif: motif || null,
    })
    setSaving(false)
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    onOk?.('Sortie enregistrée.')
    onDone()
  }
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>Sortie — {unite.nom}</strong>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      {unite.mode === 'boite' && <F label="Quantité sortie" type="number" value={qte} set={setQte} required />}
      <F label="Motif" value={motif} set={setMotif} placeholder="Casse, don, destruction, correction…" />
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : 'Enregistrer la sortie'}</Btn>
    </Card>
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
