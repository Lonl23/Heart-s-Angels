import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Sel, PhoneF, AddressFields, fmtAdresse, lbl, Empty, AdresseAffichee, LiensGps } from '@/components/ui'
import { CATEGORIES, ACCOMPAGNANT_FIELDS, POINT_CONTACT_FIELDS, catInfo, emptyToNull, normaliserNiss, fmtTelephones, formaterNiss } from './annuaireSchema'
import { GenrePicker, GenreIcon, NissF } from './genre'
import { assurerPartenaireDepuisAnnuaire, upsertPointContact } from './annuaireApi'
import { genCodeInvitation } from '@/lib/motDePasse'

const COLS = ['nom', 'prenom', 'beneficiaire_id', 'institution_id', 'niss', 'tel_gsm', 'tel_fixe', 'genre', 'date_naissance', 'lien', 'telephone']

const sliceDate = v => (v ? String(v).slice(0, 10) : '')

const toForm = r => {
  const d = r.data || {}
  return {
    ...d,
    id: r.id,
    nom: r.nom || '',
    prenom: r.prenom || '',
    beneficiaire_id: r.beneficiaire_id || null,
    institution_id: r.institution_id || null,
    niss: formaterNiss(r.niss || d.niss || ''),
    tel_gsm: r.tel_gsm || d.tel_gsm || '',
    tel_fixe: r.tel_fixe || d.tel_fixe || '',
    genre: r.genre || d.genre || '',
    date_naissance: sliceDate(r.date_naissance || d.date_naissance),
    lien: r.lien || d.lien || '',
    telephone: r.telephone || d.telephone || '',
    adresse: d.adresse || r.adresse || null,
  }
}

function toRecord(cat, f) {
  const data = { ...f }
  delete data.id
  COLS.forEach(k => delete data[k])
  const gsm = emptyToNull(f.tel_gsm)
  const fixe = emptyToNull(f.tel_fixe)
  return {
    categorie: cat,
    nom: emptyToNull(f.nom),
    prenom: emptyToNull(f.prenom),
    beneficiaire_id: f.beneficiaire_id || null,
    institution_id: f.institution_id || null,
    niss: normaliserNiss(f.niss) || null,
    tel_gsm: gsm,
    tel_fixe: fixe,
    genre: emptyToNull(f.genre),
    date_naissance: emptyToNull(f.date_naissance),
    lien: emptyToNull(f.lien),
    telephone: emptyToNull(f.telephone) || gsm || fixe,
    data,
  }
}

const nomComplet = r => [r.prenom, r.nom].filter(Boolean).join(' ') || '(sans nom)'

export default function Annuaire() {
  const [cat, setCat] = useState('beneficiaire')
  const [rows, setRows] = useState([])
  const [institutions, setInstitutions] = useState([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [cat])
  async function load() {
    const { data } = await supabase.from('annuaire').select('*').eq('categorie', cat).order('nom')
    setRows(data || [])
    if (institutions.length === 0) {
      const { data: inst } = await supabase.from('annuaire').select('id,nom').eq('categorie', 'institution').order('nom')
      setInstitutions(inst || [])
    }
  }
  async function supprimer(r) {
    if (!confirm('Supprimer cette fiche ?')) return
    await supabase.from('annuaire').delete().eq('id', r.id)
    load()
  }

  const info = catInfo(cat)
  const filtered = rows.filter(r => !q || `${r.prenom} ${r.nom} ${r.niss || ''} ${JSON.stringify(r.data)}`.toLowerCase().includes(q.toLowerCase()))

  if (editing) {
    return (
      <FicheContact
        cat={cat}
        form={editing}
        setForm={setEditing}
        institutions={institutions}
        onDone={() => { setEditing(null); load() }}
      />
    )
  }

  return (
    <Page title="Annuaire" subtitle="Bénéficiaires, contacts rattachés, institutions et partenaires.">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {CATEGORIES.map(c => (
          <button
            key={c.v}
            onClick={() => { setCat(c.v); setQ('') }}
            style={{
              padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border)',
              background: cat === c.v ? 'var(--accent)' : 'var(--card)',
              color: cat === c.v ? '#fff' : 'var(--text-2)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {c.icon} {c.l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="ha-search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Rechercher un(e) ${info.titre.toLowerCase()}…`} style={{ flex: 1, minWidth: 180, maxWidth: 'none' }} />
        <Btn onClick={() => setEditing({})}>+ {info.titre}</Btn>
      </div>

      {cat === 'beneficiaire' && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '-4px 0 12px' }}>
          Les bénéficiaires encodés dans un souhait ou une demande acceptée apparaissent ici. Ouvrez une fiche pour y rattacher des contacts.
        </p>
      )}

      {filtered.length === 0 ? (
        <Empty
          title={`Aucun(e) ${info.titre.toLowerCase()}`}
          hint={q ? 'Aucun résultat pour cette recherche.' : 'Ajoutez une fiche, ou encodez un souhait : le bénéficiaire sera repris ici.'}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {filtered.map(r => (
            <ContactCard
              key={r.id}
              r={r}
              cat={cat}
              institutions={institutions}
              onOpen={() => setEditing(toForm(r))}
              onDelete={() => supprimer(r)}
            />
          ))}
        </div>
      )}
    </Page>
  )
}

function ContactCard({ r, cat, institutions, onOpen, onDelete }) {
  const d = r.data || {}
  const inst = r.institution_id && institutions.find(i => i.id === r.institution_id)
  const tels = fmtTelephones(r, d)
  const adr = fmtAdresse(d.adresse)
  return (
    <Card clickable onClick={onOpen} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {cat === 'beneficiaire' && r.genre && <GenreIcon genre={r.genre} />}
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{nomComplet(r)}</div>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ ...miniBtn, color: '#C8435A' }}
          aria-label="Supprimer"
        >✕</button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {d.type_medical && <span>{d.type_medical}{d.specialite ? ` · ${d.specialite}` : ''}</span>}
        {d.type_institution && <span>{d.type_institution}</span>}
        {d.domaine && <span>{d.domaine}</span>}
        {d.type_partenaire && <span>{d.type_partenaire}</span>}
        {d.contact_personne && <span>Contact : {d.contact_personne}</span>}
        {inst && <span>🏥 {inst.nom}</span>}
        {cat === 'beneficiaire' && r.date_naissance && <span>Né(e) le {new Date(r.date_naissance).toLocaleDateString('fr-BE')}</span>}
        {tels && <span>📞 {tels}</span>}
        {d.telephone && !tels && <span>📞 {d.telephone}</span>}
        {d.email && <span>✉️ {d.email}</span>}
        {adr && (
          <span onClick={e => e.stopPropagation()}>
            <AdresseAffichee value={d.adresse} compact />
          </span>
        )}
      </div>
      {cat === 'beneficiaire' && <Accompagnants beneficiaireId={r.id} compact />}
    </Card>
  )
}

function FicheContact({ cat, form, setForm, institutions, onDone }) {
  const { profile } = useAuth()
  const info = catInfo(cat)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  async function save() {
    setSaving(true); setErr(null)
    const rec = toRecord(cat, form)
    if (form.id) {
      const { error } = await supabase.from('annuaire').update(rec).eq('id', form.id)
      if (error) { setSaving(false); setErr(error.message); return }
      if (cat === 'institution' || cat === 'externe_souhait') {
        const { data: row } = await supabase.from('annuaire').select('*').eq('id', form.id).single()
        try { await assurerPartenaireDepuisAnnuaire(row) } catch (e) { setSaving(false); setErr(e.message); return }
      }
      setSaving(false)
      onDone()
      return
    }
    const { data, error } = await supabase.from('annuaire').insert({ ...rec, created_by: profile?.id }).select('id').single()
    if (error) { setSaving(false); setErr(error.message); return }
    if ((cat === 'institution' || cat === 'externe_souhait') && data?.id) {
      const { data: row } = await supabase.from('annuaire').select('*').eq('id', data.id).single()
      try { await assurerPartenaireDepuisAnnuaire(row) } catch (e) { /* org created later */ }
    }
    setSaving(false)
    if (cat === 'beneficiaire' && data?.id) {
      setForm(s => ({ ...s, id: data.id }))
      return
    }
    onDone()
  }
  return (
    <Page title={`${form.id ? 'Fiche' : 'Nouveau'} — ${info.titre}`} action={<Btn kind="soft" onClick={onDone}>← Retour</Btn>}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0 20px' }}>
          {info.fields.map(f => <Champ key={f.k} f={f} val={form[f.k]} set={v => set(f.k, v)} institutions={institutions} />)}
        </div>
        {err && <div style={{ color: '#C8435A', fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <Btn onClick={save} disabled={saving} style={{ width: '100%', marginTop: 10 }}>{saving ? '…' : '✓ Enregistrer'}</Btn>
      </Card>
      {cat === 'beneficiaire' && form.id && (
        <Card>
          <Accompagnants beneficiaireId={form.id} />
        </Card>
      )}
      {cat === 'beneficiaire' && !form.id && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Enregistrez d’abord le bénéficiaire pour y rattacher des contacts.</div>
      )}
      {(cat === 'institution' || cat === 'externe_souhait') && form.id && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <PointsDeContact institutionId={form.id} />
          </Card>
          <Card>
            <AccesInstitution form={form} />
          </Card>
        </>
      )}
    </Page>
  )
}

function Champ({ f, val, set, institutions }) {
  if (f.t === 'address') return <div style={{ gridColumn: '1 / -1', margin: '8px 0' }}><label style={lbl}>{f.l}</label><AddressFields value={val} set={set} /></div>
  if (f.t === 'textarea') return <div style={{ gridColumn: '1 / -1' }}><TA label={f.l} value={val || ''} set={set} rows={2} /></div>
  if (f.t === 'phone') return <PhoneF label={f.l} value={val || ''} set={set} />
  if (f.t === 'genre') return <div style={{ gridColumn: '1 / -1' }}><GenrePicker label={f.l} value={val || ''} set={set} /></div>
  if (f.t === 'niss') return <NissF label={f.l} value={val || ''} set={set} />
  if (f.t === 'select') return <Sel label={f.l} value={val || ''} set={set} options={f.options.map(o => ({ v: o, l: o || '—' }))} />
  if (f.t === 'institution') return <Sel label={f.l} value={val || ''} set={v => set(v || null)} options={[{ v: '', l: '—' }, ...institutions.map(i => ({ v: i.id, l: i.nom }))]} />
  const type = f.t === 'date' ? 'date' : 'text'
  return <F label={f.l} type={type} value={val || ''} set={set} />
}

function Accompagnants({ beneficiaireId, compact }) {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  useEffect(() => { load() }, [beneficiaireId])
  async function load() {
    const { data } = await supabase.from('annuaire').select('*').eq('categorie', 'accompagnant').eq('beneficiaire_id', beneficiaireId).order('nom')
    setRows(data || [])
  }
  async function save() {
    const rec = toRecord('accompagnant', { ...form, beneficiaire_id: beneficiaireId })
    if (form.id) await supabase.from('annuaire').update(rec).eq('id', form.id)
    else await supabase.from('annuaire').insert({ ...rec, created_by: profile?.id })
    setForm(null)
    load()
  }
  async function suppr(r) {
    if (!confirm('Retirer ce contact rattaché ?')) return
    await supabase.from('annuaire').delete().eq('id', r.id)
    load()
  }

  if (compact) {
    if (rows.length === 0) return null
    return <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>👥 {rows.map(r => `${r.prenom || ''} ${r.nom || ''}`.trim()).join(', ')}</div>
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--heading)' }}>Contacts rattachés</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Famille, proche, tuteur… liés à ce bénéficiaire.</div>
        </div>
        <Btn kind="soft" onClick={() => setForm({})}>+ Ajouter</Btn>
      </div>
      {form && (
        <Card style={{ marginBottom: 10, background: 'var(--bg-alt)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0 14px' }}>
            {ACCOMPAGNANT_FIELDS.map(f => <Champ key={f.k} f={f} val={form[f.k]} set={v => setForm(s => ({ ...s, [f.k]: v }))} institutions={[]} />)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}><Btn onClick={save}>✓ Enregistrer</Btn><Btn kind="soft" onClick={() => setForm(null)}>Annuler</Btn></div>
        </Card>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => {
          const d = r.data || {}
          const tels = fmtTelephones(r, d)
          const adr = fmtAdresse(d.adresse)
          return (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 13.5, minWidth: 0 }}>
                <div>{r.prenom} {r.nom} {(r.lien || d.lien) && <span style={{ color: 'var(--text-muted)' }}>— {r.lien || d.lien}</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {r.date_naissance && <span>Né(e) le {new Date(r.date_naissance).toLocaleDateString('fr-BE')} · </span>}
                  {tels}{tels && adr ? ' · ' : ''}{adr}
                </div>
                {d.adresse && <div style={{ marginTop: 4 }}><LiensGps adresse={d.adresse} /></div>}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button type="button" onClick={() => setForm(toForm(r))} style={miniBtn} aria-label="Modifier">✎</button>
                <button type="button" onClick={() => suppr(r)} style={{ ...miniBtn, color: '#C8435A' }} aria-label="Supprimer">✕</button>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun contact rattaché.</div>}
      </div>
    </div>
  )
}

function PointsDeContact({ institutionId }) {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  useEffect(() => { load() }, [institutionId])
  async function load() {
    const { data } = await supabase.from('annuaire').select('*')
      .eq('institution_id', institutionId)
      .in('categorie', ['point_contact', 'medical'])
      .order('nom')
    setRows(data || [])
  }
  async function save() {
    try {
      await upsertPointContact(institutionId, {
        ...form,
        fonction: form.fonction || form.lien,
        telephone: form.tel_gsm || form.tel_fixe || form.telephone,
      }, { created_by: profile?.id })
      setForm(null)
      load()
    } catch (e) { alert(e.message || e) }
  }
  async function suppr(r) {
    if (!confirm('Retirer ce point de contact ?')) return
    await supabase.from('annuaire').delete().eq('id', r.id)
    load()
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--heading)' }}>Points de contact</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Infirmier chef, assistante sociale, autre membre de l’institution.</div>
        </div>
        <Btn kind="soft" onClick={() => setForm({})}>+ Point de contact</Btn>
      </div>
      {form && (
        <Card style={{ marginBottom: 10, background: 'var(--bg-alt)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0 14px' }}>
            {POINT_CONTACT_FIELDS.map(f => <Champ key={f.k} f={f} val={form[f.k]} set={v => setForm(s => ({ ...s, [f.k]: v }))} institutions={[]} />)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}><Btn onClick={save}>✓ Enregistrer</Btn><Btn kind="soft" onClick={() => setForm(null)}>Annuler</Btn></div>
        </Card>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => {
          const d = r.data || {}
          const tels = fmtTelephones(r, d)
          return (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 13.5 }}>
                <div>{r.prenom} {r.nom} {(r.lien || d.fonction) && <span style={{ color: 'var(--text-muted)' }}>— {r.lien || d.fonction}</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{tels}{tels && d.email ? ' · ' : ''}{d.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" onClick={() => setForm({ ...toForm(r), fonction: r.lien || d.fonction || '' })} style={miniBtn}>✎</button>
                <button type="button" onClick={() => suppr(r)} style={{ ...miniBtn, color: '#C8435A' }}>✕</button>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun point de contact.</div>}
      </div>
    </div>
  )
}

function AccesInstitution({ form }) {
  const { profile } = useAuth()
  const [code, setCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const email = (form.email || '').trim()
  async function generer() {
    if (!email) { setErr('Renseignez d’abord l’e-mail général, puis enregistrez la fiche.'); return }
    setBusy(true); setErr(null)
    try {
      const { data: row } = await supabase.from('annuaire').select('*').eq('id', form.id).single()
      const partenaireId = await assurerPartenaireDepuisAnnuaire(row)
      const nouveau = genCodeInvitation()
      const { error } = await supabase.from('invitations').insert({
        code: nouveau,
        email,
        prenom: form.contact_personne || form.nom || 'Institution',
        nom: form.nom || '',
        role: 'partenaire',
        partenaire_id: partenaireId,
        cree_par: profile?.id,
      })
      if (error) { setErr(error.message); setBusy(false); return }
      setCode(nouveau)
    } catch (e) { setErr(e.message || String(e)) }
    setBusy(false)
  }
  return (
    <div>
      <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 6 }}>Espace institution</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
        Connexion avec l’e-mail général et un mot de passe (10 caractères, majuscule, minuscule, chiffre, caractère spécial), ou avec un code généré ici.
      </p>
      {email ? <div style={{ fontSize: 13, marginBottom: 10 }}>E-mail de connexion : <strong>{email}</strong></div>
        : <div style={{ fontSize: 13, color: '#BA7517', marginBottom: 10 }}>Ajoutez un e-mail général pour ouvrir l’espace.</div>}
      <Btn onClick={generer} disabled={busy || !email}>{busy ? '…' : 'Générer un code d’accès'}</Btn>
      {err && <div style={{ color: '#C8435A', fontSize: 13, marginTop: 8 }}>{err}</div>}
      {code && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-alt)', borderRadius: 10 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Code à transmettre (valable 7 jours) :</div>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, letterSpacing: 1, color: 'var(--accent-blue)' }}>{code}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>L’institution s’inscrit via « J’ai un code d’invitation » avec l’e-mail général.</div>
        </div>
      )}
    </div>
  )
}

const miniBtn = { background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }
