// src/modules/comptabilite/Comptabilite.jsx
import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { exportBilanPDF, exportGrandLivreExcel } from '@/lib/exports'

export default function Comptabilite() {
  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:1150 }}>
      <Routes>
        <Route index element={<DashboardCompta />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="plan" element={<PlanComptable />} />
        <Route path="bilan" element={<BilanAnnuel />} />
        <Route path="budget" element={<BudgetView />} />
        <Route path="bilan-officiel" element={<BilanOfficiel />} />
        <Route path="synthese" element={<Synthese />} />
      </Routes>
    </div>
  )
}

// ── Dashboard comptabilité ────────────────────────────────────────────────────
function DashboardCompta() {
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => { loadData() }, [annee])

  async function loadData() {
    setLoading(true)
    const debut = `${annee}-01-01`
    const fin   = `${annee}-12-31`
    const { data: tx } = await supabase.from('transactions')
      .select('*, plan_comptable(numero, libelle, type)')
      .gte('date_operation', debut).lte('date_operation', fin)
      .order('date_operation', { ascending: false })

    const recettes = (tx||[]).filter(t => t.type_mouvement === 'recette').reduce((s,t) => s + (t.montant||0), 0)
    const depenses = (tx||[]).filter(t => t.type_mouvement === 'depense').reduce((s,t) => s + (t.montant||0), 0)
    setData({ transactions: tx||[], recettes, depenses, solde: recettes - depenses })
    setLoading(false)
  }

  async function handleExportPDF() {
    setExporting(true)
    await exportBilanPDF(annee)
    setExporting(false)
  }
  async function handleExportXLSX() {
    setExporting(true)
    await exportGrandLivreExcel(annee)
    setExporting(false)
  }

  const navItems = [
    { to:'/app/comptabilite/transactions', label:'📋 Transactions' },
    { to:'/app/comptabilite/plan',         label:'📖 Plan comptable' },
    { to:'/app/comptabilite/bilan',        label:'📊 Bilan annuel' },
    { to:'/app/comptabilite/budget',       label:'🎯 Budget 2026' },
    { to:'/app/comptabilite/bilan-officiel', label:'🏛️ Bilan officiel' },
    { to:'/app/comptabilite/synthese',     label:'📈 Synthèse pluriannuelle' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'#1A1514', marginBottom:2 }}>Comptabilité</h1>
          <p style={{ fontSize:13, color:'#7A7470' }}>Suivi financier de l'ASBL</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={annee} onChange={e => setAnnee(+e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif', color:'#1A1514' }}>
            {Array.from({length:5}, (_,i) => new Date().getFullYear() - i).map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={handleExportPDF} disabled={exporting||loading} style={{ padding:'8px 14px', background:'white', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13, color:'#1BB0CE', fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>📄 PDF</button>
          <button onClick={handleExportXLSX} disabled={exporting||loading} style={{ padding:'8px 14px', background:'white', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13, color:'#3B6D11', fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>📊 Excel</button>
        </div>
      </div>

      {/* Nav sous-pages */}
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {navItems.map(n => (
          <Link key={n.to} to={n.to} style={{ padding:'8px 16px', background:'#E6F7FA', color:'#1BB0CE', borderRadius:9, fontSize:13, fontWeight:500, textDecoration:'none', transition:'all .12s' }}
            onMouseEnter={e => e.currentTarget.style.background='#1BB0CE'}
          >{n.label}</Link>
        ))}
      </div>

      {/* KPIs */}
      {loading ? <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>{[1,2,3].map(i => <div key={i} style={{ height:100, borderRadius:14, background:'linear-gradient(90deg,#F0EBE6 25%,#E8E0DA 50%,#F0EBE6 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }}/>)}</div>
      : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:28 }}>
          {[
            { label:'Recettes', val:data.recettes, color:'#3B6D11', bg:'#EAF3DE', icon:'📈' },
            { label:'Dépenses', val:data.depenses, color:'#A32D2D', bg:'#FCEBEB', icon:'📉' },
            { label:'Solde',    val:data.solde,    color: data.solde >= 0 ? '#185FA5' : '#A32D2D', bg: data.solde >= 0 ? '#E6F1FB' : '#FCEBEB', icon: data.solde >= 0 ? '✅' : '⚠️' },
          ].map((c,i) => (
            <div key={i} style={{ background:'white', border:`1px solid ${c.color}22`, borderRadius:14, padding:'20px 18px', boxShadow:'0 1px 8px rgba(27,176,206,.05)' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:12 }}>{c.icon}</div>
              <div style={{ fontSize:'1.6rem', fontWeight:700, color:c.color, lineHeight:1, marginBottom:4 }}>
                {c.val.toLocaleString('fr-BE', { style:'currency', currency:'EUR' })}
              </div>
              <div style={{ fontSize:12.5, color:'#7A7470' }}>{c.label} {annee}</div>
            </div>
          ))}
        </div>
      )}

      {/* Dernières transactions */}
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 8px rgba(27,176,206,.05)' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(27,176,206,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:'#1A1514', margin:0 }}>Dernières transactions</h3>
          <Link to="/app/comptabilite/transactions" style={{ fontSize:13, color:'#1BB0CE', fontWeight:600, textDecoration:'none' }}>Voir toutes →</Link>
        </div>
        {loading ? <div style={{ padding:20, color:'#7A7470', fontSize:13.5 }}>Chargement…</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
            <thead><tr style={{ background:'#FDFAF6', borderBottom:'1px solid rgba(27,176,206,.08)' }}>
              {['Date','Libellé','Compte','Type','Montant'].map(h => <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(data?.transactions||[]).slice(0,15).map((t, i) => (
                <tr key={i} style={{ borderBottom:'1px solid rgba(27,176,206,.05)' }}>
                  <td style={{ padding:'9px 14px', color:'#7A7470', whiteSpace:'nowrap' }}>{new Date(t.date_operation).toLocaleDateString('fr-BE')}</td>
                  <td style={{ padding:'9px 14px', color:'#1A1514' }}>{t.libelle}</td>
                  <td style={{ padding:'9px 14px', color:'#7A7470' }}>{t.plan_comptable?.numero} – {t.plan_comptable?.libelle?.slice(0,25)}</td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ background: t.type_mouvement==='recette' ? '#EAF3DE':'#FCEBEB', color: t.type_mouvement==='recette' ? '#3B6D11':'#A32D2D', padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600 }}>
                      {t.type_mouvement==='recette' ? '+ Recette' : '− Dépense'}
                    </span>
                  </td>
                  <td style={{ padding:'9px 14px', fontWeight:600, color: t.type_mouvement==='recette' ? '#3B6D11':'#A32D2D', textAlign:'right' }}>
                    {t.type_mouvement==='recette' ? '+' : '-'} {(t.montant||0).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <style>{`@keyframes shimmer{to{background-position:-200% 0;}}`}</style>
    </div>
  )
}

// ── Transactions ──────────────────────────────────────────────────────────────
function Transactions() {
  const [txs, setTxs]         = useState([])
  const [comptes, setComptes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState({ date_operation: new Date().toISOString().slice(0,10), libelle:'', compte_id:'', type_mouvement:'depense', montant:'', reference:'' })
  const [saving, setSaving]   = useState(false)
  const [annee, setAnnee]     = useState(new Date().getFullYear())
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  useEffect(() => {
    supabase.from('plan_comptable').select('id,numero,libelle').order('numero').then(({data}) => setComptes(data||[]))
  }, [])
  useEffect(() => { loadTx() }, [annee])

  async function loadTx() {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*, plan_comptable(numero,libelle)').gte('date_operation', `${annee}-01-01`).lte('date_operation', `${annee}-12-31`).order('date_operation', { ascending: false })
    setTxs(data||[]); setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.libelle || !form.compte_id || !form.montant) return
    setSaving(true)
    await supabase.from('transactions').insert({ ...form, montant: parseFloat(form.montant) })
    setSaving(false); setShowForm(false)
    setForm({ date_operation: new Date().toISOString().slice(0,10), libelle:'', compte_id:'', type_mouvement:'depense', montant:'', reference:'' })
    loadTx()
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <Link to="/app/comptabilite" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Comptabilité</Link>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.6rem', fontWeight:500, color:'#1A1514', margin:'6px 0 0' }}>Transactions</h2>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={annee} onChange={e => setAnnee(+e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}>
            {Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} style={{ padding:'8px 16px', background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>+ Nouvelle transaction</button>
        </div>
      </div>

      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
          <thead><tr style={{ background:'#FDFAF6' }}>{['Date','Libellé','Compte','Type','Montant','Réf.'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ padding:'24px', color:'#7A7470', textAlign:'center' }}>Chargement…</td></tr>
            : txs.map((t,i) => (
              <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)' }}>
                <td style={{ padding:'9px 14px', color:'#7A7470', whiteSpace:'nowrap' }}>{new Date(t.date_operation).toLocaleDateString('fr-BE')}</td>
                <td style={{ padding:'9px 14px', color:'#1A1514' }}>{t.libelle}</td>
                <td style={{ padding:'9px 14px', color:'#7A7470' }}>{t.plan_comptable?.numero} – {t.plan_comptable?.libelle?.slice(0,20)}</td>
                <td style={{ padding:'9px 14px' }}><span style={{ background: t.type_mouvement==='recette'?'#EAF3DE':'#FCEBEB', color: t.type_mouvement==='recette'?'#3B6D11':'#A32D2D', padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600 }}>{t.type_mouvement==='recette'?'Recette':'Dépense'}</span></td>
                <td style={{ padding:'9px 14px', fontWeight:600, color: t.type_mouvement==='recette'?'#3B6D11':'#A32D2D', whiteSpace:'nowrap' }}>{t.type_mouvement==='recette'?'+':'-'} {(t.montant||0).toFixed(2)} €</td>
                <td style={{ padding:'9px 14px', color:'#7A7470', fontSize:12 }}>{t.reference||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'white', borderRadius:18, padding:'24px', width:'100%', maxWidth:440 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:600 }}>Nouvelle transaction</h3>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20 }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <F label="Date" val={form.date_operation} set={v=>set('date_operation',v)} type="date"/>
              <F label="Libellé *" val={form.libelle} set={v=>set('libelle',v)}/>
              <div><label style={LBL}>Compte *</label><select value={form.compte_id} onChange={e=>set('compte_id',e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}><option value="">— Sélectionner</option>{comptes.map(c=><option key={c.id} value={c.id}>{c.numero} – {c.libelle}</option>)}</select></div>
              <div style={{ display:'flex', gap:10 }}>
                {[['recette','📈 Recette'],['depense','📉 Dépense']].map(([v,l])=>(
                  <label key={v} style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:`1.5px solid ${form.type_mouvement===v?'#1BB0CE':'rgba(0,0,0,.1)'}`, borderRadius:8, cursor:'pointer', background:form.type_mouvement===v?'#FBEAF0':'white' }}>
                    <input type="radio" name="type" value={v} checked={form.type_mouvement===v} onChange={()=>set('type_mouvement',v)} style={{accentColor:'#1BB0CE'}}/><span style={{ fontSize:13, color:form.type_mouvement===v?'#1BB0CE':'#4A4340', fontWeight:form.type_mouvement===v?600:400 }}>{l}</span>
                  </label>
                ))}
              </div>
              <F label="Montant (€) *" val={form.montant} set={v=>set('montant',v)} type="number" placeholder="0.00"/>
              <F label="Référence" val={form.reference} set={v=>set('reference',v)} placeholder="Facture, virement…"/>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, padding:11, background:'none', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13.5, color:'#7A7470', cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Annuler</button>
                <button type="submit" disabled={saving} style={{ flex:2, padding:11, background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:saving?'wait':'pointer', fontFamily:'DM Sans,sans-serif' }}>{saving?'Enregistrement…':'✓ Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Plan comptable ────────────────────────────────────────────────────────────
function PlanComptable() {
  const [comptes, setComptes] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('plan_comptable').select('*').order('numero').then(({data})=>{setComptes(data||[]);setLoading(false)})
  }, [])
  const grouped = comptes.reduce((acc, c) => {
    const g = c.numero?.toString()[0] || '?'
    return {...acc, [g]: [...(acc[g]||[]), c]}
  }, {})
  const groupLabels = { '1':'Classe 1 — Capitaux', '2':'Classe 2 — Immobilisations', '3':'Classe 3 — Stocks', '4':'Classe 4 — Créances/Dettes', '5':'Classe 5 — Financiers', '6':'Classe 6 — Charges', '7':'Classe 7 — Produits' }
  return (
    <div>
      <div style={{ marginBottom:20 }}><Link to="/app/comptabilite" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Comptabilité</Link><h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.6rem', fontWeight:500, color:'#1A1514', margin:'6px 0 0' }}>Plan comptable ASBL</h2></div>
      {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> :
        Object.entries(grouped).map(([g, items]) => (
          <div key={g} style={{ marginBottom:20, background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'#FDFAF6', borderBottom:'1px solid rgba(27,176,206,.08)', fontSize:13, fontWeight:600, color:'#1BB0CE' }}>{groupLabels[g] || `Classe ${g}`}</div>
            {items.map((c,i) => (
              <div key={i} style={{ padding:'9px 16px', borderTop:'1px solid rgba(27,176,206,.05)', display:'flex', gap:16, fontSize:13.5 }}>
                <span style={{ fontWeight:600, color:'#1A1514', minWidth:60 }}>{c.numero}</span>
                <span style={{ color:'#4A4340', flex:1 }}>{c.libelle}</span>
                <span style={{ color:'#7A7470', fontSize:12 }}>{c.type}</span>
              </div>
            ))}
          </div>
        ))
      }
    </div>
  )
}

// ── Bilan annuel ──────────────────────────────────────────────────────────────
function BilanAnnuel() {
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  useEffect(() => {
    setLoading(true)
    supabase.from('transactions').select('*, plan_comptable(numero,libelle,type)').gte('date_operation', `${annee}-01-01`).lte('date_operation', `${annee}-12-31`)
      .then(({data: txs}) => {
        const byCompte = (txs||[]).reduce((acc, t) => {
          const k = t.compte_id
          if (!acc[k]) acc[k] = { compte: t.plan_comptable, recettes:0, depenses:0 }
          if (t.type_mouvement === 'recette') acc[k].recettes += t.montant||0
          else acc[k].depenses += t.montant||0
          return acc
        }, {})
        const totalR = Object.values(byCompte).reduce((s,c)=>s+c.recettes,0)
        const totalD = Object.values(byCompte).reduce((s,c)=>s+c.depenses,0)
        setData({ byCompte, totalR, totalD })
        setLoading(false)
      })
  }, [annee])
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div><Link to="/app/comptabilite" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Comptabilité</Link><h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.6rem', fontWeight:500, color:'#1A1514', margin:'6px 0 0' }}>Bilan {annee}</h2></div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={annee} onChange={e=>setAnnee(+e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}>{Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y}>{y}</option>)}</select>
          <button disabled={loading||exporting} onClick={async()=>{setExporting(true);await exportBilanPDF(annee);setExporting(false)}} style={{ padding:'8px 14px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>📄 Exporter PDF</button>
        </div>
      </div>
      {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> : data && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
            {[{l:'Recettes totales',v:data.totalR,c:'#3B6D11',bg:'#EAF3DE'},{l:'Dépenses totales',v:data.totalD,c:'#A32D2D',bg:'#FCEBEB'},{l:'Résultat',v:data.totalR-data.totalD,c:data.totalR-data.totalD>=0?'#185FA5':'#A32D2D',bg:data.totalR-data.totalD>=0?'#E6F1FB':'#FCEBEB'}].map((c,i)=>(
              <div key={i} style={{ background:'white', border:`1px solid ${c.c}22`, borderRadius:14, padding:'18px 16px' }}>
                <div style={{ fontSize:'1.4rem', fontWeight:700, color:c.c }}>{(c.v||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR'})}</div>
                <div style={{ fontSize:12.5, color:'#7A7470', marginTop:4 }}>{c.l}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
              <thead><tr style={{ background:'#FDFAF6' }}>{['Compte','Libellé','Recettes','Dépenses','Solde'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470' }}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.values(data.byCompte).map((c,i)=>(
                  <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)' }}>
                    <td style={{ padding:'9px 14px', fontWeight:600, color:'#1A1514' }}>{c.compte?.numero}</td>
                    <td style={{ padding:'9px 14px', color:'#4A4340' }}>{c.compte?.libelle}</td>
                    <td style={{ padding:'9px 14px', color:'#3B6D11', fontWeight:500 }}>{c.recettes.toFixed(2)} €</td>
                    <td style={{ padding:'9px 14px', color:'#A32D2D', fontWeight:500 }}>{c.depenses.toFixed(2)} €</td>
                    <td style={{ padding:'9px 14px', fontWeight:600, color:(c.recettes-c.depenses)>=0?'#185FA5':'#A32D2D' }}>{(c.recettes-c.depenses).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}


// ── Budget 2026 vs Réalisé ────────────────────────────────────────────────────
function BudgetView() {
  const [comptes, setComptes] = useState([])
  const [realise, setRealise] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const annee = 2026
      const [{ data: cpt }, { data: tx }] = await Promise.all([
        supabase.from('plan_comptable').select('*').order('numero'),
        supabase.from('transactions').select('montant, type_mouvement, compte_id')
          .gte('date_operation', annee + '-01-01').lte('date_operation', annee + '-12-31'),
      ])
      // Cumul réalisé par compte
      const r = {}
      ;(tx||[]).forEach(t => { r[t.compte_id] = (r[t.compte_id]||0) + (t.montant||0) })
      setComptes(cpt||[])
      setRealise(r)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding:32, textAlign:'center', color:'#1BB0CE' }}>Chargement…</div>

  const recettes = comptes.filter(c => c.type === 'recette')
  const depenses = comptes.filter(c => c.type === 'depense')
  const totalBudgetRec = recettes.reduce((s,c)=>s+(c.budget_2026||0),0)
  const totalBudgetDep = depenses.reduce((s,c)=>s+(c.budget_2026||0),0)
  const totalRealRec = recettes.reduce((s,c)=>s+(realise[c.id]||0),0)
  const totalRealDep = depenses.reduce((s,c)=>s+(realise[c.id]||0),0)
  const eur = (n) => (n||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR'})

  const Section = ({ titre, items, color, totalB, totalR }) => (
    <div style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, overflow:'hidden', marginBottom:20 }}>
      <div style={{ padding:'12px 18px', background: color+'10', borderBottom:`1px solid ${color}22`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ fontSize:14, fontWeight:600, color, margin:0 }}>{titre}</h3>
        <div style={{ fontSize:12.5, color:'#7A7470' }}>Budget : <strong style={{ color }}>{eur(totalB)}</strong> · Réalisé : <strong style={{ color }}>{eur(totalR)}</strong></div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead><tr style={{ background:'#FDFAF6' }}>
          <th style={{ padding:'8px 14px', textAlign:'left', fontSize:11.5, color:'#7A7470', fontWeight:600 }}>Compte</th>
          <th style={{ padding:'8px 14px', textAlign:'right', fontSize:11.5, color:'#7A7470', fontWeight:600 }}>Budget 2026</th>
          <th style={{ padding:'8px 14px', textAlign:'right', fontSize:11.5, color:'#7A7470', fontWeight:600 }}>Réalisé</th>
          <th style={{ padding:'8px 14px', textAlign:'right', fontSize:11.5, color:'#7A7470', fontWeight:600 }}>%</th>
          <th style={{ padding:'8px 14px', textAlign:'left', fontSize:11.5, color:'#7A7470', fontWeight:600, width:120 }}>Progression</th>
        </tr></thead>
        <tbody>
          {items.map((c,i) => {
            const real = realise[c.id] || 0
            const pct = c.budget_2026 > 0 ? Math.round(real / c.budget_2026 * 100) : 0
            const over = pct > 100
            return (
              <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)' }}>
                <td style={{ padding:'8px 14px' }}><span style={{ color:'#7A7470', fontFamily:'monospace', fontSize:12 }}>{c.numero}</span> <span style={{ color:'#1A1514' }}>{c.libelle}</span></td>
                <td style={{ padding:'8px 14px', textAlign:'right', color:'#4A4340' }}>{eur(c.budget_2026)}</td>
                <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color:'#1A1514' }}>{eur(real)}</td>
                <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color: over ? '#C8435A' : color }}>{pct}%</td>
                <td style={{ padding:'8px 14px' }}>
                  <div style={{ height:7, background:'#F0EFED', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:Math.min(pct,100)+'%', background: over ? '#C8435A' : color, borderRadius:99 }}/>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const resultatBudget = totalBudgetRec - totalBudgetDep
  const resultatRealise = totalRealRec - totalRealDep

  return (
    <div>
      <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.5rem', fontWeight:500, color:'#1A1514', marginBottom:6 }}>Budget 2026</h2>
      <p style={{ fontSize:13, color:'#7A7470', marginBottom:20 }}>Budget voté en assemblée générale, suivi du réalisé en temps réel.</p>

      {/* Résumé */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Recettes prévues', budget:totalBudgetRec, real:totalRealRec, color:'#3B6D11' },
          { label:'Dépenses prévues', budget:totalBudgetDep, real:totalRealDep, color:'#C8435A' },
          { label:'Résultat prévu', budget:resultatBudget, real:resultatRealise, color: resultatBudget>=0?'#1BB0CE':'#C8435A' },
        ].map((k,i)=>(
          <div key={i} style={{ background:'white', border:`1px solid ${k.color}22`, borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontSize:12, color:'#7A7470', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:'1.4rem', fontWeight:700, color:k.color, lineHeight:1 }}>{eur(k.budget)}</div>
            <div style={{ fontSize:12, color:'#7A7470', marginTop:4 }}>Réalisé : {eur(k.real)}</div>
          </div>
        ))}
      </div>

      <Section titre="📈 Recettes" items={recettes} color="#3B6D11" totalB={totalBudgetRec} totalR={totalRealRec} />
      <Section titre="📉 Dépenses" items={depenses} color="#C8435A" totalB={totalBudgetDep} totalR={totalRealDep} />
    </div>
  )
}


// ── Bilan officiel (voté en AG) ───────────────────────────────────────────────
function BilanOfficiel() {
  const [annee, setAnnee] = useState(2025)
  const [lignes, setLignes] = useState([])
  const [synthese, setSynthese] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('bilan_annuel').select('*').eq('annee', annee).order('ordre'),
      supabase.from('comptes_synthese').select('*').eq('annee', annee).maybeSingle(),
    ]).then(([{ data: b }, { data: s }]) => {
      setLignes(b||[]); setSynthese(s); setLoading(false)
    })
  }, [annee])

  const eur = (n) => (n||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR'})
  const actifs = lignes.filter(l => l.categorie === 'actif')
  const passifs = lignes.filter(l => l.categorie === 'passif')
  const fp = lignes.filter(l => l.categorie === 'fonds_propres')
  const totalActif = actifs.reduce((s,l)=>s+(l.montant||0),0)
  const totalPassif = passifs.reduce((s,l)=>s+(l.montant||0),0)
  const totalFP = fp.reduce((s,l)=>s+(l.montant||0),0)

  const Bloc = ({ titre, items, total, color }) => (
    <div style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
      <div style={{ padding:'11px 16px', background: color+'10', borderBottom:`1px solid ${color}22`, display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize:13.5, fontWeight:700, color }}>{titre}</span>
        <span style={{ fontSize:13.5, fontWeight:700, color }}>{eur(total)}</span>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <tbody>
          {items.map((l,i)=>(
            <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)' }}>
              <td style={{ padding:'8px 16px', color:'#7A7470', fontFamily:'monospace', fontSize:12, width:70 }}>{l.numero||''}</td>
              <td style={{ padding:'8px 16px', color:'#1A1514' }}>{l.libelle}</td>
              <td style={{ padding:'8px 16px', textAlign:'right', fontWeight:500, color: l.montant<0?'#C8435A':'#1A1514' }}>{eur(l.montant)}</td>
            </tr>
          ))}
          {items.length===0 && <tr><td colSpan={3} style={{ padding:14, color:'#A8A39D', fontStyle:'italic', textAlign:'center' }}>Aucune donnée</td></tr>}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <Link to="/app/comptabilite" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Comptabilité</Link>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.6rem', fontWeight:500, color:'#1A1514', margin:'6px 0 0' }}>Bilan officiel {annee}</h2>
          <p style={{ fontSize:12.5, color:'#7A7470', marginTop:2 }}>Tel que voté en assemblée générale</p>
        </div>
        <select value={annee} onChange={e=>setAnnee(+e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}>
          <option value={2025}>2025</option><option value={2024}>2024</option>
        </select>
      </div>
      {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> : (
        <>
          {synthese && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
              {[
                { l:'Total actif', v:synthese.total_actifs, c:'#1BB0CE' },
                { l:'Total passif', v:synthese.total_passifs, c:'#C8435A' },
                { l:'Fonds propres', v:synthese.fonds_propres, c:'#3B6D11' },
              ].map((k,i)=>(
                <div key={i} style={{ background:'white', border:`1px solid ${k.c}22`, borderRadius:14, padding:'16px 18px' }}>
                  <div style={{ fontSize:'1.4rem', fontWeight:700, color:k.c }}>{eur(k.v)}</div>
                  <div style={{ fontSize:12.5, color:'#7A7470', marginTop:4 }}>{k.l}</div>
                </div>
              ))}
            </div>
          )}
          <Bloc titre="ACTIF" items={actifs} total={totalActif} color="#1BB0CE" />
          <Bloc titre="PASSIF (dettes)" items={passifs} total={totalPassif} color="#C8435A" />
          <Bloc titre="FONDS PROPRES" items={fp} total={totalFP} color="#3B6D11" />
          {synthese?.note && (
            <div style={{ background:'#FAEEDA', border:'1px solid rgba(186,117,23,.2)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#BA7517' }}>
              ℹ️ {synthese.note}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Synthèse pluriannuelle ────────────────────────────────────────────────────
function Synthese() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('comptes_synthese').select('*').order('annee').then(({data})=>{ setRows(data||[]); setLoading(false) })
  }, [])
  const eur = (n) => (n||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR'})

  return (
    <div>
      <Link to="/app/comptabilite" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Comptabilité</Link>
      <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.6rem', fontWeight:500, color:'#1A1514', margin:'6px 0 20px' }}>Synthèse pluriannuelle</h2>
      {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> : (
        <div style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
            <thead><tr style={{ background:'#F0F9FB' }}>
              {['Année','Revenus','Charges','Résultat','Total actif','Fonds propres'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign: h==='Année'?'left':'right', fontSize:12, fontWeight:600, color:'#7A7470' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)' }}>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:'#1A1514' }}>{r.annee}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', color:'#3B6D11', fontWeight:500 }}>{eur(r.total_revenus)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', color:'#C8435A', fontWeight:500 }}>{eur(r.total_charges)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color: r.resultat>=0?'#1BB0CE':'#C8435A' }}>{eur(r.resultat)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', color:'#4A4340' }}>{eur(r.total_actifs)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', color:'#4A4340' }}>{eur(r.fonds_propres)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize:12, color:'#A8A39D', marginTop:12, fontStyle:'italic' }}>
        Données issues des comptes annuels validés en assemblée générale.
      </p>
    </div>
  )
}

const LBL = { fontSize:'12.5px', fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
function F({ label, val, set, type='text', placeholder }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}/></div>
}