import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import PhotoUpload from '@/components/shared/PhotoUpload'

// ── Couleurs par catégorie de rôle ────────────────────────────────────────────
const CAT_COLORS = {
  direction:     { bg:'linear-gradient(135deg,#C8435A,#E8697E)', text:'white', light:'#FBEAF0', tc:'#C8435A' },
  medical:       { bg:'linear-gradient(135deg,#0E7A93,#1BB0CE)', text:'white', light:'#E6F7FA', tc:'#0E7A93' },
  soutien:       { bg:'linear-gradient(135deg,#3B6D11,#5A9E1A)', text:'white', light:'#EAF3DE', tc:'#3B6D11' },
  benevole:      { bg:'linear-gradient(135deg,#534AB7,#7B74D4)', text:'white', light:'#EEEAF7', tc:'#534AB7' },
  administratif: { bg:'linear-gradient(135deg,#BA7517,#D49A2A)', text:'white', light:'#FAEEDA', tc:'#BA7517' },
}

export default function Organigramme() {
  const { can } = useAuth()
  const [tab, setTab] = useState('organigramme') // 'organigramme' | 'roles' | 'membres'
  return (
    <div style={{ padding:'24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1200 }}>
      <div style={{ marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.9rem', fontWeight:500, color:'#1A1514' }}>Organigramme</h1>
        <div style={{ display:'flex', gap:6 }}>
          {[
            ['organigramme','🏛️ Organigramme'],
            ...(can('organigramme.manage') ? [['membres','👥 Membres & Rôles'],['roles','🏷️ Gérer les rôles']] : []),
          ].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:'8px 16px', borderRadius:9, border:`1.5px solid ${tab===k?'#1BB0CE':'rgba(0,0,0,.1)'}`, background:tab===k?'#1BB0CE':'white', color:tab===k?'white':'#4A4340', fontSize:13, fontWeight:tab===k?600:400, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {tab === 'organigramme' && <OrganigrammeView />}
      {tab === 'membres' && can('organigramme.manage') && <MembresView />}
      {tab === 'roles'   && can('organigramme.manage') && <RolesView />}
    </div>
  )
}

// ── Vue organigramme hiérarchique ─────────────────────────────────────────────
function OrganigrammeView() {
  const { can } = useAuth()
  const [postes, setPostes] = useState([])
  const [profiles, setProfiles] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from('organigramme_postes').select('*, profiles(prenom,nom,photo_url,role)').order('ordre'),
      supabase.from('profiles').select('id,prenom,nom,role').eq('actif',true).order('nom'),
    ])
    setPostes(p||[])
    setProfiles(pr||[])
  }

  function buildTree(nodes, parentId=null) {
    return nodes
      .filter(n => (n.parent_id||null) === parentId)
      .sort((a,b) => a.ordre - b.ordre)
      .map(n => ({ ...n, children: buildTree(nodes, n.id) }))
  }

  async function save() {
    setSaving(true)
    const payload = { titre:form.titre, sous_titre:form.sous_titre, profile_id:form.profile_id||null, parent_id:form.parent_id||null, couleur:form.couleur||'#1BB0CE', ordre:parseInt(form.ordre)||0 }
    if (form.id) await supabase.from('organigramme_postes').update(payload).eq('id',form.id)
    else await supabase.from('organigramme_postes').insert(payload)
    setSaving(false); setModal(null); load()
  }
  async function remove() {
    if (!confirm('Supprimer ce poste ?')) return
    await supabase.from('organigramme_postes').delete().eq('id',form.id)
    setModal(null); load()
  }

  const tree = buildTree(postes)

  return (
    <div>
      {can('admin') && (
        <div style={{ marginBottom:20, display:'flex', gap:10 }}>
          <button onClick={()=>{setForm({ couleur:'#1BB0CE' });setModal(true)}} style={BTN_PRIMARY}>+ Ajouter un poste</button>
        </div>
      )}

      {/* Arbre */}
      <div style={{ overflowX:'auto', paddingBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, minWidth:800 }}>
          {tree.map((node, i) => (
            <TreeNode key={node.id} node={node} depth={0} onEdit={can('admin') ? n=>{setForm(n);setModal(true)} : null} />
          ))}
        </div>
      </div>

      {/* Légende */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:28, paddingTop:20, borderTop:'1px solid rgba(27,176,206,.08)' }}>
        {Object.entries(CAT_COLORS).map(([k,c])=>(
          <div key={k} style={{ display:'flex', alignItems:'center', gap:7, background:c.light, border:`1px solid ${c.tc}30`, borderRadius:8, padding:'4px 12px', fontSize:12, color:c.tc, fontWeight:500 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:c.tc }}/>
            {k.charAt(0).toUpperCase()+k.slice(1)}
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={form.id?'Modifier le poste':'Nouveau poste'} onClose={()=>setModal(null)}>
          <F label="Titre du poste *" val={form.titre} set={v=>set('titre',v)} />
          <F label="Sous-titre / description" val={form.sous_titre} set={v=>set('sous_titre',v)} />
          <div style={{ marginBottom:12 }}>
            <label style={LBL}>Attribuer à un membre</label>
            <select value={form.profile_id||''} onChange={e=>set('profile_id',e.target.value||null)} style={SEL}>
              <option value="">— Poste vacant</option>
              {profiles.map(p=><option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.role})</option>)}
            </select>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={LBL}>Poste parent</label>
            <select value={form.parent_id||''} onChange={e=>set('parent_id',e.target.value||null)} style={SEL}>
              <option value="">— Racine (niveau 0)</option>
              {postes.filter(p=>p.id!==form.id).map(p=><option key={p.id} value={p.id}>{p.titre}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={LBL}>Couleur</label>
              <input type="color" value={form.couleur||'#1BB0CE'} onChange={e=>set('couleur',e.target.value)} style={{ width:'100%', height:40, borderRadius:8, border:'1px solid rgba(0,0,0,.1)', cursor:'pointer' }}/>
            </div>
            <F label="Ordre" val={form.ordre} set={v=>set('ordre',v)} type="number" />
          </div>
          <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, width:'100%', marginTop:14, justifyContent:'center' }}>
            {saving?'Enregistrement…':'✓ Enregistrer'}
          </button>
          {form.id && <button onClick={remove} style={{ ...BTN_DANGER, width:'100%', marginTop:8, justifyContent:'center' }}>🗑️ Supprimer ce poste</button>}
        </Modal>
      )}
    </div>
  )
}

function TreeNode({ node, depth, onEdit }) {
  const [open, setOpen] = useState(depth < 2)
  const hasCh = node.children?.length > 0
  const col = node.couleur || '#1BB0CE'

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      {/* Trait du haut */}
      {depth > 0 && <div style={{ width:2, height:20, background:col, opacity:.4 }}/>}

      {/* Nœud */}
      <div style={{ background:`linear-gradient(135deg, ${col}EE, ${col}BB)`, border:`2px solid ${col}`, borderRadius:12, padding:'12px 18px', minWidth:150, maxWidth:210, textAlign:'center', cursor:onEdit?'pointer':'default', boxShadow:`0 3px 12px ${col}33`, transition:'transform .12s', position:'relative' }}
        onClick={() => onEdit && onEdit(node)}
        onMouseEnter={e=>{if(onEdit)e.currentTarget.style.transform='translateY(-2px)'}}
        onMouseLeave={e=>{e.currentTarget.style.transform=''}}>
        {node.profiles?.photo_url && (
          <img src={node.profiles.photo_url} alt="" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(255,255,255,.5)', marginBottom:6, display:'block', margin:'0 auto 6px' }}/>
        )}
        <div style={{ fontSize:13, fontWeight:700, color:'white', lineHeight:1.3 }}>{node.titre}</div>
        {node.profiles && <div style={{ fontSize:11.5, color:'rgba(255,255,255,.85)', marginTop:4 }}>{node.profiles.prenom} {node.profiles.nom}</div>}
        {!node.profiles && <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:4, fontStyle:'italic' }}>Vacant</div>}
        {node.sous_titre && <div style={{ fontSize:11, color:'rgba(255,255,255,.7)', marginTop:2 }}>{node.sous_titre}</div>}
        {onEdit && <div style={{ position:'absolute', top:6, right:8, fontSize:12, opacity:.6 }}>✏️</div>}
      </div>

      {/* Enfants */}
      {hasCh && (
        <>
          <button onClick={()=>setOpen(o=>!o)} style={{ background:'none', border:'none', cursor:'pointer', color:col, fontSize:18, margin:'2px 0', lineHeight:1 }}>{open?'▾':'▸'}</button>
          {open && (
            <div style={{ position:'relative', display:'flex', gap:0, alignItems:'flex-start', justifyContent:'center' }}>
              {/* Ligne horizontale */}
              {node.children.length > 1 && (
                <div style={{ position:'absolute', top:0, left:'50%', right:'50%', height:2, background:col, opacity:.3, width:`${(node.children.length-1)*230}px`, transform:'translateX(-50%)' }}/>
              )}
              {node.children.map(ch=>(
                <div key={ch.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', width:230 }}>
                  <TreeNode node={ch} depth={depth+1} onEdit={onEdit} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Vue membres & attribution des rôles ──────────────────────────────────────
function MembresView() {
  const { can } = useAuth()
  const [membres, setMembres] = useState([])
  const [roles, setRoles] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('tous')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [])
  async function load() {
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase.from('profiles').select('*').order('nom'),
      supabase.from('roles_asbl').select('*').eq('actif',true).order('ordre'),
    ])
    setMembres(m||[])
    setRoles(r||[])
  }

  async function save() {
    setSaving(true)
    await supabase.from('profiles').update({
      prenom:       form.prenom,
      nom:          form.nom,
      email:        form.email,
      telephone:    form.telephone,
      role:         form.role,
      type_benevole:form.type_benevole,
      membre_ag:    !!form.membre_ag,
      qualification:form.qualification,
      adresse:      form.adresse,
      ville:        form.ville,
      actif:        form.actif !== false,
      notes:        form.notes,
      photo_url:    form.photo_url,
    }).eq('id', form.id)
    setSaving(false); setModal(null); load()
  }

  const CATS = { tous:'Tous', direction:'Direction', medical:'Médical', soutien:'Soutien', benevole:'Bénévoles', ag:'Membres AG' }
  const displayed = membres.filter(m => {
    const matchSearch = !search || `${m.prenom} ${m.nom} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    const roleInfo = roles.find(r=>r.slug===m.role)
    const matchCat = filterCat === 'tous' ? true
      : filterCat === 'ag' ? m.membre_ag
      : roleInfo?.categorie === filterCat
    return matchSearch && matchCat
  })

  return (
    <div>
      {/* Filtres */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20, alignItems:'center' }}>
        <input placeholder="🔍 Rechercher…" value={search} onChange={e=>setSearch(e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", flex:1, minWidth:200 }}/>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {Object.entries(CATS).map(([k,l])=>(
            <button key={k} onClick={()=>setFilterCat(k)} style={{ padding:'7px 14px', borderRadius:8, border:`1px solid ${filterCat===k?'#1BB0CE':'rgba(0,0,0,.1)'}`, background:filterCat===k?'#1BB0CE':'white', color:filterCat===k?'white':'#4A4340', fontSize:12.5, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:filterCat===k?600:400 }}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', fontSize:13, color:'#7A7470' }}>{displayed.length} membre{displayed.length>1?'s':''}</div>
      </div>

      {/* Tableau */}
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
          <thead>
            <tr style={{ background:'#F0F9FB' }}>
              {['Membre','Rôle','Type','AG','Actif','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((m,i)=>{
              const roleInfo = roles.find(r=>r.slug===m.role)
              const catColor = CAT_COLORS[roleInfo?.categorie||'benevole']
              return (
                <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.06)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#F8FCFD'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {m.photo_url
                        ? <img src={m.photo_url} alt="" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', border:'2px solid #E6F7FA', flexShrink:0 }}/>
                        : <div style={{ width:34, height:34, borderRadius:'50%', background:catColor?.light||'#E6F7FA', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600, color:catColor?.tc||'#1BB0CE', flexShrink:0 }}>{(m.prenom||'?')[0]}{(m.nom||'?')[0]}</div>
                      }
                      <div>
                        <div style={{ fontWeight:600, color:'#1A1514' }}>{m.prenom} {m.nom}</div>
                        <div style={{ fontSize:12, color:'#7A7470' }}>{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:catColor?.light||'#E6F7FA', color:catColor?.tc||'#1BB0CE', padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
                      {roleInfo?.label || m.role}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12.5, color:'#4A4340' }}>
                    {m.type_benevole === 'medical' ? '🏥 Médical' : m.type_benevole === 'coordinateur' ? '⭐ Direction' : '🤝 Non-médical'}
                  </td>
                  <td style={{ padding:'10px 14px', textAlign:'center' }}>
                    {m.membre_ag ? <span style={{ color:'#3B6D11', fontSize:16 }}>✓</span> : <span style={{ color:'#D0C8C5', fontSize:14 }}>—</span>}
                  </td>
                  <td style={{ padding:'10px 14px', textAlign:'center' }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:m.actif?'#5A9E1A':'#D0C8C5', display:'inline-block' }}/>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {can('admin') && (
                      <button onClick={()=>{setForm(m);setModal(true)}} style={{ padding:'5px 14px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>✏️ Modifier</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {displayed.length===0 && <p style={{ padding:'28px', color:'#7A7470', textAlign:'center' }}>Aucun membre trouvé.</p>}
      </div>

      {/* Statistiques rapides */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginTop:24 }}>
        {[
          { label:'Total membres', val:membres.length, color:'#1BB0CE' },
          { label:'Membres AG', val:membres.filter(m=>m.membre_ag).length, color:'#C8435A' },
          { label:'Médicaux', val:membres.filter(m=>m.type_benevole==='medical').length, color:'#0E7A93' },
          { label:'Non-médicaux', val:membres.filter(m=>m.type_benevole==='non_medical').length, color:'#3B6D11' },
          { label:'Actifs', val:membres.filter(m=>m.actif).length, color:'#5A9E1A' },
        ].map((s,i)=>(
          <div key={i} style={{ background:'white', border:`1px solid ${s.color}22`, borderRadius:12, padding:'14px 16px', textAlign:'center', boxShadow:`0 1px 6px ${s.color}11` }}>
            <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'2rem', fontWeight:600, color:s.color, lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:12, color:'#7A7470', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Modal édition membre */}
      {modal && (
        <Modal title={`Modifier — ${form.prenom} ${form.nom}`} onClose={()=>setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <F label="Prénom" val={form.prenom} set={v=>set('prenom',v)} />
            <F label="Nom" val={form.nom} set={v=>set('nom',v)} />
          </div>
          <F label="Email" val={form.email} set={v=>set('email',v)} type="email" />
          <F label="Téléphone" val={form.telephone} set={v=>set('telephone',v)} type="tel" />
          <div>
            <label style={{ fontSize:'12.5px', fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>Photo</label>
            <PhotoUpload value={form.photo_url} onChange={v=>set('photo_url',v)} folder="organigramme" shape="circle" size={72} label="Ajouter" />
          </div>

          {/* Rôle */}
          <div style={{ marginBottom:12 }}>
            <label style={LBL}>Rôle dans l'ASBL</label>
            <select value={form.role||'volontaire_non_medical'} onChange={e=>set('role',e.target.value)} style={SEL}>
              {roles.map(r=>(
                <option key={r.slug} value={r.slug}>{r.label} ({r.categorie})</option>
              ))}
            </select>
          </div>

          {/* Type bénévole */}
          <div style={{ marginBottom:12 }}>
            <label style={LBL}>Type de bénévolat</label>
            <div style={{ display:'flex', gap:8 }}>
              {[['medical','🏥 Médical'],['non_medical','🤝 Non-médical'],['coordinateur','⭐ Direction']].map(([v,l])=>(
                <label key={v} style={{ flex:1, display:'flex', alignItems:'center', gap:7, padding:'8px 12px', border:`1.5px solid ${form.type_benevole===v?'#1BB0CE':'rgba(0,0,0,.1)'}`, borderRadius:8, cursor:'pointer', background:form.type_benevole===v?'#E6F7FA':'white', fontSize:12.5 }}>
                  <input type="radio" name="type_benevole" value={v} checked={form.type_benevole===v} onChange={()=>set('type_benevole',v)} style={{ accentColor:'#1BB0CE' }}/>
                  {l}
                </label>
              ))}
            </div>
          </div>

          <F label="Qualification / Diplôme" val={form.qualification} set={v=>set('qualification',v)} placeholder="Infirmier BE, Médecin généraliste…" />
          <F label="Adresse" val={form.adresse} set={v=>set('adresse',v)} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <F label="Ville" val={form.ville} set={v=>set('ville',v)} />
            <F label="IBAN" val={form.iban} set={v=>set('iban',v)} placeholder="BE…" />
          </div>
          <F label="Notes internes" val={form.notes} set={v=>set('notes',v)} />

          {/* Cases à cocher */}
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:12 }}>
            <CK label="✓ Membre AG (Assemblée Générale)" val={form.membre_ag} set={v=>set('membre_ag',v)} />
            <CK label="✓ Actif" val={form.actif !== false} set={v=>set('actif',v)} />
          </div>

          <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, width:'100%', justifyContent:'center' }}>
            {saving?'Enregistrement…':'✓ Enregistrer les modifications'}
          </button>
        </Modal>
      )}
    </div>
  )
}

// ── Vue gestion des rôles ─────────────────────────────────────────────────────
function RolesView() {
  const { can } = useAuth()
  const [roles, setRoles] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(()=>{ load() },[])
  async function load() {
    const { data } = await supabase.from('roles_asbl').select('*').order('categorie').order('ordre')
    setRoles(data||[])
  }
  async function save() {
    setSaving(true)
    const payload = { slug:form.slug||form.label?.toLowerCase().replace(/[^a-z0-9]+/g,'_'), label:form.label, description:form.description, couleur:form.couleur||'#1BB0CE', categorie:form.categorie||'benevole', ordre:parseInt(form.ordre)||0, actif:form.actif!==false }
    if (form.id) await supabase.from('roles_asbl').update(payload).eq('id',form.id)
    else await supabase.from('roles_asbl').insert(payload)
    setSaving(false); setModal(false); load()
  }

  const groups = {}
  roles.forEach(r => { if(!groups[r.categorie]) groups[r.categorie]=[]; groups[r.categorie].push(r) })
  const catLabels = { direction:'⭐ Direction & CA', medical:'🏥 Équipe médicale', soutien:'🤝 Soutien & logistique', benevole:'🙋 Bénévoles', administratif:'📋 Administratif' }

  return (
    <div>
      {can('admin') && (
        <button onClick={()=>{setForm({ categorie:'benevole', couleur:'#1BB0CE', actif:true });setModal(true)}} style={{ ...BTN_PRIMARY, marginBottom:20 }}>
          + Créer un nouveau rôle
        </button>
      )}

      {Object.entries(groups).map(([cat, items])=>(
        <div key={cat} style={{ marginBottom:28 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1BB0CE', marginBottom:10 }}>{catLabels[cat]||cat}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:10 }}>
            {items.map((r,i)=>(
              <div key={i} style={{ background:'white', border:`1.5px solid ${r.couleur}33`, borderRadius:12, padding:'14px 16px', display:'flex', gap:12, alignItems:'flex-start', opacity:r.actif?1:.6 }}>
                <div style={{ width:36, height:36, borderRadius:9, background:r.couleur+'22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:r.couleur, fontWeight:700, fontSize:14 }}>{r.label[0]}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514', marginBottom:2 }}>{r.label}</div>
                  {r.description && <div style={{ fontSize:12, color:'#7A7470', lineHeight:1.4 }}>{r.description}</div>}
                  <div style={{ fontSize:11, color:r.couleur, fontWeight:500, marginTop:4 }}>{r.slug}</div>
                </div>
                {can('admin') && (
                  <button onClick={()=>{setForm(r);setModal(true)}} style={{ padding:'4px 10px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:6, fontSize:12, cursor:'pointer' }}>✏️</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {modal && (
        <Modal title={form.id?'Modifier le rôle':'Nouveau rôle'} onClose={()=>setModal(false)}>
          <F label="Libellé *" val={form.label} set={v=>set('label',v)} />
          <F label="Slug (identifiant technique)" val={form.slug} set={v=>set('slug',v)} placeholder="auto-généré si vide" />
          <div style={{ marginBottom:12 }}>
            <label style={LBL}>Catégorie</label>
            <select value={form.categorie||'benevole'} onChange={e=>set('categorie',e.target.value)} style={SEL}>
              {Object.entries(catLabels).map(([k,l])=><option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <F label="Description" val={form.description} set={v=>set('description',v)} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={LBL}>Couleur</label>
              <input type="color" value={form.couleur||'#1BB0CE'} onChange={e=>set('couleur',e.target.value)} style={{ width:'100%', height:40, borderRadius:8, border:'1px solid rgba(0,0,0,.1)', cursor:'pointer' }}/>
            </div>
            <F label="Ordre" val={form.ordre} set={v=>set('ordre',v)} type="number" />
          </div>
          <CK label="Rôle actif" val={form.actif!==false} set={v=>set('actif',v)} />
          <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, width:'100%', marginTop:14, justifyContent:'center' }}>
            {saving?'Enregistrement…':'✓ Enregistrer'}
          </button>
        </Modal>
      )}
    </div>
  )
}

// ── Composants helpers ────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
      <div style={{ background:'white', borderRadius:18, width:'100%', maxWidth:540, maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 22px', borderBottom:'1px solid rgba(27,176,206,.1)', position:'sticky', top:0, background:'white', zIndex:1 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:600, color:'#1A1514' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#7A7470' }}>✕</button>
        </div>
        <div style={{ padding:'18px 22px' }}>{children}</div>
      </div>
    </div>
  )
}
function F({ label, val, set, type='text', placeholder }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={LBL}>{label}</label>
      <input type={type} value={val||''} onChange={e=>set(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", outline:'none', transition:'border-color .12s' }}
        onFocus={e=>e.target.style.borderColor='#1BB0CE'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'}/>
    </div>
  )
}
function CK({ label, val, set }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', fontSize:13.5, marginBottom:10 }}>
      <input type="checkbox" checked={!!val} onChange={e=>set(e.target.checked)} style={{ width:16, height:16, accentColor:'#1BB0CE' }}/>
      {label}
    </label>
  )
}

const LBL = { fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
const SEL = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }
const BTN_PRIMARY = { display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 2px 10px rgba(27,176,206,.25)' }
const BTN_DANGER  = { display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', background:'#FCEBEB', color:'#C8435A', border:'1px solid rgba(200,67,90,.2)', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }