import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Card, Sel, Empty, Loading } from '@/components/ui'
import { TYPES_MOUVEMENT, lblMouv, couleurMouv, fmtQuand } from './stockSchema'
import { PhotoArticle } from './photoStock'
import { exporterMouvementsCsv } from './excelStock'
import { imprimerHtml, telechargerHtml, imprimerApercuIframe } from '@/modules/souhaits/documentA4'
import { htmlRapportStock, nomFichierRapportStock } from './rapportStockHtml'

export default function OngletMouvements({ cats, typesAutorises, hint, csv, sansSouhait }) {
  const [type, setType] = useState('')
  const [cat, setCat] = useState('')
  const [items, setItems] = useState(null)
  const [err, setErr] = useState(null)
  const [busyPdf, setBusyPdf] = useState(false)
  const [apercu, setApercu] = useState(null)
  const apercuRef = useRef(null)

  const typesOk = typesAutorises?.length ? typesAutorises : null

  async function load(t = type, c = cat) {
    setErr(null)
    if (typesOk && !t) {
      const results = await Promise.all(typesOk.map(ty =>
        supabase.rpc('stock_journal', { p_limite: 250, p_type: ty, p_catalogue: c || null })
      ))
      const fail = results.find(r => r.error || r.data?.ok === false)
      if (fail) {
        setErr(fail.error?.message || fail.data?.error)
        setItems([])
        return
      }
      const merged = results.flatMap(r => r.data?.items || [])
        .filter(m => sansSouhait ? !m.souhait_id : true)
      merged.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      setItems(merged)
      return
    }
    const { data, error } = await supabase.rpc('stock_journal', {
      p_limite: 250,
      p_type: t || null,
      p_catalogue: c || null,
    })
    if (error || data?.ok === false) { setErr(error?.message || data?.error); setItems([]); return }
    const list = data.items || []
    setItems((typesOk ? list.filter(m => typesOk.includes(m.type)) : list)
      .filter(m => sansSouhait ? !m.souhait_id : true))
  }

  useEffect(() => { load() }, [])

  async function pdfDeclasse() {
    setBusyPdf(true)
    try {
      const html = await htmlRapportStock({
        titre: 'Rapport de déclassement',
        sousTitre: 'Casse, don, destruction, cession — sorties hors mission.',
        items: items || [],
      })
      imprimerHtml(html, setApercu)
    } catch (e) {
      alert('Impossible de préparer le PDF : ' + (e?.message || e))
    }
    setBusyPdf(false)
  }

  const optsType = typesOk
    ? [{ v: '', l: typesOk.length === 1 ? (TYPES_MOUVEMENT.find(x => x.v === typesOk[0])?.l || 'Tous') : 'Emports et sorties' }, ...TYPES_MOUVEMENT.filter(x => x.v && typesOk.includes(x.v))]
    : TYPES_MOUVEMENT
  const optsCat = [{ v: '', l: 'Tous les articles' }, ...(cats || []).map(c => ({ v: c.id, l: c.nom }))]

  return (
    <div>
      {hint && (
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>{hint}</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: csv ? '1fr 1fr auto auto' : '1fr 1fr', gap: 10, marginBottom: 12, alignItems: 'end' }} className="ha-stock-recv-lot">
        <Sel label="Type" value={type} set={v => { setType(v); load(v, cat) }} options={optsType} />
        <Sel label="Article" value={cat} set={v => { setCat(v); load(type, v) }} options={optsCat} />
        {csv && (
          <Btn kind="soft" onClick={() => exporterMouvementsCsv(items || [])} disabled={!items?.length} style={{ marginBottom: 10 }}>
            CSV
          </Btn>
        )}
        {csv && (
          <Btn kind="soft" onClick={pdfDeclasse} disabled={!items?.length || busyPdf} style={{ marginBottom: 10 }}>
            {busyPdf ? 'PDF…' : 'PDF'}
          </Btn>
        )}
      </div>
      {err && <div style={{ color: '#A32D2D', fontSize: 13.5, marginBottom: 10 }}>{err}</div>}
      {items == null ? <Loading /> : items.length === 0 ? (
        <Empty title="Aucun mouvement" hint={sansSouhait ? 'Les sorties hors mission (casse, don, destruction) apparaissent ici.' : typesOk ? 'Les emports mission et les sorties apparaissent ici.' : 'Les réceptions, scans mission et transferts apparaissent ici.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(m => (
            <Card key={m.id} style={{ padding: '12px 14px' }}>
              <div className="ha-stock-row">
                <PhotoArticle path={m.photo_path} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{m.article || m.lieu_nom || 'Mouvement'}</strong>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: couleurMouv(m.type) }}>{lblMouv(m.type)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    {m.quantite != null ? `Qté ${Number(m.quantite)}` : ''}
                    {m.lot ? ` · lot ${m.lot}` : ''}
                    {m.lieu_origine_nom || m.lieu_nom ? ` · ${m.lieu_origine_nom ? `${m.lieu_origine_nom} → ${m.lieu_nom || '—'}` : m.lieu_nom}` : ''}
                    {m.fournisseur_nom ? ` · ${m.fournisseur_nom}` : ''}
                    {m.souhait_titre ? ` · ${m.souhait_titre}` : ''}
                  </div>
                  {m.motif && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>{m.motif}</div>}
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>
                    {fmtQuand(m.created_at)}{m.par_nom ? ` · ${m.par_nom}` : ''}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {apercu && (
        <div className="ha-fiche-apercu">
          <div className="ha-fiche-apercu-bar no-print">
            <Btn onClick={() => imprimerApercuIframe(apercuRef.current)}>🖨 Imprimer / PDF</Btn>
            <Btn kind="soft" onClick={() => telechargerHtml(nomFichierRapportStock('declasse'), apercu)}>Télécharger</Btn>
            <Btn kind="soft" onClick={() => setApercu(null)}>Fermer</Btn>
          </div>
          <iframe ref={apercuRef} title="Rapport de déclassement" srcDoc={apercu} />
        </div>
      )}
    </div>
  )
}
