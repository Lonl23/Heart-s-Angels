// src/modules/vente/Vente.jsx
import { useState, useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import GestionArticles from './GestionArticles'

export default function Vente() {
  return (
    <Routes>
      <Route index element={<PointDeVente />} />
      <Route path="articles" element={<GestionArticles />} />
    </Routes>
  )
}

function PointDeVente() {
  const { profile } = useAuth()
  const [articles, setArticles] = useState([])
  const [panier, setPanier]     = useState([])
  const [paiement, setPaiement] = useState('cash')
  const [loading, setLoading]   = useState(true)
  const [selling, setSelling]   = useState(false)
  const [lastVente, setLastVente] = useState(null)
  const [catSel, setCatSel]     = useState(null)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    supabase.from('articles_vente').select('*, boutique_categories(nom_fr)').eq('actif', true).order('nom_fr')
      .then(({ data }) => { setArticles(data||[]); setLoading(false) })
  }, [])

  const displayed = articles
    .filter(a => !catSel || a.categorie_id === catSel)
    .filter(a => !search || a.nom_fr.toLowerCase().includes(search.toLowerCase()))

  const cats = [...new Map(articles.filter(a=>a.boutique_categories).map(a=>[a.categorie_id, a.boutique_categories])).entries()]

  function addToCart(art) {
    setPanier(prev => {
      const ex = prev.find(l => l.id === art.id)
      if (ex) return prev.map(l => l.id === art.id ? {...l, qty: l.qty+1} : l)
      return [...prev, { id:art.id, nom:art.nom_fr, prix:art.prix_vente_ttc, qty:1 }]
    })
  }
  function setQty(id, qty) {
    if (qty < 1) { setPanier(p => p.filter(l => l.id !== id)); return }
    setPanier(p => p.map(l => l.id === id ? {...l, qty} : l))
  }

  const total    = panier.reduce((s,l)=>s+l.prix*l.qty, 0)
  const qtyTotal = panier.reduce((s,l)=>s+l.qty, 0)

  async function handleVente() {
    if (!panier.length) return
    setSelling(true)
    const { data: vente, error } = await supabase.from('ventes').insert({
      operateur_id: profile?.id,
      montant_ttc:  total,
      mode_paiement: paiement,
      statut: 'payee',
    }).select().single()
    if (error) { alert('Erreur lors de la vente.'); setSelling(false); return }

    await supabase.from('vente_lignes').insert(panier.map(l => ({
      vente_id: vente.id, article_id: l.id, quantite: l.qty, prix_unitaire: l.prix,
    })))
    // Décrémenter stock variante si applicable (via boutique_produits liés)

    setLastVente({ id: vente.id, montant: total, lignes: panier })
    setPanier([])
    setSelling(false)
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'#1A1514', marginBottom:2 }}>Point de vente</h1>
          <p style={{ fontSize:13, color:'#7A7470' }}>Ventes en événements · {new Date().toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long' })}</p>
        </div>
        <Link to="/app/vente/articles" style={{ padding:'8px 16px', background:'#FBEAF0', color:'#C8435A', borderRadius:9, fontSize:13.5, fontWeight:600, textDecoration:'none' }}>
          ⚙️ Gérer les articles
        </Link>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20, alignItems:'start' }}>
        {/* Catalogue */}
        <div>
          {/* Search + cats */}
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher…" style={{ flex:1, minWidth:180, padding:'8px 12px', border:'1px solid rgba(200,67,90,.12)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}/>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
            <CatBtn active={!catSel} onClick={()=>setCatSel(null)}>Tous</CatBtn>
            {cats.map(([id,c])=><CatBtn key={id} active={catSel===id} onClick={()=>setCatSel(id)}>{c.nom_fr}</CatBtn>)}
          </div>

          {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
              {displayed.map(art => (
                <button key={art.id} onClick={()=>addToCart(art)} style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:12, padding:'14px 12px', cursor:'pointer', textAlign:'center', boxShadow:'0 1px 6px rgba(200,67,90,.04)', transition:'all .12s', fontFamily:'DM Sans,sans-serif' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(200,67,90,.3)';e.currentTarget.style.background='#FBEAF0'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(200,67,90,.09)';e.currentTarget.style.background='white'}}
                >
                  <div style={{ fontSize:'1.8rem', marginBottom:8 }}>{art.image_url ? '🛍️' : '🏷️'}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1A1514', marginBottom:4, lineHeight:1.3 }}>{art.nom_fr}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#C8435A' }}>{(art.prix_vente_ttc||0).toFixed(2)} €</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Panier */}
        <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:16, padding:'18px', boxShadow:'0 2px 14px rgba(200,67,90,.07)', position:'sticky', top:80 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:'#1A1514', marginBottom:14 }}>🛒 Ticket en cours</h3>

          {lastVente && (
            <div style={{ background:'#EAF3DE', border:'1px solid rgba(59,109,17,.2)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'#1E5C1E', marginBottom:14 }}>
              ✓ Vente #{lastVente.id.slice(0,8)} — {lastVente.montant.toFixed(2)} € encaissé
            </div>
          )}

          {panier.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'#7A7470', fontSize:13 }}>Panier vide<br/>Cliquez sur un article</div>
          ) : (
            <>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14, maxHeight:260, overflowY:'auto' }}>
                {panier.map(l => (
                  <div key={l.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid rgba(200,67,90,.07)' }}>
                    <div style={{ flex:1, fontSize:13, color:'#1A1514', fontWeight:500 }}>{l.nom}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <button onClick={()=>setQty(l.id, l.qty-1)} style={QTY}>−</button>
                      <span style={{ fontSize:13, fontWeight:600, minWidth:18, textAlign:'center' }}>{l.qty}</span>
                      <button onClick={()=>setQty(l.id, l.qty+1)} style={QTY}>+</button>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1A1514', minWidth:52, textAlign:'right' }}>{(l.prix*l.qty).toFixed(2)} €</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:16, color:'#1A1514', marginBottom:14, paddingTop:8, borderTop:'1px solid rgba(200,67,90,.1)' }}>
                <span>Total</span><span style={{ color:'#C8435A' }}>{total.toFixed(2)} €</span>
              </div>
              {/* Mode paiement */}
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                {[['cash','💵 Cash'],['bancontact','💳 Bancontact'],['virement','🏦 Virement']].map(([v,l])=>(
                  <button key={v} onClick={()=>setPaiement(v)} style={{ flex:1, padding:'7px 4px', borderRadius:8, border:`1.5px solid ${paiement===v?'#C8435A':'rgba(0,0,0,.1)'}`, background:paiement===v?'#FBEAF0':'white', color:paiement===v?'#C8435A':'#4A4340', fontSize:11.5, fontWeight:paiement===v?600:400, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>{l}</button>
                ))}
              </div>
              <button onClick={handleVente} disabled={selling} style={{ width:'100%', padding:12, background: selling?'#E8697E':'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:10, fontSize:14.5, fontWeight:700, cursor:selling?'wait':'pointer', fontFamily:'DM Sans,sans-serif', boxShadow:'0 3px 12px rgba(200,67,90,.3)' }}>
                {selling ? 'Enregistrement…' : `✓ Encaisser ${total.toFixed(2)} €`}
              </button>
              <button onClick={()=>setPanier([])} style={{ width:'100%', marginTop:8, padding:9, background:'none', border:'1px solid rgba(200,67,90,.15)', borderRadius:9, fontSize:13, color:'#7A7470', cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                🗑️ Vider le panier
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@media(max-width:900px){[style*='grid-template-columns: 1fr 320px']{grid-template-columns:1fr !important;}}`}</style>
    </div>
  )
}

const QTY = { width:26, height:26, borderRadius:6, border:'1px solid rgba(0,0,0,.1)', background:'white', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }
function CatBtn({ active, onClick, children }) {
  return <button onClick={onClick} style={{ padding:'5px 13px', borderRadius:99, border:'1px solid', borderColor:active?'#C8435A':'rgba(200,67,90,.15)', background:active?'#C8435A':'white', color:active?'white':'#7A7470', fontSize:12.5, fontWeight:active?600:400, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>{children}</button>
}
