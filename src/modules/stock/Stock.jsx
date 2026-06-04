// src/modules/stock/Stock.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function Stock() {
  const [produits, setProduits]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filtreStatut, setFiltreStatut] = useState('tous')   // 'tous'|'faible'|'rupture'|'ok'
  const [editing, setEditing]     = useState(null)   // { variante_id, stock }
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState(null)
  const [expandedProd, setExpandedProd] = useState(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('boutique_produits')
      .select(`
        id, nom_fr, nom_nl, nom_en, image_url, actif,
        boutique_categories(nom_fr),
        boutique_variantes(id, taille, couleur, stock, prix_ht, sku, updated_at)
      `)
      .eq('actif', true)
      .order('ordre')
    setProduits(data || [])
    setLoading(false)
  }

  function statutVariante(stock) {
    if (stock === 0)  return { label: 'Rupture', color: '#A32D2D', bg: '#FCEBEB' }
    if (stock <= 3)   return { label: 'Faible',  color: '#BA7517', bg: '#FAEEDA' }
    return               { label: 'OK',      color: '#3B6D11', bg: '#EAF3DE' }
  }

  // Stats globales
  const allVariantes = produits.flatMap(p => p.boutique_variantes || [])
  const nbRupture    = allVariantes.filter(v => v.stock === 0).length
  const nbFaible     = allVariantes.filter(v => v.stock > 0 && v.stock <= 3).length
  const nbOk         = allVariantes.filter(v => v.stock > 3).length
  const stockTotal   = allVariantes.reduce((s, v) => s + (v.stock || 0), 0)

  // Filtrage
  const produitsFiltres = produits
    .filter(p => !search || (p.nom_fr || '').toLowerCase().includes(search.toLowerCase()))
    .filter(p => {
      if (filtreStatut === 'tous') return true
      const variantes = p.boutique_variantes || []
      if (filtreStatut === 'rupture') return variantes.some(v => v.stock === 0)
      if (filtreStatut === 'faible')  return variantes.some(v => v.stock > 0 && v.stock <= 3)
      if (filtreStatut === 'ok')      return variantes.every(v => v.stock > 3)
      return true
    })

  function toggleExpand(id) {
    setExpandedProd(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function saveStock(varianteId, newStock) {
    if (newStock < 0) return
    setSaving(true)
    const { error } = await supabase
      .from('boutique_variantes')
      .update({ stock: parseInt(newStock), updated_at: new Date().toISOString() })
      .eq('id', varianteId)
    setSaving(false)
    if (error) { setMsg({ type: 'error', text: 'Erreur lors de la mise à jour du stock.' }); return }
    setEditing(null)
    setMsg({ type: 'success', text: 'Stock mis à jour.' })
    setTimeout(() => setMsg(null), 2500)
    await load()
  }

  return (
    <div style={{ padding: '28px 24px', fontFamily: 'DM Sans,sans-serif', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '1.8rem', fontWeight: 500, color: '#1A1514', marginBottom: 2 }}>
            Stock boutique
          </h1>
          <p style={{ fontSize: 13, color: '#7A7470' }}>
            Suivi des variantes par taille et couleur — mis à jour en temps réel après chaque commande
          </p>
        </div>
        <button onClick={load} style={{ padding: '8px 16px', background: '#F8F3EE', border: '1px solid rgba(200,67,90,.15)', borderRadius: 9, fontSize: 13, color: '#7A7470', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
          🔄 Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '📦', label: 'Total en stock',  val: `${stockTotal} unités`, color: '#185FA5', bg: '#E6F1FB' },
          { icon: '✅', label: 'Variantes OK',     val: nbOk,                  color: '#3B6D11', bg: '#EAF3DE' },
          { icon: '⚠️', label: 'Stock faible',     val: nbFaible,              color: '#BA7517', bg: '#FAEEDA' },
          { icon: '🚫', label: 'En rupture',       val: nbRupture,             color: '#A32D2D', bg: '#FCEBEB' },
        ].map((k, i) => (
          <div key={i} onClick={() => setFiltreStatut(['tous','ok','faible','rupture'][i])}
            style={{ background: 'white', border: `1px solid ${k.color}22`, borderRadius: 13, padding: '16px 14px', cursor: 'pointer', boxShadow: '0 1px 6px rgba(200,67,90,.04)', transition: 'transform .12s, box-shadow .12s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 5px 18px ${k.color}22` }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 6px rgba(200,67,90,.04)' }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 11.5, color: '#7A7470', marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Alertes rupture */}
      {nbRupture > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCD5D5', borderRadius: 12, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#991B1B' }}>
          <span style={{ fontSize: '1.3rem' }}>🚫</span>
          <span><strong>{nbRupture} variante{nbRupture > 1 ? 's' : ''} en rupture de stock</strong> — pensez à réapprovisionner avant les prochaines commandes.</span>
        </div>
      )}
      {nbFaible > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#92400E' }}>
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <span><strong>{nbFaible} variante{nbFaible > 1 ? 's' : ''} avec stock faible</strong> (≤ 3 unités).</span>
        </div>
      )}

      {/* Filtres + search */}
      {msg && (
        <div style={{ background: msg.type === 'success' ? '#F0FAF0' : '#FEF2F2', border: `1px solid ${msg.type === 'success' ? '#C3E6C3' : '#FCD5D5'}`, borderRadius: 9, padding: '9px 14px', fontSize: 13.5, color: msg.type === 'success' ? '#1E5C1E' : '#991B1B', marginBottom: 14 }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#C8B0B0' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…"
            style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid rgba(200,67,90,.12)', borderRadius: 9, fontSize: 13.5, fontFamily: 'DM Sans,sans-serif' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['tous','Tous'],['rupture','Rupture'],['faible','Faible'],['ok','OK']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltreStatut(v)}
              style={{ padding: '7px 14px', borderRadius: 99, border: '1px solid', borderColor: filtreStatut === v ? '#C8435A' : 'rgba(200,67,90,.15)', background: filtreStatut === v ? '#C8435A' : 'white', color: filtreStatut === v ? 'white' : '#7A7470', fontSize: 12.5, fontWeight: filtreStatut === v ? 600 : 400, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Liste produits */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 72, borderRadius: 12, background: 'linear-gradient(90deg,#F0EBE6 25%,#E8E0DA 50%,#F0EBE6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>)}
        </div>
      ) : produitsFiltres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#7A7470', fontSize: 15 }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>📦</div>
          Aucun produit trouvé.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {produitsFiltres.map(prod => {
            const variantes  = prod.boutique_variantes || []
            const expanded   = expandedProd.has(prod.id)
            const hasRupture = variantes.some(v => v.stock === 0)
            const hasFaible  = variantes.some(v => v.stock > 0 && v.stock <= 3)
            const stockProd  = variantes.reduce((s, v) => s + (v.stock || 0), 0)

            return (
              <div key={prod.id} style={{ background: 'white', border: `1px solid ${hasRupture ? 'rgba(163,45,45,.2)' : hasFaible ? 'rgba(186,117,23,.2)' : 'rgba(200,67,90,.09)'}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 8px rgba(200,67,90,.05)' }}>
                {/* Ligne produit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', background: expanded ? '#FDFAF6' : 'white', transition: 'background .12s' }}
                  onClick={() => toggleExpand(prod.id)}
                >
                  {/* Miniature */}
                  {prod.image_url
                    ? <img src={prod.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}/>
                    : <div style={{ width: 44, height: 44, borderRadius: 8, background: '#FBEAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🛍️</div>
                  }

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: '#1A1514' }}>{prod.nom_fr}</span>
                      {prod.boutique_categories?.nom_fr && (
                        <span style={{ fontSize: 11, color: '#7A7470', background: '#F0EFED', padding: '2px 8px', borderRadius: 99 }}>{prod.boutique_categories.nom_fr}</span>
                      )}
                      {hasRupture && <span style={{ fontSize: 11, color: '#A32D2D', background: '#FCEBEB', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>🚫 Rupture</span>}
                      {!hasRupture && hasFaible && <span style={{ fontSize: 11, color: '#BA7517', background: '#FAEEDA', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>⚠️ Faible</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#7A7470', marginTop: 3 }}>
                      {variantes.length} variante{variantes.length > 1 ? 's' : ''} · {stockProd} unités au total
                    </div>
                  </div>

                  {/* Mini-jauges par variante */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-end' }}>
                    {variantes.slice(0, 8).map((v, j) => {
                      const st = statutVariante(v.stock)
                      return (
                        <div key={j} title={`${[v.taille, v.couleur].filter(Boolean).join(' / ')} : ${v.stock} unités`}
                          style={{ padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {[v.taille, v.couleur].filter(Boolean).join('/')} · {v.stock}
                        </div>
                      )
                    })}
                    {variantes.length > 8 && <div style={{ fontSize: 11, color: '#7A7470' }}>+{variantes.length - 8}</div>}
                  </div>

                  <div style={{ fontSize: 18, color: '#C8B0B0', marginLeft: 8, flexShrink: 0 }}>
                    {expanded ? '▲' : '▼'}
                  </div>
                </div>

                {/* Détail variantes */}
                {expanded && (
                  <div style={{ borderTop: '1px solid rgba(200,67,90,.08)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                      <thead>
                        <tr style={{ background: '#F8F3EE' }}>
                          {['Taille', 'Couleur', 'SKU', 'Prix HT', 'Stock', 'Statut', 'Modifier', 'Dernière MAJ'].map(h => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#7A7470', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {variantes.map(v => {
                          const st  = statutVariante(v.stock)
                          const isEd = editing?.id === v.id
                          return (
                            <tr key={v.id} style={{ borderTop: '1px solid rgba(200,67,90,.05)', background: isEd ? '#FDFAF6' : 'white' }}>
                              <td style={{ padding: '9px 14px', color: '#1A1514', fontWeight: 500 }}>{v.taille || '—'}</td>
                              <td style={{ padding: '9px 14px', color: '#1A1514' }}>{v.couleur || '—'}</td>
                              <td style={{ padding: '9px 14px', color: '#7A7470', fontFamily: 'monospace', fontSize: 12 }}>{v.sku || '—'}</td>
                              <td style={{ padding: '9px 14px', color: '#4A4340' }}>{v.prix_ht ? `${parseFloat(v.prix_ht).toFixed(2)} €` : '—'}</td>
                              <td style={{ padding: '9px 14px' }}>
                                {isEd ? (
                                  <input
                                    type="number" min="0"
                                    value={editing.stock}
                                    onChange={e => setEditing(ed => ({ ...ed, stock: e.target.value }))}
                                    autoFocus
                                    style={{ width: 72, padding: '5px 8px', border: '1.5px solid #C8435A', borderRadius: 7, fontSize: 13.5, fontFamily: 'DM Sans,sans-serif', textAlign: 'center' }}
                                  />
                                ) : (
                                  <span style={{ fontSize: 15, fontWeight: 700, color: st.color }}>{v.stock}</span>
                                )}
                              </td>
                              <td style={{ padding: '9px 14px' }}>
                                <span style={{ background: st.bg, color: st.color, padding: '3px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 600 }}>{st.label}</span>
                              </td>
                              <td style={{ padding: '9px 14px' }}>
                                {isEd ? (
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    <button onClick={() => saveStock(v.id, editing.stock)} disabled={saving}
                                      style={{ padding: '4px 10px', background: 'linear-gradient(135deg,#C8435A,#D9566A)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                      {saving ? '…' : '✓'}
                                    </button>
                                    <button onClick={() => setEditing(null)}
                                      style={{ padding: '4px 8px', background: '#F0EFED', color: '#7A7470', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => setEditing({ id: v.id, stock: v.stock })}
                                      style={{ padding: '4px 10px', background: '#FBEAF0', color: '#C8435A', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                      ✏️ Modifier
                                    </button>
                                    <button onClick={() => saveStock(v.id, v.stock + 1)}
                                      title="Ajouter 1"
                                      style={{ padding: '4px 8px', background: '#EAF3DE', color: '#3B6D11', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                      +1
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '9px 14px', fontSize: 12, color: '#A8A39D', whiteSpace: 'nowrap' }}>
                                {v.updated_at ? new Date(v.updated_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Lien vers commandes */}
      <div style={{ marginTop: 24, background: '#E6F1FB', border: '1px solid rgba(24,95,165,.15)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13.5, color: '#185FA5' }}>
          💡 Le stock est automatiquement décrémenté après chaque commande validée sur la boutique publique.
        </div>
        <a href="/app/vente/articles" style={{ fontSize: 13, color: '#185FA5', fontWeight: 600, textDecoration: 'none' }}>
          Gérer les articles de vente →
        </a>
      </div>

      <style>{`@keyframes shimmer{to{background-position:-200% 0;}} @media(max-width:700px){[style*='repeat(4,1fr)']{grid-template-columns:repeat(2,1fr) !important;}}`}</style>
    </div>
  )
}
