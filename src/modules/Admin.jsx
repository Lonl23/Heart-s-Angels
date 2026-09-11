import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, Pill } from '@/components/ui'
import { QUALIFS, ROLES_ASBL } from '@/modules/fiche/ficheSchema'
import { ACCES, TYPES_BENEVOLE } from '@/modules/acces/accesSchema'
import { CodeBox, FormInvit, FormOrg, Msg, genCode, tbl, th, td } from '@/modules/admin/inviteUi'

export default function Admin() {
  const { peutGererApp } = useAuth()
  const [tab, setTab] = useState('partenaires')
  if (!peutGererApp()) return <Navigate to="/app" replace />
  return (
    <Page
      title="Administration"
      subtitle="Gestion de l’application : partenaires et matrice d’accès. Les fiches volontaires sont dans l’onglet Volontaires."
      action={
        <div style={{ display: 'flex', gap: 6 }}>
          {[['partenaires', '🤝 Partenaires'], ['acces', '🔐 Accès']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: tab === v ? 'var(--accent)' : 'var(--card)', color: tab === v ? '#fff' : 'var(--text-2)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      }
    >
      {tab === 'partenaires' && <Partenaires />}
      {tab === 'acces' && <AccesMatrice />}
    </Page>
  )
}

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
    const [{ data: o }, { data: c }, { data: i }] = await Promise.all([
      supabase.from('partenaires').select('*').order('nom'),
      supabase.from('profiles').select('id,prenom,nom,email,actif,partenaire_id').eq('role', 'partenaire').order('nom'),
      supabase.from('invitations').select('*').not('partenaire_id', 'is', null).eq('utilise', false).order('created_at', { ascending: false }),
    ])
    setOrgs(o || []); setComptes(c || []); setInvits(i || []); setLoading(false)
  }
  function flash(t, ok = true) { setMsg({ t, ok }); setTimeout(() => setMsg(null), 4000) }
  const orgNom = id => orgs.find(o => o.id === id)?.nom || '—'

  async function saveOrg(f) {
    const p = {
      nom: f.nom,
      type: f.type || null,
      ville: f.ville || null,
      contact_nom: f.contact_nom || null,
      contact_email: f.email_general || f.contact_email || null,
      contact_tel: f.tel_general || f.contact_tel || null,
      email_general: f.email_general || f.contact_email || null,
      tel_general: f.tel_general || f.contact_tel || null,
    }
    if (f.id) await supabase.from('partenaires').update(p).eq('id', f.id)
    else await supabase.from('partenaires').insert(p)
    setOrgForm(null); load()
  }
  async function inviter(f) {
    if (!f.partenaire_id) { flash('Choisissez une organisation.', false); return }
    const org = orgs.find(o => o.id === f.partenaire_id)
    const email = (f.email || org?.email_general || org?.contact_email || '').trim()
    if (!email) { flash('Indiquez l’e-mail général de l’institution.', false); return }
    const code = genCode()
    const { error } = await supabase.from('invitations').insert({
      code,
      email,
      prenom: f.prenom || org?.nom || 'Institution',
      nom: f.nom || org?.nom || '',
      role: 'partenaire',
      partenaire_id: f.partenaire_id,
    })
    if (error) { flash(error.message, false); return }
    setCptForm(null); setLastCode(code); load()
  }
  async function toggle(u) { const { error } = await supabase.from('profiles').update({ actif: !u.actif }).eq('id', u.id); if (error) flash(error.message, false); else load() }
  async function revoquer(code) { if (!confirm('Révoquer cette invitation ?')) return; await supabase.from('invitations').delete().eq('code', code); load() }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>

  return (
    <div>
      {msg && <Msg msg={msg} />}
      {lastCode && <CodeBox code={lastCode} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)' }}>Organisations partenaires</div>
        <Btn onClick={() => setOrgForm({})}>+ Organisation</Btn>
      </div>
      {orgForm && <FormOrg form={orgForm} setForm={setOrgForm} onSave={saveOrg} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {orgs.length === 0 && <Card>Aucune organisation.</Card>}
        {orgs.map(o => (
          <Card key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div><div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.nom}</div><div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{[o.type, o.ville].filter(Boolean).join(' · ') || '—'}</div></div>
            <Btn kind="soft" onClick={() => setOrgForm(o)}>Modifier</Btn>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)' }}>Comptes partenaires</div>
        <Btn onClick={() => { setLastCode(null); setCptForm({}) }}>+ Inviter un partenaire</Btn>
      </div>
      {cptForm && <FormInvit form={cptForm} setForm={setCptForm} onSave={inviter} orgs={orgs} />}

      {invits.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Invitations partenaires en attente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invits.map(i => (
              <div key={i.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-blue)' }}>{i.code}</span> — {i.prenom} {i.nom} ({i.email}) · <span style={{ color: 'var(--text-muted)' }}>{orgNom(i.partenaire_id)}</span></div>
                <Btn kind="danger" onClick={() => revoquer(i.code)} style={{ padding: '4px 10px' }}>Révoquer</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: 'auto' }}>
        <table style={tbl}><thead><tr style={{ background: 'var(--bg-alt)' }}>{['Nom', 'E-mail', 'Organisation', 'Statut', 'Action'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {comptes.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--border)', opacity: u.actif ? 1 : .5 }}>
                <td style={td}>{u.prenom} {u.nom}</td><td style={td}>{u.email}</td><td style={td}>{orgNom(u.partenaire_id)}</td>
                <td style={td}>{u.actif ? <Pill color="#3B6D11" bg="#EAF3DE">Actif</Pill> : <Pill color="#A32D2D" bg="#FCEBEB">Désactivé</Pill>}</td>
                <td style={td}><Btn kind={u.actif ? 'danger' : 'ok'} onClick={() => toggle(u)} style={{ padding: '5px 10px' }}>{u.actif ? 'Désactiver' : 'Activer'}</Btn></td>
              </tr>
            ))}
            {comptes.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>Aucun compte partenaire.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function AccesMatrice() {
  const [dim, setDim] = useState('role')
  const [map, setMap] = useState({})
  const [msg, setMsg] = useState(null)
  const sujets = dim === 'role' ? ROLES_ASBL : dim === 'qualif' ? QUALIFS : TYPES_BENEVOLE

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('acces_config').select('*')
    const m = {}; (data || []).forEach(r => { m[`${r.dimension}:${r.sujet}:${r.acces}`] = r.autorise }); setMap(m)
  }
  function flash(t, ok = true) { setMsg({ t, ok }); setTimeout(() => setMsg(null), 3000) }
  async function toggle(sujet, acces, cur) {
    const nv = !cur
    setMap(m => ({ ...m, [`${dim}:${sujet}:${acces}`]: nv }))
    const { error } = await supabase.from('acces_config').upsert({ dimension: dim, sujet, acces, autorise: nv }, { onConflict: 'dimension,sujet,acces' })
    if (error) flash(error.message, false)
  }

  return (
    <div>
      {msg && <Msg msg={msg} />}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        Cochez les accès autorisés pour chaque rôle, qualification ou type. Un membre a un accès dès qu'<b>au moins un</b> de ses rôles/qualifications/son type l'autorise. Les administrateurs du logiciel gardent toujours l'accès total. Tant que rien n'est coché, aucune restriction n'est appliquée.
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['role', 'Rôles ASBL'], ['qualif', 'Qualifications'], ['type', 'Type de bénévole']].map(([v, l]) => (
          <button key={v} onClick={() => setDim(v)} style={{ padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border)', background: dim === v ? 'var(--accent)' : 'var(--card)', color: dim === v ? '#fff' : 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-alt)' }}>
              <th style={{ ...th, position: 'sticky', left: 0, background: 'var(--bg-alt)' }}>Sujet</th>
              {ACCES.map(a => <th key={a.v} style={{ ...th, textAlign: 'center' }}>{a.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {sujets.map(sj => (
              <tr key={sj.v} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, position: 'sticky', left: 0, background: 'var(--card)', fontWeight: 600 }}>{sj.l}</td>
                {ACCES.map(a => {
                  const cur = !!map[`${dim}:${sj.v}:${a.v}`]
                  return (
                    <td key={a.v} style={{ ...td, textAlign: 'center' }}>
                      <input type="checkbox" checked={cur} onChange={() => toggle(sj.v, a.v, cur)} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
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
