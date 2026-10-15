import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Card, F, Empty, inp } from '@/components/ui'
import { cheminLieux } from './stockSchema'
import { aggregerLots, fmtDlc, dlcPassee, dlcProche, qteLotLabel } from './lotsStock'
import { correspondArticle } from './dotationStock'

export default function OngletGestionArticles({ cats, unites, lieux, onChange, onOk, onErr }) {
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [seuils, setSeuils] = useState({})
  const [saving, setSaving] = useState(null)
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

  const vis = (cats || []).filter(c => correspondArticle(c, q))

  async function saveSeuil(c) {
    const raw = seuils[c.id]
    const n = raw === undefined ? Number(c.stock_minimal) || 0 : Number(raw)
    if (Number.isNaN(n) || n < 0) { onErr?.('Seuil invalide.'); return }
    setSaving('s-' + c.id)
    const { error } = await supabase.from('stock_catalogue').update({ stock_minimal: n }).eq('id', c.id)
    setSaving(null)
    if (error) { onErr?.(error.message); return }
    onOk?.('Stock mini enregistré.')
    onChange?.()
  }

  async function saveLot() {
    if (!edit) return
    setSaving('lot')
    const { data, error } = await supabase.rpc('stock_lot_mettre_a_jour', {
      p_catalogue: edit.catalogue_id,
      p_lot: edit.lot || null,
      p_nouveau_lot: edit.nouveauLot,
      p_dlc: edit.dlc || null,
    })
    setSaving(null)
    if (error || data?.ok === false) { onErr?.(error?.message || data?.error); return }
    onOk?.(data.nb ? `${data.nb} unité(s) mises à jour.` : 'Lot enregistré.')
    setEdit(null)
    onChange?.()
  }

  if (!vis.length) {
    return <Empty title="Aucun article" hint="Créez un type dans Plus → Types d’articles, puis une réception." />
  }

  return (
    <div>
      <label className="ha-stock-search-lab" htmlFor="gestion-recherche">Rechercher</label>
      <input id="gestion-recherche" className="ha-search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Article, lot, lieu…" autoComplete="off" style={{ ...inp, marginBottom: 12, width: 'min(100%, 420px)' }} />
      {edit && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
            <strong>Lot — {edit.article}</strong>
            <Btn kind="soft" onClick={() => setEdit(null)}>Annuler</Btn>
          </div>
          <F label="N° de lot" value={edit.nouveauLot} set={v => setEdit(s => ({ ...s, nouveauLot: v }))} placeholder="tel qu’imprimé sur la boîte" />
          <F label="Date de péremption" type="date" value={edit.dlc || ''} set={v => setEdit(s => ({ ...s, dlc: v }))} />
          <Btn onClick={saveLot} disabled={saving === 'lot'} style={{ width: '100%' }}>{saving === 'lot' ? '…' : 'Enregistrer'}</Btn>
        </Card>
      )}
      <div className="ha-stock-table-wrap">
        <table className="ha-stock-table">
          <thead>
            <tr>
              <th>Article</th>
              <th>Lot</th>
              <th>Péremption</th>
              <th>Qté</th>
              <th>Où</th>
              <th>Stock mini</th>
            </tr>
          </thead>
          <tbody>
            {vis.map(c => {
              const ls = lotsParCat.get(c.id) || []
              const rows = ls.length ? ls : [null]
              const reste = ls.reduce((s, l) => s + (Number(l.qte_totale) || 0), 0)
              const seuil = Number(c.stock_minimal) || 0
              const alerte = seuil > 0 && reste <= seuil && c.mode !== 'oxygene'
              return rows.map((lot, i) => {
                const perime = lot && dlcPassee(lot.dlc)
                const j15 = lot && dlcProche(lot.dlc, 15)
                const dlcColor = perime ? '#A32D2D' : j15 ? '#BA7517' : 'var(--text-muted)'
                return (
                  <tr key={`${c.id}-${lot?.lot || 'sans'}-${i}`} className={alerte || perime ? 'is-alerte' : ''}>
                    {i === 0 && (
                      <td rowSpan={rows.length}>
                        <div style={{ fontWeight: 600 }}>{c.nom}</div>
                        {c.categorie && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.categorie}</div>}
                      </td>
                    )}
                    <td>
                      {lot ? (
                        <button type="button" className="ha-stock-table-link" onClick={() => setEdit({
                          catalogue_id: c.id, article: c.nom, lot: lot.lot || '',
                          nouveauLot: lot.lot || '', dlc: lot.dlc || '',
                        })}>
                          {lot.lot || 'sans n°'}
                        </button>
                      ) : '—'}
                    </td>
                    <td style={{ color: dlcColor, fontWeight: perime || j15 ? 700 : 400 }}>
                      {lot ? (
                        <>
                          {fmtDlc(lot.dlc)}
                          {perime ? ' · périmé' : j15 ? ' · J-15' : ''}
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{lot ? qteLotLabel(lot) : '0'}</td>
                    <td>
                      {lot && (lot.lieux || []).length
                        ? (lot.lieux || []).map((x, j) => (
                          <div key={x.lieu_id || j}>
                            {x.chemin || x.nom || cheminLieux(lieux, x.lieu_id) || 'sans lieu'}
                            {x.qte != null ? ` · ${Number(x.qte)}` : ''}
                          </div>
                        ))
                        : '—'}
                    </td>
                    {i === 0 && (
                      <td rowSpan={rows.length}>
                        {c.mode === 'oxygene' ? (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <div className="ha-stock-mini-edit">
                            <input type="number" min="0" className="ha-stock-mini"
                              value={seuils[c.id] ?? (c.stock_minimal || 0)}
                              onChange={e => setSeuils(s => ({ ...s, [c.id]: e.target.value }))} />
                            <Btn kind="soft" onClick={() => saveSeuil(c)} disabled={saving === 's-' + c.id} style={{ padding: '5px 8px' }}>
                              {saving === 's-' + c.id ? '…' : 'OK'}
                            </Btn>
                          </div>
                        )}
                        {alerte && <div style={{ fontSize: 12, color: '#A32D2D', marginTop: 4 }}>sous le seuil ({reste})</div>}
                      </td>
                    )}
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
