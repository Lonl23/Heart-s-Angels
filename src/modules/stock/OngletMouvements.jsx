import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Sel, Empty, Loading } from '@/components/ui'
import { TYPES_MOUVEMENT, lblMouv, couleurMouv, fmtQuand } from './stockSchema'
import { PhotoArticle } from './photoStock'

export default function OngletMouvements({ cats }) {
  const [type, setType] = useState('')
  const [cat, setCat] = useState('')
  const [items, setItems] = useState(null)
  const [err, setErr] = useState(null)

  async function load(t = type, c = cat) {
    setErr(null)
    const { data, error } = await supabase.rpc('stock_journal', {
      p_limite: 250,
      p_type: t || null,
      p_catalogue: c || null,
    })
    if (error || data?.ok === false) { setErr(error?.message || data?.error); setItems([]); return }
    setItems(data.items || [])
  }

  useEffect(() => { load() }, [])

  const optsCat = [{ v:'', l:'Tous les articles' }, ...(cats || []).map(c => ({ v:c.id, l:c.nom }))]

  return (
    <div>
      <p style={{ fontSize:13.5, color:'var(--text-muted)', margin:'0 0 12px' }}>
        Journal complet : réceptions, sorties mission, transferts, péremptions, emports.
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
        <Sel label="Type" value={type} set={v => { setType(v); load(v, cat) }} options={TYPES_MOUVEMENT} />
        <Sel label="Article" value={cat} set={v => { setCat(v); load(type, v) }} options={optsCat} />
      </div>
      {err && <div style={{ color:'#A32D2D', fontSize:13.5, marginBottom:10 }}>{err}</div>}
      {items == null ? <Loading /> : items.length === 0 ? (
        <Empty title="Aucun mouvement" hint="Les réceptions, scans mission et transferts apparaissent ici." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {items.map(m => (
            <Card key={m.id} style={{ padding:'12px 14px' }}>
              <div className="ha-stock-row">
                <PhotoArticle path={m.photo_path} size={48} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                    <strong>{m.article || m.lieu_nom || 'Mouvement'}</strong>
                    <span style={{ fontSize:12.5, fontWeight:700, color: couleurMouv(m.type) }}>{lblMouv(m.type)}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:3 }}>
                    {m.quantite != null ? `Qté ${Number(m.quantite)}` : ''}
                    {m.lot ? ` · lot ${m.lot}` : ''}
                    {m.lieu_origine_nom || m.lieu_nom ? ` · ${m.lieu_origine_nom ? `${m.lieu_origine_nom} → ${m.lieu_nom || '—'}` : m.lieu_nom}` : ''}
                    {m.fournisseur_nom ? ` · ${m.fournisseur_nom}` : ''}
                  </div>
                  {m.motif && <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:2 }}>{m.motif}</div>}
                  <div style={{ fontSize:11.5, color:'var(--text-faint)', marginTop:4 }}>
                    {fmtQuand(m.created_at)}{m.par_nom ? ` · ${m.par_nom}` : ''}
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
