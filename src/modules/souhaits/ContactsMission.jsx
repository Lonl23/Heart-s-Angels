import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, F, Loading, Flash, inp } from '@/components/ui'
import { telephonesPluri, nomPluri, lblRolePluri } from './missionSchema'
import { lblRoleMission } from '@/modules/fiche/ficheSchema'
import RappelAsbl from './RappelAsbl'

function Tel({ n, equipage }) {
  if (!n) return null
  return (
    <a href={`tel:${String(n).replace(/\s/g, '')}`} style={{ color: equipage ? 'var(--accent)' : '#A32D2D', fontWeight: 700, textDecoration: 'none' }}>
      {n}
    </a>
  )
}

function Carte({ titre, lignes }) {
  if (!lignes?.length) return null
  return (
    <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginTop: 12 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.02rem', color: 'var(--heading)' }}>{titre}</h2>
      {lignes.map((l, i) => (
        <div key={l.id || i} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
          <div style={{ fontWeight: 700 }}>{l.nom}</div>
          {l.detail && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{l.detail}</div>}
          <div style={{ marginTop: 4 }}><Tel n={l.tel} equipage={l.equipage} />{l.email ? <span style={{ marginLeft: 8, fontSize: 13 }}>{l.email}</span> : null}</div>
        </div>
      ))}
    </section>
  )
}

export default function ContactsMission({ souhaitId, individuel, onBack }) {
  const [data, setData] = useState(null)
  const [extras, setExtras] = useState([])
  const [err, setErr] = useState(null)
  const [form, setForm] = useState({ libelle: '', nom: '', telephone: '', email: '' })

  async function charger() {
    const [{ data: c, error }, { data: ex, error: exErr }] = await Promise.all([
      supabase.rpc('contacts_mission', { p_souhait: souhaitId }),
      supabase.from('souhait_contacts_extra').select('*').eq('souhait_id', souhaitId).order('created_at'),
    ])
    if (error || c?.ok === false) setErr(error?.message || c?.error || 'Contacts inaccessibles.')
    else setData(c)
    if (!exErr) setExtras(ex || [])
  }

  useEffect(() => { charger() }, [souhaitId])

  async function ajouter(e) {
    e.preventDefault()
    if (!form.libelle.trim()) { setErr('Indiquez le rôle du contact.'); return }
    const { error } = await supabase.from('souhait_contacts_extra').insert({
      souhait_id: souhaitId,
      auteur_id: (await supabase.auth.getUser()).data.user?.id,
      libelle: form.libelle.trim(),
      nom: form.nom.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim(),
      individuel: !!individuel,
    })
    if (error) { setErr(error.message); return }
    setForm({ libelle: '', nom: '', telephone: '', email: '' })
    setErr(null)
    charger()
  }

  if (!data && !err) return <div style={{ padding: 16 }}><Loading /></div>
  const b = data?.beneficiaire || {}
  const benef = [b.prenom, b.nom].filter(Boolean).join(' ')
  const famille = (data?.contacts || []).map((c, i) => ({
    id: c.id || i,
    nom: [c.prenom, c.nom].filter(Boolean).join(' ') || c.libelle || 'Contact',
    detail: c.lien || c.type || 'Famille / proche',
    tel: c.tel_gsm || c.tel_fixe || c.telephone,
    email: c.email,
  }))
  const pluri = (data?.equipe_pluri || []).flatMap(r => telephonesPluri(r).map((t, i) => ({
    id: (r.id || nomPluri(r)) + i,
    nom: nomPluri(r) || lblRolePluri(r.role),
    detail: [lblRolePluri(r.role), r.type_medecin === 'referent' ? 'Médecin référent' : r.type_medecin].filter(Boolean).join(' · '),
    tel: t.n,
  })))
  const crew = (data?.equipage || []).map(e => ({
    id: e.prenom + (e.nom || '') + e.role,
    nom: [e.prenom, e.nom].filter(Boolean).join(' '),
    detail: lblRoleMission(e.role) || e.role || 'Équipage',
    tel: e.telephone,
    equipage: true,
  }))
  const coords = (data?.coordinateurs || []).map(c => ({
    id: c.email || c.prenom,
    nom: [c.prenom, c.nom].filter(Boolean).join(' ') || 'Coordination médicale',
    detail: 'Médecin coordinateur / coordination médicale',
    tel: c.telephone,
    email: c.email,
  }))
  const inst = data?.institution
  const ajoutes = extras.map(x => ({
    id: x.id,
    nom: x.nom || x.libelle,
    detail: x.libelle,
    tel: x.telephone,
    email: x.email,
  }))

  return (
    <div style={{ padding: '12px 14px 40px' }}>
      {onBack && <Btn kind="soft" onClick={onBack}>← Menu de la mission</Btn>}
      <h1 style={{ fontSize: '1.45rem', color: 'var(--heading)', margin: '12px 0 4px' }}>Contacts</h1>
      <RappelAsbl />
      {err && <Flash kind="err">{err}</Flash>}
      <Carte titre="Bénéficiaire" lignes={benef ? [{ id: 'b', nom: benef, tel: b.tel_gsm || b.tel_fixe, email: b.email, detail: 'Bénéficiaire' }] : []} />
      <Carte titre="Famille et proches" lignes={famille} />
      <Carte titre="Équipage" lignes={crew} />
      <Carte titre="Médecins et équipe pluridisciplinaire" lignes={pluri} />
      <Carte titre="Coordination médicale" lignes={coords} />
      {(inst?.nom || inst?.telephone) && (
        <Carte titre="Institution" lignes={[{ id: 'i', nom: inst.nom || 'Institution', detail: inst.service, tel: inst.telephone }]} />
      )}
      <Carte titre="Contacts ajoutés" lignes={ajoutes} />
      <form onSubmit={ajouter} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginTop: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.02rem' }}>Ajouter un contact manquant</h2>
        <F label="Rôle" value={form.libelle} set={v => setForm(f => ({ ...f, libelle: v }))} placeholder="Famille, médecin référent…" />
        <F label="Nom" value={form.nom} set={v => setForm(f => ({ ...f, nom: v }))} />
        <F label="Téléphone" value={form.telephone} set={v => setForm(f => ({ ...f, telephone: v }))} />
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>E-mail</label>
        <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ ...inp, marginBottom: 12 }} />
        <Btn type="submit">Ajouter</Btn>
      </form>
    </div>
  )
}
