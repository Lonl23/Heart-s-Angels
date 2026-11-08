import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Flash, F, Card } from '@/components/ui'
import Scanner from './Scanner'
import ContenuLieu from './ContenuLieu'
import { resteLabel, capaciteO2, PRESSION_ALERTE, lblLieu } from './stockSchema'

export default function ScanConso({ souhaitId, locked, onFlash, onErr, optionnel=false }) {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState(null)
  const [liste, setListe] = useState([])
  const [busy, setBusy] = useState(false)
  const [o2, setO2] = useState(null)
  const [pression, setPression] = useState('')
  const [feuille, setFeuille] = useState(null)

  useEffect(() => { charger() }, [souhaitId])
  async function charger() {
    const { data } = await supabase.rpc('stock_conso_souhait', { p_souhait: souhaitId })
    setListe(data?.items || [])
  }

  async function onCode(token) {
    if (locked || busy) return
    setBusy(true)
    const { data: lieu, error: errLieu } = await supabase.rpc('stock_contenu_direct', { p_token: token })
    if (errLieu) {
      setBusy(false)
      onErr?.(errLieu.message)
      setLast({ ok: false, msg: errLieu.message })
      return
    }
    if (lieu?.ok) {
      setBusy(false)
      setOpen(false)
      if (!['sac', 'pochette', 'kit'].includes(lieu.lieu?.type)) {
        const msg = 'Ce QR n’est pas un sac, une pochette ou un kit.'
        onErr?.(msg)
        setLast({ ok: false, msg })
        return
      }
      setO2(null)
      setFeuille(lieu)
      return
    }
    if (lieu?.error && lieu.error !== 'pas_un_lieu') {
      setBusy(false)
      onErr?.(lieu.error)
      setLast({ ok: false, msg: lieu.error })
      return
    }
    const { data, error } = await supabase.rpc('stock_scan', {
      p_token: token, p_action: 'lire', p_qte: 1, p_souhait: null, p_lieu: null,
    })
    setBusy(false)
    if (error || data?.ok === false) {
      onErr?.(error?.message || data?.error || 'Scan refusé')
      setLast({ ok: false, msg: error?.message || data?.error })
      return
    }
    if (data.kind === 'unite' && data.unite?.mode === 'oxygene') {
      setOpen(false)
      setFeuille(null)
      setO2(data.unite)
      setPression(data.unite.pression_bar == null ? '' : String(data.unite.pression_bar))
      return
    }
    const msg = data.kind === 'lieu'
      ? `Scannez un sac, une pochette ou un kit${data.lieu?.type ? ` (${lblLieu(data.lieu.type)} ignoré)` : ''}.`
      : 'Les consommables n’ont pas de QR. Scannez le sac, la pochette ou le kit, puis cochez ce qui a été utilisé.'
    onErr?.(msg)
    setLast({ ok: false, msg })
  }

  async function validerLieu(lignes) {
    if (!feuille || busy || locked) return
    setBusy(true)
    const { data, error } = await supabase.rpc('stock_utiliser_emplacement', {
      p_token: feuille.lieu.qr_token,
      p_souhait: souhaitId,
      p_lignes: lignes,
    })
    setBusy(false)
    if (error || data?.ok === false) {
      onErr?.(error?.message || data?.error || 'Enregistrement refusé')
      setLast({ ok: false, msg: error?.message || data?.error })
      return
    }
    setLast({ ok: true, msg: data.message })
    setFeuille(null)
    onFlash?.()
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
        <div>
          <div style={{ fontWeight:600, color:'var(--heading)' }}>Matériel utilisé</div>
          <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
            {optionnel
              ? 'Sur un vrai souhait : scannez le sac, la pochette ou le kit, puis cochez ce qui a été utilisé. Ici ce n’est pas obligatoire.'
              : 'Scannez le sac pour le vrac, ou le QR de la pochette ou du kit. La quantité ne peut pas dépasser ce qu’il y a à cet endroit.'}
          </div>
        </div>
        {!locked && <Btn onClick={()=>setOpen(true)}>Scanner</Btn>}
      </div>
      {feuille && (
        <ContenuLieu
          lieu={feuille.lieu}
          items={feuille.items}
          busy={busy}
          onValider={validerLieu}
          onAnnuler={() => setFeuille(null)}
        />
      )}
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
        ? <div style={{ fontSize:13.5, color:'var(--text-muted)' }}>Rien d’enregistré pour l’instant. Les bouteilles d’O₂ se scannent encore une à une.</div>
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
      {open && <Scanner titre="Scanner le sac, la pochette ou le kit" onCode={onCode} onClose={()=>setOpen(false)} />}
    </div>
  )
}
