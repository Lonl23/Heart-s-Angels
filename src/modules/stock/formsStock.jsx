import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, lbl, inp } from '@/components/ui'
import { PRESSION_PLEINE, cheminLieux, nomTypeO2 } from './stockSchema'
import { lotConnuPour, fmtDlc } from './lotsStock'
import { ApercuEtiq, telechargerWord, telechargerPng, copierPng, telechargerCsv } from './QrImg'
import { PhotoArticle } from './photoStock'

export function etiqLieu(l) {
  return { titre: l.nom, lot: '', token: l.qr_token, format: 'lieu' }
}
export function etiqUnite(u) {
  const titre = u.mode === 'oxygene'
    ? (u.nom || nomTypeO2(u.volume_l))
    : (u.nom || 'Article')
  return {
    titre,
    lot: u.lot || '',
    ligne2: u.lot ? `Lot ${u.lot}` : (u.date_peremption ? `DLC ${u.date_peremption}` : ''),
    token: u.qr_token,
  }
}

export function CarteQr({ lieu, unite, onClose, onOk }) {
  const e = lieu ? etiqLieu(lieu) : etiqUnite(unite)
  async function copier() {
    const ok = await copierPng(e)
    onOk?.(ok ? 'Étiquette copiée — colle-la dans P-touch ou Word (Ctrl+V).' : 'Copie impossible : télécharge le PNG.')
  }
  return (
    <Card style={{ marginBottom:12, maxWidth: lieu ? 480 : 360 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>Étiquette {lieu ? '90,3 × 29 mm' : '23 × 23 mm'}</strong>
        <Btn kind="soft" onClick={onClose}>Fermer</Btn>
      </div>
      <ApercuEtiq titre={e.titre} ligne2={e.ligne2} token={e.token} format={e.format} />
      <p style={{ fontSize:12.5, color:'var(--text-muted)', margin:'10px 0' }}>
        {lieu
          ? 'QR en haut, nom en bas — pour coller la bonne étiquette sur la pochette ou le sac. Ensuite on scanne.'
          : 'QR + nom + lot : pour coller la bonne étiquette au bon endroit. Après, on scanne le QR.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <Btn onClick={() => telechargerPng(e)}>PNG pour Brother</Btn>
        <Btn kind="soft" onClick={() => telechargerCsv([e])}>CSV P-touch</Btn>
        <Btn kind="soft" onClick={() => telechargerWord([e])}>Word (planche)</Btn>
        <Btn kind="soft" onClick={copier}>Copier l’image</Btn>
      </div>
    </Card>
  )
}

export function CarteQrLot({ unites, onClose, onOk }) {
  const etiq = (unites || []).map(etiqUnite)
  return (
    <Card style={{ marginBottom:12, maxWidth: 480 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>{etiq.length} étiquettes — même lot</strong>
        <Btn kind="soft" onClick={onClose}>Fermer</Btn>
      </div>
      <p style={{ fontSize:12.5, color:'var(--text-muted)', margin:'0 0 10px' }}>
        Un QR par pièce / boîte / bouteille. Imprimez la planche Word ou le CSV P-touch, puis collez chaque étiquette.
      </p>
      <div style={{ fontSize:13.5, marginBottom:12 }}>
        <div style={{ fontWeight:600 }}>{unites[0]?.nom}</div>
        {unites[0]?.lot && <div style={{ color:'var(--text-muted)' }}>Lot {unites[0].lot}</div>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <Btn onClick={() => telechargerWord(etiq)}>Word — {etiq.length} étiquettes</Btn>
        <Btn kind="soft" onClick={() => telechargerCsv(etiq)}>CSV P-touch</Btn>
        <Btn kind="soft" onClick={() => { onOk?.('Étiquettes prêtes.'); onClose() }}>Terminé</Btn>
      </div>
    </Card>
  )
}

export function FormReception({ cat, lieux, unites, onDone, onOk, onErr }) {
  const [f, setF] = useState({
    qte: cat.mode === 'boite' ? (cat.qte_defaut || '') : '1',
    nb: '1',
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
    const nb = Math.max(1, Math.min(80, Math.round(Number(f.nb) || 1)))
    setSaving(true)
    const { data, error } = await supabase.rpc('stock_creer_unites', {
      p_catalogue: cat.id,
      p_qte: Number(f.qte) || 1,
      p_lot: f.lot || null,
      p_dlc: f.dlc || null,
      p_lieu: f.lieu_id || null,
      p_notes: null,
      p_pression: cat.mode === 'oxygene' ? (Number(f.pression) || PRESSION_PLEINE) : 200,
      p_nb: nb,
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
    const list = data.unites || (data.unite ? [data.unite] : [])
    setCreated(list)
    onOk?.(list.length > 1
      ? `${list.length} QR créés — imprimez les étiquettes.`
      : 'Réception enregistrée — imprimez l’étiquette.')
  }
  if (created) {
    if (created.length > 1) return <CarteQrLot unites={created} onClose={onDone} onOk={onOk} />
    return <CarteQr unite={created[0]} onClose={onDone} onOk={onOk} />
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
      <F label={cat.mode === 'boite' ? 'Nombre de boîtes (1 QR chacune)' : cat.mode === 'oxygene' ? 'Nombre de bouteilles (1 QR chacune)' : 'Nombre de pièces (1 QR chacune)'}
        type="number" value={f.nb} set={v=>setF(s=>({ ...s, nb:v }))} />
      <Btn onClick={save} disabled={saving} style={{ width:'100%', minHeight:48, fontSize:15.5 }}>{saving ? '…' : 'Créer et imprimer le QR'}</Btn>
    </Card>
  )
}

export function FormTransfert({ unite, lieux, onDone, onOk, onErr }) {
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
      <Btn onClick={save} disabled={saving} style={{ width:'100%', minHeight:48, fontSize:15.5 }}>{saving ? '…' : 'Enregistrer le transfert'}</Btn>
    </Card>
  )
}

export function FormSortie({ unite, onDone, onOk, onErr }) {
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
      <Btn onClick={save} disabled={saving} style={{ width:'100%', minHeight:48, fontSize:15.5 }}>{saving ? '…' : 'Enregistrer la sortie'}</Btn>
    </Card>
  )
}
