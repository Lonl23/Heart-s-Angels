import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, TA, Pill, Tabs, Flash, StatutFlow, Loading, AdresseAffichee, LiensGps, fmtAdresse } from '@/components/ui'
import { GenreIcon } from '@/modules/annuaire/genre'
import { fmtTelephones, formaterNiss, libelleGenre } from '@/modules/annuaire/annuaireSchema'
import { stInfo, ATTENTE_RAISONS, PIPELINE, PIPELINE_ENCODE, statutsDisponibles, peutPasserNonRealise, statutFige, peutChangerStatut } from './statuts'
import { fmtDatesSouhait } from './datesSouhait'
import FormSouhait from './FormSouhait'
import FicheMission from './FicheMission'
import MissionForm from './MissionForm'
import MissionSummary from './MissionSummary'
import RapportJournee from './RapportJournee'
import Suivi from './Suivi'

export default function DetailSouhait({ id, onBack, onPreparer, onVoir, preparer=false }) {
  const [s, setS] = useState(null)
  const mode = preparer ? 'edit' : 'view'
  const [tab, setTab] = useState('resume')
  const [tabFixe, setTabFixe] = useState(false)
  const [fiche, setFiche] = useState(false)
  const [msg, setMsg] = useState(null)
  const [motifOpen, setMotifOpen] = useState(false)
  const [motif, setMotif] = useState('')

  useEffect(() => { load() }, [id])
  useEffect(() => {
    setTabFixe(false)
    setTab('resume')
  }, [id])
  useEffect(() => {
    if (preparer && s && statutFige(s.statut)) onVoir?.()
  }, [preparer, s?.id, s?.statut])
  async function load() { const { data } = await supabase.from('souhaits').select('*').eq('id', id).single(); setS(data) }
  function flash(t){ setMsg(t); setTimeout(()=>setMsg(null), 3000) }

  async function appliquerStatut(v, missionPatch={}) {
    if (statutFige(s.statut) && v !== s.statut) {
      flash('Un souhait réalisé ne peut plus changer de statut.')
      return
    }
    const patch = { statut: v }
    if (v === 'realise' && !s.date_realisee) patch.date_realisee = new Date().toISOString().slice(0,10)
    if (Object.keys(missionPatch).length) {
      const { data: fresh } = await supabase.from('souhaits').select('mission').eq('id', id).single()
      patch.mission = { ...(fresh?.mission || s.mission || {}), ...missionPatch }
    }
    await supabase.from('souhaits').update(patch).eq('id', id)
    setS(x => ({ ...x, ...patch })); flash('Statut mis à jour.')
  }
  function majStatut(v) {
    if (v === s.statut) return
    if (!peutChangerStatut(s.statut, v) && v !== 'non_realise') {
      if (statutFige(s.statut)) flash('Un souhait réalisé ne peut plus changer de statut.')
      return
    }
    if (v === 'non_realise') {
      if (!peutPasserNonRealise(s.statut)) return
      setMotif(s.mission?.motif_non_realise || '')
      setMotifOpen(true)
      return
    }
    setMotifOpen(false)
    appliquerStatut(v)
  }
  async function confirmerNonRealise() {
    const t = motif.trim()
    if (!t) { alert('Indiquez le motif de non-réalisation.'); return }
    setMotifOpen(false)
    await appliquerStatut('non_realise', { motif_non_realise: t })
  }
  async function toggleAttente(key) {
    const { data: fresh } = await supabase.from('souhaits').select('mission').eq('id', id).single()
    const base = fresh?.mission || s.mission || {}
    const att = { ...(base.attente || {}), [key]: !(base.attente?.[key]) }
    const mission = { ...base, attente: att }
    await supabase.from('souhaits').update({ mission }).eq('id', id)
    setS(x => ({ ...x, mission }))
  }

  if (!s) return <div style={{ padding:24 }}><Loading /></div>
  if (preparer && statutFige(s.statut)) return <div style={{ padding:24 }}><Loading /></div>
  if (fiche) return <FicheMission souhaitId={id} onClose={()=>setFiche(false)} />
  const tabActif = (!tabFixe && s.statut === 'realise') ? 'jour' : tab

  const st = stInfo(s.statut)
  const extras = [
    ...(['en_cours','realise'].includes(s.statut) ? [s.statut] : []),
    ...statutsDisponibles(s.statut).filter(k => !PIPELINE.includes(k)),
  ]
  const m = s.mission || {}
  const pretHints = []
  if (!(m.vecteurs||[]).length) pretHints.push('un vecteur et un équipage')
  if (!m.pec_type && !m.dest_adresse) pretHints.push('le trajet (prise en charge / destination)')

  return (
    <div style={{ padding:'clamp(14px,3vw,24px)', width:'100%', boxSizing:'border-box' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', marginBottom:14 }}>
        <div>
          <Btn kind="soft" onClick={onBack}>← Tous les souhaits</Btn>
          <h1 style={{ fontSize:'1.6rem', color:'var(--heading)', margin:'10px 0 4px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {s.beneficiaire_genre && <GenreIcon genre={s.beneficiaire_genre} size={26} title={libelleGenre(s.beneficiaire_genre)} />}
            {s.beneficiaire_prenom} {s.beneficiaire_nom}
          </h1>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
            {fmtDatesSouhait(s) !== 'Date à définir' && <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>{fmtDatesSouhait(s)}</span>}
          </div>
        </div>
        <div className="ha-souhait-actions">
          <Btn kind="soft" onClick={()=>setFiche(true)}>Imprimer la fiche</Btn>
          {statutFige(s.statut)
            ? null
            : (
              <Btn kind={mode==='edit'?'ok':'primary'} onClick={()=>mode==='edit' ? onVoir?.() : onPreparer?.()}>
                {mode==='edit' ? 'Terminer l\'encodage' : 'Préparer le dossier'}
              </Btn>
            )}
        </div>
      </div>

      <Card style={{ marginBottom:12, padding:'12px 16px' }}>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
          {statutFige(s.statut)
            ? 'Souhait réalisé — le statut ne peut plus être modifié, les heures de mission sont conservées.'
            : `Préparation ${s.statut === 'en_cours' ? '— En cours se pose depuis Mes missions' : ''}`}
        </div>
        <StatutFlow value={s.statut} info={stInfo} pipeline={PIPELINE_ENCODE} extras={extras} onPick={majStatut} locked={statutFige(s.statut)} />
        {s.statut === 'pret' && pretHints.length > 0 && (
          <div style={{ fontSize:12.5, color:'#BA7517', marginTop:8 }}>Avant le terrain, il manque encore : {pretHints.join(', ')}.</div>
        )}
      </Card>

      {motifOpen && (
        <Card style={{ marginBottom:12 }}>
          <div style={{ fontWeight:600, color:'var(--heading)', marginBottom:8 }}>Motif de non-réalisation</div>
          <TA label="Pourquoi ce souhait ne sera pas réalisé ?" value={motif} set={setMotif} rows={3} placeholder="Ex. : état de santé, date impossible, souhait retiré…" />
          <div style={{ display:'flex', gap:8 }}>
            <Btn kind="danger" onClick={confirmerNonRealise}>Confirmer non réalisé</Btn>
            <Btn kind="soft" onClick={()=>setMotifOpen(false)}>Annuler</Btn>
          </div>
        </Card>
      )}

      {s.statut === 'en_attente' && (
        <Card style={{ marginBottom:12, padding:'12px 16px' }}>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:8 }}>En attente de (plusieurs possibles) :</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ATTENTE_RAISONS.map(r => { const on = !!s.mission?.attente?.[r.v]; return (
              <button key={r.v} onClick={()=>toggleAttente(r.v)} style={{ padding:'6px 12px', borderRadius:99, border:`1.5px solid ${on?'#BA7517':'var(--border)'}`, background:on?'#FAEEDA':'var(--card)', color:on?'#BA7517':'var(--text-2)', fontSize:12.5, fontWeight:600 }}>{on?'✓ ':''}{r.l}</button>
            )})}
          </div>
        </Card>
      )}
      {s.statut === 'non_realise' && s.mission?.motif_non_realise && (
        <Flash kind="err"><strong>Motif : </strong>{s.mission.motif_non_realise}</Flash>
      )}
      {msg && <Flash>{msg}</Flash>}

      {mode === 'edit' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Flash kind="warn">Encodage du dossier — tout s'enregistre tout seul. Les checklists et le MAR se feront dans Mes missions.</Flash>
          <Card>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>Souhait & bénéficiaire</div>
            <FormSouhait initial={s} inline onDone={()=>{ load(); flash('Souhait enregistré.') }} />
          </Card>
          <MissionForm souhaitId={id} />
        </div>
      )}

      {mode === 'view' && (
        <>
          <Tabs value={tabActif} onChange={v => { setTabFixe(true); setTab(v) }} items={[
            { v:'resume', l:'Résumé' },
            { v:'jour', l: s.statut === 'realise' ? 'Rapport du jour' : 'Rapport' },
            { v:'suivi', l:'Suivi interne' },
          ]} />
          {tabActif==='resume' && <Resume s={s} souhaitId={id} onVoirRapport={() => { setTabFixe(true); setTab('jour') }} />}
          {tabActif==='jour' && <RapportJournee s={s} souhaitId={id} flash={flash} onMission={mission => setS(x => ({ ...x, mission }))} />}
          {tabActif==='suivi' && <Suivi souhaitId={id} />}
        </>
      )}
    </div>
  )
}

function Resume({ s, souhaitId, onVoirRapport }) {
  const [extNom, setExtNom] = useState('')
  const [appel, setAppel] = useState(null)
  useEffect(() => {
    supabase.rpc('coordonnees_appel', { p_souhait: souhaitId }).then(({ data }) => setAppel(data?.ok ? data : null))
    if (s.annuaire_externe_id) {
      supabase.from('annuaire').select('nom').eq('id', s.annuaire_externe_id).maybeSingle()
        .then(({ data }) => { if (data?.nom) setExtNom(data.nom) })
    } else if (s.partenaire_id) {
      supabase.from('partenaires').select('nom').eq('id', s.partenaire_id).maybeSingle()
        .then(({ data }) => { if (data?.nom) setExtNom(data.nom) })
    }
  }, [souhaitId, s.annuaire_externe_id, s.partenaire_id])
  const L = ({ k, v }) => v ? <div style={{ marginBottom:8 }}><div style={{ fontSize:12, color:'var(--text-muted)' }}>{k}</div><div style={{ fontSize:13.5, color:'var(--text)', whiteSpace:'pre-wrap' }}>{v}</div></div> : null
  const tels = fmtTelephones({ tel_gsm: s.beneficiaire_tel_gsm, tel_fixe: s.beneficiaire_tel_fixe })
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Card>
        <L k="Origine" v={s.origine === 'institution' ? `Institution${extNom ? ` · ${extNom}` : ''}` : 'Demande privée'} />
        {appel?.tel && <L k="N° à appeler" v={`${appel.tel}${appel.libelle ? ` (${appel.libelle})` : ''}`} />}
        <L k="Bénéficiaire" v={`${s.beneficiaire_prenom||''} ${s.beneficiaire_nom||''}`.trim()} />
        {s.beneficiaire_genre && (
          <div style={{ marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>Genre</div>
            <GenreIcon genre={s.beneficiaire_genre} title={libelleGenre(s.beneficiaire_genre)} />
            <span style={{ fontSize:13.5 }}>{libelleGenre(s.beneficiaire_genre)}</span>
          </div>
        )}
        {s.beneficiaire_ddn && <L k="Né(e) le" v={new Date(s.beneficiaire_ddn).toLocaleDateString('fr-BE')} />}
        {s.beneficiaire_niss && <L k="Numéro national" v={formaterNiss(s.beneficiaire_niss)} />}
        {tels && <L k="Téléphone" v={tels} />}
        {fmtAdresse(s.beneficiaire_adresse) && (
          <div style={{ marginBottom: 8 }}>
            <AdresseAffichee label="Adresse légale" value={s.beneficiaire_adresse} />
          </div>
        )}
        {s.beneficiaire_contact && <L k="Contact / famille" v={s.beneficiaire_contact} />}
        <L k="Souhait" v={s.description} />
        {s.localisation && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lieu</div>
            <div style={{ fontSize: 13.5 }}>{s.localisation}</div>
            <LiensGps texte={s.localisation} />
          </div>
        )}
        <L k="Dates" v={fmtDatesSouhait(s) !== 'Date à définir' ? fmtDatesSouhait(s) : null} />
        <L k="Besoins spécifiques" v={s.besoins_specifiques} />
      </Card>
      {s.statut === 'realise' && (
        <Card>
          <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 6 }}>Rapport de la journée</div>
          {s.mission?.rapport_medical || s.mission?.rapport_observations ? (
            <div style={{ fontSize: 13.5, color: 'var(--text-2)', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {s.mission?.rapport_medical || s.mission?.rapport_observations}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Le compte-rendu terrain n’est pas encore encodé. Vous pouvez le rédiger dans l’onglet Rapport du jour.</div>
          )}
          <div style={{ marginTop: 10 }}>
            <Btn kind="soft" onClick={onVoirRapport}>Ouvrir le rapport du jour ›</Btn>
          </div>
        </Card>
      )}
      {s.notes_medicales && <Flash kind="err"><strong>Notes médicales — </strong>{s.notes_medicales}</Flash>}
      <MissionSummary souhaitId={souhaitId} infoOnly={!['en_cours','realise'].includes(s.statut)} />
    </div>
  )
}
