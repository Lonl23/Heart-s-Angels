// src/components/souhaits/AffectationEquipages.jsx
// Affectation du personnel + véhicule par équipage. Autonome : charge volontaires,
// disponibilités et personnel affecté. Écrit dans souhait_personnel.
// La plaque est remontée au parent via onVehicule (stockée dans equipages).
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AffectationEquipages({ souhaitId, equipages, dateSouhait, dateFin, surPlusieursJours, onVehicule, onChauffeur, peutAffecter = true }) {
  const [personnel, setPersonnel] = useState([])
  const [volontaires, setVolontaires] = useState([])
  const [dispos, setDispos] = useState([])

  useEffect(() => { if (souhaitId) charger() }, [souhaitId])

  async function charger() {
    const [{ data: p }, { data: v }, { data: d }] = await Promise.all([
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role,selection_medicale)').eq('souhait_id', souhaitId),
      supabase.from('profiles').select('id,prenom,nom,role,selection_medicale').order('nom'),
      supabase.from('disponibilites').select('user_id,date_debut,date_fin'),
    ])
    setPersonnel(p || []); setVolontaires(v || []); setDispos(d || [])
  }

  async function affecter(userId, eqId) {
    if (!userId) return
    if (personnel.some(p => p.user_id === userId && (p.equipage_id||null) === (eqId||null))) return
    const { error } = await supabase.from('souhait_personnel').insert({ souhait_id: souhaitId, user_id: userId, equipage_id: eqId || null })
    if (error) { alert('Affectation impossible : ' + error.message); return }
    charger()
  }
  async function retirer(spId) {
    await supabase.from('souhait_personnel').delete().eq('id', spId)
    charger()
  }

  // Disponibilités couvrant toute la durée
  const debut = dateSouhait ? String(dateSouhait).slice(0,10) : null
  const fin = (surPlusieursJours && dateFin) ? String(dateFin).slice(0,10) : debut
  const dispoIds = new Set()
  if (debut) for (const d of dispos) {
    const dd = d.date_debut ? String(d.date_debut).slice(0,10) : null
    const df = d.date_fin ? String(d.date_fin).slice(0,10) : dd
    if (dd && dd <= debut && (df || dd) >= fin) dispoIds.add(d.user_id)
  }

  function besoin(eq) {
    if (eq.type === 'logistique') return { min: 1, txt: '1 conducteur' }
    const base = 2 + (eq.longue_route ? 1 : 0)
    return { min: base, txt: `${base} médicaux dont 1 chauffeur` + (eq.longue_route ? ' (+1 longue route)' : '') }
  }
  const sansEquipage = personnel.filter(p => !p.equipage_id)

  return (
    <div style={{ marginTop:14 }}>
      <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A', marginBottom:8 }}>🚑 Affectation des équipages</div>
      {equipages.length === 0 && (
        <p style={{ fontSize:12.5, color:'#A8A39D', fontStyle:'italic', marginBottom:10 }}>
          Définissez d'abord les équipages ci-dessus pour pouvoir affecter véhicules et personnel.
        </p>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {equipages.map((eq, i) => {
          const b = besoin(eq)
          const membres = personnel.filter(p => p.equipage_id === eq.id)
          const complet = membres.length >= b.min
          const titre = eq.type === 'logistique' ? `🚐 Véhicule logistique ${i+1}` : `🚑 Ambulance ${i+1}${eq.mode==='paramedicalise'?' — paramédicalisé':' — normalisé'}`
          return (
            <EquipageCard key={eq.id} eq={eq} titre={titre} besoin={b} complet={complet}
              membres={membres} volontaires={volontaires} personnel={personnel}
              dispoIds={dispoIds} aDate={!!debut} multiJours={!!(surPlusieursJours && dateFin)}
              peutAffecter={peutAffecter} onAffecter={affecter} onRetirer={retirer} onVehicule={onVehicule} onChauffeur={onChauffeur} />
          )
        })}
      </div>
      {sansEquipage.length > 0 && (
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#7A7470', marginBottom:6 }}>Autres affectés</div>
          {sansEquipage.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ flex:1, fontSize:13, color:'#1A1514' }}>{p.profiles?.prenom} {p.profiles?.nom} <span style={{ color:'#7A7470', fontSize:12 }}>· {p.profiles?.role?.replace(/_/g,' ')}</span></div>
              {peutAffecter && <button type="button" onClick={()=>retirer(p.id)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, padding:'3px 8px', fontSize:12, cursor:'pointer' }}>✕</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EquipageCard({ eq, titre, besoin, complet, membres, volontaires, personnel, dispoIds, aDate, multiJours, peutAffecter, onAffecter, onRetirer, onVehicule, onChauffeur }) {
  const [sel, setSel] = useState('')
  const [plaque, setPlaque] = useState(eq.immatriculation || '')
  const [dispoOnly, setDispoOnly] = useState(aDate)
  useEffect(() => { setPlaque(eq.immatriculation || '') }, [eq.immatriculation])

  const libres = volontaires.filter(v => !personnel.some(p => p.user_id === v.id))
  const dispo = (aDate && dispoOnly) ? libres.filter(v => dispoIds.has(v.id)) : libres
  const nbDispo = libres.filter(v => dispoIds.has(v.id)).length

  // Chauffeurs accrédités parmi les membres affectés
  const accredites = membres.filter(m => m.profiles?.selection_medicale)
  // Chauffeur effectif : désigné, sinon l'unique accrédité
  const chauffeurId = eq.chauffeur_id || (accredites.length === 1 ? accredites[0].user_id : null)

  return (
    <div style={{ border:`1px solid ${complet ? 'rgba(59,109,17,.25)' : 'rgba(200,67,90,.2)'}`, borderRadius:12, padding:'13px 15px', background: complet ? '#F6FBF1' : '#FFF8F9' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:13.5, fontWeight:700, color:'#1A1514' }}>{titre}</span>
        <span style={{ fontSize:11.5, fontWeight:600, padding:'2px 9px', borderRadius:99, background: complet ? '#EAF3DE' : '#FCEBEB', color: complet ? '#3B6D11' : '#A32D2D' }}>
          {membres.length}/{besoin.min} · {complet ? 'complet' : 'incomplet'}
        </span>
      </div>
      <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:10 }}>Besoin : {besoin.txt}</div>

      <div style={{ marginBottom:10 }}>
        <label style={{ fontSize:11.5, fontWeight:600, color:'#7A7470', display:'block', marginBottom:3 }}>🚗 Véhicule (immatriculation)</label>
        <input value={plaque} disabled={!peutAffecter}
          onChange={e=>setPlaque(e.target.value)} onBlur={()=>plaque!==(eq.immatriculation||'') && onVehicule(eq.id, plaque)}
          placeholder="1-ABC-234" style={{ width:'100%', padding:'7px 10px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:13, fontFamily:'monospace' }} />
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom: peutAffecter ? 10 : 0 }}>
        {membres.length === 0 && <span style={{ fontSize:12.5, color:'#A8A39D', fontStyle:'italic' }}>Aucun volontaire affecté.</span>}
        {membres.map(p => (
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#FBEAF0,#F7C1C1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#C8435A', flexShrink:0 }}>
              {(p.profiles?.prenom?.[0]||'')+(p.profiles?.nom?.[0]||'')}
            </div>
            <div style={{ flex:1, fontSize:13, color:'#1A1514' }}>
              {p.profiles?.prenom} {p.profiles?.nom} <span style={{ color:'#7A7470', fontSize:11.5 }}>· {p.profiles?.role?.replace(/_/g,' ')}</span>
              {p.user_id === chauffeurId && <span style={{ fontSize:10.5, fontWeight:700, color:'#0E7A93', background:'#E6F7FA', borderRadius:99, padding:'1px 7px', marginLeft:6 }}>🚗 chauffeur</span>}
            </div>
            {peutAffecter && <button type="button" onClick={()=>onRetirer(p.id)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'2px 7px', fontSize:11.5, cursor:'pointer' }}>✕</button>}
          </div>
        ))}
      </div>

      {/* Désignation du chauffeur */}
      {membres.length > 0 && (
        accredites.length === 0 ? (
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'#FCEBEB', color:'#A32D2D', border:'1px solid rgba(163,45,45,.2)', borderRadius:8, padding:'7px 10px', fontSize:12, fontWeight:600, marginBottom: peutAffecter ? 10 : 0 }}>
            ⚠️ Aucun chauffeur accrédité dans cet équipage.
          </div>
        ) : accredites.length === 1 ? (
          <div style={{ fontSize:12, color:'#0E7A93', marginBottom: peutAffecter ? 10 : 0 }}>
            🚗 Chauffeur : <strong>{accredites[0].profiles?.prenom} {accredites[0].profiles?.nom}</strong> <span style={{ color:'#7A7470' }}>(automatique)</span>
          </div>
        ) : peutAffecter ? (
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'#7A7470', display:'block', marginBottom:3 }}>🚗 Chauffeur désigné</label>
            <select value={eq.chauffeur_id || ''} onChange={e=>onChauffeur && onChauffeur(eq.id, e.target.value || null)}
              style={{ width:'100%', padding:'7px 9px', border:`1px solid ${eq.chauffeur_id ? 'rgba(0,0,0,.12)' : 'rgba(163,45,45,.4)'}`, borderRadius:7, fontSize:12.5, fontFamily:"'DM Sans',sans-serif" }}>
              <option value="">— À désigner —</option>
              {accredites.map(a => <option key={a.user_id} value={a.user_id}>{a.profiles?.prenom} {a.profiles?.nom}</option>)}
            </select>
            {!eq.chauffeur_id && <div style={{ fontSize:11, color:'#A32D2D', marginTop:4 }}>Plusieurs chauffeurs accrédités : désignez celui qui conduit.</div>}
          </div>
        ) : null
      )}

      {peutAffecter && (
        <div>
          {aDate && (
            <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:11.5, color:'#0E7A93', marginBottom:6, cursor:'pointer' }}>
              <input type="checkbox" checked={dispoOnly} onChange={e=>setDispoOnly(e.target.checked)} style={{ accentColor:'#1BB0CE' }} />
              Seulement le personnel disponible {multiJours ? 'sur toute la durée' : 'ce jour-là'} ({nbDispo})
            </label>
          )}
          <div style={{ display:'flex', gap:7 }}>
            <select value={sel} onChange={e=>setSel(e.target.value)} style={{ flex:1, padding:'7px 9px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:12.5, fontFamily:"'DM Sans',sans-serif" }}>
              <option value="">+ Affecter un volontaire…</option>
              {dispo.map(v => <option key={v.id} value={v.id}>{v.prenom} {v.nom}{v.role?` — ${v.role.replace(/_/g,' ')}`:''}{dispoIds.has(v.id)?' ✓':''}</option>)}
            </select>
            <button type="button" onClick={()=>{ onAffecter(sel, eq.id); setSel('') }} disabled={!sel} style={{ padding:'7px 12px', background:'#C8435A', color:'white', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:sel?'pointer':'not-allowed', opacity:sel?1:.5, fontFamily:"'DM Sans',sans-serif" }}>Affecter</button>
          </div>
          {aDate && dispoOnly && dispo.length === 0 && <div style={{ fontSize:11.5, color:'#A32D2D', marginTop:5 }}>Aucun volontaire n'a encodé de disponibilité couvrant {multiJours ? 'toute la durée' : 'ce jour'}.</div>}
        </div>
      )}
    </div>
  )
}