import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const TYPES_INSTIT = ['Hôpital', 'Clinique', 'Maison de repos (MR/MRS)', 'Domicile', 'Centre de soins', 'Cabinet', 'Autre']

const TABS = [
  { id: 'institutions',  label: '🏥 Institutions',  sensible: false },
  { id: 'medecin',       label: '👨\u200d⚕️ Médecins',   sensible: false },
  { id: 'infirmier',     label: '💉 Infirmiers',    sensible: false },
  { id: 'beneficiaire',  label: '🎗️ Bénéficiaires', sensible: true },
  { id: 'accompagnant',  label: '🤝 Accompagnants', sensible: true },
]

const C = {
  bleu:'#1BB0CE', fonce:'#0A4A5A', fonce2:'#0E4A5A', texte:'#1A1514', gris:'#7A7470', gris2:'#A8A39D',
  rose:'#C8435A', roseBg:'#FBEAF0', bord:'rgba(0,0,0,.10)', fond:'#FAFAF8', clair:'#E6F7FA',
}

export default function Annuaire() {
  const { can, profile } = useAuth()
  const medical = can('annuaire.medical')
  const peutEditer = can('nav.annuaire')

  const [tab, setTab] = useState('institutions')
  const [institutions, setInstitutions] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // { cat, data }
  const [filtreBenef, setFiltreBenef] = useState('') // pour onglet accompagnants

  // si onglet sensible sans droit → revenir sur un onglet autorisé
  useEffect(() => {
    if (!medical && TABS.find(t => t.id === tab)?.sensible) setTab('institutions')
  }, [medical, tab])

  async function load() {
    setLoading(true)
    const [{ data: inst }, { data: ct }] = await Promise.all([
      supabase.from('annuaire_institutions').select('*').order('nom'),
      supabase.from('annuaire_contacts').select('*').order('nom'),
    ])
    setInstitutions(inst || [])
    setContacts(ct || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const instById = useMemo(() => Object.fromEntries(institutions.map(i => [i.id, i])), [institutions])
  const ctById = useMemo(() => Object.fromEntries(contacts.map(c => [c.id, c])), [contacts])
  const medecins = useMemo(() => contacts.filter(c => c.categorie === 'medecin'), [contacts])
  const infirmiers = useMemo(() => contacts.filter(c => c.categorie === 'infirmier'), [contacts])
  const beneficiaires = useMemo(() => contacts.filter(c => c.categorie === 'beneficiaire'), [contacts])

  const nomDe = (c) => c ? `${c.prenom || ''} ${c.nom || ''}`.trim() || '—' : '—'

  const visibleTabs = TABS.filter(t => medical || !t.sensible)

  // Données de l'onglet courant
  const liste = useMemo(() => {
    const q = search.trim().toLowerCase()
    const match = (s) => !q || (s || '').toLowerCase().includes(q)
    if (tab === 'institutions') {
      return institutions.filter(i => match(i.nom) || match(i.type) || match(i.adresse))
    }
    let arr = contacts.filter(c => c.categorie === tab)
    if (tab === 'accompagnant' && filtreBenef) arr = arr.filter(a => a.beneficiaire_id === filtreBenef)
    return arr.filter(c => match(c.prenom) || match(c.nom) || match(c.specialite) || match(c.lien))
  }, [tab, institutions, contacts, search, filtreBenef])

  function nouveau() {
    if (tab === 'institutions') setModal({ cat: 'institutions', data: { type: 'Hôpital' } })
    else setModal({ cat: tab, data: { categorie: tab, ...(tab === 'accompagnant' && filtreBenef ? { beneficiaire_id: filtreBenef } : {}) } })
  }
  function editer(item, cat) { setModal({ cat, data: { ...item } }) }

  async function supprimer(item, cat) {
    const nom = cat === 'institutions' ? item.nom : nomDe(item)
    let extra = ''
    if (cat === 'beneficiaire') {
      const nbAcc = contacts.filter(a => a.beneficiaire_id === item.id).length
      if (nbAcc) extra = `\n\n⚠️ ${nbAcc} accompagnant(s) lié(s) seront aussi supprimés.`
    }
    if (!confirm(`Supprimer « ${nom} » ?${extra}`)) return
    const table = cat === 'institutions' ? 'annuaire_institutions' : 'annuaire_contacts'
    await supabase.from(table).delete().eq('id', item.id)
    load()
  }

  async function sauver(cat, data) {
    const table = cat === 'institutions' ? 'annuaire_institutions' : 'annuaire_contacts'
    const payload = { ...data }
    // nettoyage des champs vides → null
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
    if (cat !== 'institutions') payload.categorie = cat
    let res
    if (data.id) {
      const { id, created_at, ...up } = payload
      res = await supabase.from(table).update(up).eq('id', id)
    } else {
      payload.created_by = profile?.id
      res = await supabase.from(table).insert(payload)
    }
    if (res.error) { alert('Enregistrement impossible : ' + res.error.message); return }
    setModal(null); load()
  }

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', fontFamily: "'DM Sans',sans-serif", maxWidth: 1040, margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, color: C.fonce, margin: 0 }}>Annuaire</h1>
        {peutEditer && (
          <button onClick={nouveau} style={{ padding: '10px 18px', background: C.bleu, color: 'white', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            + Ajouter
          </button>
        )}
      </div>
      <p style={{ color: C.gris, fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>Institutions, médecins, infirmiers, bénéficiaires et leurs accompagnants.</p>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setFiltreBenef('') }}
            style={{ padding: '8px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: tab === t.id ? C.fonce2 : '#F0F4F5', color: tab === t.id ? 'white' : '#5A6A6E' }}>
            {t.label}{t.sensible ? ' 🔒' : ''}
          </button>
        ))}
      </div>

      {/* Bandeau secret médical */}
      {TABS.find(t => t.id === tab)?.sensible && (
        <div style={{ background: C.roseBg, border: '1px solid rgba(200,67,90,.2)', color: C.rose, borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>
          🔒 Données soumises au secret médical — accès réservé aux fonctions médicales.
        </div>
      )}

      {/* Filtre par bénéficiaire (onglet accompagnants) */}
      {tab === 'accompagnant' && (
        <div style={{ marginBottom: 12 }}>
          <select value={filtreBenef} onChange={e => setFiltreBenef(e.target.value)} style={inp}>
            <option value="">Tous les bénéficiaires</option>
            {beneficiaires.map(b => <option key={b.id} value={b.id}>{nomDe(b)}</option>)}
          </select>
        </div>
      )}

      {/* Recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ ...inp, marginBottom: 16 }} />

      {/* Liste */}
      {loading ? (
        <div style={{ color: C.gris, fontSize: 14 }}>Chargement…</div>
      ) : liste.length === 0 ? (
        <div style={{ color: C.gris2, fontSize: 14, padding: '20px 0' }}>Aucune entrée.</div>
      ) : tab === 'institutions' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {liste.map(i => (
            <Carte key={i.id} onEdit={peutEditer ? () => editer(i, 'institutions') : null} onDel={peutEditer ? () => supprimer(i, 'institutions') : null}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.texte }}>{i.nom}</div>
              {i.type && <Tag>{i.type}</Tag>}
              {i.adresse && <Ligne icon="📍">{i.adresse}</Ligne>}
              {i.telephone && <Ligne icon="📞"><a href={`tel:${i.telephone}`} style={lien}>{i.telephone}</a></Ligne>}
              {i.email && <Ligne icon="✉️"><a href={`mailto:${i.email}`} style={lien}>{i.email}</a></Ligne>}
              {i.note && <Note>{i.note}</Note>}
            </Carte>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {liste.map(c => (
            <Carte key={c.id} onEdit={peutEditer ? () => editer(c, tab) : null} onDel={peutEditer ? () => supprimer(c, tab) : null}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.texte }}>{nomDe(c)}</div>

              {tab === 'medecin' && c.specialite && <Tag>{c.specialite}</Tag>}
              {tab === 'medecin' && c.inami && <Ligne icon="🆔">INAMI {c.inami}</Ligne>}

              {tab === 'accompagnant' && (
                <div style={{ fontSize: 12.5, color: C.rose, fontWeight: 600, margin: '3px 0' }}>
                  {c.lien ? `${c.lien} · ` : ''}Accompagnant de {nomDe(ctById[c.beneficiaire_id])}
                </div>
              )}

              {tab === 'beneficiaire' && (
                <>
                  {c.date_naissance && <Ligne icon="🎂">{new Date(c.date_naissance).toLocaleDateString('fr-BE')}</Ligne>}
                  {c.adresse && <Ligne icon="📍">{c.adresse}</Ligne>}
                  {c.institution_id && <Ligne icon="🏥">{instById[c.institution_id]?.nom}</Ligne>}
                  {c.medecin_id && <Ligne icon="👨‍⚕️">Dr {nomDe(ctById[c.medecin_id])}</Ligne>}
                  {c.infirmier_id && <Ligne icon="💉">{nomDe(ctById[c.infirmier_id])}</Ligne>}
                  {c.pathologie && <Note>{c.pathologie}</Note>}
                </>
              )}

              {(tab === 'medecin' || tab === 'infirmier') && c.institution_id && <Ligne icon="🏥">{instById[c.institution_id]?.nom}</Ligne>}
              {c.telephone && <Ligne icon="📞"><a href={`tel:${c.telephone}`} style={lien}>{c.telephone}</a></Ligne>}
              {c.email && <Ligne icon="✉️"><a href={`mailto:${c.email}`} style={lien}>{c.email}</a></Ligne>}
              {c.note && <Note>{c.note}</Note>}

              {/* Accompagnants liés (sous un bénéficiaire) */}
              {tab === 'beneficiaire' && (() => {
                const accs = contacts.filter(a => a.beneficiaire_id === c.id)
                if (!accs.length) return <div style={{ fontSize: 11.5, color: C.gris2, marginTop: 6 }}>Aucun accompagnant.</div>
                return (
                  <div style={{ marginTop: 8, borderTop: '1px dashed ' + C.bord, paddingTop: 6 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.fonce2, marginBottom: 3 }}>Accompagnants ({accs.length})</div>
                    {accs.map(a => (
                      <div key={a.id} style={{ fontSize: 12, color: C.texte }}>• {nomDe(a)}{a.lien ? ` (${a.lien})` : ''}{a.telephone ? ` · ${a.telephone}` : ''}</div>
                    ))}
                  </div>
                )
              })()}
            </Carte>
          ))}
        </div>
      )}

      {modal && (
        <FormModal
          cat={modal.cat}
          data={modal.data}
          institutions={institutions}
          medecins={medecins}
          infirmiers={infirmiers}
          beneficiaires={beneficiaires}
          nomDe={nomDe}
          onClose={() => setModal(null)}
          onSave={sauver}
        />
      )}
    </div>
  )
}

// ── Modale de formulaire ──────────────────────────────────────────────────────
function FormModal({ cat, data, institutions, medecins, infirmiers, beneficiaires, nomDe, onClose, onSave }) {
  const [f, setF] = useState(data)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const titre = { institutions: 'Institution', medecin: 'Médecin', infirmier: 'Infirmier', beneficiaire: 'Bénéficiaire', accompagnant: 'Accompagnant' }[cat]

  const valide = cat === 'institutions' ? !!(f.nom || '').trim()
    : cat === 'accompagnant' ? !!f.beneficiaire_id && !!(f.prenom || f.nom || '').trim()
    : !!(f.nom || f.prenom || '').trim()

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,30,45,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 22, maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.fonce }}>{data.id ? 'Modifier' : 'Nouveau'} — {titre}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, color: C.gris, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {cat === 'institutions' && (
          <>
            <Champ label="Nom *"><input value={f.nom || ''} onChange={e => set('nom', e.target.value)} style={inp} /></Champ>
            <Champ label="Type"><select value={f.type || ''} onChange={e => set('type', e.target.value)} style={inp}><option value="">—</option>{TYPES_INSTIT.map(t => <option key={t}>{t}</option>)}</select></Champ>
            <Champ label="Adresse"><input value={f.adresse || ''} onChange={e => set('adresse', e.target.value)} style={inp} /></Champ>
            <Deux>
              <Champ label="Téléphone"><input value={f.telephone || ''} onChange={e => set('telephone', e.target.value)} style={inp} /></Champ>
              <Champ label="Email"><input value={f.email || ''} onChange={e => set('email', e.target.value)} style={inp} /></Champ>
            </Deux>
            <Champ label="Note"><textarea rows={2} value={f.note || ''} onChange={e => set('note', e.target.value)} style={{ ...inp, resize: 'vertical' }} /></Champ>
          </>
        )}

        {(cat === 'medecin' || cat === 'infirmier') && (
          <>
            <Deux>
              <Champ label="Prénom"><input value={f.prenom || ''} onChange={e => set('prenom', e.target.value)} style={inp} /></Champ>
              <Champ label="Nom *"><input value={f.nom || ''} onChange={e => set('nom', e.target.value)} style={inp} /></Champ>
            </Deux>
            {cat === 'medecin' && (
              <Deux>
                <Champ label="Spécialité"><input value={f.specialite || ''} onChange={e => set('specialite', e.target.value)} style={inp} /></Champ>
                <Champ label="N° INAMI"><input value={f.inami || ''} onChange={e => set('inami', e.target.value)} style={inp} /></Champ>
              </Deux>
            )}
            <Champ label="Institution"><SelectInstit value={f.institution_id} onChange={v => set('institution_id', v)} institutions={institutions} /></Champ>
            <Deux>
              <Champ label="Téléphone"><input value={f.telephone || ''} onChange={e => set('telephone', e.target.value)} style={inp} /></Champ>
              <Champ label="Email"><input value={f.email || ''} onChange={e => set('email', e.target.value)} style={inp} /></Champ>
            </Deux>
            <Champ label="Note"><textarea rows={2} value={f.note || ''} onChange={e => set('note', e.target.value)} style={{ ...inp, resize: 'vertical' }} /></Champ>
          </>
        )}

        {cat === 'beneficiaire' && (
          <>
            <Deux>
              <Champ label="Prénom *"><input value={f.prenom || ''} onChange={e => set('prenom', e.target.value)} style={inp} /></Champ>
              <Champ label="Nom *"><input value={f.nom || ''} onChange={e => set('nom', e.target.value)} style={inp} /></Champ>
            </Deux>
            <Deux>
              <Champ label="Date de naissance"><input type="date" value={f.date_naissance || ''} onChange={e => set('date_naissance', e.target.value)} style={inp} /></Champ>
              <Champ label="Téléphone"><input value={f.telephone || ''} onChange={e => set('telephone', e.target.value)} style={inp} /></Champ>
            </Deux>
            <Champ label="Adresse / lieu de vie"><input value={f.adresse || ''} onChange={e => set('adresse', e.target.value)} style={inp} /></Champ>
            <Champ label="Institution (lieu de vie)"><SelectInstit value={f.institution_id} onChange={v => set('institution_id', v)} institutions={institutions} /></Champ>
            <Deux>
              <Champ label="Médecin traitant"><SelectContact value={f.medecin_id} onChange={v => set('medecin_id', v)} liste={medecins} nomDe={nomDe} vide="Aucun" /></Champ>
              <Champ label="Infirmier"><SelectContact value={f.infirmier_id} onChange={v => set('infirmier_id', v)} liste={infirmiers} nomDe={nomDe} vide="Aucun" /></Champ>
            </Deux>
            <Champ label="Pathologie / éléments médicaux"><textarea rows={2} value={f.pathologie || ''} onChange={e => set('pathologie', e.target.value)} style={{ ...inp, resize: 'vertical' }} /></Champ>
            <Champ label="Note"><textarea rows={2} value={f.note || ''} onChange={e => set('note', e.target.value)} style={{ ...inp, resize: 'vertical' }} /></Champ>
          </>
        )}

        {cat === 'accompagnant' && (
          <>
            <Champ label="Bénéficiaire accompagné *">
              <SelectContact value={f.beneficiaire_id} onChange={v => set('beneficiaire_id', v)} liste={beneficiaires} nomDe={nomDe} vide="— Choisir —" />
            </Champ>
            <Deux>
              <Champ label="Prénom"><input value={f.prenom || ''} onChange={e => set('prenom', e.target.value)} style={inp} /></Champ>
              <Champ label="Nom"><input value={f.nom || ''} onChange={e => set('nom', e.target.value)} style={inp} /></Champ>
            </Deux>
            <Champ label="Lien avec le bénéficiaire"><input value={f.lien || ''} onChange={e => set('lien', e.target.value)} style={inp} placeholder="Fils, épouse, ami, tuteur…" /></Champ>
            <Deux>
              <Champ label="Téléphone"><input value={f.telephone || ''} onChange={e => set('telephone', e.target.value)} style={inp} /></Champ>
              <Champ label="Email"><input value={f.email || ''} onChange={e => set('email', e.target.value)} style={inp} /></Champ>
            </Deux>
            <Champ label="Note"><textarea rows={2} value={f.note || ''} onChange={e => set('note', e.target.value)} style={{ ...inp, resize: 'vertical' }} /></Champ>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', background: 'none', border: '1px solid rgba(0,0,0,.15)', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Annuler</button>
          <button onClick={() => onSave(cat, f)} disabled={!valide} style={{ padding: '9px 20px', background: C.bleu, color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: valide ? 'pointer' : 'not-allowed', opacity: valide ? 1 : .5, fontFamily: "'DM Sans',sans-serif" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

// ── Petits composants ─────────────────────────────────────────────────────────
function Carte({ children, onEdit, onDel }) {
  return (
    <div style={{ background: 'white', border: '1px solid ' + C.bord, borderRadius: 12, padding: '13px 15px', position: 'relative' }}>
      {(onEdit || onDel) && (
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 5 }}>
          {onEdit && <button onClick={onEdit} title="Modifier" style={miniBtn}>✏️</button>}
          {onDel && <button onClick={onDel} title="Supprimer" style={{ ...miniBtn, color: C.rose }}>🗑️</button>}
        </div>
      )}
      {children}
    </div>
  )
}
function Ligne({ icon, children }) { return <div style={{ fontSize: 12.5, color: C.texte, marginTop: 3, display: 'flex', gap: 6 }}><span style={{ opacity: .8 }}>{icon}</span><span>{children}</span></div> }
function Tag({ children }) { return <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 600, color: C.fonce2, background: C.clair, borderRadius: 6, padding: '2px 8px', marginTop: 4 }}>{children}</span> }
function Note({ children }) { return <div style={{ fontSize: 12, color: C.gris, marginTop: 6, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{children}</div> }
function Champ({ label, children }) { return <div style={{ marginBottom: 10 }}><label style={{ fontSize: 12.5, fontWeight: 600, color: C.fonce2, display: 'block', marginBottom: 4 }}>{label}</label>{children}</div> }
function Deux({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div> }
function SelectInstit({ value, onChange, institutions }) {
  return <select value={value || ''} onChange={e => onChange(e.target.value)} style={inp}><option value="">— Aucune —</option>{institutions.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}</select>
}
function SelectContact({ value, onChange, liste, nomDe, vide }) {
  return <select value={value || ''} onChange={e => onChange(e.target.value)} style={inp}><option value="">{vide || '—'}</option>{liste.map(c => <option key={c.id} value={c.id}>{nomDe(c)}</option>)}</select>
}

const inp = { width: '100%', padding: '9px 11px', border: '1px solid rgba(0,0,0,.14)', borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box', background: 'white' }
const lien = { color: '#0E7A93', textDecoration: 'none' }
const miniBtn = { background: '#F0F4F5', border: 'none', borderRadius: 6, padding: '3px 7px', fontSize: 12, cursor: 'pointer' }