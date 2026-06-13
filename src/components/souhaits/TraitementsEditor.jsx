// src/components/souhaits/TraitementsEditor.jsx
import { useState } from 'react'
import { VOIES, normTrait } from '@/lib/traitements'

export default function TraitementsEditor({ value, onChange }) {
  const [items, setItems] = useState((value || []).map(normTrait))
  const sync = (next) => { setItems(next); onChange(next) }
  const maj = (i,k,v) => sync(items.map((x,j)=>j===i?{...x,[k]:v}:x))
  const add = () => sync([...items, { id:'t'+Date.now(), nom:'', posologie:'', voie:'PO', type:'office', horaires:[], condition:'' }])
  const del = (i) => sync(items.filter((_,j)=>j!==i))
  function addHoraire(i){ const h = prompt('Heure (HH:MM)', '08:00'); if (h) maj(i,'horaires',[...(items[i].horaires||[]), h].sort()) }
  function delHoraire(i,h){ maj(i,'horaires',(items[i].horaires||[]).filter(x=>x!==h)) }

  const IN = { padding:'7px 9px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:12.5, fontFamily:"'DM Sans',sans-serif" }
  return (
    <div>
      {items.map((t,i)=>(
        <div key={t.id} style={{ border:'1px solid rgba(0,0,0,.1)', borderRadius:10, padding:'12px 14px', marginBottom:10, background:'#FAFAF8' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#7A7470' }}>Médicament {i+1}</span>
            <button type="button" onClick={()=>del(i)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'3px 8px', fontSize:12, cursor:'pointer' }}>✕</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8, marginBottom:8 }}>
            <input style={IN} placeholder="Nom du médicament" value={t.nom} onChange={e=>maj(i,'nom',e.target.value)} />
            <select style={IN} value={t.voie} onChange={e=>maj(i,'voie',e.target.value)}>
              {VOIES.map(([k,l])=><option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <input style={{ ...IN, width:'100%', marginBottom:8 }} placeholder="Posologie (ex. 1 gélule, 10 mg…)" value={t.posologie} onChange={e=>maj(i,'posologie',e.target.value)} />
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, cursor:'pointer' }}>
              <input type="radio" checked={t.type==='office'} onChange={()=>maj(i,'type','office')} /> D'office
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, cursor:'pointer' }}>
              <input type="radio" checked={t.type==='si_necessaire'} onChange={()=>maj(i,'type','si_necessaire')} /> Si nécessaire
            </label>
          </div>
          {t.type === 'office' ? (
            <div>
              <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:4 }}>Horaires de prise</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(t.horaires||[]).map(h=>(
                  <span key={h} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#E6F7FA', color:'#0E7A93', borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:600 }}>
                    {h} <button type="button" onClick={()=>delHoraire(i,h)} style={{ background:'none', border:'none', color:'#0E7A93', cursor:'pointer', padding:0 }}>×</button>
                  </span>
                ))}
                <button type="button" onClick={()=>addHoraire(i)} style={{ background:'#F0F9FB', color:'#0E7A93', border:'1px dashed rgba(14,122,147,.4)', borderRadius:99, padding:'3px 10px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ heure</button>
              </div>
            </div>
          ) : (
            <input style={{ ...IN, width:'100%' }} placeholder="Condition (ex. si douleur, si T° > 38,5°C…)" value={t.condition} onChange={e=>maj(i,'condition',e.target.value)} />
          )}
        </div>
      ))}
      <button type="button" onClick={add} style={{ padding:'8px 14px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ Ajouter un médicament</button>
    </div>
  )
}