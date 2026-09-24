import { useState } from 'react'
import { Card, Btn, F, Sel, PhoneF } from '@/components/ui'
import { copierTexte, messageInvitation, urlInvitation } from '@/lib/urls'

export function genCode() {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const p = () => Array.from({ length: 4 }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `HA-${p()}-${p()}`
}

async function marquerCopie(setCopie, cle, texte) {
  const ok = await copierTexte(texte)
  if (!ok) return false
  setCopie(cle)
  setTimeout(() => setCopie(null), 1800)
  return true
}

export function BtnCopierLien({ code, email, style }) {
  const [copie, setCopie] = useState(null)
  const lien = urlInvitation(code, email)
  return (
    <Btn
      kind="soft"
      onClick={() => marquerCopie(setCopie, 'lien', lien)}
      style={{ padding: '4px 10px', ...style }}
      title={lien}
    >
      {copie === 'lien' ? '✓ Lien copié' : 'Copier le lien'}
    </Btn>
  )
}

export function CodeBox({ code, email, prenom }) {
  const [copie, setCopie] = useState(null)
  const lien = urlInvitation(code, email)
  const message = messageInvitation({ prenom, lien })
  return (
    <Card style={{ marginBottom: 14, background: '#E6F7FA', border: '1px solid rgba(27,176,206,.3)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>Lien d’invitation à envoyer par e-mail (valable 7 jours) :</div>
      <div style={{
        width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9,
        fontSize: 12.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        boxSizing: 'border-box', marginBottom: 8, wordBreak: 'break-all', lineHeight: 1.45,
        background: 'var(--surface)', color: 'var(--text)', userSelect: 'all',
      }}>{lien}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Btn kind="soft" onClick={() => marquerCopie(setCopie, 'lien', lien)}>{copie === 'lien' ? '✓ Lien copié' : 'Copier le lien'}</Btn>
        <Btn kind="soft" onClick={() => marquerCopie(setCopie, 'message', message)}>{copie === 'message' ? '✓ Message copié' : 'Copier le message'}</Btn>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Code de secours (si le lien ne s’ouvre pas) :</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: 1 }}>{code}</span>
        <Btn kind="soft" onClick={() => marquerCopie(setCopie, 'code', code)}>{copie === 'code' ? '✓ Code copié' : 'Copier le code'}</Btn>
      </div>
    </Card>
  )
}

export function FormInvit({ form, setForm, onSave, roles, roleLabel, orgs }) {
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }))
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const roleOpts = (roles || []).map(r => (typeof r === 'object' ? r : { v: r, l: r }))
  async function go() {
    if (!form.prenom || !form.nom || !form.email) { setErr('Prénom, nom et e-mail requis.'); return }
    setBusy(true); setErr(null); await onSave(form); setBusy(false)
  }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{roles ? 'Inviter un volontaire' : 'Inviter un partenaire'}</div>
        <Btn kind="soft" onClick={() => setForm(null)}>Annuler</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <F label="Prénom" value={form.prenom} set={v => set('prenom', v)} required />
        <F label="Nom" value={form.nom} set={v => set('nom', v)} required />
      </div>
      <F label={roles ? 'E-mail' : 'E-mail (identifiant de connexion — e-mail général de l’institution)'} type="email" value={form.email} set={v => set('email', v)} required />
      {roles && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>{roleLabel || 'Type de volontaire'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roleOpts.map(o => {
              const on = form.role === o.v
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => set('role', o.v)}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: on ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: on ? '#E6F7FA' : 'var(--card)',
                    color: 'var(--heading)',
                    fontWeight: 700,
                    fontSize: 15,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {o.l}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Uniquement médical ou non médical. Les fonctions (président, trésorier…) se choisissent ensuite dans la fiche.
          </div>
        </div>
      )}
      {orgs && <Sel label="Organisation" value={form.partenaire_id || ''} set={v => set('partenaire_id', v)} options={[{ v: '', l: '— Choisir —' }, ...orgs.map(o => ({ v: o.id, l: o.nom }))]} />}
      {err && <div style={{ color: '#C8435A', fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <Btn onClick={go} disabled={busy} style={{ width: '100%' }}>{busy ? '…' : '✓ Générer le lien d\'invitation'}</Btn>
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
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', margin: '4px 0 12px' }}>
        <input type="checkbox" checked={!!form.fictif} onChange={e => set('fictif', e.target.checked)} />
        <span>Partenaire fictif — toutes ses demandes et missions sont des démonstrations.</span>
      </label>
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
