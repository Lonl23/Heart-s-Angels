import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, F, TA, Sel, PhoneF, AddressFields } from '@/components/ui'
import { STATUTS, PIPELINE_ENCODE, statutsDisponibles, peutPasserNonRealise } from './Souhaits'
import { GenrePicker, NissF } from '@/modules/annuaire/genre'
import { upsertBeneficiaire, upsertContactRattache } from '@/modules/annuaire/annuaireApi'
import { formaterNiss, normaliserNiss } from '@/modules/annuaire/annuaireSchema'

const sliceDate = v => (v ? String(v).slice(0, 10) : '')

function etatVide() {
  return {
    beneficiaire_prenom: '', beneficiaire_nom: '', beneficiaire_ddn: '', beneficiaire_contact: '',
    beneficiaire_niss: '', beneficiaire_genre: '', beneficiaire_tel_gsm: '', beneficiaire_tel_fixe: '',
    beneficiaire_adresse: null, beneficiaire_annuaire_id: null,
    contact_prenom: '', contact_nom: '', contact_lien: '', contact_ddn: '',
    contact_niss: '', contact_tel_gsm: '', contact_tel_fixe: '', contact_adresse: null,
    description: '', localisation: '', notes_medicales: '', besoins_specifiques: '',
    date_souhaitee: '', date_fin: '', courte_duree: false, heure_depart: '', heure_retour: '',
    statut: 'nouveau', priorite: 2,
  }
}

function depuisSouhait(s) {
  if (!s) return etatVide()
  return {
    ...etatVide(),
    ...s,
    beneficiaire_ddn: sliceDate(s.beneficiaire_ddn),
    beneficiaire_niss: formaterNiss(s.beneficiaire_niss || ''),
    beneficiaire_genre: s.beneficiaire_genre || '',
    beneficiaire_tel_gsm: s.beneficiaire_tel_gsm || '',
    beneficiaire_tel_fixe: s.beneficiaire_tel_fixe || '',
    beneficiaire_adresse: s.beneficiaire_adresse || null,
    date_souhaitee: sliceDate(s.date_souhaitee),
    date_fin: sliceDate(s.date_fin),
  }
}

export default function FormSouhait({ initial, onDone, inline = false }) {
  const { profile } = useAuth()
  const [f, setF] = useState(() => depuisSouhait(initial))
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const id = initial?.beneficiaire_annuaire_id
    if (!id) return
    supabase.from('annuaire').select('*').eq('categorie', 'accompagnant').eq('beneficiaire_id', id).order('created_at').limit(1)
      .then(({ data }) => {
        const c = data?.[0]
        if (!c) return
        const d = c.data || {}
        setF(s => {
          if (s.contact_prenom || s.contact_nom) return s
          return {
            ...s,
            contact_prenom: c.prenom || '',
            contact_nom: c.nom || '',
            contact_lien: c.lien || d.lien || '',
            contact_ddn: sliceDate(c.date_naissance),
            contact_niss: formaterNiss(c.niss || d.niss || ''),
            contact_tel_gsm: c.tel_gsm || d.tel_gsm || '',
            contact_tel_fixe: c.tel_fixe || d.tel_fixe || '',
            contact_adresse: d.adresse || null,
          }
        })
      })
  }, [initial?.beneficiaire_annuaire_id])

  async function save() {
    if (!f.beneficiaire_nom || !f.description) { alert('Nom du bénéficiaire et description requis.'); return }
    const statut = inline
      ? undefined
      : (f.statut === 'non_realise' && initial?.id && !peutPasserNonRealise(initial.statut))
        ? initial.statut
        : f.statut
    setSaving(true)
    let annuaireId = f.beneficiaire_annuaire_id || null
    try {
      annuaireId = await upsertBeneficiaire({
        nom: f.beneficiaire_nom,
        prenom: f.beneficiaire_prenom,
        date_naissance: f.beneficiaire_ddn,
        niss: f.beneficiaire_niss,
        tel_gsm: f.beneficiaire_tel_gsm,
        tel_fixe: f.beneficiaire_tel_fixe,
        genre: f.beneficiaire_genre,
        adresse: f.beneficiaire_adresse,
      }, { created_by: profile?.id }) || annuaireId
      if (annuaireId && (f.contact_prenom || f.contact_nom)) {
        await upsertContactRattache(annuaireId, {
          prenom: f.contact_prenom,
          nom: f.contact_nom,
          lien: f.contact_lien,
          date_naissance: f.contact_ddn,
          niss: f.contact_niss,
          tel_gsm: f.contact_tel_gsm,
          tel_fixe: f.contact_tel_fixe,
          adresse: f.contact_adresse,
        }, { created_by: profile?.id })
      }
    } catch (e) {
      setSaving(false)
      alert('Annuaire : ' + (e.message || e))
      return
    }
    const contactLib = [f.contact_prenom, f.contact_nom, f.contact_lien].filter(Boolean).join(' ').trim()
    const payload = {
      beneficiaire_prenom: f.beneficiaire_prenom,
      beneficiaire_nom: f.beneficiaire_nom,
      beneficiaire_ddn: f.beneficiaire_ddn || null,
      beneficiaire_contact: contactLib || f.beneficiaire_contact || null,
      beneficiaire_annuaire_id: annuaireId,
      beneficiaire_niss: normaliserNiss(f.beneficiaire_niss) || null,
      beneficiaire_genre: f.beneficiaire_genre || null,
      beneficiaire_tel_gsm: f.beneficiaire_tel_gsm || null,
      beneficiaire_tel_fixe: f.beneficiaire_tel_fixe || null,
      beneficiaire_adresse: f.beneficiaire_adresse || null,
      description: f.description,
      localisation: f.localisation || null,
      notes_medicales: f.notes_medicales || null,
      besoins_specifiques: f.besoins_specifiques || null,
      date_souhaitee: f.date_souhaitee || null,
      date_fin: f.date_fin && f.date_souhaitee && f.date_fin >= f.date_souhaitee ? f.date_fin : (f.date_souhaitee || null),
      courte_duree: !!f.courte_duree,
      heure_depart: f.courte_duree && f.heure_depart ? f.heure_depart : null,
      heure_retour: f.courte_duree && f.heure_retour ? f.heure_retour : null,
      priorite: Number(f.priorite) || 2,
    }
    if (statut !== undefined) payload.statut = statut
    if (f.id) {
      const { error } = await supabase.from('souhaits').update(payload).eq('id', f.id)
      setSaving(false)
      if (error) { alert('Erreur : ' + error.message); return }
      onDone(f.id)
      return
    }
    const { data, error } = await supabase.from('souhaits').insert({ ...payload, created_by: profile?.id }).select('id').single()
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onDone(data?.id)
  }

  const Wrap = inline ? 'div' : 'div'
  return (
    <Wrap style={inline ? {} : { padding: 'clamp(16px,3vw,28px)', maxWidth: 760, margin: '0 auto' }}>
      {!inline && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--heading)', margin: 0 }}>{f.id ? 'Modifier le souhait' : 'Nouveau souhait'}</h1>
            {!f.id && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Le dossier commencera en « Nouveau ». Le bénéficiaire sera repris dans l’Annuaire.</p>}
          </div>
          <Btn kind="soft" onClick={() => onDone(false)}>← Retour</Btn>
        </div>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Bénéficiaire</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <F label="Prénom" value={f.beneficiaire_prenom} set={v => set('beneficiaire_prenom', v)} required />
          <F label="Nom" value={f.beneficiaire_nom} set={v => set('beneficiaire_nom', v)} required />
        </div>
        <GenrePicker value={f.beneficiaire_genre} set={v => set('beneficiaire_genre', v)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <F label="Date de naissance" type="date" value={f.beneficiaire_ddn} set={v => set('beneficiaire_ddn', v)} />
          <NissF value={f.beneficiaire_niss} set={v => set('beneficiaire_niss', v)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <PhoneF label="GSM" value={f.beneficiaire_tel_gsm} set={v => set('beneficiaire_tel_gsm', v)} />
          <PhoneF label="Fixe" value={f.beneficiaire_tel_fixe} set={v => set('beneficiaire_tel_fixe', v)} />
        </div>
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse légale</div>
          <AddressFields value={f.beneficiaire_adresse} set={v => set('beneficiaire_adresse', v)} />
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 4 }}>Contact rattaché (facultatif)</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>Famille ou proche. D’autres contacts s’ajoutent ensuite dans l’Annuaire, sur la fiche du bénéficiaire.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <F label="Prénom" value={f.contact_prenom} set={v => set('contact_prenom', v)} />
          <F label="Nom" value={f.contact_nom} set={v => set('contact_nom', v)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <F label="Lien d'affiliation" value={f.contact_lien} set={v => set('contact_lien', v)} placeholder="conjoint, enfant, tuteur…" />
          <F label="Date de naissance" type="date" value={f.contact_ddn} set={v => set('contact_ddn', v)} />
        </div>
        <NissF value={f.contact_niss} set={v => set('contact_niss', v)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <PhoneF label="GSM" value={f.contact_tel_gsm} set={v => set('contact_tel_gsm', v)} />
          <PhoneF label="Fixe" value={f.contact_tel_fixe} set={v => set('contact_tel_fixe', v)} />
        </div>
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse légale</div>
          <AddressFields value={f.contact_adresse} set={v => set('contact_adresse', v)} />
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Le souhait</div>
        <TA label="Description *" value={f.description} set={v => set('description', v)} rows={3} />
        <F label="Lieu (affiché au calendrier, sans nom de patient)" value={f.localisation} set={v => set('localisation', v)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <F label="Du" type="date" value={f.date_souhaitee} set={v => setF(s => ({ ...s, date_souhaitee: v, date_fin: (!s.date_fin || s.date_fin < v) ? v : s.date_fin }))} />
          <F label="Au (si plusieurs jours)" type="date" value={f.date_fin || f.date_souhaitee} set={v => set('date_fin', v)} />
        </div>
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
          {!inline && f.id && <Sel label="Statut" value={f.statut} set={v => set('statut', v)} options={statutsDisponibles(initial?.statut || f.statut).map(k => ({ v: k, l: STATUTS[k].l }))} />}
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

      <Btn onClick={save} disabled={saving} style={{ width: '100%' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Btn>
    </Wrap>
  )
}
