import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Btn, Loading, Flash } from '@/components/ui'
import { personneEstMedicale } from '@/modules/fiche/ficheSchema'
import { fenetreStatuts } from './fenetreMission'
import RecapMission from './RecapMission'
import ContactsMission from './ContactsMission'
import DossierDar from './DossierDar'
import MissionExecution from './MissionExecution'
import DocumentsMission from './DocumentsMission'
import EnvoiRapportMedical from './EnvoiRapportMedical'
import { fusionMissionDemo } from './formationSession'

const ROLES_COORD = ['coord_medical', 'coord_medical_adjoint', 'coordinateur_medical']
const VOLETS = ['recap', 'medical', 'documents', 'contacts', 'envoyer_rapport', 'statuts']
const ONGLETS = [
  { v: 'recap', l: 'Récapitulatif' },
  { v: 'medical', l: 'Rapport médical' },
  { v: 'documents', l: 'Tous les documents' },
  { v: 'contacts', l: 'Contacts' },
  { v: 'envoyer_rapport', l: 'Envoyer le rapport' },
  { v: 'statuts', l: 'Statuts' },
]

export default function MenuMission({ souhaitId, onBack }) {
  const { user, profile, accesTotal, estMedical, role } = useAuth()
  const [params] = useSearchParams()
  const [meta, setMeta] = useState(null)
  const [meds, setMeds] = useState([])
  const [err, setErr] = useState(null)
  const volet = params.get('volet')
  const [onglet, setOnglet] = useState(VOLETS.includes(volet) ? volet : 'recap')

  useEffect(() => { charger() }, [souhaitId, user?.id])

  useEffect(() => {
    setOnglet(VOLETS.includes(volet) ? volet : 'recap')
  }, [souhaitId, volet])

  useEffect(() => {
    if (onglet !== 'medical' && onglet !== 'envoyer_rapport') return
    let stop = false
    supabase.from('souhait_medicaments').select('*').eq('souhait_id', souhaitId).then(({ data }) => {
      if (!stop) setMeds(data || [])
    })
    return () => { stop = true }
  }, [onglet, souhaitId])

  async function charger() {
    setErr(null)
    const { data, error } = await supabase.from('souhaits')
      .select('id, statut, fictif, date_souhaitee, date_fin, dates_possibles, beneficiaire_prenom, beneficiaire_nom, beneficiaire_ddn, beneficiaire_genre, description, localisation, besoins_specifiques, notes_medicales, mission')
      .eq('id', souhaitId)
      .maybeSingle()
    if (error || !data) {
      setErr(error?.message || 'Mission inaccessible.')
      return
    }
    const { data: me } = await supabase.from('souhait_personnel')
      .select('role_mission')
      .eq('souhait_id', souhaitId)
      .eq('user_id', user.id)
      .maybeSingle()
    let mission = data.mission || {}
    const jouetteCharge = !!(data.fictif || mission?.demo_cle)
    if (jouetteCharge) {
      const { data: sess } = await supabase.rpc('lire_session_formation', { p_souhait: souhaitId })
      if (sess?.ok && sess.etat) {
        mission = fusionMissionDemo(mission, sess.etat, null, user?.id)
      }
    }
    setMeta({
      ...data,
      mission,
      role_mission: me?.role_mission || null,
      sur_equipage: !!me,
    })
    const { data: ints } = await supabase.from('souhait_medicaments').select('*').eq('souhait_id', souhaitId)
    setMeds(ints || [])
  }

  if (err) {
    return (
      <div style={{ padding: 24 }}>
        <Flash kind="err">{err}</Flash>
        <Btn kind="soft" onClick={onBack}>← Mes souhaits</Btn>
      </div>
    )
  }
  if (!meta) return <div style={{ padding: 24 }}><Loading /></div>

  const jouette = !!(meta.fictif || meta.mission?.demo_cle)
  const coordination = (profile?.fiche?.roles_asbl || []).some(r => ROLES_COORD.includes(r))
  const medical = personneEstMedicale({
    role_mission: meta.role_mission,
    role: profile?.role,
    fiche: profile?.fiche,
  }) || estMedical?.()
  const staffTest = jouette && (accesTotal?.() || role === 'coordinateur' || role === 'admin' || role === 'president')
  const fenetre = fenetreStatuts(meta)
  const peutEcrire = medical || coordination || staffTest
  // Vrais souhaits : médicaux de l’équipage. Test/formation : médical, coordination, ou staff (pas d’équipage à poser).
  const peutExporter = coordination || staffTest || (medical && (!!meta.sur_equipage || jouette))

  return (
    <div>
      <div style={{ padding: '12px 14px 0' }}>
        <Btn kind="soft" onClick={onBack}>← Mes souhaits</Btn>
        <h1 style={{ fontSize: '1.45rem', color: 'var(--heading)', margin: '12px 0 8px' }}>
          {meta.beneficiaire_prenom || 'Mission'}
        </h1>
        <div className="ha-tabs" style={{ marginBottom: 4 }}>
          {ONGLETS.map(o => (
            <button key={o.v} type="button" className={'ha-tab' + (onglet === o.v ? ' is-on' : '')} onClick={() => setOnglet(o.v)}>
              {o.l}
            </button>
          ))}
        </div>
      </div>
      {onglet === 'recap' && <RecapMission souhaitId={souhaitId} />}
      {onglet === 'medical' && (
        <DossierDar
          souhaitId={souhaitId}
          individuel={jouette}
          peutEcrire={peutEcrire}
          peutNoter
          peutExporter={peutExporter}
          souhait={meta}
          meds={meds}
          onMedsChange={setMeds}
          onSouhaitMission={mission => setMeta(prev => prev ? { ...prev, mission } : prev)}
        />
      )}
      {onglet === 'documents' && <DocumentsMission souhaitId={souhaitId} />}
      {onglet === 'contacts' && <ContactsMission souhaitId={souhaitId} individuel={jouette} />}
      {onglet === 'envoyer_rapport' && (
        <EnvoiRapportMedical
          souhaitId={souhaitId}
          souhait={meta}
          meds={meds}
          peutExporter={peutExporter}
        />
      )}
      {onglet === 'statuts' && (
        fenetre.ouvert
          ? (
            <>
              {jouette && (
                <div style={{ padding: '0 16px 8px' }}>
                  <Flash kind="ok">
                    Formation Camille — vos statuts sont personnels et disponibles à tout moment (indépendants des autres volontaires).
                  </Flash>
                </div>
              )}
              <MissionExecution souhaitId={souhaitId} onBack={() => setOnglet('recap')} />
            </>
          )
          : (
            <div style={{ padding: 16 }}>
              <Flash kind="warn">{fenetre.raison}</Flash>
            </div>
          )
      )}
    </div>
  )
}
