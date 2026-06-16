import { useState } from 'react'

const VOIES = [
  ['PO','PO (per os)'], ['SL','Sublingual'], ['IV','IV'], ['SC','SC'], ['IM','IM'],
  ['inhalation','Inhalation'], ['patch','Patch'], ['locale','Voie locale'], ['autre','Autre'],
]
const HEURES = Array.from({ length:24 }, (_,h)=>h)
const cbipUrl = (nom) => nom?.trim()
  ? `https://www.cbip.be/fr/search?q=${encodeURIComponent(nom.trim())}`
  : 'https://www.cbip.be/fr/'

function norm(t, i) {
  if (typeof t === 'string') return { id:'t'+i, nom:t, type:'office', voie:'PO', dosage:'', debit:'', consignes:'', heures:[], perfusion:false, perf_debut:null, perf_fin:null, max_jour:'' }
  const heures = Array.isArray(t.heures) ? t.heures.map(Number).filter(n=>!isNaN(n))
    : Array.isArray(t.horaires) ? t.horaires.map(h=>parseInt(String(h),10)).filter(n=>!isNaN(n)) : []
  return {
    id: t.id || ('t'+i), nom: t.nom||'', type: t.type||'office',
    voie: t.voie||'PO', dosage: (t.dosage ?? t.posologie ?? ''), debit: t.debit||'',
    consignes: (t.consignes ?? t.condition ?? ''),
    heures, perfusion: !!t.perfusion,
    perf_debut: (t.perf_debut===0||t.perf_debut)? t.perf_debut : null,
    perf_fin: (t.perf_fin===0||t.perf_fin)? t.perf_fin : null,
    max_jour: (t.max_jour===0||t.max_jour)? t.max_jour : '',
  }
}

export default function TraitementsEditor({ value = [], onChange }) {
  const [items, setItems] = useState((value||[]).map(norm))

  const commit = (list) => { setItems(list); onChange && onChange(list) }
  const maj = (i, patch) => commit(items.map((x,j)=> j===i ? { ...x, ...patch } : x))
  const add = () => commit([...items, norm({ id:'t'+Date.now() }, items.length)])
  const del = (i) => commit(items.filter((_,j)=>j!==i))

  function clickHour(i, h) {
    const t = items[i]
    if (t.type === 'si_necessaire') return
    if (t.perfusion) {
      if (t.perf_debut == null || (t.perf_debut != null && t.perf_fin != null)) {
        maj(i, { perf_debut:h, perf_fin:null })       // démarre une nouvelle plage
      } else {
        maj(i, { perf_debut:Math.min(t.perf_debut,h), perf_fin:Math.max(t.perf_debut,h) })
      }
    } else {
      const hrs = t.heures.includes(h) ? t.heures.filter(x=>x!==h) : [...t.heures, h].sort((a,b)=>a-b)
      maj(i, { heures:hrs })
    }
  }
  const pmin = (t)=>Math.min(t.perf_debut, t.perf_fin), pmax = (t)=>Math.max(t.perf_debut, t.perf_fin)

  const IN = { padding:'6px 8px', border:'1px solid rgba(0,0,0,.14)', borderRadius:7, fontSize:12.5, fontFamily:"'DM Sans',sans-serif", width:'100%', boxSizing:'border-box', background:'white' }
  const TH = { padding:'4px 0', fontSize:10, fontWeight:700, color:'#7A7470', textAlign:'center', minWidth:24, borderBottom:'1px solid rgba(0,0,0,.1)' }
  const LEFT = { position:'sticky', left:0, background:'white', zIndex:2, padding:'8px 10px', borderRight:'1px solid rgba(0,0,0,.1)', borderBottom:'1px solid rgba(0,0,0,.06)', minWidth:230, maxWidth:250, verticalAlign:'top' }

  return (
    <div>
      <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:8, lineHeight:1.5 }}>
        Une ligne par médicament. Pour les médicaments d'office, cliquez les heures de prise (0–23).
        Pour une <strong>perfusion</strong>, cochez « Perfusion » puis cliquez l'heure de début et l'heure de fin : une barre couvre toute la durée.
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize:13, color:'#A8A39D', padding:'10px 0' }}>Aucun médicament encodé.</div>
      ) : (
        <div style={{ overflowX:'auto', border:'1px solid rgba(0,0,0,.1)', borderRadius:10, marginBottom:10 }}>
          <table style={{ borderCollapse:'collapse', width:'100%' }}>
            <thead><tr>
              <th style={{ ...LEFT, ...TH, textAlign:'left', minWidth:230 }}>Médicament</th>
              {HEURES.map(h=><th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {items.map((t,i)=>(
                <tr key={t.id}>
                  <td style={LEFT}>
                    <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:5 }}>
                      <input style={{ ...IN, fontWeight:700 }} placeholder="Nom du médicament" value={t.nom} onChange={e=>maj(i,{nom:e.target.value})} />
                      <button onClick={()=>del(i)} title="Supprimer" style={{ flexShrink:0, background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'5px 8px', fontSize:12, cursor:'pointer' }}>✕</button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:5 }}>
                      <select style={IN} value={t.voie} onChange={e=>maj(i,{voie:e.target.value})}>
                        {VOIES.map(([k,l])=><option key={k} value={k}>{l}</option>)}
                      </select>
                      <input style={IN} placeholder="Dosage" value={t.dosage} onChange={e=>maj(i,{dosage:e.target.value})} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:5 }}>
                      <input style={IN} placeholder="Débit (perf.)" value={t.debit} onChange={e=>maj(i,{debit:e.target.value})} />
                      <input style={IN} placeholder="Consignes" value={t.consignes} onChange={e=>maj(i,{consignes:e.target.value})} />
                    </div>
                    <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', fontSize:11.5 }}>
                      <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
                        <input type="radio" checked={t.type==='office'} onChange={()=>maj(i,{type:'office'})} /> D'office
                      </label>
                      <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
                        <input type="radio" checked={t.type==='si_necessaire'} onChange={()=>maj(i,{type:'si_necessaire'})} /> Si nécessaire
                      </label>
                      {t.type==='office' && (
                        <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
                          <input type="checkbox" checked={t.perfusion} onChange={e=>maj(i,{perfusion:e.target.checked, perf_debut:null, perf_fin:null})} /> Perfusion
                        </label>
                      )}
                      {t.type==='si_necessaire' && (
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                          max <input style={{ ...IN, width:46, padding:'4px 6px' }} type="number" min="1" value={t.max_jour} onChange={e=>maj(i,{max_jour:e.target.value})} />/jour
                        </span>
                      )}
                    </div>
                    <a href={cbipUrl(t.nom)} target="_blank" rel="noreferrer" style={{ display:'inline-block', marginTop:6, fontSize:11.5, color:'#0E7A93', fontWeight:600, textDecoration:'none' }}>🔎 Voir sur le CBIP</a>
                  </td>

                  {HEURES.map(h=>{
                    if (t.type === 'si_necessaire') return <td key={h} style={{ borderBottom:'1px solid rgba(0,0,0,.04)', textAlign:'center', color:'#E2DED8' }}>·</td>
                    if (t.perfusion) {
                      const hasRange = t.perf_debut!=null && t.perf_fin!=null
                      const onlyStart = t.perf_debut!=null && t.perf_fin==null && h===t.perf_debut
                      const inRange = hasRange && h>=pmin(t) && h<=pmax(t)
                      const isStart = inRange && h===pmin(t), isEnd = inRange && h===pmax(t)
                      return (
                        <td key={h} onClick={()=>clickHour(i,h)} title="Cliquer : début puis fin de perfusion"
                          style={{ borderBottom:'1px solid rgba(0,0,0,.04)', cursor:'pointer', padding:0, verticalAlign:'middle' }}>
                          {inRange ? (
                            <div style={{ height:12, background:'#1BB0CE', marginLeft:isStart?3:0, marginRight:isEnd?3:0,
                              borderTopLeftRadius:isStart?6:0, borderBottomLeftRadius:isStart?6:0, borderTopRightRadius:isEnd?6:0, borderBottomRightRadius:isEnd?6:0 }} />
                          ) : onlyStart ? (
                            <div style={{ width:12, height:12, borderRadius:4, background:'#1BB0CE', margin:'0 auto' }} />
                          ) : <div style={{ height:12 }} />}
                        </td>
                      )
                    }
                    const on = t.heures.includes(h)
                    return (
                      <td key={h} style={{ padding:3, textAlign:'center', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                        <button onClick={()=>clickHour(i,h)} title={`${h}h`}
                          style={{ width:22, height:22, borderRadius:5, cursor:'pointer', border:`1.5px solid ${on?'#0E7A93':'#D8D3CD'}`, background:on?'#0E7A93':'white', color:on?'white':'transparent', fontSize:12, fontWeight:700, lineHeight:1, padding:0 }}>
                          {on?'✓':''}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button onClick={add} style={{ padding:'8px 14px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ Ajouter un médicament</button>
    </div>
  )
}