import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Btn, F, Sel, Pill } from '@/components/ui'
import FicheVolontaire from '@/modules/fiche/FicheVolontaire'
import { QUALIFS, ROLES_ASBL } from '@/modules/fiche/ficheSchema'
import { ACCES, TYPES_BENEVOLE } from '@/modules/acces/accesSchema'

const ROLES_INTERNES = ['admin','president','coordinateur','ambulancier_bleu','ambulancier_gris','infirmier','medecin','volontaire_non_medical','tresorier','secretaire']

function genCode() {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const p = () => Array.from({ length:4 }, () => s[Math.floor(Math.random()*s.length)]).join('')
  return `HA-${p()}-${p()}`
}

export default function Admin() {
  const [tab, setTab] = useState('membres')
  return (
    <Page title="Administration" action={
      <div style={{ display:'flex', gap:6 }}>
        {[['membres','👥 Membres'],['partenaires','🤝 Partenaires'],['acces','🔐 Accès']].map(([v,l]) => (
          <button key={v} onClick={()=>setTab(v)} style={{ padding:'8px 14px', borderRadius:9, border:'1px solid var(--border)', background: tab===v?'var(--accent)':'var(--card)', color: tab===v?'#fff':'var(--text-2)', fontWeight:600, fontSize:13.5, cursor:'pointer' }}>{l}</button>
        ))}
      </div>
    }>
      {tab === 'membres' && <Membres />}
      {tab === 'partenaires' && <Partenaires />}
      {tab === 'acces' && <AccesMatrice />}
    </Page>
  )
}

// Affiche un code d'invitation généré, à transmettre
function CodeBox({ code }) {
  const [copie, setCopie] = useState(false)
  return (
    <Card style={{ marginBottom:14, background:'#E6F7FA', border:'1px solid rgba(27,176,206,.3)' }}>
      <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:6 }}>Code d'invitation à transmettre (valable 7 jours) :</div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontFamily:'monospace', fontSize:'1.3rem', fontWeight:700, color:'var(--accent-blue)', letterSpacing:1 }}>{code}</span>
        <Btn kind="soft" onClick={()=>{ navigator.clipboard?.writeText(code); setCopie(true); setTimeout(()=>setCopie(false),1500) }}>{copie?'✓ Copié':'Copier'}</Btn>
      </div>
      <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:8 }}>La personne s'inscrit via « J'ai un code d'invitation » sur l'écran de connexion.</div>
    </Card>
  )
}

// ── Membres internes ──────────────────────────────────────────────────────────
const _lblRole = v => (ROLES_ASBL.find(r=>r.v===v)?.l) || v
const _lblQual = v => (QUALIFS.find(q=>q.v===v)?.l) || v
function rolesAsblTxt(u) { const rs = u.fiche?.roles_asbl || []; return rs.length ? rs.map(_lblRole).join(', ') : '—' }
function qualifsTxt(u) { const qs = u.fiche?.qualifications || []; return qs.length ? qs.map(_lblQual).join(', ') : '—' }

function Membres() {
  const [fiche, setFiche] = useState(null)
  const [membres, setMembres] = useState([])
  const [invits, setInvits] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [lastCode, setLastCode] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data:m }, { data:i }] = await Promise.all([
      supabase.from('profiles').select('id,prenom,nom,email,role,actif,fiche').neq('role','partenaire').order('nom'),
      supabase.from('invitations').select('*').is('partenaire_id', null).eq('utilise', false).order('created_at', { ascending:false }),
    ])
    setMembres(m || []); setInvits(i || []); setLoading(false)
  }
  function flash(t, ok=true){ setMsg({ t, ok }); setTimeout(()=>setMsg(null), 4000) }

  async function inviter(f) {
    const code = genCode()
    const { error } = await supabase.from('invitations').insert({ code, email:f.email.trim(), prenom:f.prenom, nom:f.nom, role:f.role })
    if (error) { flash(error.message, false); return }
    setForm(null); setLastCode(code); load()
  }
  async function toggle(u) {
    const { error } = await supabase.from('profiles').update({ actif:!u.actif }).eq('id', u.id)
    if (error) flash(error.message, false); else load()
  }
  async function revoquer(code) {
    if (!confirm('Révoquer cette invitation ?')) return
    await supabase.from('invitations').delete().eq('code', code); load()
  }

  if (fiche) return <FicheVolontaire userId={fiche} onBack={()=>{ setFiche(null); load() }} />

  return (
    <div>
      {msg && <Msg msg={msg} />}
      {lastCode && <CodeBox code={lastCode} />}
      <div style={{ marginBottom:14 }}><Btn onClick={()=>{ setLastCode(null); setForm({ role:'volontaire_non_medical' }) }}>+ Inviter un membre</Btn></div>
      {form && <FormInvit form={form} setForm={setForm} onSave={inviter} roles={ROLES_INTERNES} />}

      {invits.length > 0 && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ fontWeight:600, color:'var(--heading)', marginBottom:10 }}>Invitations en attente</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {invits.map(i => (
              <div key={i.code} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <div style={{ fontSize:13 }}><span style={{ fontFamily:'monospace', fontWeight:600, color:'var(--accent-blue)' }}>{i.code}</span> — {i.prenom} {i.nom} ({i.email}) · <span style={{ color:'var(--text-muted)' }}>{i.role}</span></div>
                <Btn kind="danger" onClick={()=>revoquer(i.code)} style={{ padding:'4px 10px' }}>Révoquer</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? <p style={{ color:'var(--text-muted)' }}>Chargement…</p> : (
        <Card style={{ padding:0, overflow:'auto' }}>
          <table style={tbl}><thead><tr style={{ background:'var(--bg-alt)' }}>{['Nom','E-mail','Rôle (ASBL)','Qualification','Statut','Action'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {membres.map(u => (
                <tr key={u.id} style={{ borderTop:'1px solid var(--border)', opacity:u.actif?1:.5 }}>
                  <td style={td}>{u.prenom} {u.nom}</td><td style={td}>{u.email}</td><td style={td}>{rolesAsblTxt(u)}</td><td style={td}>{qualifsTxt(u)}</td>
                  <td style={td}>{u.actif ? <Pill color="#3B6D11" bg="#EAF3DE">Actif</Pill> : <Pill color="#A32D2D" bg="#FCEBEB">Désactivé</Pill>}</td>
                  <td style={{ ...td, display:'flex', gap:6, flexWrap:'wrap' }}><Btn kind="soft" onClick={()=>setFiche(u.id)} style={{ padding:'5px 10px' }}>Fiche</Btn><Btn kind={u.actif?'danger':'ok'} onClick={()=>toggle(u)} style={{ padding:'5px 10px' }}>{u.actif?'Désactiver':'Activer'}</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ── Partenaires : organisations + invitations ─────────────────────────────────
function Partenaires() {
  const [orgs, setOrgs] = useState([])
  const [comptes, setComptes] = useState([])
  const [invits, setInvits] = useState([])
  const [loading, setLoading] = useState(true)
  const [orgForm, setOrgForm] = useState(null)
  const [cptForm, setCptForm] = useState(null)
  const [lastCode, setLastCode] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data:o }, { data:c }, { data:i }] = await Promise.all([
      supabase.from('partenaires').select('*').order('nom'),
      supabase.from('profiles').select('id,prenom,nom,email,actif,partenaire_id').eq('role','partenaire').order('nom'),
      supabase.from('invitations').select('*').not('partenaire_id','is',null).eq('utilise', false).order('created_at', { ascending:false }),
    ])
    setOrgs(o || []); setComptes(c || []); setInvits(i || []); setLoading(false)
  }
  function flash(t, ok=true){ setMsg({ t, ok }); setTimeout(()=>setMsg(null), 4000) }
  const orgNom = id => orgs.find(o => o.id === id)?.nom || '—'

  async function saveOrg(f) {
    const p = { nom:f.nom, type:f.type||null, ville:f.ville||null, contact_nom:f.contact_nom||null, contact_email:f.contact_email||null, contact_tel:f.contact_tel||null }
    if (f.id) await supabase.from('partenaires').update(p).eq('id', f.id)
    else await supabase.from('partenaires').insert(p)
    setOrgForm(null); load()
  }
  async function inviter(f) {
    if (!f.partenaire_id) { flash('Choisissez une organisation.', false); return }
    const code = genCode()
    const { error } = await supabase.from('invitations').insert({ code, email:f.email.trim(), prenom:f.prenom, nom:f.nom, role:'partenaire', partenaire_id:f.partenaire_id })
    if (error) { flash(error.message, false); return }
    setCptForm(null); setLastCode(code); load()
  }
  async function toggle(u) { const { error } = await supabase.from('profiles').update({ actif:!u.actif }).eq('id', u.id); if (error) flash(error.message,false); else load() }
  async function revoquer(code) { if (!confirm('Révoquer cette invitation ?')) return; await supabase.from('invitations').delete().eq('code', code); load() }

  if (loading) return <p style={{ color:'var(--text-muted)' }}>Chargement…</p>

  return (
    <div>
      {msg && <Msg msg={msg} />}
      {lastCode && <CodeBox code={lastCode} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontWeight:600, color:'var(--heading)' }}>Organisations partenaires</div>
        <Btn onClick={()=>setOrgForm({})}>+ Organisation</Btn>
      </div>
      {orgForm && <FormOrg form={orgForm} setForm={setOrgForm} onSave={saveOrg} />}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
        {orgs.length === 0 && <Card>Aucune organisation.</Card>}
        {orgs.map(o => (
          <Card key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div><div style={{ fontWeight:600, color:'var(--text)' }}>{o.nom}</div><div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{[o.type,o.ville].filter(Boolean).join(' · ')||'—'}</div></div>
            <Btn kind="soft" onClick={()=>setOrgForm(o)}>Modifier</Btn>
          </Card>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontWeight:600, color:'var(--heading)' }}>Comptes partenaires</div>
        <Btn onClick={()=>{ setLastCode(null); setCptForm({}) }}>+ Inviter un partenaire</Btn>
      </div>
      {cptForm && <FormInvit form={cptForm} setForm={setCptForm} onSave={inviter} orgs={orgs} />}

      {invits.length > 0 && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ fontWeight:600, color:'var(--heading)', marginBottom:10 }}>Invitations partenaires en attente</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {invits.map(i => (
              <div key={i.code} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <div style={{ fontSize:13 }}><span style={{ fontFamily:'monospace', fontWeight:600, color:'var(--accent-blue)' }}>{i.code}</span> — {i.prenom} {i.nom} ({i.email}) · <span style={{ color:'var(--text-muted)' }}>{orgNom(i.partenaire_id)}</span></div>
                <Btn kind="danger" onClick={()=>revoquer(i.code)} style={{ padding:'4px 10px' }}>Révoquer</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ padding:0, overflow:'auto' }}>
        <table style={tbl}><thead><tr style={{ background:'var(--bg-alt)' }}>{['Nom','E-mail','Organisation','Statut','Action'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {comptes.map(u => (
              <tr key={u.id} style={{ borderTop:'1px solid var(--border)', opacity:u.actif?1:.5 }}>
                <td style={td}>{u.prenom} {u.nom}</td><td style={td}>{u.email}</td><td style={td}>{orgNom(u.partenaire_id)}</td>
                <td style={td}>{u.actif ? <Pill color="#3B6D11" bg="#EAF3DE">Actif</Pill> : <Pill color="#A32D2D" bg="#FCEBEB">Désactivé</Pill>}</td>
                <td style={td}><Btn kind={u.actif?'danger':'ok'} onClick={()=>toggle(u)} style={{ padding:'5px 10px' }}>{u.actif?'Désactiver':'Activer'}</Btn></td>
              </tr>
            ))}
            {comptes.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign:'center', color:'var(--text-muted)' }}>Aucun compte partenaire.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function FormInvit({ form, setForm, onSave, roles, orgs }) {
  const set = (k,v) => setForm(s => ({ ...s, [k]:v }))
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  async function go() {
    if (!form.prenom || !form.nom || !form.email) { setErr('Prénom, nom et e-mail requis.'); return }
    setBusy(true); setErr(null); await onSave(form); setBusy(false)
  }
  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:600, color:'var(--text)' }}>{roles ? 'Inviter un membre' : 'Inviter un partenaire'}</div>
        <Btn kind="soft" onClick={()=>setForm(null)}>Annuler</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Prénom" value={form.prenom} set={v=>set('prenom',v)} required />
        <F label="Nom" value={form.nom} set={v=>set('nom',v)} required />
      </div>
      <F label="E-mail (identifiant de connexion)" type="email" value={form.email} set={v=>set('email',v)} required />
      {roles && <Sel label="Rôle" value={form.role} set={v=>set('role',v)} options={roles.map(r=>({v:r,l:r}))} />}
      {orgs && <Sel label="Organisation" value={form.partenaire_id||''} set={v=>set('partenaire_id',v)} options={[{v:'',l:'— Choisir —'}, ...orgs.map(o=>({v:o.id,l:o.nom}))]} />}
      {err && <div style={{ color:'#C8435A', fontSize:13, marginBottom:8 }}>{err}</div>}
      <Btn onClick={go} disabled={busy} style={{ width:'100%' }}>{busy?'…':'✓ Générer le code d\'invitation'}</Btn>
    </Card>
  )
}

function FormOrg({ form, setForm, onSave }) {
  const set = (k,v) => setForm(s => ({ ...s, [k]:v }))
  const [busy, setBusy] = useState(false)
  async function go() { if (!form.nom) return; setBusy(true); await onSave(form); setBusy(false) }
  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:600, color:'var(--text)' }}>{form.id ? 'Modifier l\'organisation' : 'Nouvelle organisation'}</div>
        <Btn kind="soft" onClick={()=>setForm(null)}>Annuler</Btn>
      </div>
      <F label="Nom" value={form.nom} set={v=>set('nom',v)} required />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <Sel label="Type" value={form.type||''} set={v=>set('type',v)} options={[{v:'',l:'—'},{v:'hopital',l:'Hôpital'},{v:'maison_repos',l:'Maison de repos'},{v:'soins_palliatifs',l:'Soins palliatifs'},{v:'domicile',l:'Domicile'},{v:'institution',l:'Institution'},{v:'autre',l:'Autre'}]} />
        <F label="Ville" value={form.ville} set={v=>set('ville',v)} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Contact (nom)" value={form.contact_nom} set={v=>set('contact_nom',v)} />
        <F label="Contact (tél.)" value={form.contact_tel} set={v=>set('contact_tel',v)} />
      </div>
      <F label="Contact (e-mail)" value={form.contact_email} set={v=>set('contact_email',v)} />
      <Btn onClick={go} disabled={busy} style={{ width:'100%' }}>{busy?'…':'✓ Enregistrer'}</Btn>
    </Card>
  )
}

function Msg({ msg }) {
  return <Card style={{ marginBottom:12, padding:'10px 14px', background: msg.ok?'#F0FAF0':'#FEF2F2', border:`1px solid ${msg.ok?'#C3E6C3':'#FCD5D5'}`, color: msg.ok?'#1E5C1E':'#991B1B' }}>{msg.t}</Card>
}
const tbl = { width:'100%', minWidth:620, borderCollapse:'collapse', fontSize:13.5 }
const th = { padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', whiteSpace:'nowrap' }
const td = { padding:'10px 14px', color:'var(--text)' }


// ── Matrice d'accès ───────────────────────────────────────────────────────────
function AccesMatrice() {
  const [dim, setDim] = useState('role')
  const [map, setMap] = useState({})
  const [msg, setMsg] = useState(null)
  const sujets = dim === 'role' ? ROLES_ASBL : dim === 'qualif' ? QUALIFS : TYPES_BENEVOLE

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('acces_config').select('*')
    const m = {}; (data||[]).forEach(r => { m[`${r.dimension}:${r.sujet}:${r.acces}`] = r.autorise }); setMap(m)
  }
  function flash(t, ok=true){ setMsg({ t, ok }); setTimeout(()=>setMsg(null), 3000) }
  async function toggle(sujet, acces, cur) {
    const nv = !cur
    setMap(m => ({ ...m, [`${dim}:${sujet}:${acces}`]: nv }))
    const { error } = await supabase.from('acces_config').upsert({ dimension:dim, sujet, acces, autorise:nv }, { onConflict:'dimension,sujet,acces' })
    if (error) flash(error.message, false)
  }

  return (
    <div>
      {msg && <Msg msg={msg} />}
      <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>
        Cochez les accès autorisés pour chaque rôle, qualification ou type. Un membre a un accès dès qu'<b>au moins un</b> de ses rôles/qualifications/son type l'autorise. Les administrateurs du logiciel gardent toujours l'accès total. Tant que rien n'est coché, aucune restriction n'est appliquée.
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {[['role','Rôles ASBL'],['qualif','Qualifications'],['type','Type de bénévole']].map(([v,l]) => (
          <button key={v} onClick={()=>setDim(v)} style={{ padding:'7px 13px', borderRadius:9, border:'1px solid var(--border)', background: dim===v?'var(--accent)':'var(--card)', color: dim===v?'#fff':'var(--text-2)', fontWeight:600, fontSize:13, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      <Card style={{ padding:0, overflow:'auto' }}>
        <table style={{ width:'100%', minWidth:520, borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'var(--bg-alt)' }}>
              <th style={{ ...th, position:'sticky', left:0, background:'var(--bg-alt)' }}>Sujet</th>
              {ACCES.map(a => <th key={a.v} style={{ ...th, textAlign:'center' }}>{a.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {sujets.map(sj => (
              <tr key={sj.v} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ ...td, position:'sticky', left:0, background:'var(--card)', fontWeight:600 }}>{sj.l}</td>
                {ACCES.map(a => {
                  const cur = !!map[`${dim}:${sj.v}:${a.v}`]
                  return (
                    <td key={a.v} style={{ ...td, textAlign:'center' }}>
                      <input type="checkbox" checked={cur} onChange={()=>toggle(sj.v, a.v, cur)} style={{ width:18, height:18, accentColor:'var(--accent)', cursor:'pointer' }} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
