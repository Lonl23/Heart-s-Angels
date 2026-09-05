import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, TA, Pill, Loading, fmtAdresse, AdresseAffichee } from '@/components/ui'
import { lblRoleMission } from '@/modules/fiche/ficheSchema'
import { fmtDatesSouhait } from './datesSouhait'
import { ticketsCarburantMission, TicketVue } from './TerrainPhotos'
import { lblStatutBase, lblEtapeTerrain, lblAutorisationPhotos, estSurPlace } from './missionSchema'

function fmtDt(v) {
  if (!v) return ''
  return new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }).replace(' ', ' · ')
}

function prisesAdministrees(md) {
  const p = md.prises
  if (Array.isArray(p)) return p.filter(x => x?.heure || x?.donne)
  if (p && typeof p === 'object') {
    return Object.entries(p).filter(([, x]) => x?.donne).map(([h, x]) => ({ heure: x.reelle || h }))
  }
  return []
}

function vide(v) {
  return v == null || v === ''
}

export default function RapportJournee({ s, souhaitId, flash, onMission }) {
  const { profile } = useAuth()
  const [m, setM] = useState(s?.mission || {})
  const [equipe, setEquipe] = useState([])
  const [meds, setMeds] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [medical, setMedical] = useState(s?.mission?.rapport_medical || '')
  const [notes, setNotes] = useState(s?.mission?.rapport_observations || '')
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ deroulement: '', etat_patient: '', observations: '' })
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  useEffect(() => { charger() }, [souhaitId])
  useEffect(() => {
    setM(s?.mission || {})
    setMedical(s?.mission?.rapport_medical || '')
    setNotes(s?.mission?.rapport_observations || '')
  }, [s?.id, s?.mission?.rapport_medical, s?.mission?.rapport_observations])

  async function charger() {
    setLoading(true)
    const [{ data: eq }, { data: ints }, { data: dem }, { data: rap }, { data: so }] = await Promise.all([
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role)').eq('souhait_id', souhaitId),
      supabase.from('souhait_medicaments').select('*').eq('souhait_id', souhaitId),
      supabase.from('demandes_souhaits').select('id').eq('souhait_id', souhaitId).limit(1),
      supabase.from('souhait_rapports').select('*').eq('souhait_id', souhaitId).order('created_at', { ascending: false }),
      supabase.from('souhaits').select('mission').eq('id', souhaitId).single(),
    ])
    let all = ints || []
    if (dem?.[0]) {
      const { data: pm } = await supabase.from('souhait_medicaments').select('*').eq('demande_id', dem[0].id)
      all = [...all, ...(pm || [])]
    }
    setEquipe(eq || [])
    setMeds(all)
    setRows(rap || [])
    if (so?.mission) setM(so.mission)
    setLoading(false)
  }

  async function patchMission(extra) {
    const { data: fresh } = await supabase.from('souhaits').select('mission').eq('id', souhaitId).single()
    const mission = { ...(fresh?.mission || m || {}), ...extra }
    const { error } = await supabase.from('souhaits').update({ mission }).eq('id', souhaitId)
    if (error) { alert('Erreur : ' + error.message); return false }
    setM(mission)
    onMission?.(mission)
    return true
  }

  async function sauverTerrain() {
    setSaving(true)
    const ok = await patchMission({
      rapport_medical: medical.trim() || null,
      rapport_observations: notes.trim() || null,
    })
    setSaving(false)
    if (ok) flash('Compte-rendu enregistré.')
  }

  async function publierPartenaire() {
    if (!f.deroulement.trim() && !f.observations.trim()) {
      alert('Renseignez au moins le déroulement, visible du partenaire.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('souhait_rapports').insert({
      souhait_id: souhaitId,
      profile_id: profile?.id,
      auteur_nom: `${profile?.prenom || ''} ${profile?.nom || ''}`.trim(),
      role_auteur: profile?.role,
      deroulement: f.deroulement.trim() || null,
      etat_patient: f.etat_patient.trim() || null,
      observations: f.observations.trim() || null,
    })
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setF({ deroulement: '', etat_patient: '', observations: '' })
    charger()
    flash('Rapport partenaire ajouté (brouillon). Publiez-le pour qu’il soit visible.')
  }

  async function togglePublie(r) {
    const nv = !r.publie
    await supabase.from('souhait_rapports').update({ publie: nv, publie_le: nv ? new Date().toISOString() : null }).eq('id', r.id)
    charger()
    flash(nv ? 'Rapport publié (visible du partenaire).' : 'Rapport dépublié.')
  }

  function reprendreTerrain() {
    setF({
      deroulement: medical.trim(),
      etat_patient: f.etat_patient,
      observations: notes.trim(),
    })
  }

  if (loading) return <Loading />

  const realise = s?.statut === 'realise'
  const dest = fmtAdresse(m.dest_adresse)
  const pec = m.pec_type === 'Domicile du patient' ? m.patient_adresse : m.pec_adresse
  const pecTxt = fmtAdresse(pec)
  const tickets = ticketsCarburantMission(m)
  const vecteurs = Array.isArray(m.vecteurs) ? m.vecteurs : []
  const photosAuth = lblAutorisationPhotos(m.autorisation_photos)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 6 }}>
          {realise ? 'Rapport de la journée' : 'Compte-rendu de mission'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
          {fmtDatesSouhait(s)}
          {s?.date_realisee ? ` · réalisé le ${new Date(s.date_realisee + 'T12:00:00').toLocaleDateString('fr-BE')}` : ''}
          {s?.localisation ? ` · ${s.localisation}` : ''}
        </div>
        {s?.description && (
          <div style={{ fontSize: 14, color: 'var(--text)', fontStyle: 'italic', marginBottom: 12 }}>« {s.description} »</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '8px 18px', fontSize: 13.5 }}>
          <Ligne k="Statut du souhait" v={s?.statut === 'realise' ? 'Réalisé' : s?.statut === 'en_cours' ? 'En cours' : s?.statut} />
          <Ligne k="Autorisation photos" v={photosAuth || 'Non renseignée'} />
          <Ligne k="Mission démarrée" v={fmtDt(m.demarre_le) || '—'} />
          <Ligne k="Mission clôturée" v={fmtDt(m.cloture_le) || '—'} />
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Équipage qui a fait la mission</div>
        {equipe.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun volontaire affecté.</div>
        )}
        {equipe.map(e => {
          const stPerso = m.personnel_statuts?.[e.user_id]
          const surPlace = estSurPlace(stPerso)
          const role = lblRoleMission(e.role_mission) || e.role_mission
          return (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 13.5, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{e.profiles?.prenom} {e.profiles?.nom}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {[role, e.vehicule, e.profiles?.role].filter(Boolean).join(' · ') || 'Rôle non précisé'}
                </div>
              </div>
              <Pill color={surPlace ? '#3B6D11' : '#7A7470'} bg={surPlace ? '#EAF3DE' : '#F3F1EF'}>
                {lblStatutBase(stPerso) || (stPerso ? stPerso : 'Statut personnel non indiqué')}
              </Pill>
            </div>
          )
        })}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Vecteurs — étapes et horaires</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Horaires enregistrés sur le terrain. Ils ne sont pas modifiés ici.
        </p>
        {vecteurs.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun vecteur encodé.</div>
        )}
        {vecteurs.map(v => {
          const vStatut = m.vecteur_statuts?.[v.id]
          const etape = lblEtapeTerrain(m.vecteur_etapes?.[v.id] || m.etape_terrain, vStatut)
          const cloture = m.vecteur_clotures?.[v.id]
          return (
            <div key={v.id} style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--bg-alt)', borderRadius: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {[v.nom, v.type_transport, v.plaque].filter(Boolean).join(' · ') || 'Véhicule'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '6px 14px', fontSize: 13 }}>
                <Ligne k="Étape" v={etape || '—'} />
                <Ligne k="Statut vecteur" v={vStatut === 'realise' ? 'Rentré base' : (vStatut || '—')} />
                <Ligne k="Clôture vecteur" v={fmtDt(cloture) || '—'} />
                <Ligne k="KM départ" v={vide(v.kms_depart) ? '—' : v.kms_depart} />
                <Ligne k="KM retour" v={vide(v.kms_retour) ? '—' : v.kms_retour} />
                <Ligne k="Essence au départ" v={vide(v.essence_pct) ? '—' : `${v.essence_pct} %`} />
              </div>
            </div>
          )
        })}
        {!vecteurs.length && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '6px 14px', fontSize: 13 }}>
            <Ligne k="Étape" v={lblEtapeTerrain(m.etape_terrain, null) || '—'} />
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Itinéraire</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, fontSize: 13.5 }}>
          <BlocTrajet titre="Base">
            <Ligne k="Base" v={m.base_nom || '—'} />
            {fmtAdresse(m.base_adresse) ? <AdresseAffichee value={m.base_adresse} compact /> : <Ligne k="Adresse" v="—" />}
            <Ligne k="Rendez-vous" v={fmtDt(m.rdv_base) || '—'} />
            <Ligne k="Départ prévu" v={fmtDt(m.depart_base) || '—'} />
          </BlocTrajet>
          <BlocTrajet titre="Prise en charge">
            <Ligne k="Lieu" v={m.pec_type || '—'} />
            {m.pec_institution && <Ligne k="Institution" v={m.pec_institution} />}
            {pecTxt ? <AdresseAffichee value={pec} compact /> : <Ligne k="Adresse" v="—" />}
            <Ligne k="Heure souhaitée" v={fmtDt(m.arrivee_pec) || '—'} />
          </BlocTrajet>
          <BlocTrajet titre="Destination">
            {dest ? <AdresseAffichee value={m.dest_adresse} compact /> : <Ligne k="Adresse" v="—" />}
            <Ligne k="Heure souhaitée" v={fmtDt(m.arrivee_destination) || '—'} />
            {m.dest_precisions && <Ligne k="Précisions" v={m.dest_precisions} />}
          </BlocTrajet>
          <BlocTrajet titre="Retour">
            <Ligne k="Type" v={m.retour_type || '—'} />
            <Ligne k="Heure attendue" v={fmtDt(m.retour_heure) || '—'} />
            {m.retour_precisions && <Ligne k="Précisions" v={m.retour_precisions} />}
          </BlocTrajet>
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Rapport médical</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Rédigé sur le terrain (Mes missions) ou complété ici. Confidentiel — usage interne. Les heures de statut ne sont pas modifiées.
        </p>
        <TA
          label="Compte-rendu (médical et déroulement)"
          value={medical}
          set={setMedical}
          rows={7}
          placeholder="Comment s’est passée la journée, observations cliniques, décisions…"
        />
        <TA
          label="Notes logistiques"
          value={notes}
          set={setNotes}
          rows={3}
          placeholder="Véhicule, matériel, incidents pratiques…"
        />
        <Btn onClick={sauverTerrain} disabled={saving}>{saving ? '…' : 'Enregistrer le compte-rendu'}</Btn>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Traitements administrés</div>
        {meds.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun traitement encodé.</div>
        )}
        {meds.map(md => {
          const prises = prisesAdministrees(md)
          return (
            <div key={md.id} style={{ borderLeft: '3px solid var(--accent)', padding: '2px 0 6px 10px', marginBottom: 6 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{md.medicament}{md.dosage ? ` · ${md.dosage}` : ''}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {prises.length
                  ? `Administré : ${prises.map(p => p.heure || '?').join(', ')}`
                  : (Array.isArray(md.horaires) && md.horaires.length ? `Prévu : ${md.horaires.join(', ')} — non coché` : 'Non administré')}
              </div>
            </div>
          )
        })}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Tickets carburant — remboursement</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>
          À envoyer à la société qui prête l’ambulance (plein du matin si le véhicule n’était pas à 100 %).
        </p>
        {tickets.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun ticket capturé.</div>
        )}
        {tickets.map(t => (
          <div key={t.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{t.nom}{t.essence != null && t.essence !== '' ? ` · essence au départ ${t.essence} %` : ''}</div>
            {t.matin?.path && <TicketVue meta={t.matin} titre="Plein du matin" />}
            {t.soir?.path && <TicketVue meta={t.soir} titre="Plein du retour" />}
          </div>
        ))}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Rapport pour le partenaire</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Version partageable (institution / famille). Elle n’est visible du partenaire que lorsque vous la publiez.
        </p>
        {(medical.trim() || notes.trim()) && (
          <div style={{ marginBottom: 10 }}>
            <Btn kind="soft" onClick={reprendreTerrain}>Reprendre le compte-rendu interne</Btn>
          </div>
        )}
        <TA label="Déroulement" value={f.deroulement} set={v => set('deroulement', v)} rows={3} />
        <TA label="État du patient" value={f.etat_patient} set={v => set('etat_patient', v)} rows={2} />
        <TA label="Observations" value={f.observations} set={v => set('observations', v)} rows={2} />
        <Btn onClick={publierPartenaire} disabled={saving}>{saving ? '…' : 'Ajouter le rapport partenaire'}</Btn>
        {rows.length === 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '10px 0 0' }}>Pas encore de version partenaire. Le compte-rendu interne reste consultable ici.</p>
        )}
      </Card>

      {rows.map(r => (
        <Card key={r.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{r.auteur_nom} · {new Date(r.created_at).toLocaleDateString('fr-BE')}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Pill color={r.publie ? '#3B6D11' : '#BA7517'} bg={r.publie ? '#EAF3DE' : '#FAEEDA'}>{r.publie ? 'Publié' : 'Brouillon'}</Pill>
              <Btn kind={r.publie ? 'soft' : 'ok'} onClick={() => togglePublie(r)} style={{ padding: '5px 10px' }}>{r.publie ? 'Dépublier' : 'Publier'}</Btn>
            </div>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {r.deroulement && <p style={{ margin: '0 0 6px' }}><strong>Déroulement.</strong> {r.deroulement}</p>}
            {r.etat_patient && <p style={{ margin: '0 0 6px' }}><strong>État.</strong> {r.etat_patient}</p>}
            {r.observations && <p style={{ margin: 0 }}><strong>Observations.</strong> {r.observations}</p>}
          </div>
        </Card>
      ))}
    </div>
  )
}

function Ligne({ k, v }) {
  if (v == null || v === '') return null
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</div>
      <div>{v}</div>
    </div>
  )
}

function BlocTrajet({ titre, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--heading)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>{titre}</div>
      {children}
    </div>
  )
}
