import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, Tabs, Pill, Empty, Loading, Flash, inp } from '@/components/ui'
import { TYPES_LIEU, MODES, VOLUMES_O2, PRESSION_PLEINE, PRESSION_ALERTE, lblLieu, lblMode, cheminLieux, enfantsDe, resteLabel } from './stock/stockSchema'
import { ApercuEtiq, telechargerWord, telechargerPng, copierPng, telechargerCsv } from './stock/QrImg'
import Scanner from './stock/Scanner'

export default function Stock() {
  const { peutGererStock } = useAuth()
  const gerer = peutGererStock()
  const [tab, setTab] = useState('lieux')
  const [lieux, setLieux] = useState([])
  const [cats, setCats] = useState([])
  const [unites, setUnites] = useState([])
  const [loading, setLoading] = useState(true)
  const [scan, setScan] = useState(null) // ranger | inventaire | null
  const [lieuCible, setLieuCible] = useState(null)
  const [flash, setFlash] = useState(null)
  const [err, setErr] = useState(null)
  const [inv, setInv] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [a, b, c] = await Promise.all([
      supabase.from('stock_lieux').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_catalogue').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_unites').select('*, stock_catalogue(nom,mode,unite,volume_l), stock_lieux(nom)').order('created_at', { ascending: false }).limit(400),
    ])
    setLieux(a.data || [])
    setCats(b.data || [])
    setUnites((c.data || []).map(u => ({
      ...u,
      nom: u.stock_catalogue?.nom,
      mode: u.stock_catalogue?.mode,
      unite: u.stock_catalogue?.unite,
      volume_l: u.volume_l || u.stock_catalogue?.volume_l,
      lieu_nom: u.stock_lieux?.nom,
    })))
    setLoading(false)
  }
  function ok(msg) { setFlash(msg); setErr(null); setTimeout(() => setFlash(null), 2500) }

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
        <Empty title="Inventaire et recharge" hint="Le volontaire scanne le matériel utilisé depuis Mes missions. Les responsables rechargent et inventorient ici." />
      </Page>
    )
  }

  return (
    <Page title="Stock" subtitle="QR par pièce ou boîte. Nom et lot sur l’étiquette pour coller au bon endroit."
      action={<div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Btn kind="soft" onClick={() => { setLieuCible(null); setScan('ranger') }}>Ranger (scan)</Btn>
        <Btn onClick={() => setScan('inventaire')}>Inventaire (scan lieu)</Btn>
      </div>}>
      {flash && <Flash>{flash}</Flash>}
      {err && <Flash kind="err">{err}</Flash>}
      {lieuCible && scan === 'ranger' && (
        <div style={{ fontSize:13.5, marginBottom:10, color:'var(--heading)' }}>Lieu cible : <strong>{lieuCible.nom}</strong> — scannez les articles à y placer.</div>
      )}
      <Tabs items={[
        { v:'lieux', l:'Lieux' },
        { v:'articles', l:'Types d’articles' },
        { v:'unites', l:'Pièces & boîtes' },
        { v:'alertes', l:'Alertes' },
        ...(inv ? [{ v:'inventaire', l:'Inventaire' }] : []),
      ]} value={tab} onChange={setTab} />

      {loading ? <Loading /> : (
        <>
          {tab === 'lieux' && <OngletLieux lieux={lieux} unites={unites} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'articles' && <OngletCatalogue cats={cats} lieux={lieux} unites={unites} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'unites' && <OngletUnites unites={unites} lieux={lieux} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'alertes' && <OngletAlertes />}
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

function OngletLieux({ lieux, unites, onChange, onOk, onErr }) {
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
      <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 12px' }}>Nom sous le QR pour savoir où coller. Ensuite on scanne.</p>
      {edit && <FormLieu item={edit} lieux={lieux} onDone={() => { setEdit(null); onChange() }} />}
      {etiq && <CarteQr lieu={etiq} onClose={() => setEtiq(null)} onOk={onOk} />}
      {racines.length === 0 ? <Empty title="Aucun lieu" hint="Créez la réserve, une armoire, un sac…" /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {racines.map(l => <NoeudLieu key={l.id} n={l} lieux={lieux} onEdit={setEdit} onQr={setEtiq} onDel={supprimer} />)}
        </div>
      )}
    </div>
  )
}

function NoeudLieu({ n, lieux, onEdit, onQr, onDel, profondeur = 0 }) {
  const kids = enfantsDe(lieux, n.id)
  return (
    <div>
      <Card style={{ padding:'10px 14px', marginLeft: profondeur * 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:600 }}>{n.nom}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{lblLieu(n.type)}</div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <Btn kind="soft" onClick={() => onQr(n)} style={{ padding:'5px 10px' }}>QR</Btn>
            <Btn kind="soft" onClick={() => onEdit(n)} style={{ padding:'5px 10px' }}>Modifier</Btn>
            <Btn kind="soft" onClick={() => onEdit({ nom:'', type: n.type === 'sac' ? 'pochette' : 'armoire', parent_id: n.id })} style={{ padding:'5px 10px' }}>+ Dedans</Btn>
            <Btn kind="danger" onClick={() => onDel(n)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
          </div>
        </div>
      </Card>
      {kids.map(k => <NoeudLieu key={k.id} n={k} lieux={lieux} onEdit={onEdit} onQr={onQr} onDel={onDel} profondeur={profondeur + 1} />)}
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

function OngletCatalogue({ cats, lieux, unites, onChange, onOk, onErr }) {
  const [edit, setEdit] = useState(null)
  const [recv, setRecv] = useState(null)
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
  return (
    <div>
      <Btn onClick={() => setEdit({ nom:'', mode:'piece', unite:'pièce', qte_defaut:'', stock_minimal:0 })} style={{ marginBottom:12 }}>+ Type d’article</Btn>
      {edit && <FormCatalogue item={edit} onDone={() => { setEdit(null); onChange() }} />}
      {recv && <FormReception cat={recv} lieux={lieux} onDone={() => { setRecv(null); onChange() }} onOk={onOk} onErr={onErr} />}
      {cats.length === 0 ? <Empty title="Aucun type" hint="Ex. Gants nitrile M (boîte), Compresse, Oxygène 2 / 5 / 10 L." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {cats.map(c => (
            <Card key={c.id} style={{ padding:'12px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{c.nom}</div>
                  <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                    {lblMode(c.mode)}{c.mode === 'boite' && c.qte_defaut ? ` · ${Number(c.qte_defaut)} ${c.unite} / boîte` : ''}
                    {c.mode === 'oxygene' && c.volume_l ? ` · ${Number(c.volume_l)} L · ${PRESSION_PLEINE} bar à la livraison` : ''}
                    {c.stock_minimal ? ` · seuil ${Number(c.stock_minimal)}` : ''}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <Btn onClick={() => setRecv(c)} style={{ padding:'5px 10px' }}>+ Réception</Btn>
                  <Btn kind="soft" onClick={() => setEdit(c)} style={{ padding:'5px 10px' }}>Modifier</Btn>
                  <Btn kind="danger" onClick={() => supprimer(c)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function FormCatalogue({ item, onDone }) {
  const [f, setF] = useState({ unite:'pièce', mode:'piece', stock_minimal:0, ...item })
  const [saving, setSaving] = useState(false)
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
    }
    if (f.id) await supabase.from('stock_catalogue').update(payload).eq('id', f.id)
    else await supabase.from('stock_catalogue').insert(payload)
    setSaving(false); onDone()
  }
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>{f.id ? 'Modifier le type' : 'Nouveau type'}</strong>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
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
      {f.mode === 'oxygene' && (
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>
          Livraison : {PRESSION_PLEINE} bar. Capacité pleine = volume × {PRESSION_PLEINE}
          {f.volume_l ? ` → ${Number(f.volume_l) * PRESSION_PLEINE} L` : ''}. Alerte à {PRESSION_ALERTE} bar ou à la péremption. Chaque bouteille a son QR.
        </div>
      )}
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : 'Enregistrer'}</Btn>
    </Card>
  )
}

function FormReception({ cat, lieux, onDone, onOk, onErr }) {
  const [f, setF] = useState({
    qte: cat.mode === 'boite' ? (cat.qte_defaut || '') : '1',
    lot:'', dlc:'', lieu_id: lieux[0]?.id || '',
    pression: String(PRESSION_PLEINE),
  })
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)
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
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    setCreated(data.unite)
    onOk?.('Réception enregistrée — imprimez l’étiquette.')
  }
  if (created) {
    return <CarteQr unite={created} onClose={onDone} onOk={onOk} />
  }
  const optsLieu = [{ v:'', l:'— Pas encore rangé —' }, ...lieux.map(l => ({ v:l.id, l: cheminLieux(lieux, l.id) }))]
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>Réception — {cat.nom}</strong>
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
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="N° de lot" value={f.lot} set={v=>setF(s=>({ ...s, lot:v }))} />
        <F label="Péremption" type="date" value={f.dlc} set={v=>setF(s=>({ ...s, dlc:v }))} />
      </div>
      <Sel label="Ranger dans" value={f.lieu_id} set={v=>setF(s=>({ ...s, lieu_id:v }))} options={optsLieu} />
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : 'Créer et imprimer le QR'}</Btn>
    </Card>
  )
}

function OngletUnites({ unites, lieux, onChange, onOk, onErr }) {
  const [etiq, setEtiq] = useState(null)
  const [filtre, setFiltre] = useState('')
  const vis = unites.filter(u => {
    const q = filtre.trim().toLowerCase()
    if (!q) return true
    return [u.nom, u.lot, u.lieu_nom, u.qr_token].some(x => (x || '').toLowerCase().includes(q))
  })
  async function supprimer(u) {
    if (!confirm(`Supprimer « ${u.nom || 'cette pièce'} » et son QR ? L’historique de mouvements est conservé.`)) return
    const { error } = await supabase.from('stock_unites').delete().eq('id', u.id)
    if (error) { onErr?.(error.message); return }
    onOk?.('Entrée supprimée.')
    onChange()
  }
  return (
    <div>
      {etiq && <CarteQr unite={etiq} onClose={() => setEtiq(null)} onOk={onOk} />}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <Btn kind="soft" onClick={() => telechargerCsv(vis.map(etiqUnite))} disabled={!vis.length}>CSV P-touch ({vis.length})</Btn>
        <Btn kind="soft" onClick={() => telechargerWord(vis.map(etiqUnite))} disabled={!vis.length}>Word — visibles</Btn>
        <Btn kind="soft" onClick={() => telechargerWord(unites.map(etiqUnite))} disabled={!unites.length}>Word — tous</Btn>
      </div>
      <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 12px' }}>
        Nom et lot sous le QR pour coller au bon article. Ensuite on scanne.
      </p>
      <input value={filtre} onChange={e=>setFiltre(e.target.value)} placeholder="Rechercher…" style={{ ...inp, marginBottom:12 }} />
      {vis.length === 0 ? <Empty title="Aucune pièce" hint="Réceptionnez un type d’article pour générer un QR." /> : (
        <Card style={{ padding:0, overflow:'auto' }}>
          <table style={{ width:'100%', minWidth:640, borderCollapse:'collapse', fontSize:13.5 }}>
            <thead><tr style={{ background:'var(--bg-alt)' }}>
              {['Article','Reste','Lieu','DLC',' '].map(h => <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, color:'var(--text-muted)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {vis.map(u => {
                const perime = u.date_peremption && u.date_peremption < new Date().toISOString().slice(0,10)
                return (
                  <tr key={u.id} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontWeight:500 }}>{u.nom}</div>
                      <div style={{ fontSize:11.5, color:'var(--text-faint)' }}>{lblMode(u.mode)}{u.lot ? ` · lot ${u.lot}` : ''}</div>
                    </td>
                    <td style={{ padding:'10px 14px', color: (u.mode === 'oxygene' && Number(u.pression_bar) <= PRESSION_ALERTE) || perime ? '#A32D2D' : 'var(--text)' }}>{resteLabel(u)}{u.etat !== 'dispo' && <div><Pill color="#A32D2D" bg="#FCEBEB">{u.etat}</Pill></div>}</td>
                    <td style={{ padding:'10px 14px', color:'var(--text-muted)' }}>{cheminLieux(lieux, u.lieu_id) || u.lieu_nom || '—'}</td>
                    <td style={{ padding:'10px 14px', color: perime ? '#A32D2D' : 'var(--text-muted)' }}>{u.date_peremption || '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <Btn kind="soft" onClick={() => setEtiq(u)} style={{ padding:'5px 10px' }}>QR</Btn>
                        <Btn kind="danger" onClick={() => supprimer(u)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function OngletAlertes() {
  const [a, setA] = useState(null)
  useEffect(() => { supabase.rpc('stock_alertes').then(({ data }) => setA(data)) }, [])
  if (!a) return <Loading />
  const blocs = [
    { k:'perimes', t:'Périmés', c:'#A32D2D' },
    { k:'o2_basse', t:'Oxygène ≤ 50 bar', c:'#A32D2D' },
    { k:'proches', t:'Péremption ≤ 90 jours', c:'#BA7517' },
    { k:'vides', t:'Vides / presque vides', c:'#185FA5' },
    { k:'bas', t:'Sous le seuil', c:'#A32D2D' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {blocs.map(b => {
        const rows = a[b.k] || []
        return (
          <div key={b.k}>
            <div style={{ fontWeight:700, color: b.c, marginBottom:8 }}>{b.t} ({rows.length})</div>
            {rows.length === 0 ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Rien.</div> : rows.map((u, i) => (
              <Card key={u.id || i} style={{ padding:'10px 14px', marginBottom:6 }}>
                <div style={{ fontWeight:600 }}>{u.nom}</div>
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                  {u.reste != null ? `Reste total ${u.reste} / seuil ${u.stock_minimal}` : `${resteLabel(u)}${u.lieu_nom ? ' · ' + u.lieu_nom : ''}${u.date_peremption ? ' · DLC ' + u.date_peremption : ''}`}
                </div>
              </Card>
            ))}
          </div>
        )
      })}
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
