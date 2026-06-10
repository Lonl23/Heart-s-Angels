// src/modules/contenu/Contenu.jsx
import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import PhotoUpload from '@/components/shared/PhotoUpload'
import RichText from '@/components/shared/RichText'
import GestionFormulaires from './GestionFormulaires'
import EventInscriptions from './EventInscriptions'
import { Separateur, MOTIFS } from '@/public/components/Decor.jsx'

export default function Contenu() {
  return (
    <Routes>
      <Route index element={<ContenuDashboard />} />
      <Route path="evenements" element={<GestionEvenements />} />
      <Route path="articles" element={<GestionArticles />} />
      <Route path="partenaires" element={<GestionPartenaires />} />
      <Route path="equipe" element={<GestionEquipe />} />
      <Route path="temoignages" element={<GestionTemoignages />} />
      <Route path="galerie" element={<GestionGalerie />} />
      <Route path="formulaires" element={<GestionFormulaires />} />
      <Route path="arriere-plans" element={<GestionArrierePlans />} />
      <Route path="pages" element={<GestionPages />} />
      <Route path="boutique" element={<GestionBoutique />} />
      <Route path="publication" element={<Publication />} />
    </Routes>
  )
}

// ── Dashboard CMS ─────────────────────────────────────────────────────────────
function ContenuDashboard() {
  const { profile } = useAuth()
  const [lastPub, setLastPub] = useState(null)
  const [nextPub, setNextPub] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('site_publication').select('*').order('published_at', { ascending: false }).limit(1)
      .then(({ data }) => setLastPub(data?.[0]))
    // Calculer prochaine publication (23h59)
    const now = new Date()
    const next = new Date(now)
    next.setHours(23, 59, 0, 0)
    if (now >= next) next.setDate(next.getDate() + 1)
    setNextPub(next.toLocaleString('fr-BE', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' }))
  }, [])

  async function publishNow() {
    if (!confirm('Publier toutes les modifications maintenant ?')) return
    setPublishing(true)
    // Snapshot de tout le contenu
    const [ev, art, part, eq, temo, pages] = await Promise.all([
      supabase.from('evenements_publics').select('*'),
      supabase.from('articles').select('*'),
      supabase.from('partenaires').select('*'),
      supabase.from('equipe_membres').select('*'),
      supabase.from('temoignages_publics').select('*'),
      supabase.from('pages_statiques').select('*'),
    ])
    const snapshot = {
      evenements: ev.data, articles: art.data, partenaires: part.data,
      equipe: eq.data, temoignages: temo.data, pages: pages.data,
      published_at: new Date().toISOString(),
    }
    await supabase.from('site_publication').insert({
      published_by: profile?.id,
      snapshot,
      note: 'Publication manuelle',
    })
    setMsg({ type:'success', text:'Site mis à jour avec succès !' })
    setPublishing(false)
    setTimeout(() => setMsg(null), 4000)
  }

  const sections = [
    { to:'evenements', icon:'📅', label:'Événements',    count:null, desc:'Balade motos, Marche ADEPS, autres' },
    { to:'articles',   icon:'📰', label:'Articles/Blog', count:null, desc:'Actualités, témoignages détaillés' },
    { to:'partenaires',icon:'🤝', label:'Partenaires',   count:null, desc:'Logos, liens, catégories' },
    { to:'equipe',     icon:'👥', label:'Équipe',        count:null, desc:'Membres CA, équipe médicale' },
    { to:'temoignages',icon:'💬', label:'Témoignages',   count:null, desc:'Citations, photos, rôles' },
    { to:'galerie',    icon:'📸', label:'Galerie photos',count:null, desc:'Albums et photos' },
    { to:'boutique',   icon:'🛍️', label:'Boutique',      count:null, desc:'Articles, prix, variantes' },
    { to:'formulaires',   icon:'📝', label:'Formulaires', count:null, desc:'Champs demandés et destinataires' },
    { to:'arriere-plans', icon:'🖼️', label:'Arrière-plans', count:null, desc:'Images de fond des pages (héros)' },
    { to:'pages',      icon:'📄', label:'Pages statiques',count:null, desc:'Mentions légales, politique conf.' },
    { to:'publication',icon:'🚀', label:'Publication',   count:null, desc:'Historique et publication manuelle' },
  ]

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1000 }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.9rem', fontWeight:500, color:'#1A1514', marginBottom:4 }}>
          Gestion du contenu
        </h1>
        <p style={{ fontSize:13.5, color:'#7A7470' }}>
          Les modifications sont publiées automatiquement tous les soirs à 23h59.
        </p>
      </div>

      {msg && (
        <div style={{ background: msg.type==='success'?'#F0FAF0':'#FEF2F2', border:`1px solid ${msg.type==='success'?'#C3E6C3':'#FCD5D5'}`, borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13.5, color: msg.type==='success'?'#1E5C1E':'#991B1B' }}>
          {msg.text}
        </div>
      )}

      {/* Statut publication */}
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.15)', borderRadius:16, padding:'18px 20px', marginBottom:28, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#1A1514', marginBottom:4 }}>📡 Statut du site</div>
          <div style={{ fontSize:13, color:'#7A7470' }}>
            {lastPub
              ? `Dernière publication : ${new Date(lastPub.published_at).toLocaleString('fr-BE', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}`
              : 'Aucune publication enregistrée'
            }
          </div>
          <div style={{ fontSize:12, color:'#1BB0CE', marginTop:2 }}>
            Prochaine publication automatique : {nextPub}
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <a href="https://heart-s-angels.web.app" target="_blank" rel="noopener"
            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#E6F7FA', color:'#1BB0CE', borderRadius:8, fontSize:13, fontWeight:600, textDecoration:'none' }}>
            🌐 Voir le site
          </a>
          <button onClick={publishNow} disabled={publishing}
            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', background: publishing?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: publishing?'wait':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            {publishing ? '⏳ Publication…' : '🚀 Publier maintenant'}
          </button>
        </div>
      </div>

      {/* Grille sections */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
        {sections.map((s, i) => (
          <Link key={i} to={s.to} style={{ display:'flex', flexDirection:'column', gap:10, background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, padding:'18px 16px', textDecoration:'none', transition:'all .12s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#1BB0CE';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 5px 18px rgba(27,176,206,.1)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(27,176,206,.1)';e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}
          >
            <div style={{ fontSize:'1.8rem' }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'#1A1514', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:12, color:'#7A7470', lineHeight:1.4 }}>{s.desc}</div>
            </div>
            <div style={{ fontSize:12, color:'#1BB0CE', fontWeight:600, marginTop:'auto' }}>Gérer →</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Composants réutilisables ───────────────────────────────────────────────────
function SectionHeader({ title, onAdd, addLabel }) {
  const loc = useLocation()
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:12 }}>
      <div>
        <Link to="/app/contenu" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Contenu</Link>
        <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.7rem', fontWeight:500, color:'#1A1514', margin:'4px 0 0' }}>{title}</h2>
      </div>
      {onAdd && (
        <button onClick={onAdd} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 2px 10px rgba(27,176,206,.3)' }}>
          + {addLabel || 'Ajouter'}
        </button>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflow:'auto' }}>
      <div style={{ background:'white', borderRadius:18, width:'100%', maxWidth:560, maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid rgba(27,176,206,.1)', position:'sticky', top:0, background:'white', zIndex:1 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:600, color:'#1A1514' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#7A7470' }}>✕</button>
        </div>
        <div style={{ padding:'20px 22px' }}>{children}</div>
      </div>
    </div>
  )
}

function TableRow({ cells, onEdit, onToggle, onDelete, onView, active }) {
  return (
    <tr style={{ borderTop:'1px solid rgba(27,176,206,.06)', opacity: active===false ? .5 : 1 }}
      onMouseEnter={e=>e.currentTarget.style.background='#F8FCFD'}
      onMouseLeave={e=>e.currentTarget.style.background='white'}
    >
      {cells.map((c,i) => <td key={i} style={{ padding:'10px 14px', fontSize:13.5, color:i===0?'#1A1514':'#4A4340', fontWeight:i===0?500:400 }}>{c}</td>)}
      <td style={{ padding:'10px 14px', display:'flex', gap:8 }}>
        {onView && (
          <button onClick={onView} style={{ padding:'4px 12px', background:'#EAF3DE', color:'#3B6D11', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>👥 Inscriptions</button>
        )}
        <button onClick={onEdit} style={{ padding:'4px 12px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>✏️ Modifier</button>
        {onToggle && (
          <button onClick={onToggle} style={{ padding:'4px 10px', background: active ? '#FCEBEB' : '#EAF3DE', color: active ? '#A32D2D' : '#3B6D11', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
            {active ? 'Désactiver' : 'Activer'}
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} title="Supprimer définitivement" style={{ padding:'4px 10px', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
            🗑 Supprimer
          </button>
        )}
      </td>
    </tr>
  )
}

function F({ label, val, set, type='text', placeholder, required }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>{label}{required&&' *'}</label>
      <input type={type} value={val||''} onChange={e=>set(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}
        onFocus={e=>e.target.style.borderColor='#1BB0CE'}
        onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'}
      />
    </div>
  )
}

function TA({ label, val, set, rows=3, placeholder }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>{label}</label>
      <textarea value={val||''} onChange={e=>set(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }}
      />
    </div>
  )
}

function SaveBtn({ saving, onClick, label }) {
  return (
    <button onClick={onClick} disabled={saving}
      style={{ width:'100%', padding:12, background: saving?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor: saving?'wait':'pointer', fontFamily:"'DM Sans',sans-serif", marginTop:8 }}>
      {saving ? 'Enregistrement…' : label || '✓ Enregistrer'}
    </button>
  )
}

// ── Gestion Événements ────────────────────────────────────────────────────────
function GestionEvenements() {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const [voirInscriptions, setVoirInscriptions] = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('evenements_publics').select('*').order('date_debut', { ascending:false })
    setItems(data||[])
  }
  function openNew() { setForm({ publie:false, gratuit:false, inscription_requise:false }); setModal('new') }
  function openEdit(it) { setForm({...it, date_debut: it.date_debut?.slice(0,16)}); setModal('edit') }
  async function save() {
    setSaving(true)
    // Garantir des id de tarifs uniques et non vides (corrige les anciens doublons)
    const vus = new Set()
    const tarifsCorriges = (form.tarifs || []).map((t, i) => {
      let id = t.id
      if (!id || vus.has(id)) id = 't' + Date.now() + '_' + i
      vus.add(id)
      return { ...t, id }
    })
    const payload = { ...form, tarifs: tarifsCorriges, slug: form.slug || form.titre_fr?.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60) }
    if (modal==='edit') await supabase.from('evenements_publics').update(payload).eq('id', form.id)
    else await supabase.from('evenements_publics').insert(payload)
    setSaving(false); setModal(null); load()
  }
  async function toggle(it) {
    await supabase.from('evenements_publics').update({ publie:!it.publie }).eq('id', it.id)
    load()
  }
  async function remove(it) {
    if (!confirm(`Supprimer définitivement l'événement « ${it.titre_fr || ''} » ?\n\nCette action est irréversible. Les inscriptions liées ne seront pas supprimées.`)) return
    const { error } = await supabase.from('evenements_publics').delete().eq('id', it.id)
    if (error) { alert('Suppression impossible : ' + error.message); return }
    load()
  }

  if (voirInscriptions) return <EventInscriptions event={voirInscriptions} onBack={() => setVoirInscriptions(null)} />

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1050 }}>
      <SectionHeader title="Événements" onAdd={openNew} addLabel="Nouvel événement" />
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
          <thead><tr style={{ background:'#F0F9FB' }}>{['Titre','Date','Lieu','Gratuit','Statut','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((it,i) => (
              <TableRow key={i}
                cells={[
                  it.titre_fr?.slice(0,45),
                  new Date(it.date_debut).toLocaleDateString('fr-BE'),
                  it.lieu?.slice(0,30)||'—',
                  it.gratuit ? '✓ Oui' : `${it.prix_adulte||0} €`,
                  <span style={{ background:it.publie?'#EAF3DE':'#F0EFED', color:it.publie?'#3B6D11':'#7A7470', padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600 }}>{it.publie?'Publié':'Brouillon'}</span>,
                ]}
                onView={() => setVoirInscriptions(it)}
                onEdit={() => openEdit(it)}
                onToggle={() => toggle(it)}
                onDelete={() => remove(it)}
                active={it.publie}
              />
            ))}
          </tbody>
        </table>
        {items.length===0 && <p style={{ padding:'24px', color:'#7A7470', textAlign:'center' }}>Aucun événement. Créez-en un !</p>}
      </div>

      {modal && (
        <Modal title={modal==='new'?'Nouvel événement':'Modifier l\'événement'} onClose={()=>setModal(null)}>
          <F label="Titre (FR)" val={form.titre_fr} set={v=>set('titre_fr',v)} required />
          <F label="Titre (NL)" val={form.titre_nl} set={v=>set('titre_nl',v)} />
          <F label="Titre (EN)" val={form.titre_en} set={v=>set('titre_en',v)} />
          <F label="Titre (DE)" val={form.titre_de} set={v=>set('titre_de',v)} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <F label="Date/heure" val={form.date_debut} set={v=>set('date_debut',v)} type="datetime-local" required />
            <F label="Heure affichée" val={form.heure} set={v=>set('heure',v)} placeholder="8h00 – 18h00" />
          </div>
          <F label="Lieu" val={form.lieu} set={v=>set('lieu',v)} placeholder="Rue des Awirs 222, Flémalle" />
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:6 }}>Description (FR)</label>
            <RichText value={form.desc_fr} onChange={v=>set('desc_fr',v)} placeholder="Décrivez l'événement : programme, tarifs, infos pratiques…" />
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:6 }}>Image de l'événement</label>
            <PhotoUpload value={form.image_url} onChange={url=>set('image_url',url)} folder="evenements" shape="square" size={80} label="Choisir une image" aspect={1.6} sortie={1200} />
          </div>
          <F label="Lien externe (inscription)" val={form.lien_externe} set={v=>set('lien_externe',v)} placeholder="https://hearts-angels-asbl.odoo.com/event" />

          {/* Gratuit / Payant + tarifs */}
          <div style={{ background:'#F0F9FB', borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
            <div style={{ display:'flex', gap:16, marginBottom:form.gratuit?0:12 }}>
              {[['gratuit','Gratuit'],['inscription_requise','Inscription requise']].map(([k,l])=>(
                <label key={k} style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13.5, color:'#4A4340' }}>
                  <input type="checkbox" checked={!!form[k]} onChange={e=>set(k,e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
                  {l}
                </label>
              ))}
            </div>

            {!form.gratuit && <>
              <div style={{ fontSize:12.5, fontWeight:600, color:'#0E4A5A', marginBottom:8 }}>Tarifs proposés</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(form.tarifs || []).map((t, i) => (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input value={t.label||''} placeholder="Libellé (ex: Pilote moto)" onChange={e=>{ const arr=[...(form.tarifs||[])]; arr[i]={...arr[i], label:e.target.value, id:(arr[i].id||('t'+Date.now()+'_'+i))}; set('tarifs',arr) }}
                      style={{ flex:2, padding:'8px 11px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}/>
                    <input type="number" value={t.prix??''} placeholder="€" onChange={e=>{ const arr=[...(form.tarifs||[])]; arr[i]={...arr[i], prix:parseFloat(e.target.value)||0}; set('tarifs',arr) }}
                      style={{ width:90, padding:'8px 11px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}/>
                    <button type="button" onClick={()=>{ const arr=(form.tarifs||[]).filter((_,j)=>j!==i); set('tarifs',arr) }}
                      style={{ padding:'8px 10px', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={()=>set('tarifs',[...(form.tarifs||[]),{ id:'', label:'', prix:0 }])}
                  style={{ alignSelf:'flex-start', padding:'7px 13px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  + Ajouter un tarif
                </button>
              </div>

              <div style={{ fontSize:12.5, fontWeight:600, color:'#0E4A5A', margin:'14px 0 8px' }}>Modes de paiement acceptés</div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {[['paiement_virement','Virement (communication structurée)'],['paiement_payconiq','Payconiq']].map(([k,l])=>(
                  <label key={k} style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13, color:'#4A4340' }}>
                    <input type="checkbox" checked={!!form[k]} onChange={e=>set(k,e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
                    {l}
                  </label>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                <F label="IBAN (vide = IBAN ASBL)" val={form.iban} set={v=>set('iban',v)} placeholder="BE45 0689 3611 4489" />
                <F label="Lien Payconiq (optionnel)" val={form.payconiq_lien} set={v=>set('payconiq_lien',v)} placeholder="https://payconiq.com/..." />
              </div>
            </>}
          </div>

          {/* Champs personnalisés de l'événement */}
          <div style={{ background:'#F0F9FB', borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'#0E4A5A', marginBottom:4 }}>Champs personnalisés</div>
            <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:10 }}>Questions propres à cet événement (ex. n° de plaque, allergies…). Chaque champ peut être demandé à chaque participant ou une seule fois pour l'inscription.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(form.champs_perso || []).map((ch, i) => (
                <div key={i} style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap', background:'white', borderRadius:9, padding:'8px 10px' }}>
                  <input value={ch.label||''} placeholder="Libellé (ex: Numéro de plaque)"
                    onChange={e=>{ const arr=[...(form.champs_perso||[])]; arr[i]={...arr[i], label:e.target.value, id:(arr[i].id||'c'+Date.now())}; set('champs_perso',arr) }}
                    style={{ flex:2, minWidth:150, padding:'7px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }}/>
                  <select value={ch.type||'text'} onChange={e=>{ const arr=[...(form.champs_perso||[])]; arr[i]={...arr[i], type:e.target.value}; set('champs_perso',arr) }}
                    style={{ padding:'7px 8px', border:'1px solid rgba(0,0,0,.1)', borderRadius:7, fontSize:12.5, fontFamily:"'DM Sans',sans-serif" }}>
                    <option value="text">Texte court</option>
                    <option value="textarea">Texte long</option>
                    <option value="number">Nombre</option>
                    <option value="date">Date</option>
                    <option value="tel">Téléphone</option>
                  </select>
                  <select value={ch.portee||'participant'} onChange={e=>{ const arr=[...(form.champs_perso||[])]; arr[i]={...arr[i], portee:e.target.value}; set('champs_perso',arr) }}
                    style={{ padding:'7px 8px', border:'1px solid rgba(0,0,0,.1)', borderRadius:7, fontSize:12.5, fontFamily:"'DM Sans',sans-serif" }}>
                    <option value="participant">Par participant</option>
                    <option value="global">Inscription globale</option>
                  </select>
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#4A4340', cursor:'pointer' }}>
                    <input type="checkbox" checked={!!ch.requis} onChange={e=>{ const arr=[...(form.champs_perso||[])]; arr[i]={...arr[i], requis:e.target.checked}; set('champs_perso',arr) }} style={{ accentColor:'#BA7517' }}/> Obligatoire
                  </label>
                  <button type="button" onClick={()=>{ const arr=(form.champs_perso||[]).filter((_,j)=>j!==i); set('champs_perso',arr) }}
                    style={{ padding:'6px 9px', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, fontSize:12.5, cursor:'pointer' }}>✕</button>
                </div>
              ))}
              <button type="button" onClick={()=>set('champs_perso',[...(form.champs_perso||[]),{ id:'c'+Date.now(), label:'', type:'text', requis:false, portee:'participant' }])}
                style={{ alignSelf:'flex-start', padding:'7px 13px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                + Ajouter un champ
              </button>
            </div>
          </div>

          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13.5, color:'#4A4340' }}>
              <input type="checkbox" checked={!!form.publie} onChange={e=>set('publie',e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
              Publié (visible sur le site public)
            </label>
          </div>
          <SaveBtn saving={saving} onClick={save} />
        </Modal>
      )}
    </div>
  )
}

// ── Gestion Articles ──────────────────────────────────────────────────────────
function GestionArticles() {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('articles').select('id,slug,titre_fr,categorie,publie,publie_le').order('created_at', { ascending:false })
    setItems(data||[])
  }
  function openNew() { setForm({ publie:false, categorie:'divers' }); setModal('new') }
  function openEdit(it) { setForm(it); setModal('edit') }
  async function loadFull(id) {
    const { data } = await supabase.from('articles').select('*').eq('id',id).single()
    setForm(data); setModal('edit')
  }
  async function save() {
    setSaving(true)
    const slug = form.slug || (form.titre_fr||'').toLowerCase().replace(/[éèê]/g,'e').replace(/[àâ]/g,'a').replace(/[^a-z0-9]+/g,'-').slice(0,60)
    const payload = { ...form, slug, publie_le: form.publie ? (form.publie_le || new Date().toISOString()) : null }
    if (form.id) await supabase.from('articles').update(payload).eq('id', form.id)
    else await supabase.from('articles').insert(payload)
    setSaving(false); setModal(null); load()
  }

  const cats = ['divers','souhaits_realises','evenements','association','partenariats','temoignages']

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1050 }}>
      <SectionHeader title="Articles & Blog" onAdd={openNew} addLabel="Nouvel article" />
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
          <thead><tr style={{ background:'#F0F9FB' }}>{['Titre','Catégorie','Date','Statut','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((it,i)=>(
              <TableRow key={i}
                cells={[
                  it.titre_fr?.slice(0,50),
                  it.categorie||'—',
                  it.publie_le ? new Date(it.publie_le).toLocaleDateString('fr-BE') : '—',
                  <span style={{ background:it.publie?'#EAF3DE':'#F0EFED', color:it.publie?'#3B6D11':'#7A7470', padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600 }}>{it.publie?'Publié':'Brouillon'}</span>,
                ]}
                onEdit={() => loadFull(it.id)}
                active={it.publie}
              />
            ))}
          </tbody>
        </table>
        {items.length===0 && <p style={{ padding:'24px', color:'#7A7470', textAlign:'center' }}>Aucun article.</p>}
      </div>

      {modal && (
        <Modal title={form.id?'Modifier l\'article':'Nouvel article'} onClose={()=>setModal(null)}>
          <F label="Titre (FR)" val={form.titre_fr} set={v=>set('titre_fr',v)} required />
          <F label="Titre (NL)" val={form.titre_nl} set={v=>set('titre_nl',v)} />
          <F label="Titre (EN)" val={form.titre_en} set={v=>set('titre_en',v)} />
          <F label="Slug URL" val={form.slug} set={v=>set('slug',v)} placeholder="auto-généré si vide" />
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>Catégorie</label>
            <select value={form.categorie||'divers'} onChange={e=>set('categorie',e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}>
              {cats.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <TA label="Résumé (FR)" val={form.resume_fr} set={v=>set('resume_fr',v)} rows={2} />
          <TA label="Contenu complet (FR)" val={form.contenu_fr} set={v=>set('contenu_fr',v)} rows={8} placeholder="Texte en Markdown ou HTML simple…" />
          <F label="Image URL" val={form.image_url} set={v=>set('image_url',v)} placeholder="https://…" />
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13.5, color:'#4A4340' }}>
              <input type="checkbox" checked={!!form.publie} onChange={e=>set('publie',e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
              Publié
            </label>
          </div>
          <SaveBtn saving={saving} onClick={save} />
        </Modal>
      )}
    </div>
  )
}

// ── Gestion Partenaires ───────────────────────────────────────────────────────
function GestionPartenaires() {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('partenaires').select('*').order('categorie').order('ordre')
    setItems(data||[])
  }
  function openNew() { setForm({ categorie:'prive', actif:true, ordre:0 }); setModal(true) }
  async function save() {
    setSaving(true)
    if (form.id) await supabase.from('partenaires').update(form).eq('id', form.id)
    else await supabase.from('partenaires').insert(form)
    setSaving(false); setModal(false); load()
  }
  async function toggle(it) {
    await supabase.from('partenaires').update({ actif:!it.actif }).eq('id', it.id); load()
  }

  const [rapatriement, setRapatriement] = useState(null)
  async function rapatrierLogos() {
    if (!confirm('Télécharger tous les logos externes et les héberger chez nous ? Les URL seront remplacées par des copies permanentes.')) return
    setRapatriement({ enCours:true })
    try {
      const { data, error } = await supabase.functions.invoke('rapatrier-logos')
      if (error) throw error
      setRapatriement({ enCours:false, resultats:data?.resultats || [] })
      load()
    } catch (e) {
      setRapatriement({ enCours:false, erreur: e.message || 'Erreur' })
    }
  }

  const cats = { medical:'🏥 Médicaux', institutionnel:'🏛️ Institutionnels', prive:'🏢 Privés' }

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1050 }}>
      <SectionHeader title="Partenaires" onAdd={openNew} addLabel="Ajouter un partenaire" />

      <div style={{ background:'#FAEEDA', border:'1px solid rgba(186,117,23,.2)', borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div style={{ fontSize:13, color:'#7A5512', lineHeight:1.5, flex:1, minWidth:240 }}>
            <strong>🛡️ Sécuriser les logos.</strong> Télécharge les logos enregistrés par URL externe et les héberge chez nous, pour qu'ils ne disparaissent jamais si le site d'un partenaire change.
          </div>
          <button onClick={rapatrierLogos} disabled={rapatriement?.enCours}
            style={{ padding:'9px 16px', background:'#BA7517', color:'white', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:rapatriement?.enCours?'wait':'pointer', fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap' }}>
            {rapatriement?.enCours ? '⏳ En cours…' : '🛡️ Sécuriser tous les logos'}
          </button>
        </div>
        {rapatriement?.resultats && (
          <div style={{ marginTop:12, maxHeight:180, overflow:'auto', background:'white', borderRadius:8, padding:'8px 12px', fontSize:12.5 }}>
            {rapatriement.resultats.map((r,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid #F0EFED' }}>
                <span style={{ color:'#1A1514' }}>{r.nom}</span>
                <span style={{ color: r.statut.includes('✓')?'#3B6D11': r.statut.includes('déjà')?'#7A7470':'#C8435A', fontWeight:500 }}>{r.statut}</span>
              </div>
            ))}
          </div>
        )}
        {rapatriement?.erreur && <div style={{ marginTop:10, color:'#C8435A', fontSize:12.5 }}>Erreur : {rapatriement.erreur}</div>}
      </div>
      {Object.entries(cats).map(([cat, catLabel]) => {
        const catItems = items.filter(it => it.categorie === cat)
        if (!catItems.length) return null
        return (
          <div key={cat} style={{ marginBottom:24 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1BB0CE', marginBottom:8 }}>{catLabel}</div>
            <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:12, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
                <thead><tr style={{ background:'#F0F9FB' }}>{['Nom','Logo URL','Site','Ordre','Actions'].map(h=><th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11.5, fontWeight:600, color:'#7A7470' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {catItems.map((it,i)=>(
                    <TableRow key={i}
                      cells={[ it.nom, it.logo_url?'✓ Logo':'—', it.site_url?'✓':'—', it.ordre||0 ]}
                      onEdit={() => { setForm(it); setModal(true) }}
                      onToggle={() => toggle(it)}
                      active={it.actif}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {modal && (
        <Modal title={form.id?'Modifier le partenaire':'Nouveau partenaire'} onClose={()=>setModal(false)}>
          <F label="Nom *" val={form.nom} set={v=>set('nom',v)} required />
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>Catégorie</label>
            <select value={form.categorie||'prive'} onChange={e=>set('categorie',e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}>
              <option value="medical">🏥 Médical</option>
              <option value="institutionnel">🏛️ Institutionnel</option>
              <option value="prive">🏢 Privé</option>
            </select>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>Logo du partenaire</label>
            <PhotoUpload value={form.logo_url} onChange={v=>set('logo_url',v)} folder="partenaires" shape="square" size={80} label="Téléverser le logo" />
            <div style={{ fontSize:11.5, color:'#7A7470', marginTop:8, lineHeight:1.5 }}>
              💡 Téléversez le fichier du logo (recommandé : PNG sur fond transparent). L'image est hébergée chez nous, donc elle ne disparaîtra jamais même si le site du partenaire change.
            </div>
          </div>
          <F label="Initiales (fallback si pas de logo)" val={form.initiales} set={v=>set('initiales',v)} placeholder="CHC" />
          <F label="Site web" val={form.site_url} set={v=>set('site_url',v)} placeholder="https://…" />
          <F label="Description" val={form.description} set={v=>set('description',v)} />
          <F label="Ordre d'affichage" val={form.ordre} set={v=>set('ordre',parseInt(v)||0)} type="number" />
          <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13.5, marginBottom:12 }}>
            <input type="checkbox" checked={!!form.actif} onChange={e=>set('actif',e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
            Actif (affiché sur le site)
          </label>
          <SaveBtn saving={saving} onClick={save} />
        </Modal>
      )}
    </div>
  )
}

// ── Gestion Équipe ────────────────────────────────────────────────────────────
function GestionEquipe() {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('equipe_membres').select('*').order('categorie').order('ordre')
    setItems(data||[])
  }
  async function save() {
    setSaving(true)
    if (form.id) await supabase.from('equipe_membres').update(form).eq('id', form.id)
    else await supabase.from('equipe_membres').insert(form)
    setSaving(false); setModal(false); load()
  }
  async function toggle(it) {
    await supabase.from('equipe_membres').update({ actif:!it.actif }).eq('id', it.id); load()
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1050 }}>
      <SectionHeader title="Équipe" onAdd={()=>{setForm({ categorie:'ca', actif:true, ordre:0 });setModal(true)}} addLabel="Ajouter un membre" />
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
          <thead><tr style={{ background:'#F0F9FB' }}>{['Nom','Rôle','Catégorie','Photo','Ordre','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((it,i)=>(
              <TableRow key={i}
                cells={[
                  `${it.prenom} ${it.nom}`,
                  it.role_fr?.slice(0,35)||'—',
                  it.categorie,
                  it.photo_url ? '✓' : '—',
                  it.ordre||0,
                ]}
                onEdit={() => { setForm(it); setModal(true) }}
                onToggle={() => toggle(it)}
                active={it.actif}
              />
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={form.id?'Modifier le membre':'Nouveau membre'} onClose={()=>setModal(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <F label="Prénom *" val={form.prenom} set={v=>set('prenom',v)} required />
            <F label="Nom *"    val={form.nom}    set={v=>set('nom',v)} required />
          </div>
          <F label="Rôle (FR)" val={form.role_fr} set={v=>set('role_fr',v)} placeholder="Président, Infirmier…" />
          <F label="Rôle (NL)" val={form.role_nl} set={v=>set('role_nl',v)} />
          <F label="Rôle (EN)" val={form.role_en} set={v=>set('role_en',v)} />
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>Catégorie</label>
            <select value={form.categorie||'ca'} onChange={e=>set('categorie',e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}>
              <option value="ca">Conseil d'administration</option>
              <option value="medical">Équipe médicale</option>
              <option value="benevole">Bénévole</option>
            </select>
          </div>
          <F label="Photo URL" val={form.photo_url} set={v=>set('photo_url',v)} placeholder="https://…" />
          {form.photo_url && <img src={form.photo_url} alt="" style={{ width:60, height:60, borderRadius:'50%', objectFit:'cover', marginBottom:10 }} onError={e=>e.target.style.display='none'} />}
          <F label="Ordre" val={form.ordre} set={v=>set('ordre',parseInt(v)||0)} type="number" />
          <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13.5, marginBottom:12 }}>
            <input type="checkbox" checked={!!form.actif} onChange={e=>set('actif',e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
            Actif
          </label>
          <SaveBtn saving={saving} onClick={save} />
        </Modal>
      )}
    </div>
  )
}

// ── Gestion Témoignages ───────────────────────────────────────────────────────
function GestionTemoignages() {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('temoignages_publics').select('*').order('ordre')
    setItems(data||[])
  }
  async function save() {
    setSaving(true)
    if (form.id) await supabase.from('temoignages_publics').update(form).eq('id', form.id)
    else await supabase.from('temoignages_publics').insert(form)
    setSaving(false); setModal(false); load()
  }
  async function toggle(it) {
    await supabase.from('temoignages_publics').update({ publie:!it.publie }).eq('id', it.id); load()
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1050 }}>
      <SectionHeader title="Témoignages" onAdd={()=>{setForm({ publie:false });setModal(true)}} addLabel="Ajouter un témoignage" />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
        {items.map((it,i) => (
          <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, padding:'18px', opacity:it.publie?1:.6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              {it.photo_url && <img src={it.photo_url} alt="" style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover' }} />}
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514' }}>{it.auteur_nom}</div>
                <div style={{ fontSize:12, color:'#7A7470' }}>{it.auteur_role_fr}</div>
              </div>
            </div>
            <p style={{ fontSize:13, color:'#4A4340', lineHeight:1.65, marginBottom:14, fontStyle:'italic' }}>« {it.texte_fr?.slice(0,120)}… »</p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{setForm(it);setModal(true)}} style={{ flex:1, padding:'6px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>✏️ Modifier</button>
              <button onClick={()=>toggle(it)} style={{ flex:1, padding:'6px', background:it.publie?'#FCEBEB':'#EAF3DE', color:it.publie?'#A32D2D':'#3B6D11', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                {it.publie?'Masquer':'Publier'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={form.id?'Modifier':'Nouveau témoignage'} onClose={()=>setModal(false)}>
          <F label="Nom de l'auteur *" val={form.auteur_nom} set={v=>set('auteur_nom',v)} required />
          <F label="Rôle/Description (FR)" val={form.auteur_role_fr} set={v=>set('auteur_role_fr',v)} placeholder="Fille du bénéficiaire, Bénéficiaire…" />
          <F label="Photo URL" val={form.photo_url} set={v=>set('photo_url',v)} placeholder="https://…" />
          <TA label="Témoignage (FR) *" val={form.texte_fr} set={v=>set('texte_fr',v)} rows={4} />
          <TA label="Témoignage (NL)" val={form.texte_nl} set={v=>set('texte_nl',v)} rows={3} />
          <TA label="Témoignage (EN)" val={form.texte_en} set={v=>set('texte_en',v)} rows={3} />
          <F label="Ordre" val={form.ordre} set={v=>set('ordre',parseInt(v)||0)} type="number" />
          <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13.5, marginBottom:12 }}>
            <input type="checkbox" checked={!!form.publie} onChange={e=>set('publie',e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
            Publié
          </label>
          <SaveBtn saving={saving} onClick={save} />
        </Modal>
      )}
    </div>
  )
}

// ── Gestion Galerie ───────────────────────────────────────────────────────────
function GestionGalerie() {
  const [albums, setAlbums] = useState([])
  const [selAlbum, setSelAlbum] = useState(null)
  const [photos, setPhotos] = useState([])
  const [modalAlbum, setModalAlbum] = useState(false)
  const [modalPhoto, setModalPhoto] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { loadAlbums() }, [])
  async function loadAlbums() {
    const { data } = await supabase.from('galerie_albums').select('*').order('ordre')
    setAlbums(data||[])
  }
  async function loadPhotos(albumId) {
    const { data } = await supabase.from('galerie_photos').select('*').eq('album_id', albumId).order('ordre')
    setPhotos(data||[]); setSelAlbum(albumId)
  }
  async function saveAlbum() {
    setSaving(true)
    if (form.id) await supabase.from('galerie_albums').update(form).eq('id', form.id)
    else await supabase.from('galerie_albums').insert(form)
    setSaving(false); setModalAlbum(false); loadAlbums()
  }
  async function savePhoto() {
    setSaving(true)
    if (form.id) await supabase.from('galerie_photos').update(form).eq('id', form.id)
    else await supabase.from('galerie_photos').insert({ ...form, album_id: selAlbum })
    setSaving(false); setModalPhoto(false); loadPhotos(selAlbum)
  }
  async function deletePhoto(id) {
    if (!confirm('Supprimer cette photo ?')) return
    await supabase.from('galerie_photos').delete().eq('id', id)
    loadPhotos(selAlbum)
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1050 }}>
      <SectionHeader title="Galerie photos" onAdd={()=>{setForm({ publie:true });setModalAlbum(true)}} addLabel="Nouvel album" />

      {!selAlbum ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
          {albums.map((al,i) => (
            <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, padding:'18px', cursor:'pointer' }}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>📸</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#1A1514', marginBottom:4 }}>{al.titre_fr}</div>
              <div style={{ fontSize:12, color:'#7A7470', marginBottom:14 }}>{al.categorie||'—'}</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>loadPhotos(al.id)} style={{ flex:1, padding:'7px', background:'#1BB0CE', color:'white', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>📷 Photos</button>
                <button onClick={()=>{setForm(al);setModalAlbum(true)}} style={{ padding:'7px 10px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:7, fontSize:12.5, cursor:'pointer' }}>✏️</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <button onClick={()=>{setSelAlbum(null);setPhotos([])}} style={{ padding:'7px 16px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>← Albums</button>
            <span style={{ fontSize:14, fontWeight:600, color:'#1A1514' }}>{albums.find(a=>a.id===selAlbum)?.titre_fr}</span>
            <button onClick={()=>{setForm({});setModalPhoto(true)}} style={{ marginLeft:'auto', padding:'8px 16px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Ajouter photo</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
            {photos.map((ph,i) => (
              <div key={i} style={{ border:'1px solid rgba(27,176,206,.1)', borderRadius:10, overflow:'hidden', position:'relative' }}>
                <img src={ph.url} alt="" style={{ width:'100%', height:120, objectFit:'cover', display:'block' }} />
                <div style={{ padding:'8px', background:'white' }}>
                  <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:6, lineHeight:1.3 }}>{ph.legende_fr?.slice(0,40)||'—'}</div>
                  <div style={{ display:'flex', gap:5 }}>
                    <button onClick={()=>{setForm(ph);setModalPhoto(true)}} style={{ flex:1, padding:'4px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:5, fontSize:11.5, cursor:'pointer' }}>✏️</button>
                    <button onClick={()=>deletePhoto(ph.id)} style={{ flex:1, padding:'4px', background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:5, fontSize:11.5, cursor:'pointer' }}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modalAlbum && (
        <Modal title={form.id?'Modifier l\'album':'Nouvel album'} onClose={()=>setModalAlbum(false)}>
          <F label="Titre (FR) *" val={form.titre_fr} set={v=>set('titre_fr',v)} required />
          <F label="Titre (NL)" val={form.titre_nl} set={v=>set('titre_nl',v)} />
          <F label="Catégorie" val={form.categorie} set={v=>set('categorie',v)} placeholder="événements, souhaits, divers…" />
          <F label="Ordre" val={form.ordre} set={v=>set('ordre',parseInt(v)||0)} type="number" />
          <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13.5, marginBottom:12 }}>
            <input type="checkbox" checked={form.publie!==false} onChange={e=>set('publie',e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
            Publié
          </label>
          <SaveBtn saving={saving} onClick={saveAlbum} />
        </Modal>
      )}
      {modalPhoto && (
        <Modal title={form.id?'Modifier la photo':'Nouvelle photo'} onClose={()=>setModalPhoto(false)}>
          <F label="URL de la photo *" val={form.url} set={v=>set('url',v)} placeholder="https://…" required />
          {form.url && <img src={form.url} alt="" style={{ width:'100%', maxHeight:160, objectFit:'contain', marginBottom:10, borderRadius:8, border:'1px solid #EEE' }} onError={e=>e.target.style.display='none'} />}
          <F label="Légende (FR)" val={form.legende_fr} set={v=>set('legende_fr',v)} />
          <F label="Ordre" val={form.ordre} set={v=>set('ordre',parseInt(v)||0)} type="number" />
          <SaveBtn saving={saving} onClick={savePhoto} />
        </Modal>
      )}
    </div>
  )
}

// ── Gestion Boutique ──────────────────────────────────────────────────────────
function GestionBoutique() {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('boutique_produits').select('*, boutique_variantes(*)').order('ordre')
    setItems(data||[])
  }
  async function save() {
    setSaving(true)
    const payload = { nom_fr:form.nom_fr, nom_nl:form.nom_nl, nom_en:form.nom_en, desc_fr:form.desc_fr, prix_ttc:parseFloat(form.prix_ttc)||0, image_principale:form.image_principale, actif:form.actif!==false, ordre:parseInt(form.ordre)||0 }
    if (form.id) await supabase.from('boutique_produits').update(payload).eq('id', form.id)
    else await supabase.from('boutique_produits').insert(payload)
    setSaving(false); setModal(false); load()
  }
  async function toggle(it) {
    await supabase.from('boutique_produits').update({ actif:!it.actif }).eq('id', it.id); load()
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1050 }}>
      <SectionHeader title="Boutique" onAdd={()=>{setForm({ actif:true });setModal(true)}} addLabel="Ajouter un article" />
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
          <thead><tr style={{ background:'#F0F9FB' }}>{['Article','Prix TTC','Image','Variantes','Statut','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((it,i)=>(
              <TableRow key={i}
                cells={[
                  it.nom_fr,
                  `${(it.prix_ttc||0).toFixed(2)} €`,
                  it.image_principale ? '✓' : '—',
                  `${it.boutique_variantes?.length||0} var.`,
                  <span style={{ background:it.actif?'#EAF3DE':'#F0EFED', color:it.actif?'#3B6D11':'#7A7470', padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600 }}>{it.actif?'Actif':'Inactif'}</span>,
                ]}
                onEdit={() => { setForm(it); setModal(true) }}
                onToggle={() => toggle(it)}
                active={it.actif}
              />
            ))}
          </tbody>
        </table>
        {items.length===0 && <p style={{ padding:'24px', color:'#7A7470', textAlign:'center' }}>Aucun article. Les articles statiques sont dans le code.</p>}
      </div>

      {modal && (
        <Modal title={form.id?'Modifier l\'article':'Nouvel article'} onClose={()=>setModal(false)}>
          <F label="Nom (FR) *" val={form.nom_fr} set={v=>set('nom_fr',v)} required />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <F label="Nom (NL)" val={form.nom_nl} set={v=>set('nom_nl',v)} />
            <F label="Nom (EN)" val={form.nom_en} set={v=>set('nom_en',v)} />
          </div>
          <TA label="Description (FR)" val={form.desc_fr} set={v=>set('desc_fr',v)} rows={3} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <F label="Prix TTC (€) *" val={form.prix_ttc} set={v=>set('prix_ttc',v)} type="number" placeholder="0.00" />
            <F label="Ordre" val={form.ordre} set={v=>set('ordre',parseInt(v)||0)} type="number" />
          </div>
          <F label="Image URL" val={form.image_principale} set={v=>set('image_principale',v)} placeholder="https://…" />
          {form.image_principale && <img src={form.image_principale} alt="" style={{ width:'100%', maxHeight:120, objectFit:'cover', borderRadius:8, marginBottom:10 }} onError={e=>e.target.style.display='none'} />}
          <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13.5, marginBottom:12 }}>
            <input type="checkbox" checked={form.actif!==false} onChange={e=>set('actif',e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }}/>
            Actif (affiché en boutique)
          </label>
          <SaveBtn saving={saving} onClick={save} />
        </Modal>
      )}
    </div>
  )
}

// ── Gestion Pages statiques ───────────────────────────────────────────────────
function GestionPages() {
  const [items, setItems] = useState([])
  const [form, setForm]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    supabase.from('pages_statiques').select('*').order('slug').then(({data}) => setItems(data||[]))
  }, [])

  async function save() {
    setSaving(true)
    await supabase.from('pages_statiques').update({ ...form, updated_at:new Date().toISOString() }).eq('id', form.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    supabase.from('pages_statiques').select('*').order('slug').then(({data}) => setItems(data||[]))
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:900 }}>
      <SectionHeader title="Pages statiques" />
      {saved && <div style={{ background:'#F0FAF0', border:'1px solid #C3E6C3', borderRadius:9, padding:'10px 14px', marginBottom:16, fontSize:13.5, color:'#1E5C1E' }}>✓ Page enregistrée</div>}
      {!form ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {items.map((it,i) => (
            <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:12, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1A1514' }}>{it.titre_fr}</div>
                <div style={{ fontSize:12, color:'#7A7470' }}>/{it.slug}</div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{ fontSize:11.5, color:'#7A7470' }}>Modifié : {it.updated_at ? new Date(it.updated_at).toLocaleDateString('fr-BE') : '—'}</div>
                <button onClick={()=>setForm(it)} style={{ padding:'7px 16px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>✏️ Modifier</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, padding:'22px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <button onClick={()=>setForm(null)} style={{ padding:'7px 16px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>← Retour</button>
            <h3 style={{ margin:0, fontSize:16, fontWeight:600, color:'#1A1514' }}>{form.titre_fr}</h3>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {[['🇫🇷 Français','fr'],['🇧🇪 Néerlandais','nl'],['🇬🇧 Anglais','en'],['🇩🇪 Allemand','de']].map(([l,code])=>(
                <div key={code} style={{ flex:1, minWidth:280 }}>
                  <TA label={`Titre (${l})`} val={form[`titre_${code}`]} set={v=>set(`titre_${code}`,v)} rows={1} />
                  <TA label={`Contenu (${l})`} val={form[`contenu_${code}`]} set={v=>set(`contenu_${code}`,v)} rows={12} placeholder="Texte Markdown ou texte simple. Utilisez ## pour les titres, **texte** pour le gras." />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:'#E6F7FA', borderRadius:9, padding:'10px 14px', fontSize:12.5, color:'#0E4A5A', marginBottom:16 }}>
            💡 Utilisez **texte en gras**, ## Titre, - liste, pour formater le contenu.
          </div>
          <SaveBtn saving={saving} onClick={save} label="✓ Enregistrer les modifications" />
        </div>
      )}
    </div>
  )
}

// ── Publication ───────────────────────────────────────────────────────────────
function Publication() {
  const { profile } = useAuth()
  const [history, setHistory] = useState([])
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('site_publication').select('*, profiles(prenom,nom)').order('published_at', { ascending:false }).limit(20)
      .then(({data}) => setHistory(data||[]))
  }, [])

  async function publish(note) {
    setPublishing(true)
    const [ev, art, part, eq, temo, pages, al, ph] = await Promise.all([
      supabase.from('evenements_publics').select('*'),
      supabase.from('articles').select('*'),
      supabase.from('partenaires').select('*'),
      supabase.from('equipe_membres').select('*'),
      supabase.from('temoignages_publics').select('*'),
      supabase.from('pages_statiques').select('*'),
      supabase.from('galerie_albums').select('*'),
      supabase.from('galerie_photos').select('*'),
    ])
    const snapshot = { evenements:ev.data, articles:art.data, partenaires:part.data, equipe:eq.data, temoignages:temo.data, pages:pages.data, albums:al.data, photos:ph.data, ts:new Date().toISOString() }
    await supabase.from('site_publication').insert({ published_by:profile?.id, snapshot, note:note||'Publication manuelle' })
    setMsg('Publication enregistrée ! Le site sera mis à jour automatiquement.')
    setPublishing(false)
    setTimeout(()=>setMsg(null), 5000)
    supabase.from('site_publication').select('*, profiles(prenom,nom)').order('published_at', { ascending:false }).limit(20).then(({data})=>setHistory(data||[]))
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:900 }}>
      <SectionHeader title="Publication" />
      {msg && <div style={{ background:'#F0FAF0', border:'1px solid #C3E6C3', borderRadius:9, padding:'12px 16px', marginBottom:20, fontSize:13.5, color:'#1E5C1E' }}>✓ {msg}</div>}

      {/* Publier maintenant */}
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.15)', borderRadius:16, padding:'22px', marginBottom:24 }}>
        <h3 style={{ fontSize:15, fontWeight:600, color:'#1A1514', marginBottom:8 }}>🚀 Publier maintenant</h3>
        <p style={{ fontSize:13.5, color:'#7A7470', marginBottom:16, lineHeight:1.65 }}>
          Déclenche une publication immédiate de toutes les modifications en attente. Normalement, le site est mis à jour automatiquement tous les soirs à 23h59.
        </p>
        <button onClick={()=>publish('Publication manuelle')} disabled={publishing}
          style={{ padding:'11px 24px', background:publishing?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:publishing?'wait':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          {publishing?'⏳ Publication en cours…':'🚀 Publier toutes les modifications'}
        </button>
      </div>

      {/* Historique */}
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(27,176,206,.08)', fontSize:14, fontWeight:600, color:'#1A1514' }}>
          📋 Historique des publications
        </div>
        {history.map((h,i) => (
          <div key={i} style={{ padding:'12px 18px', borderTop:'1px solid rgba(27,176,206,.05)', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#1BB0CE', flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13.5, color:'#1A1514', fontWeight:500 }}>{h.note||'Publication'}</div>
              <div style={{ fontSize:12, color:'#7A7470', marginTop:2 }}>
                {new Date(h.published_at).toLocaleString('fr-BE', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                {h.profiles && ` · par ${h.profiles.prenom} ${h.profiles.nom}`}
              </div>
            </div>
          </div>
        ))}
        {history.length===0 && <p style={{ padding:'24px', color:'#7A7470', textAlign:'center' }}>Aucune publication enregistrée.</p>}
      </div>
    </div>
  )
}

// ── GESTION DES ARRIÈRE-PLANS (images de fond des pages) ──
const FONDS_CONFIGURABLES = [
  { cle:'hero_accueil',     label:"Page d'accueil",     desc:"Grande image en haut de la page d'accueil" },
  { cle:'hero_souhaits',    label:'Les Souhaits',       desc:'Bandeau en haut de la page des souhaits' },
  { cle:'hero_soutenir',    label:'Nous Soutenir',      desc:'Bandeau de la page de dons' },
  { cle:'hero_benevole',    label:'Devenir Bénévole',   desc:'Bandeau de la page bénévolat' },
  { cle:'hero_equipe',      label:'Notre Équipe',       desc:"Bandeau de la page de l'équipe" },
  { cle:'hero_evenements',  label:'Événements',         desc:'Bandeau de la page événements' },
  { cle:'hero_activites',   label:'Activités',          desc:'Bandeau de la page activités' },
  { cle:'hero_galerie',     label:'Galerie',            desc:'Bandeau de la page galerie' },
  { cle:'hero_partenaires', label:'Partenaires',        desc:'Bandeau de la page partenaires' },
  { cle:'hero_contact',     label:'Contact',            desc:'Bandeau de la page contact' },
]

function GestionArrierePlans() {
  const [images, setImages] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  const [motif, setMotif] = useState('vague1')
  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('site_images').select('*')
    const map = {}
    ;(data || []).forEach(r => { map[r.cle] = r.image_url })
    if (map['motif_separateur']) setMotif(map['motif_separateur'])
    setImages(map)
    setLoading(false)
  }
  async function changerMotif(m) {
    setMotif(m)
    await supabase.from('site_images').upsert({ cle:'motif_separateur', image_url:m, updated_at:new Date().toISOString() }, { onConflict:'cle' })
    setMsg({ type:'success', text:'Motif enregistré.' }); setTimeout(()=>setMsg(null),2500)
  }

  async function changer(cle, url) {
    // upsert de l'image
    const { error } = await supabase.from('site_images').upsert(
      { cle, image_url: url || null, updated_at: new Date().toISOString() },
      { onConflict: 'cle' }
    )
    if (error) { setMsg({ type:'error', text:'Erreur d\'enregistrement.' }); return }
    setImages(prev => ({ ...prev, [cle]: url }))
    setMsg({ type:'success', text:'Image enregistrée.' })
    setTimeout(() => setMsg(null), 2500)
  }

  return (
    <div style={{ padding:'28px 24px', fontFamily:"'DM Sans',sans-serif", maxWidth:900 }}>
      <SectionHeader title="Arrière-plans des pages" />
      <p style={{ fontSize:13.5, color:'#7A7470', marginTop:-8, marginBottom:22, lineHeight:1.6 }}>
        Choisissez l'image de fond affichée en haut de chaque page publique. Téléversez directement le fichier : il est hébergé chez nous.
      </p>

      {/* Choix du motif de séparation entre les sections */}
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:14, padding:'16px 18px', marginBottom:24 }}>
        <div style={{ fontSize:14.5, fontWeight:600, color:'#1A1514', marginBottom:4 }}>Motif de séparation des sections</div>
        <div style={{ fontSize:12.5, color:'#7A7470', marginBottom:14 }}>La forme des transitions entre les sections du site (vagues, diagonales…).</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
          {MOTIFS.map(m => (
            <button key={m.cle} type="button" onClick={()=>changerMotif(m.cle)}
              style={{ padding:0, overflow:'hidden', borderRadius:10, border: motif===m.cle?'2px solid #1BB0CE':'1px solid rgba(0,0,0,.1)', background:'white', cursor:'pointer', textAlign:'left' }}>
              <div style={{ background:'#0E4A5A', height:30 }} />
              <Separateur motif={m.cle} haut="#0E4A5A" bas="#F0F9FB" h={26} />
              <div style={{ background:'#F0F9FB', padding:'6px 10px', fontSize:12, fontWeight: motif===m.cle?700:500, color: motif===m.cle?'#0E7A93':'#4A4340' }}>
                {m.label}{motif===m.cle?' ✓':''}
              </div>
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.type==='success'?'#F0FAF0':'#FEF2F2', border:`1px solid ${msg.type==='success'?'#C3E6C3':'#FCD5D5'}`, borderRadius:9, padding:'10px 14px', fontSize:13.5, color: msg.type==='success'?'#1E5C1E':'#991B1B', marginBottom:16 }}>{msg.text}</div>
      )}

      {loading ? <p style={{ color:'#7A7470' }}>Chargement…</p> : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {FONDS_CONFIGURABLES.map(fond => (
            <div key={fond.cle} style={{ display:'flex', gap:18, alignItems:'center', background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, padding:'16px 18px', flexWrap:'wrap' }}>
              {/* Aperçu */}
              <div style={{ width:160, height:90, borderRadius:10, overflow:'hidden', background:'#F0F9FB', flexShrink:0, border:'1px solid rgba(27,176,206,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {images[fond.cle]
                  ? <img src={images[fond.cle]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span style={{ fontSize:12, color:'#A8A39D' }}>Aucune image</span>}
              </div>
              {/* Infos + actions */}
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:14.5, fontWeight:600, color:'#1A1514' }}>{fond.label}</div>
                <div style={{ fontSize:12.5, color:'#7A7470', marginBottom:10 }}>{fond.desc}</div>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <PhotoUpload value={images[fond.cle]} onChange={url => changer(fond.cle, url)} folder="arriere-plans" shape="square" size={64} label="Changer l'image" aspect={2.4} sortie={1600} />
                  {images[fond.cle] && (
                    <button onClick={() => changer(fond.cle, '')} style={{ padding:'6px 12px', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}