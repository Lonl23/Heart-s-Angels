import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Flash, inp, F, Card } from '@/components/ui'
import Scanner from './Scanner'
import { resteLabel, capaciteO2, PRESSION_ALERTE } from './stockSchema'

export default function ScanConso({ souhaitId, locked, onFlash, onErr }) {
  const [open, setOpen] = useState(false)
  const [qte, setQte] = useState('1')
  const [last, setLast] = useState(null)
  const [liste, setListe] = useState([])
  const [busy, setBusy] = useState(false)
  const [o2, setO2] = useState(null)
  const [pression, setPression] = useState('')

  useEffect(() => { charger() }, [souhaitId])
  async function charger() {
    const { data } = await supabase.rpc('stock_conso_souhait', { p_souhait: souhaitId })
    setListe(data?.items || [])
  }

  async function onCode(token) {
    if (locked || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('stock_scan', {
      p_token: token, p_action: 'lire', p_qte: 1, p_souhait: null, p_lieu: null,
    })
    if (error || data?.ok === false) {
      setBusy(false)
      onErr?.(error?.message || data?.error || 'Scan refusé')
      setLast({ ok: false, msg: error?.message || data?.error })
      return
    }
    if (data.kind === 'unite' && data.unite?.mode === 'oxygene') {
      setBusy(false)
      setOpen(false)
      setO2(data.unite)
      setPression(data.unite.pression_bar == null ? '' : String(data.unite.pression_bar))
      return
    }
    const n = Math.max(1, Number(qte) || 1)
    const { data: conso, error: err2 } = await supabase.rpc('stock_scan', {
      p_token: token, p_action: 'consommer', p_qte: n, p_souhait: souhaitId, p_lieu: null,
    })
    setBusy(false)
    if (err2 || conso?.ok === false) {
      onErr?.(err2?.message || conso?.error || 'Scan refusé')
      setLast({ ok: false, msg: err2?.message || conso?.error })
      return
    }
    setLast({ ok: true, msg: conso.message, unite: conso.unite })
    onFlash?.()
    setOpen(false)
    charger()
  }

  async function validerO2() {
    if (!o2 || busy) return
    const bar = Number(pression)
    if (Number.isNaN(bar) || bar < 0) { onErr?.('Indiquez la pression restante en bar.'); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('stock_scan', {
      p_token: o2.qr_token, p_action: 'consommer', p_qte: bar, p_souhait: souhaitId, p_lieu: null,
    })
    setBusy(false)
    if (error || data?.ok === false) {
      onErr?.(error?.message || data?.error || 'Relevé refusé')
      return
    }
    setLast({ ok: true, msg: data.message, unite: data.unite })
    if (data.alerte_pression) onErr?.('Pression ≤ 50 bar : cette bouteille doit partir en recharge.')
    setO2(null)
    onFlash?.()
    charger()
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
        <div style={{ fontWeight:600, color:'var(--heading)' }}>Matériel utilisé</div>
        {!locked && (
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ fontSize:12.5, color:'var(--text-muted)' }}>Qté (boîte / pièce)</label>
            <input type="number" min="1" value={qte} onChange={e=>setQte(e.target.value)}
              style={{ ...inp, width:64, margin:0 }} />
            <Btn onClick={()=>setOpen(true)}>Scanner</Btn>
          </div>
        )}
      </div>
      {o2 && (
        <Card style={{ marginBottom:12, borderColor:'var(--accent)' }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>{o2.nom}</div>
          <div style={{ fontSize:13.5, color:'var(--text-muted)', marginBottom:10 }}>
            Bouteille {Number(o2.volume_l)} L · pleine {Number(o2.pression_pleine) || 200} bar
            · en stock : {o2.pression_bar == null ? '—' : `${Number(o2.pression_bar)} bar (${capaciteO2(o2.volume_l, o2.pression_bar)} L)`}
          </div>
          <F label="Pression restante après usage (bar)" type="number" value={pression} set={setPression} />
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
            Prérempli avec le dernier relevé. Corrigez si le manomètre dit autrement.
            {Number(pression) <= PRESSION_ALERTE && Number(pression) >= 0 ? ' Alerte si ≤ 50 bar.' : ''}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Btn onClick={validerO2} disabled={busy}>{busy ? '…' : 'Enregistrer le relevé'}</Btn>
            <Btn kind="soft" onClick={()=>setO2(null)}>Annuler</Btn>
          </div>
        </Card>
      )}
      {last && (
        <Flash kind={last.ok ? 'ok' : 'err'}>{last.msg}{last.unite?.mode === 'boite' ? ` (${resteLabel(last.unite)})` : ''}</Flash>
      )}
      {liste.length === 0
        ? <div style={{ fontSize:13.5, color:'var(--text-muted)' }}>Rien de scanné pour l’instant. Scannez chaque pièce, boîte ou bouteille d’O₂.</div>
        : (
          <ul style={{ margin:0, paddingLeft:18, fontSize:14, color:'var(--text)' }}>
            {liste.map((it, i) => (
              <li key={i} style={{ marginBottom:4 }}>
                {it.mode === 'oxygene' || it.type_mouv === 'releve_o2'
                  ? `${it.nom}${it.volume_l ? ` ${Number(it.volume_l)} L` : ''} · ${it.motif || (it.pression_bar != null ? `${Number(it.pression_bar)} bar` : '')}`
                  : `${it.nom} −${Number(it.quantite)}${it.mode === 'boite' ? ` · reste ${Number(it.reste)}/${Number(it.initiale)}` : ''}${it.lot ? ` · lot ${it.lot}` : ''}${it.type_mouv === 'usage' ? ' (durable, toujours en place)' : ''}`}
              </li>
            ))}
          </ul>
        )}
      {open && <Scanner titre="Scanner le matériel utilisé" onCode={onCode} onClose={()=>setOpen(false)} />}
    </div>
  )
}
