import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, Pill, Modal, Empty, Loading } from '@/components/ui'
import FicheVolontaire from '@/modules/fiche/FicheVolontaire'
import { QUALIFS, ROLES_ASBL, personneEstMedicale } from '@/modules/fiche/ficheSchema'
import { CodeBox, FormInvit, Msg, genCode, BtnCopierLien, BtnEnvoyerInvitation } from '@/modules/admin/inviteUi'

const TYPES_INVIT = [
  { v: 'volontaire_medical', l: 'Volontaire médical' },
  { v: 'volontaire_non_medical', l: 'Volontaire non médical' },
]

const _lblRole = v => (ROLES_ASBL.find(r => r.v === v)?.l) || v
const _lblQual = v => (QUALIFS.find(q => q.v === v)?.l) || v
const _lblInvit = v => (TYPES_INVIT.find(r => r.v === v)?.l) || v
function rolesAsblTxt(u) { const rs = u.fiche?.roles_asbl || []; return rs.length ? rs.map(_lblRole).join(', ') : '—' }
function qualifsTxt(u) { const qs = u.fiche?.qualifications || []; return qs.length ? qs.map(_lblQual).join(', ') : '—' }
function typeBenevoleTxt(u) {
  const t = u.fiche?.type_benevole
  if (t === 'medical') return 'Volontaire médical'
  if (t === 'non_medical') return 'Volontaire non médical'
  return _lblInvit(u.role)
}
function compteAConfigurer(u) {
  return !!(u?.fiche?.compte_a_configurer) || !(u?.email || '').trim()
}
function roleInvitDepuisFiche(u) {
  return estMedical(u) ? 'volontaire_medical' : 'volontaire_non_medical'
}
function estMedical(u) {
  const t = u?.fiche?.type_benevole
  if (t === 'medical') return true
  if (t === 'non_medical') return false
  return personneEstMedicale(u)
}
function nomPrenom(u) {
  return `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Sans nom'
}

export default function Volontaires() {
  const { peutGererFiches } = useAuth()
  const [fiche, setFiche] = useState(null)
  if (!peutGererFiches()) return <Navigate to="/app" replace />
  if (fiche) return <FicheVolontaire userId={fiche} onBack={() => setFiche(null)} />
  return (
    <Page
      title="Volontaires"
      subtitle="Ajoutez une fiche sans e-mail si besoin ; l’invitation pourra suivre plus tard. La gestion de l’application (accès, partenaires) est dans Administration."
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
  const [lastInvite, setLastInvite] = useState(null)
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
    const email = (f.email || '').trim()
    let profileId = f.profile_cible_id || null
    if (!profileId) {
      const { data, error } = await supabase.rpc('creer_volontaire_sans_compte', {
        p_prenom: (f.prenom || '').trim(),
        p_nom: (f.nom || '').trim(),
        p_role: f.role,
        p_telephone: (f.telephone || '').trim() || null,
      })
      if (error || !data?.ok) { flash(data?.error || error?.message || 'Impossible de créer la fiche.', false); return }
      profileId = data.id
    }
    if (!email) {
      setForm(null)
      setLastInvite(null)
      flash('Fiche créée. Vous pourrez envoyer l’invitation plus tard via « Configurer le compte ».')
      load()
      return
    }
    const code = genCode()
    const { error } = await supabase.from('invitations').insert({
      code,
      email,
      prenom: f.prenom,
      nom: f.nom,
      role: f.role,
      type_benevole: f.role === 'volontaire_medical' ? 'medical' : 'non_medical',
      profile_cible_id: profileId,
    })
    if (error) { flash(profileId && !f.profile_cible_id ? 'Fiche créée, mais invitation : ' + error.message : error.message, false); load(); return }
    setForm(null); setLastInvite({ code, email, prenom: f.prenom, typeBenevole: f.role }); load()
  }
  function configurerCompte(u) {
    setLastInvite(null)
    setForm({
      prenom: u.prenom || '',
      nom: u.nom || '',
      email: (u.email || '').trim(),
      role: roleInvitDepuisFiche(u),
      profile_cible_id: u.id,
    })
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
      <div style={{ marginBottom: 14 }}>
        <Btn onClick={() => { setLastInvite(null); setForm({ role: 'volontaire_non_medical', prenom: '', nom: '', email: '', telephone: '' }) }}>+ Ajouter un volontaire</Btn>
      </div>
      {(form || lastInvite) && (
        <Modal
          title={lastInvite
            ? 'Lien d’invitation'
            : (form.profile_cible_id ? 'Configurer le compte' : 'Ajouter un volontaire')}
          onClose={() => { setForm(null); setLastInvite(null) }}
        >
          {lastInvite ? (
            <CodeBox embedded code={lastInvite.code} email={lastInvite.email} prenom={lastInvite.prenom} typeBenevole={lastInvite.typeBenevole} />
          ) : (
            <>
              {form.profile_cible_id && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
                  Encodez l’e-mail ici pour envoyer le lien. Inutile d’ouvrir la fiche.
                </p>
              )}
              <FormInvit
                embedded
                form={form}
                setForm={setForm}
                onSave={inviter}
                roles={TYPES_INVIT}
                roleLabel="Type de volontaire"
                titre={form.profile_cible_id ? 'Configurer le compte' : 'Ajouter un volontaire'}
                emailFacultatif={!form.profile_cible_id}
              />
            </>
          )}
        </Modal>
      )}

      {invits.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Invitations en attente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invits.map(i => (
              <div key={i.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-blue)' }}>{i.code}</span> — {i.prenom} {i.nom} ({i.email}) · <span style={{ color: 'var(--text-muted)' }}>{_lblInvit(i.role)}</span>{i.envoyee_le ? <span style={{ color: '#3B6D11' }}> · mail envoyé</span> : ''}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <BtnEnvoyerInvitation code={i.code} />
                  <BtnCopierLien code={i.code} email={i.email} />
                  <Btn kind="danger" onClick={() => revoquer(i.code)} style={{ padding: '4px 10px' }}>Révoquer</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? <Loading /> : (
        <GrillesVolontaires
          membres={membres}
          onOpenFiche={onOpenFiche}
          onConfigurer={configurerCompte}
          onToggle={toggle}
        />
      )}
    </div>
  )
}

function GrillesVolontaires({ membres, onOpenFiche, onConfigurer, onToggle }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const filtrés = needle
    ? membres.filter(u => {
        const hay = [u.prenom, u.nom, u.email, typeBenevoleTxt(u), rolesAsblTxt(u), qualifsTxt(u)].join(' ').toLowerCase()
        return hay.includes(needle)
      })
    : membres
  const medicaux = filtrés.filter(estMedical)
  const nonMedicaux = filtrés.filter(u => !estMedical(u))

  return (
    <div>
      {membres.length > 0 && (
        <input
          className="ha-search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Rechercher un volontaire…"
          style={{ width: '100%', maxWidth: 360, marginBottom: 18 }}
        />
      )}
      {filtrés.length === 0 ? (
        <Empty
          title={needle ? 'Aucun volontaire pour cette recherche' : 'Aucun volontaire'}
          hint={needle ? 'Essayez un autre nom, e-mail ou qualification.' : 'Ajoutez un volontaire pour commencer.'}
        />
      ) : (
        <>
          <GroupeTuiles
            titre="Volontaires médicaux"
            hint="Médecins, infirmiers, ambulanciers…"
            items={medicaux}
            onOpenFiche={onOpenFiche}
            onConfigurer={onConfigurer}
            onToggle={onToggle}
          />
          <GroupeTuiles
            titre="Volontaires non médicaux"
            hint="Secouristes, chauffeurs, accompagnement…"
            items={nonMedicaux}
            onOpenFiche={onOpenFiche}
            onConfigurer={onConfigurer}
            onToggle={onToggle}
          />
        </>
      )}
    </div>
  )
}

function GroupeTuiles({ titre, hint, items, onOpenFiche, onConfigurer, onToggle }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--heading)' }}>{titre}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{items.length} · {hint}</div>
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Personne dans ce groupe.</p>
      ) : (
        <div className="ha-vol-grille">
          {items.map(u => (
            <TuileVolontaire
              key={u.id}
              u={u}
              onOpenFiche={onOpenFiche}
              onConfigurer={onConfigurer}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function TuileVolontaire({ u, onOpenFiche, onConfigurer, onToggle }) {
  const aConfigurer = compteAConfigurer(u)
  const roles = (u.fiche?.roles_asbl || []).map(_lblRole)
  const quals = (u.fiche?.qualifications || []).map(_lblQual)
  return (
    <Card
      clickable
      onClick={() => onOpenFiche(u.id)}
      className="ha-vol-tuile"
      style={{ opacity: u.actif ? 1 : .55, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <AvatarVolontaire url={u.fiche?.photo_url} prenom={u.prenom} nom={u.nom} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nomPrenom(u)}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {aConfigurer ? 'Compte à configurer' : (u.email || '—')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {aConfigurer
          ? <Pill color="#BA7517" bg="#FAEEDA">Sans accès</Pill>
          : u.actif
            ? <Pill color="#3B6D11" bg="#EAF3DE">Actif</Pill>
            : <Pill color="#A32D2D" bg="#FCEBEB">Désactivé</Pill>}
        {roles.slice(0, 2).map(r => <Pill key={r}>{r}</Pill>)}
        {quals.slice(0, 2).map(q => <Pill key={q} color="var(--accent-blue)" bg="var(--blue-light)">{q}</Pill>)}
      </div>
      <div
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <Btn kind="soft" onClick={() => onOpenFiche(u.id)} style={{ padding: '5px 10px' }}>Fiche</Btn>
        {aConfigurer && <Btn onClick={() => onConfigurer(u)} style={{ padding: '5px 10px' }}>Configurer le compte</Btn>}
        <Btn kind={u.actif ? 'danger' : 'ok'} onClick={() => onToggle(u)} style={{ padding: '5px 10px' }}>{u.actif ? 'Désactiver' : 'Activer'}</Btn>
      </div>
    </Card>
  )
}

function AvatarVolontaire({ url, prenom, nom }) {
  const initiales = `${(prenom || '').charAt(0)}${(nom || '').charAt(0)}`.toUpperCase()
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 99, overflow: 'hidden', flexShrink: 0,
      background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center',
      fontSize: 16, fontWeight: 700, boxShadow: '0 0 0 3px var(--ring)',
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (initiales || '?')}
    </div>
  )
}
