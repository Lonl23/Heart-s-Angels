// src/modules/defraiements/ValidationAdmin.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { notifPreValidation, notifTresorier, notifBenevole } from '@/lib/notifications'

// Coordinateur titulaire responsable selon le domaine
const COORD_PAR_DOMAINE = {
  souhait:    'coord_transports',
  logistique: 'coord_logistique',
  evenement:  'coord_benevoles',
  autre:      null,   // n'importe quel coordinateur / président
}
const DOMAINE_LABEL = { souhait:'Souhait', logistique:'Logistique', evenement:'Événement', autre:'Autre' }

const STATUTS = {
  soumis:              { label:'En attente',           color:'#185FA5', bg:'#E6F1FB' },
  valide_adjoint:      { label:'Pré-validé (adjoint)',  color:'#BA7517', bg:'#FAEEDA' },
  valide_coordinateur: { label:'Validé coordinateur',   color:'#0E7A93', bg:'#E6F7FA' },
  valide_tresorier:    { label:'Approuvé trésorier',    color:'#3B6D11', bg:'#EAF3DE' },
  paye:                { label:'Payé ✓',                color:'#3B6D11', bg:'#EAF3DE' },
  refuse:              { label:'Refusé',                color:'#C8435A', bg:'#FCEBEB' },
}

export default function ValidationAdmin() {
  const { profile, mesFonctions, estAdjoint, isSuperUser } = useAuth()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre]   = useState('a_traiter')
  const [acting, setActing]   = useState(null)
  const [msg, setMsg]         = useState(null)
  const [totaux, setTotaux]   = useState({})
  const [showFicheMois, setShowFicheMois] = useState(false)

  useEffect(() => { load() }, [filtre])
  useEffect(() => { loadTotaux() }, [])

  const fcts = () => (typeof mesFonctions === 'function' ? mesFonctions() : [])
  const estDirection = () => isSuperUser || fcts().some(f => ['president','vice_president'].includes(f))
  const estTresorier = () => estDirection() || fcts().includes('tresorier')

  // Rôle de la personne pour la validation COORDINATEUR d'un défraiement donné
  // → 'titulaire' (peut valider directement) | 'adjoint' (pré-valide, à confirmer) | false
  function roleCoord(item) {
    if (estDirection()) return 'titulaire'
    const requis = COORD_PAR_DOMAINE[item.domaine]
    const f = fcts()
    if (requis) {
      if (f.includes(requis) && !estAdjoint(requis)) return 'titulaire'
      if (estAdjoint(requis)) return 'adjoint'
      return false
    }
    // domaine 'autre' : n'importe quel coordinateur de mission
    const coords = ['coord_transports','coord_logistique','coord_benevoles']
    if (coords.some(c => f.includes(c) && !estAdjoint(c))) return 'titulaire'
    if (coords.some(c => estAdjoint(c))) return 'adjoint'
    return false
  }

  async function load() {
    setLoading(true)
    let q = supabase.from('defraiements')
      .select('*, profiles!user_id(prenom, nom, role, iban), souhaits(patient_prenom, patient_nom)')
      .order('date_deplacement', { ascending: false })
    if (filtre === 'a_traiter') q = q.in('statut', ['soumis','valide_adjoint','valide_coordinateur'])
    else if (filtre !== 'tous') q = q.eq('statut', filtre)
    const { data, error } = await q
    if (error) {
      // Fallback si la relation nommée n'est pas reconnue
      let q2 = supabase.from('defraiements')
        .select('*, profiles(prenom, nom, role, iban), souhaits(patient_prenom, patient_nom)')
        .order('date_deplacement', { ascending: false })
      if (filtre === 'a_traiter') q2 = q2.in('statut', ['soumis','valide_adjoint','valide_coordinateur'])
      else if (filtre !== 'tous') q2 = q2.eq('statut', filtre)
      const r2 = await q2
      setItems(r2.data || [])
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  async function loadTotaux() {
    const { data } = await supabase.from('defraiements').select('statut, montant_rembourse')
    if (!data) return
    const t = data.reduce((acc, d) => {
      acc[d.statut] = (acc[d.statut] || 0) + (d.montant_rembourse || 0)
      acc._total    = (acc._total || 0) + (d.montant_rembourse || 0)
      return acc
    }, {})
    setTotaux(t)
  }

  // Détermine l'action disponible pour CET utilisateur sur CE défraiement
  function actionDispo(item) {
    const r = roleCoord(item)
    switch (item.statut) {
      case 'soumis':
        if (r === 'titulaire') return { next:'valide_coordinateur', label:'Valider', type:'coord' }
        if (r === 'adjoint')   return { next:'valide_adjoint', label:'Pré-valider', type:'adjoint' }
        return null
      case 'valide_adjoint':
        // Seul le titulaire (ou direction) confirme — pas l'adjoint lui-même
        if (r === 'titulaire') return { next:'valide_coordinateur', label:'Confirmer', type:'coord' }
        return null
      case 'valide_coordinateur':
        if (estTresorier()) return { next:'valide_tresorier', label:'Valider (trésorier)', type:'tresorier' }
        return null
      case 'valide_tresorier':
        if (estTresorier()) return { next:'paye', label:'Marquer payé', type:'paiement' }
        return null
      default:
        return null
    }
  }

  async function handleAction(item, action) {
    setActing(item.id)
    const now = new Date().toISOString()
    const updates = { statut: action }
    if (action === 'valide_adjoint')      { updates.valide_adjoint_par = profile?.id;   updates.valide_adjoint_at = now }
    if (action === 'valide_coordinateur') { updates.valide_coord_par = profile?.id;     updates.valide_coord_at = now }
    if (action === 'valide_tresorier')    { updates.valide_tresorier_par = profile?.id; updates.valide_tresorier_at = now }
    if (action === 'paye')                { updates.paye_par = profile?.id;             updates.date_paiement = now }

    const { error } = await supabase.from('defraiements').update(updates).eq('id', item.id)
    setActing(null)
    if (error) { setMsg({ type:'error', text:'Erreur lors de la mise à jour.' }); return }

    // Notifications selon l'étape
    const expNom = `${profile?.prenom||''} ${profile?.nom||''}`.trim()
    if (action === 'valide_adjoint')      notifPreValidation(item, expNom, profile?.id)
    if (action === 'valide_coordinateur') { notifTresorier(item, profile?.id); notifBenevole(item, 'valide_coordinateur', profile?.id) }
    if (action === 'valide_tresorier')    notifBenevole(item, 'valide_tresorier', profile?.id)
    if (action === 'paye')                notifBenevole(item, 'paye', profile?.id)

    const labels = {
      valide_adjoint:'Pré-validé (en attente du coordinateur)',
      valide_coordinateur:'Validé par le coordinateur',
      valide_tresorier:'Approuvé par le trésorier',
      paye:'Marqué payé',
    }
    setMsg({ type:'success', text:`${labels[action]} — ${item.profiles?.prenom} ${item.profiles?.nom} (${(item.montant_rembourse||0).toFixed(2)} €)` })
    setTimeout(() => setMsg(null), 4000)
    load(); loadTotaux()
  }

  async function handleRefus(item) {
    const motif = prompt(`Motif du refus pour ${item.profiles?.prenom} ${item.profiles?.nom} ?`)
    if (motif === null) return
    setActing(item.id)
    await supabase.from('defraiements').update({ statut:'refuse', refuse_par:profile?.id, refuse_motif:motif||null }).eq('id', item.id)
    notifBenevole({ ...item, refuse_motif:motif }, 'refuse', profile?.id)
    setActing(null)
    setMsg({ type:'error', text:'Demande refusée.' })
    setTimeout(() => setMsg(null), 3000)
    load(); loadTotaux()
  }

  const filtres = [
    ['a_traiter', '⚡ À traiter'],
    ['soumis',    '📋 Soumis'],
    ['valide_coordinateur', '💼 Attente trésorier'],
    ['valide_tresorier', '✅ À payer'],
    ['paye',      '💶 Payés'],
    ['refuse',    '✗ Refusés'],
    ['tous',      '📂 Tous'],
  ]

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:1150 }}>
      <div style={{ marginBottom:22 }}>
        <Link to="/app/defraiements" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Défraiements</Link>
        <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'#1A1514', margin:'6px 0 2px' }}>Validation des défraiements</h1>
        <p style={{ fontSize:13, color:'#7A7470' }}>
          Soumis → Coordinateur du domaine (adjoint = pré-validation) → Trésorier → Payé
        </p>
        {estTresorier() && (
          <button onClick={()=>setShowFicheMois(true)} style={{ marginTop:10, padding:'8px 14px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
            📅 Fiche mensuelle des paiements
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'En attente',        val:totaux.soumis||0,              color:'#185FA5', bg:'#E6F1FB' },
          { label:'Validé coord.',     val:totaux.valide_coordinateur||0, color:'#0E7A93', bg:'#E6F7FA' },
          { label:'Approuvé trésorier',val:totaux.valide_tresorier||0,    color:'#3B6D11', bg:'#EAF3DE' },
          { label:'Payés',             val:totaux.paye||0,                color:'#3B6D11', bg:'#EAF3DE' },
          { label:'Total engagé',      val:totaux._total||0,              color:'#0E7A93', bg:'#E6F7FA' },
        ].map((k,i)=>(
          <div key={i} style={{ background:'white', border:`1px solid ${k.color}22`, borderRadius:12, padding:'14px 12px' }}>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:k.color }}>{k.val.toFixed(2)} €</div>
            <div style={{ fontSize:11.5, color:'#7A7470', marginTop:3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ background: msg.type==='success'?'#F0FAF0':'#FEF2F2', border:`1px solid ${msg.type==='success'?'#C3E6C3':'#FCD5D5'}`, borderRadius:9, padding:'10px 14px', fontSize:13.5, color: msg.type==='success'?'#1E5C1E':'#991B1B', marginBottom:16 }}>{msg.text}</div>
      )}

      {/* Filtres */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:18 }}>
        {filtres.map(([v,l])=>(
          <button key={v} onClick={()=>setFiltre(v)} style={{ padding:'6px 14px', borderRadius:99, border:'1px solid', borderColor: filtre===v?'#1BB0CE':'rgba(27,176,206,.15)', background: filtre===v?'#1BB0CE':'white', color: filtre===v?'white':'#7A7470', fontSize:12.5, fontWeight: filtre===v?600:400, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>{l}</button>
        ))}
      </div>

      {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> : items.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px', color:'#7A7470', fontSize:15 }}>
          <div style={{ fontSize:'2.5rem', marginBottom:10 }}>💶</div>Aucune demande dans cette catégorie.
        </div>
      ) : (
        <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
            <thead>
              <tr style={{ background:'#FDFAF6' }}>
                {['Date','Bénévole','Domaine','Mission','Total','Statut','Action'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11.5, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item)=>{
                const st = STATUTS[item.statut] || { label:item.statut, color:'#7A7470', bg:'#F0EFED' }
                const isActing = acting === item.id
                const act = actionDispo(item)
                const peutRefuser = act || (roleCoord(item) && item.statut!=='refuse' && item.statut!=='paye')
                return (
                  <tr key={item.id} style={{ borderTop:'1px solid rgba(27,176,206,.05)', opacity:isActing?0.6:1 }}>
                    <td style={{ padding:'10px 12px', color:'#7A7470', whiteSpace:'nowrap' }}>{new Date(item.date_deplacement).toLocaleDateString('fr-BE')}</td>
                    <td style={{ padding:'10px 12px', fontWeight:500, color:'#1A1514', whiteSpace:'nowrap' }}>{item.profiles?.prenom} {item.profiles?.nom}</td>
                    <td style={{ padding:'10px 12px', color:'#4A4340' }}>
                      <span style={{ background:'#F0F9FB', color:'#0E7A93', padding:'2px 8px', borderRadius:6, fontSize:11.5 }}>{DOMAINE_LABEL[item.domaine]||item.domaine||'—'}</span>
                    </td>
                    <td style={{ padding:'10px 12px', color:'#4A4340', maxWidth:160 }}>
                      {item.souhaits ? `${item.souhaits.patient_prenom} ${item.souhaits.patient_nom}` : <span style={{ color:'#7A7470', fontStyle:'italic' }}>{item.description?.slice(0,30)}</span>}
                    </td>
                    <td style={{ padding:'10px 12px', fontWeight:700, color:'#1A1514', whiteSpace:'nowrap' }}>
                      {(item.montant_rembourse||0).toFixed(2)} €
                      {item.profiles?.iban && item.statut==='valide_tresorier' && (
                        <div style={{ fontSize:10.5, color:'#7A7470', marginTop:2 }}>IBAN: {item.profiles.iban}</div>
                      )}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:st.bg, color:st.color, padding:'3px 9px', borderRadius:99, fontSize:11.5, fontWeight:600, whiteSpace:'nowrap' }}>{st.label}</span>
                      {item.statut==='valide_adjoint' && (
                        <div style={{ fontSize:10.5, color:'#BA7517', marginTop:3 }}>⏳ attente coordinateur</div>
                      )}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:5 }}>
                        {act && (
                          <button onClick={()=>handleAction(item, act.next)} disabled={isActing}
                            style={{ padding:'4px 10px', background:'#1BB0CE', color:'white', border:'none', borderRadius:7, fontSize:11.5, fontWeight:600, cursor:isActing?'wait':'pointer', whiteSpace:'nowrap' }}>
                            {isActing ? '…' : act.label}
                          </button>
                        )}
                        {peutRefuser && item.statut!=='refuse' && item.statut!=='paye' && (
                          <button onClick={()=>handleRefus(item)} disabled={isActing}
                            style={{ padding:'4px 8px', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, fontSize:11.5, fontWeight:600, cursor:isActing?'wait':'pointer' }}>✗</button>
                        )}
                        {item.statut==='paye' && <span style={{ fontSize:11.5, color:'#3B6D11', fontWeight:600 }}>✓ payé</span>}
                        {item.statut==='refuse' && item.refuse_motif && <span style={{ fontSize:11, color:'#C8435A', fontStyle:'italic' }} title={item.refuse_motif}>motif ⓘ</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showFicheMois && <FicheMensuelle onClose={()=>setShowFicheMois(false)} />}

      {/* Légende du workflow */}
      <div style={{ marginTop:20, background:'#F0F9FB', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'14px 16px', fontSize:12.5, color:'#4A4340', lineHeight:1.7 }}>
        <strong style={{ color:'#0E4A5A' }}>Circuit de validation :</strong><br/>
        1️⃣ Le <strong>coordinateur du domaine</strong> valide (Souhait → transports · Logistique → logistique · Événement → bénévoles).
        Un <strong>adjoint</strong> peut pré-valider, mais le coordinateur titulaire doit ensuite confirmer.<br/>
        2️⃣ Le <strong>trésorier</strong> approuve (validation finale).<br/>
        3️⃣ Le <strong>trésorier</strong> marque le paiement.
      </div>
    </div>
  )
}

// ── Fiche mensuelle des paiements (pour le trésorier) ────────────────────────
function FicheMensuelle({ onClose }) {
  const [mois, setMois] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [y, m] = mois.split('-').map(Number)
      const debut = `${y}-${String(m).padStart(2,'0')}-01T00:00:00`
      const finDate = new Date(y, m, 0)
      const fin = `${y}-${String(m).padStart(2,'0')}-${String(finDate.getDate()).padStart(2,'0')}T23:59:59`
      // Regroupement sur la date d'APPROBATION trésorier (valide_tresorier_at)
      // On charge les défraiements puis on résout tous les validateurs par leurs noms
      const r2 = await supabase.from('defraiements').select('*')
        .gte('valide_tresorier_at', debut).lte('valide_tresorier_at', fin).order('valide_tresorier_at')
      let base = r2.data || []
      const ids = [...new Set(base.flatMap(d => [
        d.user_id, d.valide_adjoint_par, d.valide_coord_par, d.valide_tresorier_par
      ]).filter(Boolean))]
      let map = {}
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id,prenom,nom,iban').in('id', ids)
        map = Object.fromEntries((profs||[]).map(p => [p.id, p]))
      }
      base = base.map(d => ({
        ...d,
        beneficiaire: map[d.user_id],
        v_adjoint:    map[d.valide_adjoint_par],
        v_coord:      map[d.valide_coord_par],
        v_tresorier:  map[d.valide_tresorier_par],
      }))
      setRows(base)
      setLoading(false)
    }
    load()
  }, [mois])

  // Approuvés ce mois (à virer) + éventuellement déjà payés depuis
  const aPayer = rows.filter(d => d.statut === 'valide_tresorier' || d.statut === 'paye')
  const totalAPayer = aPayer.reduce((s,d)=>s+(d.montant_rembourse||0),0)
  const eur = (n)=>(n||0).toFixed(2)+' €'

  function imprimer() {
    const w = window.open('', '_blank')
    const fmt = (x) => x ? new Date(x).toLocaleDateString('fr-BE') : '—'
    const nom = (p) => p ? (p.prenom+' '+p.nom) : '—'
    const valid = (p, x) => p ? `${nom(p)}<br><span style="color:#7A7470;font-size:10px">${fmt(x)}</span>` : '—'
    const lignes = aPayer.map(d => `
      <tr>
        <td>${fmt(d.created_at)}</td>
        <td>${fmt(d.date_deplacement)}</td>
        <td>${d.v_adjoint ? valid(d.v_adjoint, d.valide_adjoint_at) : '<span style=color:#A8A39D>—</span>'}</td>
        <td>${valid(d.v_coord, d.valide_coord_at)}</td>
        <td>${valid(d.v_tresorier, d.valide_tresorier_at)}</td>
        <td>${nom(d.beneficiaire)}</td>
        <td>${d.beneficiaire?.iban || '<span style=color:#C8435A>IBAN manquant</span>'}</td>
        <td style="text-align:right"><strong>${(d.montant_rembourse||0).toFixed(2)} €</strong></td>
      </tr>`).join('')
    w.document.write(`
      <html><head><title>Fiche paiements ${mois}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#1A1514}
        h1{font-size:20px;color:#0E4A5A;margin-bottom:4px}
        .sub{color:#7A7470;font-size:13px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#E6F7FA;color:#0E4A5A}
        .total{margin-top:20px;font-size:16px;font-weight:bold;color:#0E7A93}
      </style></head><body>
      <h1>Heart's Angels — Défraiements à payer · ${mois}</h1>
      <div class="sub">${aPayer.length} virement(s) · édité le ${new Date().toLocaleDateString('fr-BE')}</div>
      <table>
        <thead><tr><th>Demande</th><th>Événement</th><th>Pré-validé (adjoint)</th><th>Validé (coordinateur)</th><th>Approuvé (trésorier)</th><th>Bénéficiaire</th><th>IBAN</th><th>Montant</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      <div class="total">Total à virer : ${totalAPayer.toFixed(2)} €</div>
      </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflow:'auto' }}>
      <div style={{ background:'white', borderRadius:18, padding:'24px', width:'100%', maxWidth:820, margin:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:600, color:'#0E4A5A', fontFamily:"'Cormorant Garamond',Georgia,serif" }}>Fiche mensuelle des paiements</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#7A7470' }}>✕</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <input type="month" value={mois} onChange={e=>setMois(e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(27,176,206,.25)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}/>
          <div style={{ fontSize:14, fontWeight:700, color:'#0E7A93' }}>Total à virer : {eur(totalAPayer)}</div>
        </div>
        <p style={{ fontSize:12, color:'#7A7470', marginBottom:12 }}>Défraiements approuvés par le trésorier durant ce mois (prêts au virement ou déjà payés).</p>

        {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> : aPayer.length === 0 ? (
          <p style={{ color:'#7A7470', fontSize:13, textAlign:'center', padding:'20px 0' }}>Aucun défraiement à payer pour ce mois.</p>
        ) : (
          <div style={{ maxHeight:280, overflow:'auto', border:'1px solid rgba(27,176,206,.12)', borderRadius:10, marginBottom:16 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:'#FDFAF6' }}>{['Demande','Événement','Adjoint','Coordinateur','Trésorier','Bénéficiaire','IBAN','Montant'].map(h=><th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:11, color:'#7A7470', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {aPayer.map((d,i)=>(
                  <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)' }}>
                    <td style={{ padding:'7px 10px', color:'#7A7470', whiteSpace:'nowrap' }}>{d.created_at ? new Date(d.created_at).toLocaleDateString('fr-BE') : '—'}</td>
                    <td style={{ padding:'7px 10px', color:'#7A7470', whiteSpace:'nowrap' }}>{d.date_deplacement ? new Date(d.date_deplacement).toLocaleDateString('fr-BE') : '—'}</td>
                    <td style={{ padding:'7px 10px' }}><Valideur p={d.v_adjoint} date={d.valide_adjoint_at}/></td>
                    <td style={{ padding:'7px 10px' }}><Valideur p={d.v_coord} date={d.valide_coord_at}/></td>
                    <td style={{ padding:'7px 10px' }}><Valideur p={d.v_tresorier} date={d.valide_tresorier_at}/></td>
                    <td style={{ padding:'7px 10px', color:'#1A1514', whiteSpace:'nowrap' }}>{d.beneficiaire?.prenom} {d.beneficiaire?.nom}</td>
                    <td style={{ padding:'7px 10px', color: d.beneficiaire?.iban?'#4A4340':'#C8435A', fontFamily:'monospace', fontSize:11 }}>{d.beneficiaire?.iban || 'IBAN manquant'}</td>
                    <td style={{ padding:'7px 10px', fontWeight:700, whiteSpace:'nowrap' }}>{(d.montant_rembourse||0).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={imprimer} disabled={aPayer.length===0} style={{ width:'100%', padding:11, background: aPayer.length?'#1BB0CE':'#A8D8E2', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor: aPayer.length?'pointer':'not-allowed', fontFamily:'DM Sans,sans-serif' }}>
          🖨️ Imprimer la fiche de virements
        </button>
      </div>
    </div>
  )
}

// Affiche un validateur : nom + date en petit (ou — si absent)
function Valideur({ p, date }) {
  if (!p) return <span style={{ color:'#A8A39D', fontSize:12 }}>—</span>
  return (
    <div style={{ lineHeight:1.3 }}>
      <div style={{ color:'#1A1514', fontSize:12, whiteSpace:'nowrap' }}>{p.prenom} {p.nom}</div>
      {date && <div style={{ color:'#7A7470', fontSize:10 }}>{new Date(date).toLocaleDateString('fr-BE')}</div>}
    </div>
  )
}