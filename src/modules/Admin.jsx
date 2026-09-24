import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, Pill, PillFictif } from '@/components/ui'
import { ACCES, EQUIPES_ACCES } from '@/modules/acces/accesSchema'
import { CodeBox, FormInvit, FormOrg, Msg, genCode, tbl, th, td, BtnCopierLien } from '@/modules/admin/inviteUi'
import { urlAccesPartenaire, copierTexte } from '@/lib/urls'
import { emailPartenaireAutorise, EMAIL_PRO_AIDE } from '@/lib/emailPro'

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
  const [demandes, setDemandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [orgForm, setOrgForm] = useState(null)
  const [cptForm, setCptForm] = useState(null)
  const [lastInvite, setLastInvite] = useState(null)
  const [msg, setMsg] = useState(null)
  const [copieUrl, setCopieUrl] = useState(false)
  const urlPartenaire = urlAccesPartenaire()

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: o }, { data: c }, { data: i }, { data: d }] = await Promise.all([
      supabase.from('partenaires').select('*').order('nom'),
      supabase.from('profiles').select('id,prenom,nom,email,actif,partenaire_id').eq('role', 'partenaire').order('nom'),
      supabase.from('invitations').select('*').not('partenaire_id', 'is', null).eq('utilise', false).order('created_at', { ascending: false }),
      supabase.from('demandes_acces_partenaire').select('*').eq('statut', 'en_attente').order('created_at', { ascending: false }),
    ])
    setOrgs(o || []); setComptes(c || []); setInvits(i || []); setDemandes(d || []); setLoading(false)
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
      notes: f.notes || null,
      fictif: !!f.fictif,
      email_pro_derogation: !!f.fictif ? false : !!f.email_pro_derogation,
    }
    const mail = p.email_general
    if (mail && !emailPartenaireAutorise(mail, { fictif: p.fictif, derogation: p.email_pro_derogation })) {
      flash(EMAIL_PRO_AIDE, false); return
    }
    if (f.id) await supabase.from('partenaires').update(p).eq('id', f.id)
    else await supabase.from('partenaires').insert(p)
    setOrgForm(null); load()
  }
  async function inviter(f) {
    if (!f.partenaire_id) { flash('Choisissez une organisation.', false); return }
    const org = orgs.find(o => o.id === f.partenaire_id)
    const email = (f.email || org?.email_general || org?.contact_email || '').trim()
    if (!email) { flash('Indiquez l’e-mail professionnel de l’institution.', false); return }
    if (!emailPartenaireAutorise(email, { fictif: org?.fictif, derogation: org?.email_pro_derogation })) {
      flash(EMAIL_PRO_AIDE, false); return
    }
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
    setCptForm(null); setLastInvite({ code, email, prenom: f.prenom || org?.nom || 'Institution', partenaire: true, nomInstitution: org?.nom }); load()
  }
  async function toggle(u) { const { error } = await supabase.from('profiles').update({ actif: !u.actif }).eq('id', u.id); if (error) flash(error.message, false); else load() }
  async function accepterDemande(id) {
    const { data, error } = await supabase.rpc('accepter_demande_partenaire', { p_id: id })
    if (error || !data?.ok) { flash(error?.message || data?.error || 'Impossible d’accepter.', false); return }
    setLastInvite({
      code: data.code,
      email: data.email,
      prenom: data.prenom,
      partenaire: true,
      nomInstitution: data.nom,
    })
    flash('Demande acceptée. Envoyez le lien d’activation à l’institution.')
    load()
  }
  async function refuserDemande(id) {
    const motif = window.prompt('Motif du refus (optionnel, interne) :') ?? ''
    if (motif === '' && !confirm('Refuser cette demande ?')) return
    const { data, error } = await supabase.rpc('refuser_demande_partenaire', { p_id: id, p_motif: motif })
    if (error || !data?.ok) { flash(error?.message || data?.error || 'Impossible de refuser.', false); return }
    load()
  }
  async function revoquer(code) { if (!confirm('Révoquer cette invitation ?')) return; await supabase.from('invitations').delete().eq('code', code); load() }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>

  return (
    <div>
      {msg && <Msg msg={msg} />}
      {lastInvite && <CodeBox code={lastInvite.code} email={lastInvite.email} prenom={lastInvite.prenom} partenaire={!!lastInvite.partenaire} nomInstitution={lastInvite.nomInstitution} />}

      <Card style={{ marginBottom: 16, background: '#E6F7FA', border: '1px solid rgba(27,176,206,.3)' }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 6 }}>Adresse HTML de l’accès partenaire</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>À coller sur le site web ou à envoyer aux institutions.</div>
        <div style={{
          width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9,
          fontSize: 12.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          boxSizing: 'border-box', marginBottom: 8, wordBreak: 'break-all', lineHeight: 1.45,
          background: 'var(--surface)', color: 'var(--text)', userSelect: 'all',
        }}>{urlPartenaire}</div>
        <Btn kind="soft" onClick={async () => {
          const ok = await copierTexte(urlPartenaire)
          if (ok) { setCopieUrl(true); setTimeout(() => setCopieUrl(false), 1800) }
        }}>{copieUrl ? '✓ Adresse copiée' : 'Copier l’adresse'}</Btn>
      </Card>

      {demandes.length > 0 && (
        <Card style={{ marginBottom: 16, border: '1px solid rgba(186,117,23,.35)', background: '#FAEEDA' }}>
          <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>
            Demandes d’accès en attente ({demandes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {demandes.map(d => (
              <div key={d.id} style={{ background: 'var(--card)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{d.nom_institution}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                  {d.contact_nom} · {d.email}
                  {d.ville ? ` · ${d.ville}` : ''}
                  {d.tel ? ` · ${d.tel}` : ''}
                </div>
                {d.partenaire_id && (
                  <div style={{ fontSize: 12, color: '#BA7517', marginTop: 4 }}>
                    Correspond déjà à « {orgNom(d.partenaire_id)} » dans l’annuaire.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <Btn onClick={() => accepterDemande(d.id)} style={{ padding: '5px 10px' }}>Accepter</Btn>
                  <Btn kind="danger" onClick={() => refuserDemande(d.id)} style={{ padding: '5px 10px' }}>Refuser</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)' }}>Organisations partenaires</div>
        <Btn onClick={() => setOrgForm({})}>+ Organisation</Btn>
      </div>
      {orgForm && <FormOrg form={orgForm} setForm={setOrgForm} onSave={saveOrg} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {orgs.length === 0 && <Card>Aucune organisation.</Card>}
        {orgs.map(o => (
          <Card key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {o.nom}
                {o.fictif && <PillFictif />}
                {o.email_pro_derogation && !o.fictif && <Pill color="#BA7517" bg="#FAEEDA">E-mail perso autorisé</Pill>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{[o.type, o.ville].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <Btn kind="soft" onClick={() => setOrgForm(o)}>Modifier</Btn>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)' }}>Comptes partenaires</div>
        <Btn onClick={() => { setLastInvite(null); setCptForm({}) }}>+ Inviter un partenaire</Btn>
      </div>
      {cptForm && <FormInvit form={cptForm} setForm={setCptForm} onSave={inviter} orgs={orgs} />}

      {invits.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Invitations partenaires en attente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invits.map(i => (
              <div key={i.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-blue)' }}>{i.code}</span> — {i.prenom} {i.nom} ({i.email}) · <span style={{ color: 'var(--text-muted)' }}>{orgNom(i.partenaire_id)}</span></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <BtnCopierLien code={i.code} email={i.email} partenaire />
                  <Btn kind="danger" onClick={() => revoquer(i.code)} style={{ padding: '4px 10px' }}>Révoquer</Btn>
                </div>
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
  const [map, setMap] = useState({})
  const [msg, setMsg] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('acces_config').select('*')
    const m = {}; (data || []).forEach(r => { m[`${r.dimension}:${r.sujet}:${r.acces}`] = r.autorise }); setMap(m)
  }
  function flash(t, ok = true) { setMsg({ t, ok }); setTimeout(() => setMsg(null), 3000) }
  function coche(equipe, acces) {
    return equipe.roles.some(r => !!map[`role:${r}:${acces}`])
  }
  async function toggle(equipe, acces, cur) {
    const nv = !cur
    const patch = {}
    equipe.roles.forEach(r => { patch[`role:${r}:${acces}`] = nv })
    setMap(m => ({ ...m, ...patch }))
    const { error } = await supabase.from('acces_config').upsert(
      equipe.roles.map(r => ({ dimension: 'role', sujet: r, acces, autorise: nv })),
      { onConflict: 'dimension,sujet,acces' }
    )
    if (error) flash(error.message, false)
  }

  return (
    <div>
      {msg && <Msg msg={msg} />}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        <b>Mes missions</b>, <b>défraiements</b> et <b>disponibilités</b> sont ouverts à tout le personnel enregistré (pas les partenaires) : ils ne se règlent pas ici.
        {' '}Les souhaits restent liés aux rôles de récolte et de programmation (transport, présidence, informatique).
        {' '}Cochez seulement le <b>stock</b> et l’<b>annuaire</b> (et éventuellement Souhaits en plus) par <b>équipe</b> : responsable et adjoint d’une même catégorie comptent ensemble. Un membre a l’accès dès qu’une de ses équipes est cochée. Les administrateurs du logiciel gardent l’accès total.
      </div>

      <Card style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-alt)' }}>
              <th style={{ ...th, position: 'sticky', left: 0, background: 'var(--bg-alt)' }}>Équipe ASBL</th>
              {ACCES.map(a => <th key={a.v} style={{ ...th, textAlign: 'center' }}>{a.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {EQUIPES_ACCES.map(eq => (
              <tr key={eq.v} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, position: 'sticky', left: 0, background: 'var(--card)', fontWeight: 600 }}>
                  {eq.l}
                  {eq.roles.length > 1 && (
                    <div style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {eq.v === 'presidence' ? 'président et vice-président' : 'responsable et adjoint'}
                    </div>
                  )}
                </td>
                {ACCES.map(a => {
                  const cur = coche(eq, a.v)
                  return (
                    <td key={a.v} style={{ ...td, textAlign: 'center' }}>
                      <input type="checkbox" checked={cur} onChange={() => toggle(eq, a.v, cur)} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
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
