import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, TA, Pill, Loading, Tabs, fmtAdresse, AdresseAffichee } from '@/components/ui'
import { lblRoleMission } from '@/modules/fiche/ficheSchema'
import { fmtDatesSouhait } from './datesSouhait'
import { ticketsCarburantMission, TicketVue, PhotosCotesVue } from './TerrainPhotos'
import { ApercuPartenaire } from './RapportPartenaire'
import {
  lblStatutBase, estSurPlace, PARCOURS_TERRAIN, heureEtapeVecteur,
  protocoleDetresse, injectionsDetresse, lblVoieDetresse,
  CHECKLISTS, itemsChecklistTous, snapshotHorairesPartenaire,
} from './missionSchema'

function fmtDt(v) {
  if (!v) return ''
  return new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }).replace(' ', ' · ')
}

function prisesAdministrees(md) {
  const p = md.prises
  if (Array.isArray(p)) return p.filter(x => x?.heure || x?.donne)
  if (p && typeof p === 'object') {
    if (Array.isArray(p.events)) return p.events.map(h => ({ heure: h }))
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
  const [conso, setConso] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('asbl')
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
    const [{ data: eq }, { data: ints }, { data: dem }, { data: rap }, { data: so }, { data: stock }] = await Promise.all([
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role)').eq('souhait_id', souhaitId),
      supabase.from('souhait_medicaments').select('*').eq('souhait_id', souhaitId),
      supabase.from('demandes_souhaits').select('id').eq('souhait_id', souhaitId).limit(1),
      supabase.from('souhait_rapports').select('*').eq('souhait_id', souhaitId).order('created_at', { ascending: false }),
      supabase.from('souhaits').select('mission').eq('id', souhaitId).single(),
      supabase.rpc('stock_conso_souhait', { p_souhait: souhaitId }),
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
    setConso(stock?.items || [])
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
    if (ok) flash('Compte-rendu de la journée enregistré.')
  }

  async function publierPartenaire() {
    if (!f.deroulement.trim() && !f.observations.trim() && !f.etat_patient.trim()) {
      alert('Renseignez au moins comment s’est passée la journée, visible du partenaire.')
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
      horaires: snapshotHorairesPartenaire(m),
    })
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setF({ deroulement: '', etat_patient: '', observations: '' })
    charger()
    flash('Rapport partenaire ajouté (brouillon). Publiez-le pour qu’il soit visible.')
  }

  async function togglePublie(r) {
    const nv = !r.publie
    const patch = { publie: nv, publie_le: nv ? new Date().toISOString() : null }
    if (nv && (!r.horaires || (Array.isArray(r.horaires) && !r.horaires.length))) {
      patch.horaires = snapshotHorairesPartenaire(m)
    }
    await supabase.from('souhait_rapports').update(patch).eq('id', r.id)
    charger()
    flash(nv ? 'Rapport publié (visible du partenaire).' : 'Rapport dépublié.')
  }

  function reprendreJournee() {
    setF({
      deroulement: medical.trim(),
      etat_patient: f.etat_patient,
      observations: f.observations,
    })
  }

  if (loading) return <Loading />

  const vecteurs = Array.isArray(m.vecteurs) ? m.vecteurs : []
  const tickets = ticketsCarburantMission(m)
  const patient = `${s?.beneficiaire_prenom || ''} ${s?.beneficiaire_nom || ''}`.trim() || 'Bénéficiaire'
  const ddn = s?.beneficiaire_ddn ? new Date(s.beneficiaire_ddn).toLocaleDateString('fr-BE') : ''
  const pec = m.pec_type === 'Domicile du patient' ? m.patient_adresse : m.pec_adresse

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print">
        <Tabs
          value={vue}
          onChange={setVue}
          items={[
            { v: 'asbl', l: 'Rapport ASBL' },
            { v: 'partenaire', l: 'Rapport partenaire' },
          ]}
          extra={<Btn kind="soft" onClick={() => window.print()}>Imprimer</Btn>}
        />
      </div>

      {vue === 'asbl' && (
        <div className="ha-rapport-print">
          <Card>
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Rapport de la journée — ASBL</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Compte-rendu interne : tout ce qui s’est passé sur le terrain (photos, horaires des deux vecteurs, km, essence, soins). Ce n’est pas la fiche de préparation.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '8px 18px', fontSize: 13.5 }}>
              <Ligne k="Patient" v={patient} />
              {ddn && <Ligne k="Né(e) le" v={ddn} />}
              <Ligne k="Date" v={fmtDatesSouhait(s)} />
              <Ligne k="Statut" v={s?.statut === 'realise' ? 'Réalisé' : s?.statut === 'en_cours' ? 'En cours' : s?.statut} />
              <Ligne k="Démarré" v={fmtDt(m.demarre_le) || '—'} />
              <Ligne k="Clôturé" v={fmtDt(m.cloture_le) || '—'} />
            </div>
            {s?.description && (
              <div style={{ fontSize: 14, color: 'var(--text)', fontStyle: 'italic', marginTop: 10 }}>« {s.description} »</div>
            )}
          </Card>

          <Card>
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Lieux du jour</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, fontSize: 13.5 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--heading)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>Prise en charge</div>
                <Ligne k="Lieu" v={m.pec_type || '—'} />
                {m.pec_institution && <Ligne k="Institution" v={m.pec_institution} />}
                {fmtAdresse(pec) ? <AdresseAffichee value={pec} compact /> : null}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--heading)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>Destination</div>
                {fmtAdresse(m.dest_adresse) ? <AdresseAffichee value={m.dest_adresse} compact /> : <Ligne k="Adresse" v="—" />}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--heading)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>Retour</div>
                <Ligne k="Type" v={m.retour_type || '—'} />
                {m.retour_precisions && <Ligne k="Précisions" v={m.retour_precisions} />}
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Équipage</div>
            {equipe.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun volontaire affecté.</div>}
            {equipe.map(e => {
              const stPerso = m.personnel_statuts?.[e.user_id]
              const heureSurPlace = m.personnel_heures?.[e.user_id]
              const role = lblRoleMission(e.role_mission) || e.role_mission
              const vec = vecteurs.find(v => v.id === e.vecteur_id)
              return (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 13.5, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{e.profiles?.prenom} {e.profiles?.nom}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {[role, vec?.nom, vec?.plaque].filter(Boolean).join(' · ') || 'Rôle non précisé'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Pill color={estSurPlace(stPerso) ? '#3B6D11' : '#7A7470'} bg={estSurPlace(stPerso) ? '#EAF3DE' : '#F3F1EF'}>
                      {lblStatutBase(stPerso) || '—'}
                    </Pill>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      Sur place base : {fmtDt(heureSurPlace) || '—'}
                    </div>
                  </div>
                </div>
              )
            })}
          </Card>

          {vecteurs.length === 0 && (
            <Card><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun vecteur encodé.</div></Card>
          )}
          {vecteurs.map(v => (
            <BlocVecteurAsbl key={v.id} v={v} m={m} equipe={equipe} />
          ))}

          <Card>
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Comment s’est passée la journée</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Récit de la mission (émotions, soins donnés, incidents). La pathologie et le dossier médical restent dans « Préparer le dossier » — ne les recopiez pas ici.
            </p>
            <TA
              label="Récit de la journée"
              value={medical}
              set={setMedical}
              rows={8}
              placeholder="Ex. : belle journée, repas en famille, 2 changes, tous les traitements donnés…"
            />
            <TA
              label="Notes logistiques (interne)"
              value={notes}
              set={setNotes}
              rows={3}
              placeholder="Véhicule, matériel, incidents pratiques…"
            />
            <div className="no-print">
              <Btn onClick={sauverTerrain} disabled={saving}>{saving ? '…' : 'Enregistrer le récit'}</Btn>
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Traitements administrés pendant la journée</div>
            {meds.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun traitement encodé.</div>}
            {meds.map(md => {
              const prises = prisesAdministrees(md)
              return (
                <div key={md.id} style={{ borderLeft: '3px solid var(--accent)', padding: '2px 0 6px 10px', marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{md.medicament}{md.dosage ? ` · ${md.dosage}` : ''}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {prises.length
                      ? `Administré : ${prises.map(p => p.heure || '?').join(', ')}`
                      : 'Non administré'}
                  </div>
                </div>
              )
            })}
          </Card>

          <Card>
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Protocole de détresse</div>
            {(() => {
              const proto = protocoleDetresse(m)
              const lignes = proto.lignes.filter(r => (r.medicament || '').trim() || (r.dosage || '').trim())
              const injs = injectionsDetresse(m)
              return (
                <>
                  {lignes.length === 0
                    ? <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Aucun protocole encodé.</div>
                    : lignes.map((r, i) => (
                      <div key={r.id || i} style={{ borderLeft: '3px solid #A32D2D', padding: '2px 0 6px 10px', marginBottom: 6 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.medicament || '—'}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                          {[r.dosage && `Dosage ${r.dosage}`, r.voie && `voie ${lblVoieDetresse(r.voie)}`].filter(Boolean).join(' · ') || 'Dosage / voie non précisés'}
                        </div>
                      </div>
                    ))}
                  {proto.notes ? <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{proto.notes}</p> : null}
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .4, margin: '10px 0 6px' }}>Injections du jour</div>
                  {injs.length === 0
                    ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune injection enregistrée.</div>
                    : injs.map(inj => (
                      <div key={inj.id} style={{ fontSize: 13.5, marginBottom: 8, padding: '8px 10px', background: '#FCEBEB', borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, color: '#A32D2D' }}>Injecté {fmtDt(inj.injecte_le) || '—'}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4 }}>
                          {[inj.par_nom, inj.medecin_coordinateur_prevenu && 'médecin coordinateur prévenu', inj.coordinateur_medical_prevenu && 'coordinateur médical (président) prévenu', inj.traitements_revus && 'traitements revus'].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    ))}
                </>
              )
            })()}
          </Card>

          {conso.length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Matériel utilisé</div>
              {conso.map((it, i) => (
                <div key={i} style={{ fontSize: 13.5, marginBottom: 4 }}>
                  {it.nom}
                  {it.mode === 'oxygene' && it.pression_bar != null ? ` · ${it.pression_bar} bar` : ''}
                  {it.quantite != null && it.mode !== 'oxygene' ? ` · qté ${it.quantite}` : ''}
                  {it.lot ? ` · lot ${it.lot}` : ''}
                </div>
              ))}
            </Card>
          )}

          <Card>
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Tickets carburant — remboursement</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>
              À envoyer à la société qui prête l’ambulance.
            </p>
            {tickets.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun ticket capturé.</div>}
            {tickets.map(t => (
              <div key={t.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{t.nom}{t.essence != null && t.essence !== '' ? ` · essence au départ ${t.essence} %` : ''}</div>
                {t.matin?.path && <TicketVue meta={t.matin} titre="Plein du matin" />}
                {t.soir?.path && <TicketVue meta={t.soir} titre="Plein du retour" />}
              </div>
            ))}
          </Card>
        </div>
      )}

      {vue === 'partenaire' && (
        <div className="ha-rapport-print">
          <Card>
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Rapport pour le partenaire</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Ce que l’institution ou la famille doit voir : le patient, comment s’est passée la journée, et les heures sur le trajet (prise en charge, destination, retour). Pas l’état du véhicule, pas les km, pas la base.
            </p>
            <ApercuPartenaire
              patient={s?.beneficiaire_prenom || patient}
              dateTxt={fmtDatesSouhait(s)}
              souhait={s?.description}
              vecteurs={snapshotHorairesPartenaire(m)}
              deroulement={f.deroulement || medical}
              etat={f.etat_patient}
              observations={f.observations}
            />
          </Card>

          <Card className="no-print">
            <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Texte à publier</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Les horaires ci-dessus sont repris automatiquement. Rédigez seulement le récit — sans pathologie de dossier, sans km, sans photos de véhicule.
            </p>
            {medical.trim() && (
              <div style={{ marginBottom: 10 }}>
                <Btn kind="soft" onClick={reprendreJournee}>Reprendre le récit interne</Btn>
              </div>
            )}
            <TA label="Comment s’est passée la journée" value={f.deroulement} set={v => set('deroulement', v)} rows={5} placeholder="Accueil, émotions, repas, déroulement…" />
            <TA label="État du patient au retour" value={f.etat_patient} set={v => set('etat_patient', v)} rows={2} />
            <TA label="Observations pour le partenaire" value={f.observations} set={v => set('observations', v)} rows={2} />
            <Btn onClick={publierPartenaire} disabled={saving}>{saving ? '…' : 'Ajouter le rapport partenaire'}</Btn>
            {rows.length === 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '10px 0 0' }}>Pas encore de version partenaire. Le rapport ASBL reste interne.</p>
            )}
          </Card>

          {rows.map(r => (
            <Card key={r.id}>
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{r.auteur_nom} · {new Date(r.created_at).toLocaleDateString('fr-BE')}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill color={r.publie ? '#3B6D11' : '#BA7517'} bg={r.publie ? '#EAF3DE' : '#FAEEDA'}>{r.publie ? 'Publié' : 'Brouillon'}</Pill>
                  <Btn kind={r.publie ? 'soft' : 'ok'} onClick={() => togglePublie(r)} style={{ padding: '5px 10px' }}>{r.publie ? 'Dépublier' : 'Publier'}</Btn>
                </div>
              </div>
              <ApercuPartenaire
                patient={s?.beneficiaire_prenom || patient}
                dateTxt={fmtDatesSouhait(s)}
                souhait={s?.description}
                vecteurs={Array.isArray(r.horaires) && r.horaires.length ? r.horaires : snapshotHorairesPartenaire(m)}
                deroulement={r.deroulement}
                etat={r.etat_patient}
                observations={r.observations}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function BlocVecteurAsbl({ v, m, equipe }) {
  const photos = (m.terrain_photos || {})[v.id] || {}
  const crew = (equipe || []).filter(e => e.vecteur_id === v.id)
  const vc = (m.vecteur_checklists || {})[v.id] || {}
  return (
    <Card>
      <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>
        {[v.nom, v.type_transport, v.plaque].filter(Boolean).join(' · ') || 'Véhicule'}
      </div>
      {crew.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
          {crew.map(e => `${e.profiles?.prenom || ''} ${e.profiles?.nom || ''}`.trim()).filter(Boolean).join(' · ')}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '6px 14px', fontSize: 13, marginBottom: 12 }}>
        <Ligne k="KM départ" v={vide(v.kms_depart) ? '—' : String(v.kms_depart)} />
        <Ligne k="KM retour" v={vide(v.kms_retour) ? '—' : String(v.kms_retour)} />
        <Ligne k="Essence au départ" v={vide(v.essence_pct) ? '—' : `${v.essence_pct} %`} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .4, margin: '4px 0 8px' }}>
        Horaires de tous les statuts
      </div>
      <table className="ha-rapport-heures">
        <tbody>
          {PARCOURS_TERRAIN.map(e => (
            <tr key={e.id}>
              <td>{e.l}</td>
              <td>{fmtDt(heureEtapeVecteur(m, v.id, e.id)) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PhotosCotesVue coins={photos.coins || {}} titre="Photos des 4 côtés — départ" />
      <PhotosCotesVue coins={photos.coins_retour || {}} titre="Photos des 4 côtés — rentrée" />

      <ChecklistsVecteur m={m} vc={vc} />
    </Card>
  )
}

function ChecklistsVecteur({ m, vc }) {
  const secs = Object.entries(CHECKLISTS).map(([sec, def]) => {
    const etat = vc[sec] || {}
    const faits = itemsChecklistTous(sec, m).filter(it => etat[it])
    return { titre: def.titre, faits }
  }).filter(x => x.faits.length)
  if (!secs.length) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>Checklists cochées</div>
      {secs.map(s => (
        <div key={s.titre} style={{ fontSize: 13, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>{s.titre} : </span>{s.faits.join(', ')}
        </div>
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
