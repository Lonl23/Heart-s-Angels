import { useState } from 'react'
import { Card, Btn, F, Sel, PhoneF } from '@/components/ui'

export function genCode() {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const p = () => Array.from({ length: 4 }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `HA-${p()}-${p()}`
}

export function CodeBox({ code }) {
  const [copie, setCopie] = useState(false)
  return (
    <Card style={{ marginBottom: 14, background: '#E6F7FA', border: '1px solid rgba(27,176,206,.3)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>Code d'invitation à transmettre (valable 7 jours) :</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: 1 }}>{code}</span>
        <Btn kind="soft" onClick={() => { navigator.clipboard?.writeText(code); setCopie(true); setTimeout(() => setCopie(false), 1500) }}>{copie ? '✓ Copié' : 'Copier'}</Btn>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>La personne s'inscrit via « J'ai un code d'invitation » sur l'écran de connexion.</div>
    </Card>
  )
}

export function FormInvit({ form, setForm, onSave, roles, orgs }) {
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }))
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  async function go() {
    if (!form.prenom || !form.nom || !form.email) { setErr('Prénom, nom et e-mail requis.'); return }
    setBusy(true); setErr(null); await onSave(form); setBusy(false)
  }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{roles ? 'Inviter un membre' : 'Inviter un partenaire'}</div>
        <Btn kind="soft" onClick={() => setForm(null)}>Annuler</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <F label="Prénom" value={form.prenom} set={v => set('prenom', v)} required />
        <F label="Nom" value={form.nom} set={v => set('nom', v)} required />
      </div>
      <F label="E-mail (identifiant de connexion — e-mail général de l’institution)" type="email" value={form.email} set={v => set('email', v)} required />
      {roles && <Sel label="Rôle" value={form.role} set={v => set('role', v)} options={roles.map(r => ({ v: r, l: r }))} />}
      {orgs && <Sel label="Organisation" value={form.partenaire_id || ''} set={v => set('partenaire_id', v)} options={[{ v: '', l: '— Choisir —' }, ...orgs.map(o => ({ v: o.id, l: o.nom }))]} />}
      {err && <div style={{ color: '#C8435A', fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <Btn onClick={go} disabled={busy} style={{ width: '100%' }}>{busy ? '…' : '✓ Générer le code d\'invitation'}</Btn>
    </Card>
  )
}

export function FormOrg({ form, setForm, onSave }) {
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }))
  const [busy, setBusy] = useState(false)
  async function go() { if (!form.nom) return; setBusy(true); await onSave(form); setBusy(false) }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{form.id ? 'Modifier l\'organisation' : 'Nouvelle organisation'}</div>
        <Btn kind="soft" onClick={() => setForm(null)}>Annuler</Btn>
      </div>
      <F label="Nom" value={form.nom} set={v => set('nom', v)} required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Sel label="Type" value={form.type || ''} set={v => set('type', v)} options={[{ v: '', l: '—' }, { v: 'hopital', l: 'Hôpital' }, { v: 'maison_repos', l: 'Maison de repos' }, { v: 'soins_palliatifs', l: 'Soins palliatifs' }, { v: 'domicile', l: 'Domicile' }, { v: 'institution', l: 'Institution' }, { v: 'autre', l: 'Autre' }]} />
        <F label="Ville" value={form.ville} set={v => set('ville', v)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <F label="Contact (nom)" value={form.contact_nom} set={v => set('contact_nom', v)} />
        <PhoneF label="Numéro général" value={form.tel_general || form.contact_tel} set={v => set('tel_general', v)} />
      </div>
      <F label="E-mail général (identifiant de connexion)" type="email" value={form.email_general || form.contact_email} set={v => set('email_general', v)} />
      <Btn onClick={go} disabled={busy} style={{ width: '100%' }}>{busy ? '…' : '✓ Enregistrer'}</Btn>
    </Card>
  )
}

export function Msg({ msg }) {
  return <Card style={{ marginBottom: 12, padding: '10px 14px', background: msg.ok ? '#F0FAF0' : '#FEF2F2', border: `1px solid ${msg.ok ? '#C3E6C3' : '#FCD5D5'}`, color: msg.ok ? '#1E5C1E' : '#991B1B' }}>{msg.t}</Card>
}

export const tbl = { width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 13.5 }
export const th = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }
export const td = { padding: '10px 14px', color: 'var(--text)' }
