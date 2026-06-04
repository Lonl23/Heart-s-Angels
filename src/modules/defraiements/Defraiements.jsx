// src/modules/defraiements/Defraiements.jsx
import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { notifDefraiementSoumis } from '@/lib/notifications'
import ValidationAdmin from './ValidationAdmin'

export default function Defraiements() {
  return (
    <Routes>
      <Route index element={<ListeDefraiements />} />
      <Route path="validation" element={<ValidationAdmin />} />
    </Routes>
  )
}

const KM_RATE = 0.4449   // Barème volontaire belge 01/07/2025 → 30/06/2026
const MAX_KM  = 40       // Maximum autorisé par déplacement
const DELAI_JOURS = 30   // Encodage possible jusqu'à 30 jours après le déplacement

// Heure actuelle en Belgique (Europe/Brussels)
function heureBelge() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
  return new Date(s)
}
function aujourdhuiBelgeISO() {
  const d = heureBelge()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
// Validation d'une date de déplacement. Renvoie un message d'erreur ou null.
function verifDate(dateStr) {
  if (!dateStr) return 'Date requise.'
  const bel = heureBelge()
  const ajISO = aujourdhuiBelgeISO()
  // Pas dans le futur
  if (dateStr > ajISO) return 'La date ne peut pas être dans le futur.'
  // Jour même : seulement après 20h heure belge
  if (dateStr === ajISO && bel.getHours() < 20) {
    return "Un défraiement du jour même ne peut être encodé qu'à partir de 20h."
  }
  // Pas plus de 30 jours en arrière
  const limite = heureBelge(); limite.setDate(limite.getDate() - DELAI_JOURS)
  const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth()+1).padStart(2,'0')}-${String(limite.getDate()).padStart(2,'0')}`
  if (dateStr < limiteISO) return `Le délai d'encodage est de ${DELAI_JOURS} jours maximum après le déplacement.`
  return null
}

const STATUT_STYLES = {
  soumis:              { bg:'#E6F1FB', color:'#185FA5', label:'En attente' },
  valide_adjoint:      { bg:'#FAEEDA', color:'#BA7517', label:'Pré-validé (adjoint)' },
  valide_coordinateur: { bg:'#E6F7FA', color:'#0E7A93', label:'Validé coordinateur' },
  valide_tresorier:    { bg:'#EAF3DE', color:'#3B6D11', label:'Approuvé trésorier' },
  paye:                { bg:'#EAF3DE', color:'#3B6D11', label:'Payé ✓' },
  refuse:              { bg:'#FCEBEB', color:'#C8435A', label:'Refusé' },
  // compat anciens statuts
  valide_n1:           { bg:'#FAEEDA', color:'#BA7517', label:'Validé (1ère)' },
  valide_n2:           { bg:'#E6F7FA', color:'#0E7A93', label:'Approuvé' },
}
const DOMAINES = [
  ['souhait','Souhait / mission patient'],
  ['logistique','Logistique / matériel'],
  ['evenement','Événement'],
  ['autre','Autre'],
]

function ListeDefraiements() {
  const { profile, can } = useAuth()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab]           = useState('mes')
  const [annee, setAnnee]       = useState(new Date().getFullYear())
  const [showFiche, setShowFiche] = useState(false)
  const [form, setForm] = useState({
    date_deplacement:'', souhait_id:'', categorie:'mission', domaine:'souhait',
    km:0, description:'', montant_avance:0, justificatif_url:''
  })
  const [souhaits, setSouhaits] = useState([])
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const isAdmin = can('defraiements.validate')

  useEffect(() => {
    supabase.from('souhaits').select('id,patient_prenom,patient_nom').in('statut',['planifie','en_cours','realise']).order('date_souhait', { ascending: false }).limit(30)
      .then(({data}) => setSouhaits(data||[]))
  }, [])
  useEffect(() => { if (profile?.id) load() }, [tab, profile?.id])

  async function load() {
    setLoading(true)
    // profiles!user_id : on lève l'ambiguïté (plusieurs FK vers profiles existent)
    let q = supabase.from('defraiements').select('*, profiles!user_id(prenom,nom), souhaits(patient_prenom,patient_nom)').order('date_deplacement', { ascending: false })
    if (tab === 'mes') q = q.eq('user_id', profile?.id)
    let { data, error } = await q
    if (error) {
      // Fallback sans embed profiles si la relation nommée échoue
      let q2 = supabase.from('defraiements').select('*, souhaits(patient_prenom,patient_nom)').order('date_deplacement', { ascending: false })
      if (tab === 'mes') q2 = q2.eq('user_id', profile?.id)
      const r2 = await q2; data = r2.data
    }
    setItems(data||[]); setLoading(false)
  }

  // Km plafonnés à 40 pour le calcul de l'indemnité
  const kmFactures = (km) => Math.min(parseFloat(km)||0, MAX_KM)
  const montantKm  = (km) => (kmFactures(km) * KM_RATE).toFixed(2)
  const depasse    = (parseFloat(form.km)||0) > MAX_KM

  async function handleSave(e) {
    e.preventDefault()
    if (!form.description) { setMsg({ type:'error', text:'Description requise.' }); return }
    const errDate = verifDate(form.date_deplacement)
    if (errDate) { setMsg({ type:'error', text:errDate }); return }
    setSaving(true)
    const km_reel = parseFloat(form.km)||0
    const km_calc = kmFactures(km_reel)
    const montant_km = parseFloat((km_calc * KM_RATE).toFixed(2))
    const { error } = await supabase.from('defraiements').insert({
      user_id:          profile?.id,
      date_deplacement: form.date_deplacement,
      souhait_id:       form.souhait_id || null,
      categorie:        form.domaine,
      domaine:          form.domaine,
      km:               km_reel,
      montant_km,
      montant_avance:   parseFloat(form.montant_avance)||0,
      montant_rembourse: montant_km + parseFloat(form.montant_avance||0),
      description:      form.description,
      justificatif_url: form.justificatif_url||null,
      statut:           'soumis',
    })
    setSaving(false)
    if (error) { setMsg({ type:'error', text:'Erreur lors de l\'enregistrement.' }); return }
    // Notifier les coordinateurs du domaine concerné
    notifDefraiementSoumis(
      { domaine: form.domaine, montant_rembourse: montant_km + parseFloat(form.montant_avance||0) },
      `${profile?.prenom||''} ${profile?.nom||''}`.trim(),
      profile?.id
    )
    setMsg({ type:'success', text:'Demande de défraiement soumise.' })
    setShowForm(false)
    setForm({ date_deplacement:'', souhait_id:'', categorie:'mission', domaine:'souhait', km:0, description:'', montant_avance:0, justificatif_url:'' })
    load()
    setTimeout(() => setMsg(null), 3500)
  }

  // ── Données filtrées par année ──
  const itemsAnnee = items.filter(d => new Date(d.date_deplacement).getFullYear() === annee)
  const annees = [...new Set(items.map(d => new Date(d.date_deplacement).getFullYear()))].sort((a,b)=>b-a)
  if (!annees.includes(annee)) annees.unshift(annee)

  // ── Synthèse d'avancement (pour le bénévole) ──
  const synth = itemsAnnee.reduce((acc,d) => {
    acc.total += d.montant_rembourse || 0
    if (d.statut === 'paye') acc.paye += d.montant_rembourse || 0
    else if (d.statut === 'refuse') acc.refuse += d.montant_rembourse || 0
    else acc.attente += d.montant_rembourse || 0
    return acc
  }, { total:0, paye:0, attente:0, refuse:0 })

  const eur = (n) => (n||0).toFixed(2) + ' €'

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:1050 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'#1A1514', marginBottom:2 }}>Défraiements</h1>
          <p style={{ fontSize:13, color:'#7A7470' }}>Barème : {KM_RATE.toFixed(4)} €/km · maximum {MAX_KM} km par déplacement</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={()=>setShowFiche(true)} style={{ padding:'8px 14px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
            📄 Fiche annuelle
          </button>
          {isAdmin && (
            <a href="/app/defraiements/validation" style={{ padding:'8px 14px', background:'#FAEEDA', color:'#BA7517', borderRadius:9, fontSize:13.5, fontWeight:600, textDecoration:'none' }}>
              ⚙️ Validation
            </a>
          )}
          <button onClick={()=>setShowForm(true)} style={{ padding:'9px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', boxShadow:'0 2px 10px rgba(27,176,206,.3)' }}>
            + Nouvelle demande
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.type==='success'?'#F0FAF0':'#FEF2F2', border:`1px solid ${msg.type==='success'?'#C3E6C3':'#FCD5D5'}`, borderRadius:9, padding:'10px 14px', fontSize:13.5, color: msg.type==='success'?'#1E5C1E':'#991B1B', marginBottom:16 }}>{msg.text}</div>
      )}

      {/* Sélecteur d'année + onglets admin */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, flexWrap:'wrap' }}>
        <select value={annee} onChange={e=>setAnnee(+e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(27,176,206,.25)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif', fontWeight:600, color:'#0E4A5A' }}>
          {annees.map(a=><option key={a} value={a}>Année {a}</option>)}
        </select>
        {isAdmin && (
          <div style={{ display:'flex', gap:0, borderBottom:'1px solid rgba(27,176,206,.12)' }}>
            {[['mes','Mes demandes'],['tous','Toutes les demandes']].map(([v,l])=>(
              <button key={v} onClick={()=>setTab(v)} style={{ padding:'8px 16px', background:'none', border:'none', borderBottom:`2px solid ${tab===v?'#1BB0CE':'transparent'}`, color:tab===v?'#1BB0CE':'#7A7470', fontWeight:tab===v?600:400, fontSize:13.5, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Synthèse d'avancement */}
      {tab === 'mes' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:22 }}>
          {[
            { label:`Total ${annee}`, val:synth.total, color:'#1BB0CE', bg:'#E6F7FA' },
            { label:'En attente', val:synth.attente, color:'#BA7517', bg:'#FAEEDA' },
            { label:'Payé', val:synth.paye, color:'#3B6D11', bg:'#EAF3DE' },
            { label:'Refusé', val:synth.refuse, color:'#C8435A', bg:'#FCEBEB' },
          ].map((k,i)=>(
            <div key={i} style={{ background:k.bg, borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:'1.35rem', fontWeight:700, color:k.color, lineHeight:1 }}>{eur(k.val)}</div>
              <div style={{ fontSize:12, color:'#7A7470', marginTop:4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> : itemsAnnee.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#7A7470' }}><div style={{ fontSize:'2rem', marginBottom:10 }}>💶</div>Aucune demande pour {annee}.</div>
      ) : (
        <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
            <thead><tr style={{ background:'#FDFAF6' }}>{['Date',...(tab==='tous'?['Bénévole']:[]),'Souhait','Catégorie','Km','Avances','Total','Statut'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>
              {itemsAnnee.map((d,i)=>{
                const st = STATUT_STYLES[d.statut] || { bg:'#F0EFED', color:'#7A7470', label:d.statut }
                return (
                  <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)' }}>
                    <td style={{ padding:'9px 14px', color:'#7A7470', whiteSpace:'nowrap' }}>{new Date(d.date_deplacement).toLocaleDateString('fr-BE')}</td>
                    {tab==='tous' && <td style={{ padding:'9px 14px', color:'#1A1514', fontWeight:500 }}>{d.profiles?.prenom} {d.profiles?.nom}</td>}
                    <td style={{ padding:'9px 14px', color:'#4A4340' }}>{d.souhaits ? `${d.souhaits.patient_prenom} ${d.souhaits.patient_nom}` : '—'}</td>
                    <td style={{ padding:'9px 14px', color:'#4A4340' }}>{d.categorie}</td>
                    <td style={{ padding:'9px 14px', color:'#4A4340' }}>{d.km||0} km<div style={{ fontSize:11, color:'#7A7470' }}>{(d.montant_km||0).toFixed(2)} €</div></td>
                    <td style={{ padding:'9px 14px', color:'#4A4340' }}>{(d.montant_avance||0).toFixed(2)} €</td>
                    <td style={{ padding:'9px 14px', fontWeight:700, color:'#1A1514' }}>{(d.montant_rembourse||0).toFixed(2)} €</td>
                    <td style={{ padding:'9px 14px' }}><span style={{ background:st.bg, color:st.color, padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600 }}>{st.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflow:'auto' }}>
          <div style={{ background:'white', borderRadius:18, padding:'24px', width:'100%', maxWidth:480, margin:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:600 }}>Nouvelle demande de défraiement</h3>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20 }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={LBL}>Date du déplacement *</label>
                <input type="date" value={form.date_deplacement} max={aujourdhuiBelgeISO()}
                  onChange={e=>set('date_deplacement',e.target.value)}
                  style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}/>
                {form.date_deplacement && verifDate(form.date_deplacement) && (
                  <div style={{ fontSize:11.5, color:'#C8435A', marginTop:4 }}>⚠️ {verifDate(form.date_deplacement)}</div>
                )}
                <div style={{ fontSize:11, color:'#A8A39D', marginTop:4 }}>Encodage jusqu'à {DELAI_JOURS} jours après · jour même après 20h</div>
              </div>
              <div><label style={LBL}>Souhait lié</label><select value={form.souhait_id} onChange={e=>set('souhait_id',e.target.value)} style={SEL}><option value="">— Aucun / Non spécifié</option>{souhaits.map(s=><option key={s.id} value={s.id}>{s.patient_prenom} {s.patient_nom}</option>)}</select></div>
              <div><label style={LBL}>Catégorie</label><select value={form.domaine} onChange={e=>set('domaine',e.target.value)} style={SEL}>{DOMAINES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>

              {/* Km */}
              <div style={{ background:'#F0F9FB', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
                  <F label="Km parcourus" val={form.km} set={v=>set('km',v)} type="number" placeholder="0"/>
                  <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                    <div style={{ fontSize:12, color:'#7A7470', marginBottom:4 }}>Indemnité km</div>
                    <div style={{ fontSize:17, fontWeight:700, color:'#0E7A93' }}>{montantKm(form.km)} €</div>
                  </div>
                </div>
                <div style={{ fontSize:11.5, color:'#7A7470' }}>Taux : {KM_RATE.toFixed(4)} €/km</div>
                {depasse && (
                  <div style={{ marginTop:8, padding:'7px 10px', background:'#FAEEDA', borderRadius:8, fontSize:11.5, color:'#BA7517', fontWeight:600 }}>
                    ⚠️ Maximum {MAX_KM} km autorisé par déplacement. L'indemnité est calculée sur {MAX_KM} km ({(MAX_KM*KM_RATE).toFixed(2)} €).
                  </div>
                )}
              </div>

              <F label="Avances/frais payés (€)" val={form.montant_avance} set={v=>set('montant_avance',v)} type="number" placeholder="0.00"/>
              <div style={{ background:'#E6F7FA', borderRadius:9, padding:'10px 14px', fontSize:14, fontWeight:600, color:'#0E7A93', display:'flex', justifyContent:'space-between' }}>
                <span>Total remboursable</span>
                <span>{(parseFloat(montantKm(form.km)) + parseFloat(form.montant_avance||0)).toFixed(2)} €</span>
              </div>
              <F label="Description *" val={form.description} set={v=>set('description',v)} placeholder="Trajet domicile → CHC Liège…"/>

              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, padding:11, background:'none', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13.5, color:'#7A7470', cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Annuler</button>
                <button type="submit" disabled={saving} style={{ flex:2, padding:11, background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:saving?'wait':'pointer', fontFamily:'DM Sans,sans-serif' }}>{saving?'Envoi…':'💶 Soumettre'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fiche annuelle imprimable */}
      {showFiche && (
        <FicheAnnuelle
          annee={annee}
          items={itemsAnnee.filter(d => tab==='tous' ? true : d.user_id === profile?.id)}
          profil={tab==='mes' ? profile : null}
          onClose={()=>setShowFiche(false)}
        />
      )}
    </div>
  )
}

// ── Fiche annuelle récapitulative (imprimable) ──
function FicheAnnuelle({ annee, items, profil, onClose }) {
  const total = items.reduce((s,d)=>s+(d.montant_rembourse||0),0)
  const totalPaye = items.filter(d=>d.statut==='paye').reduce((s,d)=>s+(d.montant_rembourse||0),0)
  const totalKm = items.reduce((s,d)=>s+(d.km||0),0)

  function imprimer() {
    const w = window.open('', '_blank')
    const lignes = items.map(d => `
      <tr>
        <td>${new Date(d.date_deplacement).toLocaleDateString('fr-BE')}</td>
        <td>${d.profiles ? (d.profiles.prenom+' '+d.profiles.nom) : ''}</td>
        <td>${d.categorie||''}</td>
        <td>${d.description||''}</td>
        <td style="text-align:right">${d.km||0} km</td>
        <td style="text-align:right">${(d.montant_km||0).toFixed(2)} €</td>
        <td style="text-align:right">${(d.montant_avance||0).toFixed(2)} €</td>
        <td style="text-align:right"><strong>${(d.montant_rembourse||0).toFixed(2)} €</strong></td>
        <td>${(STATUT_STYLES[d.statut]||{label:d.statut}).label}</td>
      </tr>`).join('')
    w.document.write(`
      <html><head><title>Fiche défraiements ${annee}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#1A1514}
        h1{font-size:20px;color:#0E4A5A;margin-bottom:4px}
        .sub{color:#7A7470;font-size:13px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#E6F7FA;color:#0E4A5A}
        .totaux{margin-top:20px;font-size:14px}
        .totaux div{margin:4px 0}
        .grand{font-size:16px;font-weight:bold;color:#0E7A93}
      </style></head><body>
      <h1>Heart's Angels — Fiche de défraiements ${annee}</h1>
      <div class="sub">${profil ? (profil.prenom+' '+profil.nom) : 'Tous les bénévoles'} · édité le ${new Date().toLocaleDateString('fr-BE')}</div>
      <table>
        <thead><tr><th>Date</th><th>Bénévole</th><th>Catégorie</th><th>Description</th><th>Km</th><th>Indemnité km</th><th>Avances</th><th>Total</th><th>Statut</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      <div class="totaux">
        <div>Total kilomètres : <strong>${totalKm} km</strong></div>
        <div>Total payé : <strong>${totalPaye.toFixed(2)} €</strong></div>
        <div class="grand">Total défraiements ${annee} : ${total.toFixed(2)} €</div>
      </div>
      </body></html>`)
    w.document.close()
    w.print()
  }

  const eur = (n)=>(n||0).toFixed(2)+' €'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflow:'auto' }}>
      <div style={{ background:'white', borderRadius:18, padding:'24px', width:'100%', maxWidth:560, margin:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:600, color:'#0E4A5A', fontFamily:"'Cormorant Garamond',Georgia,serif" }}>Fiche annuelle {annee}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#7A7470' }}>✕</button>
        </div>
        <p style={{ fontSize:12.5, color:'#7A7470', marginBottom:16 }}>{profil ? `${profil.prenom} ${profil.nom}` : 'Tous les bénévoles'} · {items.length} défraiement(s)</p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:18 }}>
          {[
            { l:'Total km', v:items.reduce((s,d)=>s+(d.km||0),0)+' km', c:'#0E4A5A' },
            { l:'Total payé', v:eur(totalPaye), c:'#3B6D11' },
            { l:'Total année', v:eur(total), c:'#0E7A93' },
          ].map((k,i)=>(
            <div key={i} style={{ background:'#F0F9FB', borderRadius:10, padding:'12px' }}>
              <div style={{ fontSize:'1.1rem', fontWeight:700, color:k.c }}>{k.v}</div>
              <div style={{ fontSize:11.5, color:'#7A7470', marginTop:3 }}>{k.l}</div>
            </div>
          ))}
        </div>

        {items.length === 0 ? (
          <p style={{ color:'#7A7470', fontSize:13, textAlign:'center', padding:'20px 0' }}>Aucun défraiement pour {annee}.</p>
        ) : (
          <div style={{ maxHeight:260, overflow:'auto', border:'1px solid rgba(27,176,206,.12)', borderRadius:10, marginBottom:16 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:'#FDFAF6' }}>{['Date','Catégorie','Km','Total','Statut'].map(h=><th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:11, color:'#7A7470', fontWeight:600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {items.map((d,i)=>(
                  <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)' }}>
                    <td style={{ padding:'7px 10px', color:'#7A7470' }}>{new Date(d.date_deplacement).toLocaleDateString('fr-BE')}</td>
                    <td style={{ padding:'7px 10px', color:'#4A4340' }}>{d.categorie}</td>
                    <td style={{ padding:'7px 10px', color:'#4A4340' }}>{d.km||0}</td>
                    <td style={{ padding:'7px 10px', fontWeight:600 }}>{(d.montant_rembourse||0).toFixed(2)} €</td>
                    <td style={{ padding:'7px 10px' }}>{(STATUT_STYLES[d.statut]||{label:d.statut}).label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={imprimer} style={{ width:'100%', padding:11, background:'#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
          🖨️ Imprimer / Exporter en PDF
        </button>
      </div>
    </div>
  )
}

const LBL = { fontSize:'12.5px', fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
const SEL = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }
function F({ label, val, set, type='text', placeholder }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}/></div>
}