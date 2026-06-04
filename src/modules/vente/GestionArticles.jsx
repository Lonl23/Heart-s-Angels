// src/modules/vente/GestionArticles.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function GestionArticles() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState({ nom_fr:'', nom_nl:'', nom_en:'', prix_vente_ttc:'', tva:0.21, stock_evenement:0, actif:true })
  const [saving, setSaving]     = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('articles_vente').select('*').order('nom_fr')
    setArticles(data||[]); setLoading(false)
  }

  function openEdit(art) {
    setEditing(art.id)
    setForm({ nom_fr:art.nom_fr||'', nom_nl:art.nom_nl||'', nom_en:art.nom_en||'', prix_vente_ttc:art.prix_vente_ttc||'', tva:art.tva||0.21, stock_evenement:art.stock_evenement||0, actif:art.actif!==false })
    setShowForm(true)
  }
  function openNew() { setEditing(null); setForm({ nom_fr:'', nom_nl:'', nom_en:'', prix_vente_ttc:'', tva:0.21, stock_evenement:0, actif:true }); setShowForm(true) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nom_fr || !form.prix_vente_ttc) return
    setSaving(true)
    const payload = { ...form, prix_vente_ttc: parseFloat(form.prix_vente_ttc), stock_evenement: parseInt(form.stock_evenement)||0 }
    if (editing) await supabase.from('articles_vente').update(payload).eq('id', editing)
    else await supabase.from('articles_vente').insert(payload)
    setSaving(false); setShowForm(false); load()
  }

  async function toggleActif(art) {
    await supabase.from('articles_vente').update({ actif: !art.actif }).eq('id', art.id)
    load()
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:1000 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <Link to="/app/vente" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Point de vente</Link>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.6rem', fontWeight:500, color:'#1A1514', margin:'6px 0 0' }}>Gestion des articles</h2>
        </div>
        <button onClick={openNew} style={{ padding:'9px 18px', background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', boxShadow:'0 2px 10px rgba(200,67,90,.3)' }}>+ Nouvel article</button>
      </div>

      <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:14, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
          <thead><tr style={{ background:'#FDFAF6' }}>{['Article','Prix TTC','TVA','Stock évén.','Actif','Actions'].map(h=><th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ padding:'24px', color:'#7A7470', textAlign:'center' }}>Chargement…</td></tr>
            : articles.map((art,i) => (
              <tr key={i} style={{ borderTop:'1px solid rgba(200,67,90,.06)', opacity:art.actif?1:.5 }}>
                <td style={{ padding:'10px 14px', fontWeight:500, color:'#1A1514' }}>{art.nom_fr}</td>
                <td style={{ padding:'10px 14px', fontWeight:600, color:'#C8435A' }}>{(art.prix_vente_ttc||0).toFixed(2)} €</td>
                <td style={{ padding:'10px 14px', color:'#7A7470' }}>{((art.tva||0)*100).toFixed(0)} %</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background: art.stock_evenement>0?'#EAF3DE':'#F0EFED', color: art.stock_evenement>0?'#3B6D11':'#7A7470', padding:'2px 8px', borderRadius:99, fontSize:12, fontWeight:600 }}>
                    {art.stock_evenement} unités
                  </span>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <button onClick={()=>toggleActif(art)} style={{ padding:'3px 10px', borderRadius:99, border:'none', background:art.actif?'#EAF3DE':'#F0EFED', color:art.actif?'#3B6D11':'#7A7470', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    {art.actif ? '✓ Actif' : '✗ Inactif'}
                  </button>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <button onClick={()=>openEdit(art)} style={{ padding:'5px 12px', background:'#FBEAF0', color:'#C8435A', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>✏️ Modifier</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'white', borderRadius:18, padding:'24px', width:'100%', maxWidth:460 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:600 }}>{editing ? 'Modifier l\'article' : 'Nouvel article'}</h3>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20 }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <F label="Nom (FR) *" val={form.nom_fr} set={v=>set('nom_fr',v)}/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <F label="Nom (NL)" val={form.nom_nl} set={v=>set('nom_nl',v)}/>
                <F label="Nom (EN)" val={form.nom_en} set={v=>set('nom_en',v)}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <F label="Prix TTC *" val={form.prix_vente_ttc} set={v=>set('prix_vente_ttc',v)} type="number" placeholder="0.00"/>
                <div><label style={LBL}>TVA</label><select value={form.tva} onChange={e=>set('tva',parseFloat(e.target.value))} style={{ width:'100%', padding:'9px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}><option value={0.21}>21%</option><option value={0.12}>12%</option><option value={0.06}>6%</option><option value={0}>0%</option></select></div>
                <F label="Stock évén." val={form.stock_evenement} set={v=>set('stock_evenement',v)} type="number" placeholder="0"/>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                <input type="checkbox" checked={form.actif} onChange={e=>set('actif',e.target.checked)} style={{ accentColor:'#C8435A', width:16, height:16 }}/>
                <span style={{ fontSize:13.5, color:'#4A4340' }}>Article actif</span>
              </label>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, padding:11, background:'none', border:'1px solid rgba(200,67,90,.2)', borderRadius:9, fontSize:13.5, color:'#7A7470', cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Annuler</button>
                <button type="submit" disabled={saving} style={{ flex:2, padding:11, background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:saving?'wait':'pointer', fontFamily:'DM Sans,sans-serif' }}>{saving?'…':'✓ Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
const LBL = { fontSize:'12.5px', fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
function F({ label, val, set, type='text', placeholder }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}/></div>
}
