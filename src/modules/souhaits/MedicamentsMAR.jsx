import { Card } from '@/components/ui'
import { debitLabel, heuresDues } from './medCalc'

const nowHM = () => new Date().toTimeString().slice(0,5)

// Normalise prises en objet { 'HH:MM': { donne, reelle } }
function prisesObj(m) {
  const p = m.prises
  if (Array.isArray(p)) { const o={}; p.forEach(x=>{ if(x?.prevue) o[x.prevue]={ donne:!!x.donne, reelle:x.heure } }); return o }
  return (p && typeof p === 'object') ? p : {}
}

export default function MedicamentsMAR({ meds, onSavePrises }) {
  const progr = meds.filter(m => m.type_admin !== 'si_necessaire')
  const prn = meds.filter(m => m.type_admin === 'si_necessaire')

  // colonnes = union des heures dues, triées
  const cols = Array.from(new Set(progr.flatMap(heuresDues))).sort()

  function toggle(m, label) {
    const po = prisesObj(m)
    const cur = po[label]?.donne
    const np = { ...po, [label]: cur ? { donne:false } : { donne:true, reelle: nowHM() } }
    onSavePrises(m, np)
  }
  function adminPRN(m) {
    const po = prisesObj(m); const events = Array.isArray(po.events) ? po.events : []
    onSavePrises(m, { ...po, events:[...events, nowHM()] })
  }
  function retirerPRN(m, i) {
    const po = prisesObj(m); const events = (Array.isArray(po.events)?po.events:[]).filter((_,j)=>j!==i)
    onSavePrises(m, { ...po, events })
  }

  return (
    <Card>
      <div style={{ fontSize:'1.05rem', fontWeight:700, color:'var(--heading)', marginBottom:12 }}>💊 Administration des médicaments</div>

      {progr.length === 0 ? <div style={{ fontSize:13.5, color:'var(--text-muted)' }}>Aucun médicament programmé.</div> : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ borderCollapse:'collapse', width:'100%', minWidth: 260 + cols.length*70 }}>
            <thead>
              <tr>
                <th style={{ ...th, position:'sticky', left:0, background:'var(--card)', minWidth:220, textAlign:'left' }}>Médicament</th>
                {cols.map(c => <th key={c} style={{ ...th, minWidth:64 }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {progr.map(m => {
                const dues = new Set(heuresDues(m)); const po = prisesObj(m)
                return (
                  <tr key={m.id} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ ...td, position:'sticky', left:0, background:'var(--card)', textAlign:'left' }}>
                      <div style={{ fontWeight:600, color:'var(--text)', fontSize:13.5 }}>{m.medicament} {m.dosage && <span style={{ fontWeight:400, color:'var(--text-muted)' }}>· {m.dosage}</span>}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{[m.voie, debitLabel(m)].filter(Boolean).join(' · ')}</div>
                    </td>
                    {cols.map(c => {
                      if (!dues.has(c)) return <td key={c} style={td}></td>
                      const on = po[c]?.donne
                      return (
                        <td key={c} style={{ ...td, padding:4 }}>
                          <button onClick={()=>toggle(m, c)} title={on?`Donné à ${po[c]?.reelle||''}`:'À administrer'}
                            style={{ width:'100%', minHeight:48, borderRadius:8, border:`1.5px solid ${on?'#3B6D11':'#D9B'}`, background:on?'#EAF3DE':'#FCEBEB', color:on?'#3B6D11':'#A32D2D', cursor:'pointer', fontWeight:700, fontSize:on?12:16, lineHeight:1.1 }}>
                            {on ? <span>✓<br/><span style={{ fontSize:10.5, fontWeight:600 }}>{po[c]?.reelle}</span></span> : '✕'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {prn.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Si nécessaire</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {prn.map(m => {
              const po = prisesObj(m); const events = Array.isArray(po.events)?po.events:[]
              return (
                <div key={m.id} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontWeight:600, color:'var(--text)' }}>{m.medicament} {m.dosage && <span style={{ fontWeight:400, color:'var(--text-muted)' }}>· {m.dosage}</span>}</div>
                      <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{[m.voie, debitLabel(m)].filter(Boolean).join(' · ')}{m.posologie_max?` · max ${m.posologie_max}`:''}</div>
                    </div>
                    <button onClick={()=>adminPRN(m)} style={{ padding:'12px 16px', minHeight:48, borderRadius:9, border:'none', background:'#3B6D11', color:'#fff', fontWeight:600, cursor:'pointer' }}>+ Administrer maintenant</button>
                  </div>
                  {events.length>0 && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                      {events.map((h,i)=>(
                        <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#EAF3DE', color:'#3B6D11', borderRadius:99, padding:'3px 10px', fontSize:12.5, fontWeight:600 }}>
                          {h}<button onClick={()=>retirerPRN(m,i)} style={{ background:'none', border:'none', color:'#3B6D11', cursor:'pointer' }}>✕</button>
                        </span>
                      ))}
                      <span style={{ fontSize:12, color:'var(--text-muted)', alignSelf:'center' }}>({events.length} administration{events.length>1?'s':''})</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
const th = { padding:'8px 6px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--text-muted)', background:'var(--bg-alt)' }
const td = { padding:'8px 6px', textAlign:'center', color:'var(--text)', verticalAlign:'middle' }
