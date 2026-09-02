import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Flash, F, Card, Pill } from '@/components/ui'
import Scanner from './Scanner'
import { capaciteO2, PRESSION_ALERTE, lblLieu } from './stockSchema'
import { libelleRequis, couvertureMateriel } from './materielRequis'

export default function ScanEmport({ souhaitId, locked, onFlash, onErr, checksBase, onToggleLibre }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ sacs:[], unites:[], materiel_requis:[] })
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [o2, setO2] = useState(null)
  const [pression, setPression] = useState('')

  useEffect(() => { charger() }, [souhaitId])
  async function charger() {
    const { data: d } = await supabase.rpc('stock_emports_souhait', { p_souhait: souhaitId })
    if (d?.ok !== false) setData({
      sacs: d?.sacs || [],
      unites: d?.unites || [],
      materiel_requis: d?.materiel_requis || [],
    })
  }

  async function onCode(token) {
    if (locked || busy) return
    setBusy(true)
    const { data: lu, error } = await supabase.rpc('stock_scan', {
      p_token: token, p_action: 'lire', p_qte: 1, p_souhait: null, p_lieu: null,
    })
    if (error || lu?.ok === false) {
      setBusy(false)
      onErr?.(error?.message || lu?.error || 'Scan refusé')
      setLast({ ok:false, msg: error?.message || lu?.error })
      return
    }
    if (lu.kind === 'unite' && lu.unite?.mode === 'oxygene') {
      setBusy(false)
      setOpen(false)
      setO2(lu.unite)
      setPression(lu.unite.pression_bar == null ? '' : String(lu.unite.pression_bar))
      return
    }
    const { data: em, error: e2 } = await supabase.rpc('stock_emporter', {
      p_token: token, p_souhait: souhaitId, p_qte: null,
    })
    setBusy(false)
    if (e2 || em?.ok === false) {
      onErr?.(e2?.message || em?.error || 'Scan refusé')
      setLast({ ok:false, msg: e2?.message || em?.error })
      return
    }
    setLast({ ok:true, msg: em.message })
    onFlash?.()
    setOpen(false)
    charger()
  }

  async function validerO2() {
    if (!o2 || busy) return
    const bar = Number(pression)
    if (Number.isNaN(bar) || bar < 0) { onErr?.('Indiquez la pression au manomètre (bar).'); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('stock_emporter', {
      p_token: o2.qr_token, p_souhait: souhaitId, p_qte: bar,
    })
    setBusy(false)
    if (error || data?.ok === false) {
      onErr?.(error?.message || data?.error || 'Enregistrement refusé')
      return
    }
    setLast({ ok:true, msg: data.message })
    if (data.alerte_pression) onErr?.('Pression ≤ 50 bar : cette bouteille doit partir en recharge — n’emportez pas une bouteille vide.')
    setO2(null)
    onFlash?.()
    charger()
  }

  const cov = couvertureMateriel(data.materiel_requis, data)
  const extrasO2 = (data.unites || []).filter(u => u.mode === 'oxygene' && !cov.some(c => c.pris?.some(p => p.id === u.id)))
  const extrasSac = (data.sacs || []).filter(s => !cov.some(c => c.pris?.some(p => p.id === s.id)))
  const extrasArt = (data.unites || []).filter(u => u.mode !== 'oxygene' && !cov.some(c => c.pris?.some(p => p.id === u.id)))

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:600, color:'var(--heading)' }}>O₂ et sacs emportés</div>
          <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Scannez chaque bouteille et chaque sac que vous prenez.</div>
        </div>
        {!locked && <Btn onClick={()=>setOpen(true)}>Scanner O₂ / sac</Btn>}
      </div>

      {o2 && (
        <Card style={{ marginBottom:12, borderColor:'var(--accent)' }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>{o2.nom}</div>
          <div style={{ fontSize:13.5, color:'var(--text-muted)', marginBottom:10 }}>
            Bouteille {Number(o2.volume_l)} L · en stock : {o2.pression_bar == null ? '—' : `${Number(o2.pression_bar)} bar (${capaciteO2(o2.volume_l, o2.pression_bar)} L)`}
          </div>
          <F label="Pression au départ (bar)" type="number" value={pression} set={setPression} />
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
            Lisez le manomètre. {Number(pression) <= PRESSION_ALERTE && Number(pression) >= 0 ? 'Alerte si ≤ 50 bar.' : ''}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Btn onClick={validerO2} disabled={busy}>{busy ? '…' : 'Emporter cette bouteille'}</Btn>
            <Btn kind="soft" onClick={()=>setO2(null)}>Annuler</Btn>
          </div>
        </Card>
      )}

      {last && <Flash kind={last.ok ? 'ok' : 'err'}>{last.msg}</Flash>}

      {cov.filter(r => r.kind === 'libre').length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
          {cov.filter(r => r.kind === 'libre').map(r => {
            const on = !!checksBase?.[r.libelle]
            return (
              <button key={r.id} type="button" disabled={locked} onClick={()=>onToggleLibre?.(r.libelle, on)}
                className={'ha-check-btn' + (on ? ' is-on' : '')}>
                <span className="ha-check-mark">{on ? '✓' : ''}</span>
                <span>{r.libelle}</span>
              </button>
            )
          })}
        </div>
      )}

      {cov.filter(r => r.kind !== 'libre').length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
          {cov.filter(r => r.kind !== 'libre').map(r => (
            <div key={r.id} style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', padding:'8px 10px', borderRadius:8, background: r.ok ? '#EAF3DE' : 'var(--bg-alt)' }}>
              <div>
                <div style={{ fontWeight:600 }}>{libelleRequis(r)}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                  {r.ok
                    ? r.pris.map(p => p.nom + (p.pression_bar != null ? ` · ${Number(p.pression_bar)} bar` : '')).join(' · ')
                    : `${r.pris.length}/${r.need} scanné${r.need > 1 ? 's' : ''} — scannez le QR`}
                </div>
              </div>
              <Pill color={r.ok ? '#3B6D11' : '#BA7517'} bg={r.ok ? '#EAF3DE' : '#FBF0DC'}>{r.ok ? 'OK' : 'À scanner'}</Pill>
            </div>
          ))}
        </div>
      )}

      {(data.unites.length + data.sacs.length) === 0 && cov.length === 0 && (
        <div style={{ fontSize:13.5, color:'var(--text-muted)' }}>Aucun scan pour l’instant.</div>
      )}

      {extrasO2.map(u => (
        <div key={u.id} style={{ fontSize:13.5, marginBottom:4 }}>O₂ {Number(u.volume_l) || '?'} L · {u.pression_bar != null ? `${Number(u.pression_bar)} bar` : ''} — extra</div>
      ))}
      {extrasSac.map(s => (
        <div key={s.id} style={{ fontSize:13.5, marginBottom:4 }}>{s.nom} ({lblLieu(s.type)}) — extra</div>
      ))}
      {extrasArt.map(u => (
        <div key={u.id} style={{ fontSize:13.5, marginBottom:4 }}>{u.nom}{u.lot ? ` · lot ${u.lot}` : ''}</div>
      ))}

      {open && <Scanner titre="Scanner O₂ ou sac emporté" onCode={onCode} onClose={()=>setOpen(false)} />}
    </div>
  )
}
