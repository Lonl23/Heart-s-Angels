import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, Pill } from '@/components/ui'
import FicheVolontaire from '@/modules/fiche/FicheVolontaire'
import { QUALIFS, ROLES_ASBL } from '@/modules/fiche/ficheSchema'
import { CodeBox, FormInvit, Msg, genCode, tbl, th, td } from '@/modules/admin/inviteUi'

const ROLES_INTERNES = ['admin', 'president', 'coordinateur', 'ambulancier_bleu', 'ambulancier_gris', 'infirmier', 'medecin', 'volontaire_non_medical', 'tresorier', 'secretaire']

const _lblRole = v => (ROLES_ASBL.find(r => r.v === v)?.l) || v
const _lblQual = v => (QUALIFS.find(q => q.v === v)?.l) || v
function rolesAsblTxt(u) { const rs = u.fiche?.roles_asbl || []; return rs.length ? rs.map(_lblRole).join(', ') : '—' }
function qualifsTxt(u) { const qs = u.fiche?.qualifications || []; return qs.length ? qs.map(_lblQual).join(', ') : '—' }

export default function Volontaires() {
  const { peutGererFiches } = useAuth()
  const [fiche, setFiche] = useState(null)
  if (!peutGererFiches()) return <Navigate to="/app" replace />
  if (fiche) return <FicheVolontaire userId={fiche} onBack={() => setFiche(null)} />
  return (
    <Page
      title="Volontaires"
      subtitle="Invitations, membres et fiches. La gestion de l’application (accès, partenaires) est dans Administration."
    >
      <Membres onOpenFiche={setFiche} />
    </Page>
  )
}

function Membres({ onOpenFiche }) {
  const [membres, setMembres] = useState([])
  const [invits, setInvits] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [lastCode, setLastCode] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase.from('profiles').select('id,prenom,nom,email,role,actif,fiche').neq('role', 'partenaire').order('nom'),
      supabase.from('invitations').select('*').is('partenaire_id', null).eq('utilise', false).order('created_at', { ascending: false }),
    ])
    setMembres(m || []); setInvits(i || []); setLoading(false)
  }
  function flash(t, ok = true) { setMsg({ t, ok }); setTimeout(() => setMsg(null), 4000) }

  async function inviter(f) {
    const code = genCode()
    const { error } = await supabase.from('invitations').insert({ code, email: f.email.trim(), prenom: f.prenom, nom: f.nom, role: f.role })
    if (error) { flash(error.message, false); return }
    setForm(null); setLastCode(code); load()
  }
  async function toggle(u) {
    const { error } = await supabase.from('profiles').update({ actif: !u.actif }).eq('id', u.id)
    if (error) flash(error.message, false); else load()
  }
  async function revoquer(code) {
    if (!confirm('Révoquer cette invitation ?')) return
    await supabase.from('invitations').delete().eq('code', code); load()
  }

  return (
    <div>
      {msg && <Msg msg={msg} />}
      {lastCode && <CodeBox code={lastCode} />}
      <div style={{ marginBottom: 14 }}><Btn onClick={() => { setLastCode(null); setForm({ role: 'volontaire_non_medical' }) }}>+ Inviter un membre</Btn></div>
      {form && <FormInvit form={form} setForm={setForm} onSave={inviter} roles={ROLES_INTERNES} />}

      {invits.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Invitations en attente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invits.map(i => (
              <div key={i.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-blue)' }}>{i.code}</span> — {i.prenom} {i.nom} ({i.email}) · <span style={{ color: 'var(--text-muted)' }}>{i.role}</span></div>
                <Btn kind="danger" onClick={() => revoquer(i.code)} style={{ padding: '4px 10px' }}>Révoquer</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Chargement…</p> : (
        <Card style={{ padding: 0, overflow: 'auto' }}>
          <table style={tbl}><thead><tr style={{ background: 'var(--bg-alt)' }}>{['Nom', 'E-mail', 'Rôle (ASBL)', 'Qualification', 'Statut', 'Action'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {membres.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--border)', opacity: u.actif ? 1 : .5 }}>
                  <td style={td}>{u.prenom} {u.nom}</td><td style={td}>{u.email}</td><td style={td}>{rolesAsblTxt(u)}</td><td style={td}>{qualifsTxt(u)}</td>
                  <td style={td}>{u.actif ? <Pill color="#3B6D11" bg="#EAF3DE">Actif</Pill> : <Pill color="#A32D2D" bg="#FCEBEB">Désactivé</Pill>}</td>
                  <td style={{ ...td, display: 'flex', gap: 6, flexWrap: 'wrap' }}><Btn kind="soft" onClick={() => onOpenFiche(u.id)} style={{ padding: '5px 10px' }}>Fiche</Btn><Btn kind={u.actif ? 'danger' : 'ok'} onClick={() => toggle(u)} style={{ padding: '5px 10px' }}>{u.actif ? 'Désactiver' : 'Activer'}</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
