import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Flash, F, Card, Pill } from '@/components/ui'
import Scanner from './Scanner'
import { capaciteO2, PRESSION_ALERTE, lblLieu } from './stockSchema'
import { dateFr } from './usageLieu'
import { libelleRequis, couvertureMateriel } from './materielRequis'

export default function ScanEmport({ souhaitId, locked, onFlash, onErr, checksBase, onToggleLibre, optionnel=false }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ sacs:[], unites:[], materiel_requis:[], prises:[] })
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [o2, setO2] = useState(null)
  const [pression, setPression] = useState('')
  const [service, setService] = useState(null)

  useEffect(() => { charger() }, [souhaitId])
  async function charger() {
    const { data: d } = await supabase.rpc('stock_emports_souhait', { p_souhait: souhaitId })
    if (d?.ok !== false)     setData({
      sacs: d?.sacs || [],
      unites: d?.unites || [],
      materiel_requis: d?.materiel_requis || [],
      prises: d?.prises || [],
    })
  }

  async function onCode(token) {
    if (locked || busy) return
    setBusy(true)
    const { data: lieu, error: errLieu } = await supabase.rpc('stock_contenu_direct', { p_token: token })
    if (errLieu) {
      setBusy(false)
      onErr?.(errLieu.message)
      setLast({ ok:false, msg: errLieu.message })
      return
    }
    if (lieu?.ok && lieu.lieu?.type === 'sac') {
      setBusy(false)
      setOpen(false)
      setO2(null)
      setService({
        token,
        lieu: lieu.lieu,
        connue: lieu.premiere_peremption || '',
        date: lieu.premiere_peremption || '',
        scelle: null,
      })
      return
    }
    if (lieu?.ok && (lieu.lieu?.type === 'pochette' || lieu.lieu?.type === 'kit')) {
      setBusy(false)
      const msg = `Pour la prise de service, scannez le sac. Ce QR est ${lieu.lieu.type === 'kit' ? 'un kit' : 'une pochette'}.`
      onErr?.(msg)
      setLast({ ok:false, msg })
      return
    }
    if (lieu?.error && lieu.error !== 'pas_un_lieu') {
      setBusy(false)
      onErr?.(lieu.error)
      setLast({ ok:false, msg: lieu.error })
      return
    }
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

  async function validerService() {
    if (!service || busy || service.scelle == null || !service.date) return
    setBusy(true)
    const { data: pris, error } = await supabase.rpc('stock_prise_service', {
      p_token: service.token,
      p_souhait: souhaitId,
      p_scelle: service.scelle,
      p_date: service.date,
    })
    if (error || pris?.ok === false) {
      setBusy(false)
      onErr?.(error?.message || pris?.error || 'Enregistrement refusé')
      setLast({ ok:false, msg: error?.message || pris?.error })
      return
    }
    const { data: em, error: e2 } = await supabase.rpc('stock_emporter', {
      p_token: service.token, p_souhait: souhaitId, p_qte: null,
    })
    setBusy(false)
    if (e2 || em?.ok === false) {
      onErr?.(e2?.message || em?.error || 'Le sac n’a pas été noté comme emporté')
      setLast({ ok:false, msg: e2?.message || em?.error })
      return
    }
    setLast({ ok:true, msg: pris.message })
    setService(null)
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
          <div style={{ fontWeight:600, color:'var(--heading)' }}>Prise de service</div>
          <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
            {optionnel
              ? 'Sur un vrai souhait : scannez chaque bouteille d’O₂ et chaque sac. Pour le sac, dites seulement s’il est scellé et la date de la première péremption.'
              : 'Scannez chaque bouteille d’O₂. Pour un sac : scellé ou non, et la date de la première péremption.'}
          </div>
        </div>
        {!locked && <Btn onClick={()=>setOpen(true)}>Scanner O₂ / sac</Btn>}
      </div>

      {service && (
        <Card style={{ marginBottom:12, borderColor:'var(--accent)' }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>{service.lieu.nom}</div>
          <div style={{ fontSize:13.5, color:'var(--text-muted)', marginBottom:10 }}>
            {service.connue
              ? `Date la plus proche déjà notée dans ce sac, pochettes et kits compris : ${dateFr(service.connue)}. Corrigez-la si l’étiquette du scellé dit autre chose.`
              : 'Aucune date n’est encore notée dans ce sac. Indiquez celle de la première péremption.'}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            <button type="button" className={'ha-check-btn' + (service.scelle === true ? ' is-on' : '')}
              onClick={() => setService(s => ({ ...s, scelle: true }))}>
              <span className="ha-check-mark">{service.scelle === true ? '✓' : ''}</span>
              <span>Sac scellé</span>
            </button>
            <button type="button" className={'ha-check-btn' + (service.scelle === false ? ' is-on' : '')}
              onClick={() => setService(s => ({ ...s, scelle: false }))}>
              <span className="ha-check-mark">{service.scelle === false ? '✓' : ''}</span>
              <span>Sac non scellé</span>
            </button>
          </div>
          <F label="Première péremption" type="date" value={service.date} set={v => setService(s => ({ ...s, date: v }))} />
          <div style={{ display:'flex', gap:8 }}>
            <Btn onClick={validerService} disabled={busy || service.scelle == null || !service.date}>
              {busy ? '…' : 'Enregistrer la prise de service'}
            </Btn>
            <Btn kind="soft" onClick={() => setService(null)}>Annuler</Btn>
          </div>
        </Card>
      )}

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
                    ? r.pris.map(p => {
                        const prise = (data.prises || []).find(x => x.lieu_id === p.id)
                        const nom = p.nom + (p.pression_bar != null ? ` · ${Number(p.pression_bar)} bar` : '')
                        return prise
                          ? `${nom} · ${prise.scelle ? 'scellé' : 'non scellé'} · ${dateFr(prise.premiere_peremption)}`
                          : nom
                      }).join(' · ')
                    : optionnel
                      ? `${r.pris.length}/${r.need} — à scanner sur un vrai souhait`
                      : `${r.pris.length}/${r.need} scanné${r.need > 1 ? 's' : ''} — scannez le QR`}
                </div>
              </div>
              <Pill color={r.ok ? '#3B6D11' : '#BA7517'} bg={r.ok ? '#EAF3DE' : '#FBF0DC'}>{r.ok ? 'OK' : (optionnel ? 'Exemple' : 'À scanner')}</Pill>
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
      {extrasSac.map(s => {
        const prise = (data.prises || []).find(p => p.lieu_id === s.id)
        return (
          <div key={s.id} style={{ fontSize:13.5, marginBottom:4 }}>
            {s.nom} ({lblLieu(s.type)})
            {prise ? ` · ${prise.scelle ? 'scellé' : 'non scellé'} · première péremption ${dateFr(prise.premiere_peremption)}` : ''}
            {' '}— extra
          </div>
        )
      })}
      {extrasArt.map(u => (
        <div key={u.id} style={{ fontSize:13.5, marginBottom:4 }}>{u.nom}{u.lot ? ` · lot ${u.lot}` : ''}</div>
      ))}

      {open && <Scanner titre="Scanner O₂ ou sac emporté" onCode={onCode} onClose={()=>setOpen(false)} />}
    </div>
  )
}
