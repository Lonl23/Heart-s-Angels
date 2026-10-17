import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, F, TA, Sel, PhoneF, AddressFields, Modal, phoneValide, LiensGps } from '@/components/ui'
import { STATUTS, PIPELINE_ENCODE, statutsDisponibles, peutPasserNonRealise } from './statuts'
import { GenrePicker, NissF } from '@/modules/annuaire/genre'
import {
  upsertBeneficiaire, upsertContactRattache, upsertInstitution,
  listerBeneficiaires, listerContacts, listerPartenairesExternes,
  ficheVersBeneficiaire, ficheVersContact, assurerPartenaireDepuisAnnuaire,
} from '@/modules/annuaire/annuaireApi'
import { formaterNiss, normaliserNiss } from '@/modules/annuaire/annuaireSchema'
import { periodesDepuisSouhait, normaliserPeriodes, plageGlobale } from './datesSouhait'

const sliceDate = v => (v ? String(v).slice(0, 10) : '')

function etatVide() {
  return {
    beneficiaire_prenom: '', beneficiaire_nom: '', beneficiaire_ddn: '', beneficiaire_contact: '',
    beneficiaire_niss: '', beneficiaire_genre: '', beneficiaire_tel_gsm: '', beneficiaire_tel_fixe: '',
    beneficiaire_adresse: null, beneficiaire_adresse_residence: null, beneficiaire_email: '', beneficiaire_annuaire_id: null,
    contacts: [],
    contact_prenom: '', contact_nom: '', contact_lien: '', contact_ddn: '',
    contact_niss: '', contact_tel_gsm: '', contact_tel_fixe: '', contact_adresse: null,
    contact_annuaire_id: null,
    origine: 'prive', partenaire_id: null, annuaire_externe_id: null, partenaire_nom: '',
    description: '', localisation: '', notes_medicales: '', besoins_specifiques: '',
    date_souhaitee: '', date_fin: '', dates_possibles: [{ debut: '', fin: '' }],
    courte_duree: false, heure_depart: '', heure_retour: '',
    statut: 'nouveau', priorite: 2,
  }
}

function depuisSouhait(s) {
  if (!s) return etatVide()
  return {
    ...etatVide(),
    ...s,
    origine: s.origine === 'institution' ? 'institution' : 'prive',
    partenaire_id: s.partenaire_id || null,
    annuaire_externe_id: s.annuaire_externe_id || null,
    contact_annuaire_id: s.contact_annuaire_id || null,
    beneficiaire_ddn: sliceDate(s.beneficiaire_ddn),
    beneficiaire_niss: formaterNiss(s.beneficiaire_niss || ''),
    beneficiaire_genre: s.beneficiaire_genre || '',
    beneficiaire_tel_gsm: s.beneficiaire_tel_gsm || '',
    beneficiaire_tel_fixe: s.beneficiaire_tel_fixe || '',
    beneficiaire_adresse: s.beneficiaire_adresse || null,
    beneficiaire_adresse_residence: s.beneficiaire_adresse_residence || null,
    beneficiaire_email: s.beneficiaire_email || '',
    contacts: contactsDepuis(s),
    date_souhaitee: sliceDate(s.date_souhaitee),
    date_fin: sliceDate(s.date_fin),
    dates_possibles: periodesDepuisSouhait(s),
  }
}

function nomComplet(prenom, nom) {
  return [prenom, nom].filter(Boolean).join(' ').trim()
}

function rattacherIds(s, { annuaireId, contactId, contactsMaj }) {
  let changed = !!(annuaireId && annuaireId !== s.beneficiaire_annuaire_id)
    || !!(contactId && contactId !== s.contact_annuaire_id)
  const contacts = (s.contacts || []).map(c => {
    const maj = (contactsMaj || []).find(x => x.id && x.id === c.id)
    if (maj?.annuaire_id && maj.annuaire_id !== c.annuaire_id) {
      changed = true
      return { ...c, annuaire_id: maj.annuaire_id }
    }
    return c
  })
  if (!changed) return s
  return {
    ...s,
    beneficiaire_annuaire_id: annuaireId || s.beneficiaire_annuaire_id,
    contact_annuaire_id: contactId || s.contact_annuaire_id,
    contacts,
  }
}

function contactsDepuis(s) {
  if (Array.isArray(s?.contacts) && s.contacts.length) return s.contacts
  if (s?.contact_prenom || s?.contact_nom || s?.contact_email) {
    return [{
      id: s.contact_annuaire_id || 'legacy',
      type: 'famille',
      annuaire_id: s.contact_annuaire_id || null,
      prenom: s.contact_prenom || '',
      nom: s.contact_nom || '',
      lien: s.contact_lien || '',
      email: s.contact_email || '',
      tel_gsm: s.contact_tel_gsm || '',
      tel_fixe: s.contact_tel_fixe || '',
      adresse: s.contact_adresse || null,
    }]
  }
  return []
}

function avecOrdre(rows) {
  return rows.map((r, i) => ({ ...r, priorite: i + 1, _k: r._k || (crypto.randomUUID ? crypto.randomUUID() : `d${i}-${r.debut}`) }))
}

function DatesPossibles({ value, set }) {
  const rows = value?.length ? value : [{ debut: '', fin: '' }]
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const drag = useRef(null)
  const [plusieurs, setPlusieurs] = useState(() => rows.some(r => r.fin && r.debut && r.fin > r.debut))
  useEffect(() => {
    if ((value || []).some(r => r.fin && r.debut && r.fin > r.debut)) setPlusieurs(true)
  }, [value])

  function poser(next) {
    const ordered = avecOrdre(next.length ? next : [{ debut: '', fin: '' }])
    rowsRef.current = ordered
    set(ordered)
  }
  function maj(i, patch) {
    poser(rowsRef.current.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function deplacer(from, to) {
    const cur = rowsRef.current
    if (from === to || from == null || to == null || from < 0 || to < 0 || from >= cur.length || to >= cur.length) return
    const next = [...cur]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    drag.current = to
    poser(next)
  }
  function retirer(i) {
    poser(rowsRef.current.filter((_, j) => j !== i))
  }
  function basculerPlusieurs(on) {
    setPlusieurs(on)
    if (!on) poser(rowsRef.current.map(r => ({ ...r, fin: r.debut || '' })))
  }
  function pointerDown(e, i) {
    if (e.button != null && e.button !== 0) return
    drag.current = i
    const move = ev => {
      if (drag.current == null) return
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const row = el?.closest?.('[data-date-idx]')
      if (!row) return
      deplacer(drag.current, Number(row.dataset.dateIdx))
    }
    const up = () => {
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label className="ha-check" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={plusieurs} onChange={e => basculerPlusieurs(e.target.checked)} />
        <span>Plusieurs jours</span>
      </label>
      {rows.map((r, i) => (
        <div key={r._k || i} className="ha-date-periode" data-date-idx={i}>
          {rows.length > 1 && (
            <button
              type="button"
              className="ha-date-handle"
              aria-label={`Déplacer la date ${i + 1}`}
              onPointerDown={e => pointerDown(e, i)}
            >⋮⋮</button>
          )}
          {plusieurs ? (
            <>
              <div className="ha-date-champ"><F label="Du" type="date" value={r.debut} set={v => maj(i, { debut: v, fin: (!r.fin || r.fin < v) ? v : r.fin })} /></div>
              <div className="ha-date-champ"><F label="Au" type="date" value={r.fin || r.debut} set={v => maj(i, { fin: (r.debut && v && v < r.debut) ? r.debut : v })} /></div>
            </>
          ) : (
            <div className="ha-date-champ"><F label="Date" type="date" value={r.debut} set={v => maj(i, { debut: v, fin: v })} /></div>
          )}
          {rows.length > 1 && (
            <button type="button" className="ha-date-periode-del" onClick={() => retirer(i)}>Retirer</button>
          )}
        </div>
      ))}
      <Btn kind="soft" onClick={() => poser([...rowsRef.current, { debut: '', fin: '' }])}>+ Date</Btn>
    </div>
  )
}

export default function FormSouhait({ initial, onDone, onPatch, inline = false }) {
  const { profile } = useAuth()
  const [f, setF] = useState(() => depuisSouhait(initial))
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const [saving, setSaving] = useState(false)
  const [popup, setPopup] = useState(null)
  const [contactEdit, setContactEdit] = useState(null)
  const pret = useRef(false)
  const saveRef = useRef(null)
  const chaine = useRef(Promise.resolve())
  const dernierDates = useRef('')

  useEffect(() => {
    const ext = initial?.annuaire_externe_id
    const pid = initial?.partenaire_id
    if (!ext && !pid) return
    ;(async () => {
      if (ext) {
        const { data } = await supabase.from('annuaire').select('id,nom,partenaire_id').eq('id', ext).maybeSingle()
        if (data) setF(s => ({ ...s, partenaire_nom: data.nom, partenaire_id: s.partenaire_id || data.partenaire_id }))
        return
      }
      const { data } = await supabase.from('partenaires').select('id,nom').eq('id', pid).maybeSingle()
      if (data) setF(s => ({ ...s, partenaire_nom: data.nom }))
    })()
  }, [initial?.annuaire_externe_id, initial?.partenaire_id])

  useEffect(() => {
    if (initial?.contact_annuaire_id) {
      supabase.from('annuaire').select('*').eq('id', initial.contact_annuaire_id).maybeSingle()
        .then(({ data: c }) => { if (c) appliquerContact(ficheVersContact(c), false) })
      return
    }
    if (!initial?.beneficiaire_annuaire_id || initial?.contact_prenom) return
    supabase.from('annuaire').select('*').eq('categorie', 'accompagnant')
      .eq('beneficiaire_id', initial.beneficiaire_annuaire_id).order('created_at').limit(1)
      .then(({ data }) => { if (data?.[0]) appliquerContact(ficheVersContact(data[0]), false) })
  }, [initial?.beneficiaire_annuaire_id, initial?.contact_annuaire_id])

  function appliquerBeneficiaire(b) {
    setF(s => ({
      ...s,
      beneficiaire_annuaire_id: b.id || null,
      beneficiaire_prenom: b.prenom || '',
      beneficiaire_nom: b.nom || '',
      beneficiaire_ddn: sliceDate(b.date_naissance || b.beneficiaire_ddn),
      beneficiaire_niss: formaterNiss(b.niss || ''),
      beneficiaire_genre: b.genre || '',
      beneficiaire_tel_gsm: b.tel_gsm || '',
      beneficiaire_tel_fixe: b.tel_fixe || '',
      beneficiaire_adresse: b.adresse || null,
      beneficiaire_adresse_residence: b.adresse_residence || null,
      beneficiaire_email: b.email || '',
    }))
  }

  function appliquerContact(c, resetIfEmpty = true) {
    setF(s => ({
      ...s,
      contact_annuaire_id: c?.id || null,
      contact_prenom: c?.prenom || '',
      contact_nom: c?.nom || '',
      contact_lien: c?.lien || '',
      contact_ddn: sliceDate(c?.date_naissance || c?.contact_ddn),
      contact_niss: formaterNiss(c?.niss || ''),
      contact_tel_gsm: c?.tel_gsm || '',
      contact_tel_fixe: c?.tel_fixe || '',
      contact_adresse: c?.adresse || null,
      beneficiaire_contact: nomComplet(c?.prenom, c?.nom) || (resetIfEmpty ? '' : s.beneficiaire_contact),
    }))
  }

  function checkPhones(silencieux) {
    const champs = [
      f.beneficiaire_tel_gsm, f.beneficiaire_tel_fixe,
      ...(f.contacts || []).flatMap(c => [c.tel_gsm, c.tel_fixe]),
    ]
    if (champs.some(x => x && !phoneValide(x))) {
      if (!silencieux) alert('Les numéros de téléphone doivent être au format +32 xxx.xx.xx.xx (GSM) ou +32 xx.xx.xx.xx (fixe).')
      return false
    }
    return true
  }

  async function save({ silencieux } = {}) {
    if (!f.beneficiaire_nom || !f.beneficiaire_prenom) return
    if (!silencieux && !f.description) { alert('Nom du bénéficiaire et description requis.'); return }
    if (!silencieux && f.origine === 'institution' && !f.annuaire_externe_id && !f.partenaire_id) {
      alert('Choisissez l’institution qui demande ce souhait.')
      return
    }
    if (!checkPhones(silencieux)) return
    const statut = inline
      ? undefined
      : (f.statut === 'non_realise' && initial?.id && !peutPasserNonRealise(initial.statut, initial))
        ? initial.statut
        : f.statut
    setSaving(true)
    let annuaireId = f.beneficiaire_annuaire_id || null
    let contactId = f.contact_annuaire_id || null
    let partenaireId = f.partenaire_id || null
    let contactsMaj = []
    try {
      annuaireId = await upsertBeneficiaire({
        id: f.beneficiaire_annuaire_id || undefined,
        nom: f.beneficiaire_nom,
        prenom: f.beneficiaire_prenom,
        date_naissance: f.beneficiaire_ddn,
        niss: f.beneficiaire_niss,
        tel_gsm: f.beneficiaire_tel_gsm,
        tel_fixe: f.beneficiaire_tel_fixe,
        genre: f.beneficiaire_genre,
        adresse: f.beneficiaire_adresse,
        adresse_residence: f.beneficiaire_adresse_residence,
        email: f.beneficiaire_email,
      }, { created_by: profile?.id }) || annuaireId
      for (const c of f.contacts || []) {
        if (!(c.prenom || c.nom)) { contactsMaj.push(c); continue }
        const cid = annuaireId
          ? await upsertContactRattache(annuaireId, {
            id: c.annuaire_id || undefined,
            prenom: c.prenom, nom: c.nom, lien: c.lien, email: c.email,
            date_naissance: c.date_naissance, niss: c.niss,
            tel_gsm: c.tel_gsm, tel_fixe: c.tel_fixe,
            adresse: c.adresse, adresse_residence: c.adresse_residence,
          }, { created_by: profile?.id })
          : c.annuaire_id
        contactsMaj.push({ ...c, annuaire_id: cid || c.annuaire_id || null })
      }
      if (contactsMaj.length) {
        const fam = contactsMaj.find(c => c.type === 'famille') || contactsMaj[0]
        contactId = fam?.annuaire_id || null
      }
      if (f.origine === 'institution' && f.annuaire_externe_id && !partenaireId) {
        const { data: fiche } = await supabase.from('annuaire').select('*').eq('id', f.annuaire_externe_id).maybeSingle()
        if (fiche) partenaireId = await assurerPartenaireDepuisAnnuaire(fiche)
      }
    } catch (e) {
      setSaving(false)
      alert('Annuaire : ' + (e.message || e))
      return
    }
    const contactsEnreg = contactsMaj.length ? contactsMaj : (f.contacts || [])
    const fam = contactsEnreg.find(c => c.type === 'famille') || contactsEnreg[0] || {}
    const contactLib = nomComplet(fam.prenom, fam.nom)
    const periodes = normaliserPeriodes(f.dates_possibles)
    dernierDates.current = JSON.stringify(periodes)
    const plage = plageGlobale(periodes)
    const payload = {
      beneficiaire_prenom: f.beneficiaire_prenom,
      beneficiaire_nom: f.beneficiaire_nom,
      beneficiaire_ddn: f.beneficiaire_ddn || null,
      beneficiaire_contact: contactLib || f.beneficiaire_contact || null,
      beneficiaire_annuaire_id: annuaireId,
      contact_annuaire_id: contactId,
      contacts: contactsEnreg,
      contact_email: fam.email || null,
      beneficiaire_niss: normaliserNiss(f.beneficiaire_niss) || null,
      beneficiaire_genre: f.beneficiaire_genre || null,
      beneficiaire_tel_gsm: f.beneficiaire_tel_gsm || null,
      beneficiaire_tel_fixe: f.beneficiaire_tel_fixe || null,
      beneficiaire_email: f.beneficiaire_email || null,
      beneficiaire_adresse: f.beneficiaire_adresse || null,
      beneficiaire_adresse_residence: f.beneficiaire_adresse_residence || null,
      origine: f.origine === 'institution' ? 'institution' : 'prive',
      partenaire_id: f.origine === 'institution' ? (partenaireId || null) : null,
      annuaire_externe_id: f.origine === 'institution' ? (f.annuaire_externe_id || null) : null,
      description: f.description || 'Souhait',
      localisation: f.localisation || null,
      notes_medicales: f.notes_medicales || null,
      besoins_specifiques: f.besoins_specifiques || null,
      date_souhaitee: plage.date_souhaitee,
      date_fin: plage.date_fin,
      dates_possibles: periodes,
      courte_duree: !!f.courte_duree,
      heure_depart: f.courte_duree && f.heure_depart ? f.heure_depart : null,
      heure_retour: f.courte_duree && f.heure_retour ? f.heure_retour : null,
      priorite: Number(f.priorite) || 2,
    }
    if (statut !== undefined) payload.statut = statut
    if (f.id) {
      const { error } = await supabase.from('souhaits').update(payload).eq('id', f.id)
      setSaving(false)
      if (error) { if (!silencieux) alert('Erreur : ' + error.message); return }
      setF(s => rattacherIds(s, { annuaireId, contactId, contactsMaj }))
      onPatch?.({ ...payload, id: f.id })
      if (!silencieux) onDone?.(f.id)
      return
    }
    const { data, error } = await supabase.from('souhaits').insert({ ...payload, created_by: profile?.id }).select('id').single()
    setSaving(false)
    if (error) { if (!silencieux) alert('Erreur : ' + error.message); return }
    if (data?.id) {
      setF(s => ({ ...rattacherIds(s, { annuaireId, contactId, contactsMaj }), id: data.id }))
      onPatch?.({ ...payload, id: data.id })
      onDone?.(data.id)
    }
  }
  saveRef.current = save

  useEffect(() => {
    if (!pret.current) { pret.current = true; return }
    const t = setTimeout(() => {
      chaine.current = chaine.current
        .then(() => saveRef.current?.({ silencieux: true }))
        .catch(() => {})
    }, 900)
    return () => clearTimeout(t)
  }, [f])

  const datesCle = JSON.stringify(initial?.dates_possibles || [])
  useEffect(() => {
    if (!initial?.id) return
    const incoming = JSON.stringify(periodesDepuisSouhait(initial))
    setF(s => {
      const local = JSON.stringify(normaliserPeriodes(s.dates_possibles))
      if (dernierDates.current && incoming === dernierDates.current && local !== incoming) return s
      return {
        ...s,
        dates_possibles: periodesDepuisSouhait(initial),
        date_souhaitee: sliceDate(initial.date_souhaitee),
        date_fin: sliceDate(initial.date_fin),
      }
    })
  }, [datesCle])

  const benNom = nomComplet(f.beneficiaire_prenom, f.beneficiaire_nom)
  const ctcNom = nomComplet(f.contact_prenom, f.contact_nom)

  const Wrap = 'div'
  return (
    <Wrap style={inline ? {} : { padding: 'clamp(16px,3vw,28px)', maxWidth: 760, margin: '0 auto' }}>
      {!inline && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--heading)', margin: 0 }}>{f.id ? 'Modifier le souhait' : 'Nouveau souhait'}</h1>
          </div>
          <Btn kind="soft" onClick={() => onDone(false)}>← Retour</Btn>
        </div>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 8 }}>Origine de la demande</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            { v: 'prive', l: 'Demande privée' },
            { v: 'institution', l: 'Demandé par une institution' },
          ].map(o => (
            <button
              key={o.v}
              type="button"
              className={'ha-tab-like' + (f.origine === o.v ? ' is-on' : '')}
              onClick={() => setF(s => ({
                ...s,
                origine: o.v,
                ...(o.v === 'prive' ? { partenaire_id: null, annuaire_externe_id: null, partenaire_nom: '' } : {}),
              }))}
            >{o.l}</button>
          ))}
        </div>
        {f.origine === 'institution' && (
          <>
            {(f.partenaire_nom || f.annuaire_externe_id) && (
              <div className="ha-chip-sum" style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>{f.partenaire_nom || 'Institution liée'}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn kind="soft" onClick={() => setPopup('pick-inst')}>Choisir une institution</Btn>
              <Btn kind="soft" onClick={() => setPopup('new-inst')}>Ajouter une institution</Btn>
            </div>
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 8 }}>Bénéficiaire</div>
        {benNom ? (
          <div className="ha-chip-sum" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>{benNom}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {[f.beneficiaire_ddn && new Date(f.beneficiaire_ddn).toLocaleDateString('fr-BE'), f.beneficiaire_tel_gsm || f.beneficiaire_tel_fixe].filter(Boolean).join(' · ') || 'Fiche enregistrée dans l’annuaire'}
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn kind="soft" onClick={() => setPopup('pick-ben')}>Reprendre un bénéficiaire connu</Btn>
          <Btn onClick={() => setPopup('new-ben')}>{benNom ? 'Compléter la fiche' : 'Ajouter un nouveau bénéficiaire'}</Btn>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 8 }}>Contacts</div>
        {(f.contacts || []).map(c => (
          <div key={c.id} className="ha-chip-sum" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>{nomComplet(c.prenom, c.nom) || 'Contact'} · {c.type === 'demandeur' ? 'Demandeur' : c.type === 'reference' ? 'Référence' : 'Famille'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{[c.lien, c.tel_gsm || c.tel_fixe, c.email].filter(Boolean).join(' · ')}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <Btn kind="soft" onClick={() => { setContactEdit(c); setPopup('new-ctc') }} style={{ padding: '4px 8px' }}>Modifier</Btn>
              <Btn kind="danger" onClick={() => set('contacts', (f.contacts || []).filter(x => x.id !== c.id))} style={{ padding: '4px 8px' }}>Retirer</Btn>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn kind="soft" onClick={() => { setContactEdit({ id: crypto.randomUUID(), type: 'famille' }); setPopup('new-ctc') }}>Famille</Btn>
          <Btn kind="soft" onClick={() => { setContactEdit({ id: crypto.randomUUID(), type: 'demandeur' }); setPopup('new-ctc') }}>Demandeur</Btn>
          <Btn kind="soft" onClick={() => { setContactEdit({ id: crypto.randomUUID(), type: 'reference' }); setPopup('new-ctc') }}>Référence</Btn>
          <Btn kind="soft" onClick={() => setPopup('pick-ctc')} disabled={!f.beneficiaire_annuaire_id && !benNom}>Connu</Btn>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Le souhait</div>
        <TA label="Description *" value={f.description} set={v => set('description', v)} rows={3} />
        <F label="Lieu (affiché au calendrier, sans nom de patient)" value={f.localisation} set={v => set('localisation', v)} />
        {f.localisation && <div style={{ margin: '-4px 0 10px' }}><LiensGps texte={f.localisation} /></div>}
        <DatesPossibles value={f.dates_possibles} set={v => set('dates_possibles', v)} />
        <label className="ha-check" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={!!f.courte_duree} onChange={e => set('courte_duree', e.target.checked)} />
          <span>Souhait de courte durée (sinon toute la journée, minuit à minuit)</span>
        </label>
        {!!f.courte_duree && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
            <F label="Heure de départ" type="time" value={(f.heure_depart || '').slice(0, 5)} set={v => set('heure_depart', v)} />
            <F label="Heure de retour" type="time" value={(f.heure_retour || '').slice(0, 5)} set={v => set('heure_retour', v)} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
          {!inline && !f.id && <Sel label="Statut" value={f.statut} set={v => set('statut', v)} options={PIPELINE_ENCODE.map(k => ({ v: k, l: STATUTS[k].l }))} />}
          {!inline && f.id && <Sel label="Statut" value={f.statut} set={v => set('statut', v)} options={statutsDisponibles(initial?.statut || f.statut, initial || f).map(k => ({ v: k, l: STATUTS[k].l }))} />}
          <Sel label="Priorité" value={String(f.priorite)} set={v => set('priorite', v)} options={[
            { v: '1', l: '1 · Basse' }, { v: '2', l: '2 · Normale' }, { v: '3', l: '3 · Haute' }, { v: '4', l: '4 · Urgente' }, { v: '5', l: '5 · Critique' },
          ]} />
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Médical & besoins</div>
        <TA label="Notes médicales (confidentiel)" value={f.notes_medicales} set={v => set('notes_medicales', v)} rows={2} />
        <TA label="Besoins spécifiques (matériel, logistique…)" value={f.besoins_specifiques} set={v => set('besoins_specifiques', v)} rows={2} />
      </Card>

      <div style={{ fontSize: 12, color: saving ? 'var(--text-muted)' : '#3B6D11' }}>{saving ? 'Enregistrement…' : 'Enregistrement automatique'}</div>

      {popup === 'pick-ben' && (
        <PickerList
          title="Bénéficiaire connu"
          load={listerBeneficiaires}
          label={r => nomComplet(r.prenom, r.nom) || '(sans nom)'}
          hint={r => [r.date_naissance && new Date(r.date_naissance).toLocaleDateString('fr-BE'), r.tel_gsm || r.tel_fixe].filter(Boolean).join(' · ')}
          onPick={r => { appliquerBeneficiaire(ficheVersBeneficiaire(r)); setPopup(null) }}
          onClose={() => setPopup(null)}
        />
      )}
      {popup === 'new-ben' && (
        <PopupBeneficiaire
          initial={{
            id: f.beneficiaire_annuaire_id, prenom: f.beneficiaire_prenom, nom: f.beneficiaire_nom,
            date_naissance: f.beneficiaire_ddn, niss: f.beneficiaire_niss, genre: f.beneficiaire_genre,
            tel_gsm: f.beneficiaire_tel_gsm, tel_fixe: f.beneficiaire_tel_fixe, email: f.beneficiaire_email,
            adresse: f.beneficiaire_adresse, adresse_residence: f.beneficiaire_adresse_residence,
          }}
          onClose={() => setPopup(null)}
          onSave={b => { appliquerBeneficiaire(b); setPopup(null) }}
        />
      )}
      {popup === 'pick-ctc' && (
        <PickerList
          title="Contact connu"
          load={() => listerContacts(f.beneficiaire_annuaire_id)}
          empty="Aucun contact rattaché à ce bénéficiaire pour l’instant."
          label={r => nomComplet(r.prenom, r.nom) || '(sans nom)'}
          hint={r => [r.lien || r.data?.lien, r.tel_gsm || r.tel_fixe || r.telephone].filter(Boolean).join(' · ')}
          onPick={r => {
            const c = ficheVersContact(r)
            const row = { id: c.id || crypto.randomUUID(), type: 'famille', annuaire_id: c.id, ...c }
            set('contacts', [...(f.contacts || []).filter(x => x.annuaire_id !== c.id), row])
            setPopup(null)
          }}
          onClose={() => setPopup(null)}
        />
      )}
      {popup === 'new-ctc' && (
        <PopupContact
          initial={contactEdit || {}}
          onClose={() => { setPopup(null); setContactEdit(null) }}
          onSave={c => {
            const id = c.id || contactEdit?.id || crypto.randomUUID()
            const row = { type: contactEdit?.type || 'famille', ...c, id }
            const list = f.contacts || []
            set('contacts', list.some(x => x.id === id) ? list.map(x => x.id === id ? row : x) : [...list, row])
            setPopup(null)
            setContactEdit(null)
          }}
        />
      )}
      {popup === 'pick-inst' && (
        <PickerList
          title="Institution / partenaire"
          load={listerPartenairesExternes}
          label={r => r.nom}
          hint={r => [r.categorie === 'externe_souhait' ? 'Contact externe' : r.categorie === 'institution' ? 'Institution' : 'Partenaire', r.contact, r.tel].filter(Boolean).join(' · ')}
          onPick={async r => {
            setF(s => ({
              ...s,
              origine: 'institution',
              annuaire_externe_id: r.annuaire_id,
              partenaire_id: r.partenaire_id,
              partenaire_nom: r.nom,
            }))
            setPopup(null)
          }}
          onClose={() => setPopup(null)}
        />
      )}
      {popup === 'new-inst' && (
        <PopupInstitution
          createdBy={profile?.id}
          onClose={() => setPopup(null)}
          onSave={r => {
            setF(s => ({
              ...s,
              origine: 'institution',
              annuaire_externe_id: r.id,
              partenaire_id: r.partenaire_id,
              partenaire_nom: r.nom,
            }))
            setPopup(null)
          }}
        />
      )}
    </Wrap>
  )
}

function PickerList({ title, load, label, hint, onPick, onClose, empty }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)
  useEffect(() => {
    load().then(setRows).catch(e => setErr(e.message || String(e)))
  }, [])
  const filtered = rows.filter(r => !q || `${label(r)} ${hint?.(r) || ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal title={title} onClose={onClose}>
      <input className="ha-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" style={{ width: '100%', marginBottom: 10 }} />
      {err && <div style={{ color: '#C8435A', fontSize: 13, marginBottom: 8 }}>{err}</div>}
      {filtered.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{empty || 'Aucun résultat.'}</p>}
      {filtered.map(r => (
        <button key={r.key || r.id} type="button" className="ha-pick-row" onClick={() => onPick(r)}>
          <div style={{ fontWeight: 600 }}>{label(r)}</div>
          {hint?.(r) && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{hint(r)}</div>}
        </button>
      ))}
    </Modal>
  )
}

function PopupBeneficiaire({ initial, onSave, onClose }) {
  const [g, setG] = useState({ prenom: '', nom: '', date_naissance: '', niss: '', genre: '', tel_gsm: '', tel_fixe: '', email: '', adresse: null, adresse_residence: null, ...initial })
  const set = (k, v) => setG(s => ({ ...s, [k]: v }))
  function go() {
    if (!g.nom) { alert('Nom requis.'); return }
    if (![g.tel_gsm, g.tel_fixe].every(phoneValide)) { alert('Formats téléphone : +32 xxx.xx.xx.xx ou +32 xx.xx.xx.xx'); return }
    onSave(g)
  }
  return (
    <Modal title={g.id ? 'Fiche bénéficiaire' : 'Nouveau bénéficiaire'} onClose={onClose} footer={
      <><Btn onClick={go}>Enregistrer dans l’annuaire</Btn><Btn kind="soft" onClick={onClose}>Annuler</Btn></>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <F label="Prénom" value={g.prenom} set={v => set('prenom', v)} />
        <F label="Nom" value={g.nom} set={v => set('nom', v)} required />
      </div>
      <GenrePicker value={g.genre} set={v => set('genre', v)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <F label="Date de naissance" type="date" value={g.date_naissance} set={v => set('date_naissance', v)} />
        <NissF value={g.niss} set={v => set('niss', v)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <PhoneF label="GSM" value={g.tel_gsm} set={v => set('tel_gsm', v)} />
        <PhoneF label="Fixe" value={g.tel_fixe} set={v => set('tel_fixe', v)} />
      </div>
      <F label="E-mail" value={g.email || ''} set={v => set('email', v)} />
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse légale</div>
      <AddressFields value={g.adresse} set={v => set('adresse', v)} />
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse de résidence</div>
      <AddressFields value={g.adresse_residence} set={v => set('adresse_residence', v)} />
    </Modal>
  )
}

function PopupContact({ initial, onSave, onClose }) {
  const [g, setG] = useState({ prenom: '', nom: '', lien: '', type: 'famille', date_naissance: '', niss: '', tel_gsm: '', tel_fixe: '', email: '', adresse: null, adresse_residence: null, ...initial })
  const set = (k, v) => setG(s => ({ ...s, [k]: v }))
  function go() {
    if (!g.nom && !g.prenom) { alert('Nom ou prénom requis.'); return }
    if (![g.tel_gsm, g.tel_fixe].every(phoneValide)) { alert('Formats téléphone : +32 xxx.xx.xx.xx ou +32 xx.xx.xx.xx'); return }
    onSave(g)
  }
  return (
    <Modal title={g.id ? 'Contact rattaché' : 'Nouveau contact'} onClose={onClose} footer={
      <><Btn onClick={go}>Enregistrer dans l’annuaire</Btn><Btn kind="soft" onClick={onClose}>Annuler</Btn></>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <F label="Prénom" value={g.prenom} set={v => set('prenom', v)} />
        <F label="Nom" value={g.nom} set={v => set('nom', v)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <F label="Lien d'affiliation" value={g.lien} set={v => set('lien', v)} placeholder="conjoint, enfant, tuteur…" />
        <F label="Date de naissance" type="date" value={g.date_naissance} set={v => set('date_naissance', v)} />
      </div>
      <NissF value={g.niss} set={v => set('niss', v)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <PhoneF label="GSM" value={g.tel_gsm} set={v => set('tel_gsm', v)} />
        <PhoneF label="Fixe" value={g.tel_fixe} set={v => set('tel_fixe', v)} />
      </div>
      <F label="E-mail" value={g.email || ''} set={v => set('email', v)} />
      <Sel label="Rôle" value={g.type || 'famille'} set={v => set('type', v)} options={[
        { v: 'famille', l: 'Famille' }, { v: 'demandeur', l: 'Demandeur' }, { v: 'reference', l: 'Personne de référence' },
      ]} />
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse légale</div>
      <AddressFields value={g.adresse} set={v => set('adresse', v)} />
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse de résidence</div>
      <AddressFields value={g.adresse_residence} set={v => set('adresse_residence', v)} />
    </Modal>
  )
}

function PopupInstitution({ onSave, onClose, createdBy }) {
  const [g, setG] = useState({ nom: '', telephone: '', email: '', type_institution: '', adresse: null, contact_personne: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setG(s => ({ ...s, [k]: v }))
  async function go() {
    if (!g.nom) { alert('Nom requis.'); return }
    if (g.telephone && !phoneValide(g.telephone)) { alert('Numéro général : +32 xxx.xx.xx.xx ou +32 xx.xx.xx.xx'); return }
    setBusy(true)
    try {
      const r = await upsertInstitution({ ...g, categorie: 'institution' }, { created_by: createdBy })
      onSave({ id: r.id, partenaire_id: r.partenaire_id, nom: g.nom })
    } catch (e) {
      alert(e.message || e)
    }
    setBusy(false)
  }
  return (
    <Modal title="Nouvelle institution" onClose={onClose} footer={
      <><Btn onClick={go} disabled={busy}>{busy ? '…' : 'Enregistrer dans l’annuaire'}</Btn><Btn kind="soft" onClick={onClose}>Annuler</Btn></>
    }>
      <F label="Nom" value={g.nom} set={v => set('nom', v)} required />
      <Sel label="Type" value={g.type_institution} set={v => set('type_institution', v)} options={['', 'Hôpital', 'MR / MRS', 'Clinique', 'Centre de soins', 'Domicile', 'Autre'].map(o => ({ v: o, l: o || '—' }))} />
      <PhoneF label="Numéro général" value={g.telephone} set={v => set('telephone', v)} placeholder="+32 81.62.72.38" />
      <F label="E-mail général" type="email" value={g.email} set={v => set('email', v)} />
      <F label="Personne de contact (facultatif)" value={g.contact_personne} set={v => set('contact_personne', v)} />
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse</div>
      <AddressFields value={g.adresse} set={v => set('adresse', v)} />
    </Modal>
  )
}
