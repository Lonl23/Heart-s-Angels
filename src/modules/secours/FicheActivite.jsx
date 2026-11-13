import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Btn, Empty, Loading, Flash } from '@/components/ui'
import config from '@/app.config'
import { lblRoleCompte } from '@/modules/fiche/ficheSchema'
import {
  COMPETENCES_ACTIVITE,
  libelleCompetence,
  libelleTypeActivite,
  libelleDispositif,
  competencesDuProfil,
  statutActivite,
  libelleStatutActivite,
  dureeActivite,
  estAVenir,
  selectionChauffeurEchue,
  telechargerBilan,
  ouvrirBilan,
  equipeDuDispositif,
  evaluerEquipeDispositif,
  texteManquesEquipe,
  libelleRoleEquipe,
  normaliserArmement,
  armementComplet,
  dispositifsDeActivite,
  suggestionDepuisDispositifs,
  libelleComptesEquipes,
  comptesEquipesDe,
  composerAdresse,
  estGrosPreventif,
  proposerDispAlphaId,
  estResponsableDpsProfil,
  peutCreerActiviteSecours,
} from './activitesSecours'
import {
  P2_ACTIVITE,
  E1_ENVIRONNEMENT,
  E2_DELAI,
  calculerDimensionnement,
  normaliserDimensionnement,
} from './dpsDimensionnement'

function pad(n) { return String(n).padStart(2, '0') }

function fmtDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

function fmtHeure(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function jourLocal(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fmtQuand(iso) {
  if (!iso) return ''
  return `${fmtDate(iso)} ${fmtHeure(iso)}`
}

export default function FicheActivite() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [activite, setActivite] = useState(null)
  const [inscriptions, setInscriptions] = useState([])
  const [gens, setGens] = useState([])
  const [auteur, setAuteur] = useState(null)
  const [onglet, setOnglet] = useState('info')
  const [sousPerso, setSousPerso] = useState('liste')
  const [sousLog, setSousLog] = useState('vehicule')
  const [loading, setLoading] = useState(true)
  const [absent, setAbsent] = useState(false)
  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filtreComp, setFiltreComp] = useState('')
  const [q, setQ] = useState('')
  const [armement, setArmement] = useState(null)
  const [plaques, setPlaques] = useState([])
  const [sauveArme, setSauveArme] = useState(false)
  const [dim, setDim] = useState(() => normaliserDimensionnement(null))
  const [sauveDim, setSauveDim] = useState(false)
  const [statsPatient, setStatsPatient] = useState({ secours: 0, evacuations: 0, assistees: 0, decedees: 0 })
  const [rapport, setRapport] = useState([])
  const [noteRapport, setNoteRapport] = useState('')
  const gerer = peutCreerActiviteSecours(profile)

  useEffect(() => { charger() }, [id, profile?.id])

  async function charger(silencieux = false) {
    if (!silencieux) setLoading(true)
    setErr(null)
    setAbsent(false)
    const a = await supabase
      .from('activites_secours')
      .select('id,numero,titre,type,dispositif,dispositifs,public_attendu,lieu,adresse,adresse_mode,adresse_rue,adresse_numero,adresse_cp,adresse_ville,organisateur_nom,organisateur_contact,responsable_preventif_id,disp_alpha_id,disp_bravo_id,debut,fin,places,competences,armement,dps_dimensionnement,created_by,created_at')
      .eq('id', id)
      .maybeSingle()
    if (a.error) {
      setErr(a.error.message || 'Chargement impossible.')
      if (!silencieux) setActivite(null)
      setLoading(false)
      return
    }
    if (!a.data) {
      setAbsent(true)
      setActivite(null)
      setLoading(false)
      return
    }
    const i = await supabase
      .from('activites_secours_inscrits')
      .select('id,user_id,created_at')
      .eq('activite_id', id)
    if (i.error) {
      setErr(i.error.message || 'Chargement des inscriptions impossible.')
      setActivite(a.data)
      setInscriptions([])
      setGens([])
      setLoading(false)
      return
    }
    const lignes = i.data || []
    const idsCmd = [
      a.data.responsable_preventif_id,
      a.data.disp_alpha_id,
      a.data.disp_bravo_id,
      a.data.created_by,
    ].filter(Boolean)
    const ids = [...new Set([
      ...lignes.map(x => x.user_id).filter(Boolean),
      ...idsCmd,
    ])]
    let profils = []
    if (ids.length) {
      const p = await supabase.from('profiles').select('id,prenom,nom,role,fiche').in('id', ids)
      if (p.error) setErr(p.error.message || 'Chargement du personnel impossible.')
      else profils = p.data || []
    }
    const parId = new Map(profils.map(p => [p.id, p]))
    let act = a.data
    const autoAlpha = proposerDispAlphaId(lignes.map(x => x.user_id), parId)
    if (
      autoAlpha
      && autoAlpha !== act.disp_alpha_id
      && peutCreerActiviteSecours(profile)
    ) {
      const maj = await supabase
        .from('activites_secours')
        .update({ disp_alpha_id: autoAlpha })
        .eq('id', id)
        .select('disp_alpha_id')
        .maybeSingle()
      if (!maj.error && maj.data) {
        act = { ...act, disp_alpha_id: maj.data.disp_alpha_id }
      }
    }
    setActivite(act)
    setArmement(normaliserArmement(act.armement, act))
    setDim(normaliserDimensionnement(act.dps_dimensionnement))
    setInscriptions(lignes)
    setGens(profils)
    setAuteur(act.created_by ? parId.get(act.created_by) || null : null)
    const pl = await supabase.from('plaques_vehicules').select('plaque,libelle').eq('actif', true).order('plaque')
    if (!pl.error) setPlaques(pl.data || [])
    const fp = await supabase
      .from('fiches_patient_dps')
      .select('id,orientation')
      .eq('activite_id', id)
    if (!fp.error) {
      const rows = fp.data || []
      setStatsPatient({
        secours: rows.length,
        evacuations: rows.filter(r => r.orientation === 'transport' || r.orientation === 'secours_publics').length,
        assistees: rows.filter(r => r.orientation === 'laisse_sur_place' || !r.orientation).length,
        decedees: rows.filter(r => r.orientation === 'decede').length,
      })
    }
    const rp = act.dps_dimensionnement?.rapport
    setRapport(Array.isArray(rp) ? rp : [])
    setLoading(false)
  }

  const mes = useMemo(() => competencesDuProfil(profile), [profile])
  const moi = inscriptions.some(i => i.user_id === profile?.id)
  const places = Number(activite?.places) || 0
  const n = inscriptions.length
  const statut = activite ? statutActivite(activite) : 'a_venir'
  const ouverte = activite ? estAVenir(activite) : false
  const complet = places > 0 && n >= places
  const requises = Array.isArray(activite?.competences) ? activite.competences : []
  const duree = activite ? dureeActivite(activite) : null
  const memeJour = activite && jourLocal(activite.debut) === jourLocal(activite.fin || activite.debut)
  const equipesIds = useMemo(() => dispositifsDeActivite(activite), [activite])
  const comptesEquipes = useMemo(() => comptesEquipesDe(activite), [activite])
  const evalEquipe = useMemo(
    () => evaluerEquipeDispositif(activite, gens),
    [activite, gens],
  )
  const sugEquipes = useMemo(() => suggestionDepuisDispositifs(activite), [activite])
  const libelleEquipes = useMemo(() => libelleComptesEquipes(activite), [activite])
  const parIdGens = useMemo(() => new Map(gens.map(g => [g.id, g])), [gens])
  const compsCouvertes = useMemo(() => {
    const req = Array.isArray(activite?.competences) ? activite.competences : []
    if (!req.length) return { ok: 0, total: 0 }
    let ok = 0
    for (const c of req) {
      if (gens.some(g => competencesDuProfil(g).has(c) || mesCorrespond(c, g))) ok += 1
    }
    return { ok, total: req.length }
  }, [activite?.competences, gens])

  const personnel = useMemo(() => {
    const parId = new Map(gens.map(g => [g.id, g]))
    const texte = q.trim().toLowerCase()
    return inscriptions
      .map(ins => {
        const g = parId.get(ins.user_id)
        const fiche = g?.fiche || {}
        const comps = g ? [...competencesDuProfil(g)] : []
        const quals = comps.filter(c => c !== 'medical' && c !== 'non_medical' && c !== 'volontaire_non_medical')
        const couvre = requises.some(c => comps.includes(c) || mesCorrespond(c, g))
        return {
          id: ins.user_id,
          inscription: ins.created_at,
          prenom: g?.prenom || '',
          nom: g?.nom || '',
          photo: fiche.photo_url || '',
          role: g?.role || '',
          quals,
          manque: requises.length > 0 && !couvre,
        }
      })
      .filter(p => {
        if (filtreComp && !p.quals.includes(filtreComp)) return false
        if (!texte) return true
        return `${p.prenom} ${p.nom}`.toLowerCase().includes(texte)
      })
      .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
  }, [inscriptions, gens, q, filtreComp, requises])

  function aller(tab) {
    setOnglet(tab)
    if (tab === 'personnel') setSousPerso('liste')
    if (tab === 'logistique') setSousLog('vehicule')
  }

  function majArmement(patch) {
    setArmement(a => ({ ...(a || normaliserArmement(null, activite)), ...patch }))
  }

  function majDim(patch) {
    setDim(d => ({ ...d, ...patch }))
  }

  async function sauverDimensionnement() {
    if (!activite?.id || sauveDim || !gerer) return
    setSauveDim(true)
    setFlash(null)
    const payload = normaliserDimensionnement(dim)
    const next = {
      ...(activite.dps_dimensionnement && typeof activite.dps_dimensionnement === 'object' ? activite.dps_dimensionnement : {}),
      ...payload,
      rapport,
    }
    const { error } = await supabase.from('activites_secours').update({
      dps_dimensionnement: next,
      public_attendu: payload.public_declare || activite.public_attendu,
    }).eq('id', activite.id)
    if (error) setFlash(error.message || 'Dimensionnement non enregistré.')
    else {
      setActivite(x => ({ ...x, dps_dimensionnement: next, public_attendu: payload.public_declare || x.public_attendu }))
      setDim(payload)
    }
    setSauveDim(false)
  }

  async function ajouterNoteRapport() {
    if (!gerer || !noteRapport.trim() || !activite?.id) return
    const entree = {
      id: crypto.randomUUID?.() || String(Date.now()),
      at: new Date().toISOString(),
      auteur: `${profile?.prenom || ''} ${profile?.nom || ''}`.trim() || '—',
      texte: noteRapport.trim().slice(0, 1000),
    }
    const nextRapport = [entree, ...rapport]
    setRapport(nextRapport)
    setNoteRapport('')
    const next = {
      ...(activite.dps_dimensionnement && typeof activite.dps_dimensionnement === 'object' ? activite.dps_dimensionnement : {}),
      ...normaliserDimensionnement(dim),
      rapport: nextRapport,
    }
    const { error } = await supabase.from('activites_secours').update({ dps_dimensionnement: next }).eq('id', activite.id)
    if (error) setFlash(error.message || 'Rapport non enregistré.')
    else setActivite(x => ({ ...x, dps_dimensionnement: next }))
  }

  const calcDim = useMemo(() => calculerDimensionnement(dim), [dim])

  function toggleItemArme(idItem) {
    setArmement(a => {
      const base = a || normaliserArmement(null, activite)
      return {
        ...base,
        items: base.items.map(it => it.id === idItem ? { ...it, ok: !it.ok } : it),
      }
    })
  }

  async function sauverArmement() {
    if (!activite?.id || !armement || sauveArme) return
    setSauveArme(true)
    setFlash(null)
    const payload = {
      plaque: armement.plaque || '',
      note: armement.note || '',
      items: armement.items || [],
    }
    const { error } = await supabase.from('activites_secours').update({ armement: payload }).eq('id', activite.id)
    if (error) setFlash(error.message || 'Armement non enregistré.')
    else {
      setActivite(x => ({ ...x, armement: payload }))
      setFlash(null)
    }
    setSauveArme(false)
  }

  function donneesBilan() {
    const a = config.bases?.[0]?.adresse || {}
    const adresse = [[a.rue, a.numero].filter(Boolean).join(' '), [a.cp, a.localite].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const equipe = inscriptions.map(ins => {
      const g = gens.find(x => x.id === ins.user_id)
      const fiche = g?.fiche || {}
      const quals = Array.isArray(fiche.qualifications) ? fiche.qualifications : []
      const personne = {
        prenom: g?.prenom || '',
        nom: g?.nom || '',
        quals,
        role: g?.role || '',
      }
      const couvre = requises.some(c => quals.includes(c) || mesCorrespond(c, g))
      return {
        prenom: personne.prenom,
        nom: personne.nom,
        fonction: fonctionDe(personne),
        couverture: requises.length === 0 ? 'Aucune exigée' : (couvre ? 'Couvre au moins une compétence' : 'Aucune des compétences demandées'),
      }
    }).sort((x, y) => `${x.nom} ${x.prenom}`.localeCompare(`${y.nom} ${y.prenom}`, 'fr'))
    return {
      organisation: org,
      adresse,
      logo: `${window.location.origin}${config.organisation?.logoUrl || '/icons/ha-logo-512-v4.png'}`,
      imprimePar: `${(profile?.nom || '').toUpperCase()} ${profile?.prenom || ''}`.trim(),
      numero: activite.numero,
      titre: activite.titre,
      type: libelleTypeActivite(activite.type),
      dispositif: libelleDispositif(activite.dispositif) || '',
      publicAttendu: activite.public_attendu == null ? '' : String(activite.public_attendu),
      debut: fmtQuand(activite.debut),
      fin: activite.fin ? fmtQuand(activite.fin) : '',
      duree: duree || '',
      lieu: activite.lieu || '',
      places,
      competences: requises.map(libelleCompetence),
      personnel: equipe,
      statut: libelleStatutActivite(statut),
      inscrits: n,
    }
  }

  function recupererBilan() {
    if (!telechargerBilan(donneesBilan())) setFlash('Le bilan n’a pas pu être téléchargé.')
  }

  function imprimerBilan() {
    if (!ouvrirBilan(donneesBilan())) setFlash('Le navigateur a bloqué la fenêtre du bilan. Utilisez Récupérer.')
  }

  async function inscrire() {
    if (!profile?.id || !activite || busy) return
    setBusy(true)
    setFlash(null)
    if (!moi && selectionChauffeurEchue(profile, activite)) {
      setFlash('Votre sélection médicale est échue. L’inscription n’est pas possible : cette activité demande un chauffeur.')
      setBusy(false)
      return
    }
    const res = moi
      ? await supabase.from('activites_secours_inscrits').delete().eq('activite_id', activite.id).eq('user_id', profile.id)
      : await supabase.from('activites_secours_inscrits').insert({ activite_id: activite.id, user_id: profile.id })
    if (res.error) setFlash(res.error.message || 'Inscription impossible.')
    else await charger(true)
    setBusy(false)
  }

  let libelle = 'S’inscrire'
  let desactive = false
  if (moi) libelle = 'Se désinscrire'
  else if (!ouverte) { libelle = 'Terminée'; desactive = true }
  else if (complet) { libelle = 'Complet'; desactive = true }

  const org = config.organisation?.nom || 'Heart’s Angels ASBL'
  const adresseComposee = activite
    ? (composerAdresse({
      mode: activite.adresse_mode,
      rue: activite.adresse_rue,
      numero: activite.adresse_numero,
      cp: activite.adresse_cp,
      ville: activite.adresse_ville,
    }) || activite.adresse || '')
    : ''
  const lieuMaps = adresseComposee || activite?.lieu || ''
  const lieuUrl = lieuMaps
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lieuMaps)}`
    : ''
  function nomDe(uid) {
    if (!uid) return '—'
    const g = parIdGens.get(uid)
    if (!g) return '—'
    return `${g.prenom || ''} ${g.nom || ''}`.trim() || '—'
  }

  if (loading) {
    return <Page title="Activité"><Loading /></Page>
  }
  if (!activite) {
    return (
      <Page title="Activité">
        {err && <Flash kind="err">{err}</Flash>}
        <Empty
          title={absent ? 'Activité introuvable' : 'Activité indisponible'}
          hint={absent ? 'Elle a été retirée, ou le lien ne correspond à rien.' : 'Le chargement a échoué.'}
          action={<Link to="/app/secours/activites">Retour aux activités</Link>}
        />
      </Page>
    )
  }

  return (
    <Page>
      <style>{CSS}</style>
      {err && <Flash kind="err">{err}</Flash>}
      {flash && <Flash kind="err">{flash}</Flash>}
      <div className="ha-afiche">
        <header className="ha-afiche-head">
          <div className="ha-afiche-top">
            <div>
              <p className="ha-afiche-fil">
                <Link to="/app/secours/activites">Activités</Link>
                <span> · </span>
                <span>{libelleStatutActivite(statut)}</span>
                <span> · </span>
                <span>{libelleTypeActivite(activite.type)}</span>
                {activite.numero != null && <span> · #{activite.numero}</span>}
              </p>
              <h1>{activite.titre}</h1>
              <p className="ha-afiche-quand">
                {memeJour
                  ? fmtDate(activite.debut)
                  : `du ${fmtDate(activite.debut)} au ${fmtDate(activite.fin || activite.debut)}`}
                {' · '}
                {fmtHeure(activite.debut)}
                {activite.fin ? ` – ${fmtHeure(activite.fin)}` : ''}
                {duree ? ` (${duree})` : ''}
                {(adresseComposee || activite.lieu) ? ` · ${adresseComposee || activite.lieu}` : ''}
              </p>
            </div>
            <span className={'ha-afiche-etat is-' + statut}>{libelleStatutActivite(statut)}</span>
          </div>
          <div className="ha-afiche-chiffres">
            <Chiffre label="Personnel inscrit" valeur={`${n} / ${places || '—'}`} />
            <Chiffre label="Logistique" valeur={armement?.plaque ? '1 véhicule' : (plaques.length ? `${plaques.length} dispo.` : '—')} />
            <Chiffre label="Places restantes" valeur={places ? Math.max(places - n, 0) : '—'} />
            <Chiffre label="Compétences" valeur={compsCouvertes.total ? `${compsCouvertes.ok}/${compsCouvertes.total}` : '—'} />
          </div>
        </header>

        <nav className="ha-afiche-onglets" aria-label="Fiche de l’activité">
          {[
            { v: 'info', l: 'Information' },
            { v: 'personnel', l: `Personnel${n ? ` (${n})` : ''}` },
            { v: 'logistique', l: 'Logistique' },
            { v: 'intervention', l: 'Intervention' },
            { v: 'rapport', l: 'Rapport' },
            { v: 'statistique', l: 'Statistique' },
            { v: 'dps', l: 'DPS' },
          ].map(t => (
            <button key={t.v} type="button" className={onglet === t.v ? 'is-on' : ''} onClick={() => aller(t.v)}>{t.l}</button>
          ))}
        </nav>

        {onglet === 'info' && (
          <div className="ha-afiche-grille">
            <section className="ha-afiche-carte">
              <h2>Détails de l’activité</h2>
              <p className="ha-afiche-sec">Identité</p>
              <div className="ha-afiche-kv">
                <Champ k="N°" v={activite.numero ?? '—'} />
                <Champ k="Statut" v={libelleStatutActivite(statut)} />
                <Champ k="Type" v={libelleTypeActivite(activite.type)} />
                <Champ k="Nom" v={activite.titre} />
                <Champ k="Équipes" v={libelleEquipes || '—'} />
                <Champ k="Effectif min." v={sugEquipes?.resume || '—'} />
                <Champ k="Public attendu" v={activite.public_attendu == null ? '—' : String(activite.public_attendu)} />
                <Champ k="Organisateur" v={activite.organisateur_nom || '—'} />
                <Champ k="Contact orga." v={activite.organisateur_contact || '—'} />
              </div>
              <p className="ha-afiche-sec">Commandement</p>
              <div className="ha-afiche-kv">
                <Champ k="Resp. préventif" v={nomDe(activite.responsable_preventif_id)} />
                <Champ
                  k="Disp Alpha"
                  v={nomDe(activite.disp_alpha_id) + (activite.disp_alpha_id && estResponsableDpsProfil(parIdGens.get(activite.disp_alpha_id)) ? ' · resp. DPS' : '')}
                />
                <Champ
                  k="Disp Bravo"
                  v={estGrosPreventif(activite)
                    ? nomDe(activite.disp_bravo_id)
                    : (activite.disp_bravo_id ? nomDe(activite.disp_bravo_id) : '— (optionnel)')}
                />
              </div>
              <p className="ha-afiche-vide">Les équipes se choisissent à la création (plusieurs possibles). Pas de calcul depuis le public. « Minimum » = ordre des qualifications 1→7. Un responsable DPS inscrit devient d’office Disp Alpha.</p>
              {sugEquipes && (
                <p className={'ha-afiche-vide'} style={{ color: evalEquipe.ok ? 'var(--heading)' : '#A32D2D', marginTop: 8 }}>
                  {evalEquipe.ok
                    ? 'Équipes inscrites : effectifs minimum atteints.'
                    : `Équipe incomplète — manque : ${texteManquesEquipe(evalEquipe)}.`}
                </p>
              )}
              <p className="ha-afiche-sec">Organisation</p>
              <div className="ha-afiche-kv">
                <Champ k="Organisée par" v={org} />
                <Champ k="Créée par" v={auteur ? `${auteur.prenom || ''} ${auteur.nom || ''}`.trim() : '—'} />
              </div>
              <p className="ha-afiche-sec">Date et horaires</p>
              <div className="ha-afiche-kv">
                <Champ k="Début" v={fmtQuand(activite.debut)} />
                <Champ k="Fin" v={activite.fin ? fmtQuand(activite.fin) : '—'} />
                <Champ k="Durée" v={duree || '—'} />
              </div>
              <p className="ha-afiche-sec">Suivi</p>
              <Champ k="Créée le" v={fmtQuand(activite.created_at) || '—'} />
            </section>

            <section className="ha-afiche-carte">
              <h2>Inscription</h2>
              <p className="ha-afiche-sec">État</p>
              <div className="ha-afiche-kv">
                <Champ k="Statut" v={libelleStatutActivite(statut)} />
                <Champ k="Places" v={places ? `${Math.max(places - n, 0)} libre${places - n > 1 ? 's' : ''}` : '—'} />
                <Champ k="Qui peut s’inscrire" v="Personnel de l’association" />
              </div>
              <p className="ha-afiche-sec">Compétences demandées</p>
              {requises.length === 0
                ? <p className="ha-afiche-vide">Aucune compétence exigée.</p>
                : (
                  <div className="ha-afiche-chips">
                    {requises.map(c => (
                      <span key={c} className={'ha-act-chip' + (mes.has(c) ? ' is-moi' : ' is-autre')}>
                        {mes.has(c) ? '✓' : '•'} {libelleCompetence(c)}
                      </span>
                    ))}
                  </div>
                )}
              <div style={{ marginTop: 14 }}>
                <Btn onClick={inscrire} disabled={desactive || busy} kind={moi ? 'danger' : 'primary'}>
                  {busy ? '…' : libelle}
                </Btn>
              </div>
            </section>

            <section className="ha-afiche-carte">
              <h2>Lieu</h2>
              {adresseComposee || activite.lieu
                ? (
                  <>
                    {activite.lieu && <p className="ha-afiche-lieu">{activite.lieu}</p>}
                    {adresseComposee && (
                      <p className="ha-afiche-lieu" style={{ marginTop: activite.lieu ? 6 : 0 }}>
                        {adresseComposee}
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {activite.adresse_mode === 'approximative' ? 'Adresse approximative (CP + ville)' : 'Adresse exacte (rue + n°)'}
                        </span>
                      </p>
                    )}
                    {lieuUrl && <a className="ha-afiche-maps" href={lieuUrl} target="_blank" rel="noreferrer">Ouvrir dans Google Maps</a>}
                  </>
                )
                : <p className="ha-afiche-vide">Aucun lieu renseigné.</p>}
              {(activite.organisateur_nom || activite.organisateur_contact) && (
                <div className="ha-afiche-kv" style={{ marginTop: 14 }}>
                  <Champ k="Organisateur" v={activite.organisateur_nom || '—'} />
                  <Champ k="Contact" v={activite.organisateur_contact || '—'} />
                </div>
              )}
            </section>
          </div>
        )}

        {onglet === 'personnel' && (
          <>
            <nav className="ha-afiche-sousnav" aria-label="Personnel">
              {[
                { v: 'liste', l: 'Liste' },
                { v: 'equipe', l: 'Équipe' },
                { v: 'affectation', l: 'Affectation' },
              ].map(s => (
                <button key={s.v} type="button" className={sousPerso === s.v ? 'is-on' : ''} onClick={() => setSousPerso(s.v)}>{s.l}</button>
              ))}
            </nav>
            <div className="ha-afiche-bandeau">
              <span><strong>{n}/{places || '—'}</strong> inscrit</span>
              <span><strong>{compsCouvertes.ok}/{compsCouvertes.total || '—'}</strong> compétence</span>
              <span style={{ color: evalEquipe.ok ? undefined : '#A32D2D' }}>
                {evalEquipe.ok ? 'Effectif min. OK' : `Manque : ${texteManquesEquipe(evalEquipe)}`}
              </span>
            </div>

            {sousPerso === 'liste' && (
              <section className="ha-afiche-carte">
                <h2>Personnel inscrit</h2>
                <div className="ha-afiche-outils">
                  <select aria-label="Compétence" value={filtreComp} onChange={e => setFiltreComp(e.target.value)}>
                    <option value="">Toutes les compétences</option>
                    {COMPETENCES_ACTIVITE.filter(c => c.v !== 'medical' && c.v !== 'non_medical').map(c => (
                      <option key={c.v} value={c.v}>{c.l}</option>
                    ))}
                  </select>
                  <input type="search" placeholder="Rechercher" aria-label="Rechercher une personne" value={q} onChange={e => setQ(e.target.value)} />
                </div>
                {personnel.length === 0 ? (
                  <p className="ha-afiche-vide">{inscriptions.length === 0 ? 'Personne n’est inscrit pour le moment.' : 'Aucune personne ne correspond.'}</p>
                ) : (
                  <div className="ha-afiche-table-wrap">
                    <table className="ha-afiche-table">
                      <thead>
                        <tr>
                          <th>Photo</th>
                          <th>Personnel</th>
                          <th>Fonction</th>
                          <th>Compétence</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {personnel.map(p => (
                          <tr key={p.id} className={p.manque ? 'is-manque' : undefined}>
                            <td><Portrait url={p.photo} prenom={p.prenom} nom={p.nom} /></td>
                            <td>
                              <strong>{`${p.prenom} ${p.nom}`.trim() || 'Compte retiré'}</strong>
                              <span className="ha-afiche-sous">{fmtDate(p.inscription)}</span>
                            </td>
                            <td>{fonctionDe(p)}</td>
                            <td>
                              {p.quals.length === 0
                                ? <span className="ha-afiche-vide">—</span>
                                : p.quals.map(c => (
                                  <span key={c} className={'ha-act-chip' + (requises.includes(c) ? ' is-moi' : '')}>
                                    {libelleCompetence(c)}
                                  </span>
                                ))}
                            </td>
                            <td>
                              {p.id === profile?.id && (
                                <button type="button" className="ha-afiche-moi" onClick={inscrire} disabled={busy}>
                                  {busy ? '…' : 'Se désinscrire'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {sousPerso === 'equipe' && (
              <section className="ha-afiche-carte">
                <h2>Équipes / dispositifs</h2>
                <div className="ha-afiche-info-box">
                  <strong>Deux usages</strong>
                  <p>L’équipe opérationnelle structure le dispositif. Les affectations aux postes organisent qui est où pendant le créneau.</p>
                </div>
                {equipesIds.length === 0 ? (
                  <p className="ha-afiche-vide">Aucune équipe choisie à la création.</p>
                ) : equipesIds.map(eid => {
                  const eq = equipeDuDispositif(eid)
                  const qte = comptesEquipes[eid] || 0
                  return (
                    <div key={eid} className="ha-afiche-equipe-bloc">
                      <div className="ha-afiche-equipe-titre">
                        <strong>{qte > 1 ? `${qte}× ` : ''}{libelleDispositif(eid, true)}</strong>
                        <span>{eq?.resume}</span>
                      </div>
                      <div className="ha-afiche-slots">
                        {(eq?.alternatives?.[0] || []).flatMap(b => Array.from({ length: b.n * Math.max(1, qte) }, (_, i) => (
                          <div key={`${b.role}-${i}`} className="ha-afiche-slot">
                            <span>{libelleRoleEquipe(b.role)}</span>
                            <em>Poste libre</em>
                          </div>
                        )))}
                      </div>
                    </div>
                  )
                })}
                <div className="ha-afiche-equipe-bloc" style={{ marginTop: 12 }}>
                  <div className="ha-afiche-equipe-titre">
                    <strong>Véhicule</strong>
                    <span>{armement?.plaque || 'Sans plaque'}</span>
                  </div>
                  <p className="ha-afiche-vide">Affectations aux postes : à compléter depuis la liste du personnel.</p>
                </div>
              </section>
            )}

            {sousPerso === 'affectation' && (
              <section className="ha-afiche-carte">
                <h2>Affectation</h2>
                <p className="ha-afiche-vide">
                  Commandement : Resp. {nomDe(activite.responsable_preventif_id)} · Alpha {nomDe(activite.disp_alpha_id)}
                  {activite.disp_bravo_id ? ` · Bravo ${nomDe(activite.disp_bravo_id)}` : ''}
                </p>
                <p className="ha-afiche-vide" style={{ marginTop: 8 }}>
                  Les postes d’équipe restent affectables par créneau. L’inscription globale est dans l’onglet Liste.
                </p>
              </section>
            )}
          </>
        )}

        {onglet === 'logistique' && (
          <>
            <nav className="ha-afiche-sousnav" aria-label="Logistique">
              {[
                { v: 'vehicule', l: 'Véhicule' },
                { v: 'materiel', l: 'Matériel' },
                { v: 'scanner', l: 'Scanner' },
              ].map(s => (
                <button key={s.v} type="button" className={sousLog === s.v ? 'is-on' : ''} onClick={() => setSousLog(s.v)}>{s.l}</button>
              ))}
            </nav>

            {sousLog === 'vehicule' && (
              <section className="ha-afiche-carte">
                <h2>Véhicules</h2>
                {armement && gerer && (
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Véhicule affecté (plaque)</span>
                    <select
                      value={armement.plaque || ''}
                      onChange={e => majArmement({ plaque: e.target.value })}
                      style={{ width: '100%', maxWidth: 360, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                    >
                      <option value="">—</option>
                      {plaques.map(p => (
                        <option key={p.plaque} value={p.plaque}>{p.plaque}{p.libelle ? ` — ${p.libelle}` : ''}</option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="ha-afiche-table-wrap">
                  <table className="ha-afiche-table">
                    <thead>
                      <tr><th>Véhicule</th><th>Fonction</th><th>État</th></tr>
                    </thead>
                    <tbody>
                      {armement?.plaque ? (
                        <tr>
                          <td><strong>{armement.plaque}</strong></td>
                          <td>Dispositif</td>
                          <td><span className="ha-act-chip is-moi">Opérationnel</span></td>
                        </tr>
                      ) : (
                        <tr><td colSpan={3}><span className="ha-afiche-vide">Aucun véhicule affecté.</span></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {gerer && <div style={{ marginTop: 12 }}><Btn onClick={sauverArmement} disabled={sauveArme}>{sauveArme ? '…' : 'Enregistrer'}</Btn></div>}
              </section>
            )}

            {sousLog === 'materiel' && (
              <section className="ha-afiche-carte">
                <h2>Matériel attendu</h2>
                {armement?.items?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {armement.items.map(it => (
                      <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: gerer ? 'pointer' : 'default' }}>
                        <input type="checkbox" checked={!!it.ok} disabled={!gerer} onChange={() => toggleItemArme(it.id)} />
                        <span>{it.label}</span>
                      </label>
                    ))}
                  </div>
                ) : <p className="ha-afiche-vide">Aucun matériel listé.</p>}
                <label style={{ display: 'block', marginTop: 12 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Note / dérogation</span>
                  <textarea
                    value={armement?.note || ''}
                    disabled={!gerer}
                    onChange={e => majArmement({ note: e.target.value })}
                    rows={2}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                  />
                </label>
                <p className="ha-afiche-vide" style={{ marginTop: 8 }}>
                  {armementComplet(armement) ? 'Checklist complète.' : 'Checklist incomplète.'}
                </p>
                {gerer && <Btn onClick={sauverArmement} disabled={sauveArme}>{sauveArme ? '…' : 'Enregistrer l’armement'}</Btn>}
              </section>
            )}

            {sousLog === 'scanner' && (
              <section className="ha-afiche-carte">
                <h2>Scanner</h2>
                <p className="ha-afiche-vide">Le scan d’emport matériel se fait depuis le module Stock / Scan emport. Relier le DPS à un lot d’emport dans une prochaine itération.</p>
              </section>
            )}
          </>
        )}

        {onglet === 'intervention' && (
          <section className="ha-afiche-carte">
            <h2>Intervention · carte</h2>
            {lieuMaps ? (
              <>
                <p className="ha-afiche-lieu">{lieuMaps}</p>
                <div className="ha-afiche-carte-map">
                  <iframe
                    title="Carte du dispositif"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(lieuMaps)}&z=15&output=embed`}
                  />
                </div>
                {lieuUrl && <a className="ha-afiche-maps" href={lieuUrl} target="_blank" rel="noreferrer">Ouvrir dans Google Maps</a>}
              </>
            ) : (
              <p className="ha-afiche-vide">Aucune adresse pour afficher la carte. Renseignez rue/n° ou CP/ville à la création.</p>
            )}
          </section>
        )}

        {onglet === 'rapport' && (
          <section className="ha-afiche-carte">
            <h2>Rapport <span className="ha-afiche-badge">{rapport.length}</span></h2>
            <p className="ha-afiche-vide">Chronologie des messages, interventions et changements de statut.</p>
            {gerer && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={noteRapport}
                  onChange={e => setNoteRapport(e.target.value)}
                  placeholder="Ajouter une entrée…"
                  style={{ flex: 1, minWidth: 200, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                />
                <Btn onClick={ajouterNoteRapport} disabled={!noteRapport.trim()}>Ajouter</Btn>
              </div>
            )}
            {rapport.length === 0 ? (
              <div className="ha-afiche-empty">
                <p><strong>Aucune entrée dans le rapport</strong></p>
                <p className="ha-afiche-vide">Les messages, interventions et changements de statut apparaîtront ici.</p>
              </div>
            ) : (
              <ul className="ha-afiche-rapport">
                {rapport.map(e => (
                  <li key={e.id}>
                    <strong>{fmtQuand(e.at)}</strong>
                    <span>{e.auteur}</span>
                    <p>{e.texte}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="ha-dps-actions" style={{ marginTop: 14 }}>
              <Btn onClick={recupererBilan}>Récupérer le bilan</Btn>
              <Btn kind="soft" onClick={imprimerBilan}>Imprimer</Btn>
            </div>
          </section>
        )}

        {onglet === 'statistique' && (
          <div className="ha-afiche-stats">
            <StatCard label="Secours à personnes" sous="Malaise, soin" valeur={statsPatient.secours} ton="vert" />
            <StatCard label="Évacuations réalisées" sous="Transport / secours publics" valeur={statsPatient.evacuations} ton="orange" />
            <StatCard label="Personnes assistées" sous="Laissées sur place" valeur={statsPatient.assistees} ton="violet" />
            <StatCard label="Personnes décédées" sous="Décédé" valeur={statsPatient.decedees} ton="bleu" />
            <p className="ha-afiche-vide" style={{ gridColumn: '1 / -1' }}>
              Compteurs issus des fiches patient liées (`patient-registry` / `fiches_patient_dps`). Automatique.
            </p>
          </div>
        )}

        {onglet === 'dps' && (
          <>
            <div className="ha-afiche-bandeau">
              <span><strong>{calcDim.secouristesPublic}</strong> public secouristes</span>
              <span><strong>{calcDim.acteurs}</strong> acteurs équiv.</span>
              <span><strong>{calcDim.encadrement}</strong> encadrement</span>
              <span><strong>{calcDim.total}</strong> personnes au total</span>
            </div>
            <p className="ha-afiche-vide" style={{ margin: '0 2px 8px' }}>{calcDim.message}</p>

            <div className="ha-afiche-grille">
              <section className="ha-afiche-carte">
                <h2>Demande</h2>
                <label style={{ display: 'block', marginBottom: 10 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Effectif déclaré au public</span>
                  <input type="number" min={0} value={dim.public_declare} disabled={!gerer} onChange={e => majDim({ public_declare: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />
                </label>
                <label style={{ display: 'block', marginBottom: 10 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Équivalence intervenants (acteurs)</span>
                  <input type="number" min={0} value={dim.acteurs_equivalent} disabled={!gerer} onChange={e => majDim({ acteurs_equivalent: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Descriptif demande acteurs</span>
                  <textarea rows={3} value={dim.acteurs_descriptif} disabled={!gerer} onChange={e => majDim({ acteurs_descriptif: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />
                </label>
              </section>

              <section className="ha-afiche-carte">
                <h2>Activité (indicateur P2)</h2>
                {P2_ACTIVITE.map(opt => (
                  <label key={opt.v} className={'ha-afiche-toggle' + (dim.p2 === opt.v ? ' is-on' : '')}>
                    <span>
                      <strong>{opt.l}</strong>
                      <em>{opt.detail}</em>
                    </span>
                    <input type="radio" name="p2" checked={dim.p2 === opt.v} disabled={!gerer} onChange={() => majDim({ p2: opt.v })} />
                    <b>{opt.poids.toFixed(2)}</b>
                  </label>
                ))}
              </section>
            </div>

            <div className="ha-afiche-grille">
              <section className="ha-afiche-carte">
                <h2>Environnement (E1)</h2>
                {E1_ENVIRONNEMENT.map(opt => (
                  <label key={opt.v} className={'ha-afiche-toggle' + (dim.e1 === opt.v ? ' is-on' : '')}>
                    <span>
                      <strong>{opt.l}</strong>
                      <em>{opt.detail}</em>
                    </span>
                    <input type="radio" name="e1" checked={dim.e1 === opt.v} disabled={!gerer} onChange={() => majDim({ e1: opt.v })} />
                    <b>{opt.poids.toFixed(2)}</b>
                  </label>
                ))}
              </section>
              <section className="ha-afiche-carte">
                <h2>Délai secours publics (E2)</h2>
                {E2_DELAI.map(opt => (
                  <label key={opt.v} className={'ha-afiche-toggle' + (dim.e2 === opt.v ? ' is-on' : '')}>
                    <span><strong>{opt.l}</strong></span>
                    <input type="radio" name="e2" checked={dim.e2 === opt.v} disabled={!gerer} onChange={() => majDim({ e2: opt.v })} />
                    <b>{opt.poids.toFixed(2)}</b>
                  </label>
                ))}
              </section>
            </div>

            <section className="ha-afiche-carte">
              <h2>Rappel RNMSC-DPS</h2>
              <p className="ha-afiche-vide">
                Arrêté du 7 novembre 2006 fixant le référentiel national relatif aux dispositifs prévisionnels de secours (NOR : INTE0600910A).
                Référentiel national – Missions de Sécurité Civile : Dispositifs Prévisionnels de Secours.
                En Belgique, croiser avec la loi AMU du 8 juillet 1964 (voir docs/secours/).
              </p>
              {gerer && (
                <div style={{ marginTop: 12 }}>
                  <Btn onClick={sauverDimensionnement} disabled={sauveDim}>{sauveDim ? '…' : 'Enregistrer le dimensionnement'}</Btn>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Page>
  )
}

function mesCorrespond(cle, profil) {
  if (!profil) return false
  if (cle === 'medical') return profil.fiche?.type_benevole === 'medical' || profil.role === 'volontaire_medical'
  if (cle === 'non_medical') return profil.fiche?.type_benevole === 'non_medical' || profil.role === 'volontaire_non_medical'
  return false
}

function fonctionDe(p) {
  const q = p.quals.find(c => c !== 'autre') || p.quals[0]
  if (q) return libelleCompetence(q)
  if (p.role) return lblRoleCompte(p.role)
  return '—'
}

function Champ({ k, v }) {
  return (
    <div>
      <div className="ha-afiche-k">{k}</div>
      <div className="ha-afiche-v">{v || '—'}</div>
    </div>
  )
}

function Chiffre({ label, valeur }) {
  return (
    <div>
      <div className="ha-afiche-k">{label}</div>
      <div className="ha-afiche-nb">{valeur}</div>
    </div>
  )
}

function StatCard({ label, sous, valeur, ton }) {
  return (
    <div className={'ha-afiche-stat is-' + ton}>
      <div className="ha-afiche-k">{label}</div>
      <div className="ha-afiche-nb">{valeur}</div>
      <div className="ha-afiche-sous">{sous} · Automatique</div>
    </div>
  )
}

function Portrait({ url, prenom, nom }) {
  const ini = `${(prenom || '').charAt(0)}${(nom || '').charAt(0)}`.toUpperCase() || '?'
  return (
    <span className="ha-afiche-photo">
      {url ? <img src={url} alt="" /> : <span>{ini}</span>}
    </span>
  )
}

const CSS = `
.ha-afiche { display: flex; flex-direction: column; gap: 12px; }
.ha-afiche-head, .ha-afiche-carte {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 16px 12px;
}
.ha-afiche-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.ha-afiche-fil { margin: 0 0 6px; font-size: 12.5px; color: var(--text-muted); }
.ha-afiche-fil a { color: var(--accent); font-weight: 700; text-decoration: none; }
.ha-afiche-retour { font-size: 12.5px; font-weight: 700; color: var(--accent); text-decoration: none; }
.ha-afiche-type { margin: 6px 0 0; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
.ha-afiche h1 { margin: 2px 0 0; font-size: 1.35rem; color: var(--heading); line-height: 1.2; }
.ha-afiche-quand { margin: 4px 0 0; color: var(--text-muted); font-size: 13px; }
.ha-afiche-sousnav { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
.ha-afiche-sousnav button {
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  border-radius: 999px; padding: 5px 12px; font-size: 12.5px; font-weight: 650; font-family: inherit; cursor: pointer;
}
.ha-afiche-sousnav button.is-on { background: var(--accent); color: #fff; border-color: var(--accent); }
.ha-afiche-bandeau {
  display: flex; flex-wrap: wrap; gap: 14px; padding: 10px 14px; border-radius: 12px;
  background: var(--bg-alt); border: 1px solid var(--border); font-size: 13px; color: var(--text-muted);
}
.ha-afiche-bandeau strong { color: var(--heading); }
.ha-afiche-info-box {
  margin: 10px 0 14px; padding: 10px 12px; border-radius: 10px; background: #EAF3FB; color: #185FA5; font-size: 13px;
}
.ha-afiche-info-box p { margin: 4px 0 0; }
.ha-afiche-equipe-bloc { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
.ha-afiche-equipe-titre { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.ha-afiche-equipe-titre span { color: var(--text-muted); font-size: 12.5px; }
.ha-afiche-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.ha-afiche-slot {
  border: 1px dashed var(--border); border-radius: 10px; padding: 10px; min-height: 64px;
  display: flex; flex-direction: column; gap: 4px; font-size: 12.5px;
}
.ha-afiche-slot em { color: var(--text-muted); font-style: normal; }
.ha-afiche-carte-map {
  margin: 10px 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); aspect-ratio: 16 / 10; background: var(--bg-alt);
}
.ha-afiche-carte-map iframe { width: 100%; height: 100%; border: 0; display: block; }
.ha-afiche-badge {
  display: inline-flex; align-items: center; justify-content: center; min-width: 1.4em; height: 1.4em;
  margin-left: 6px; padding: 0 6px; border-radius: 999px; background: #EAF3FB; color: #185FA5; font-size: 12px;
}
.ha-afiche-empty { text-align: center; padding: 28px 12px; }
.ha-afiche-rapport { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ha-afiche-rapport li { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
.ha-afiche-rapport strong { display: block; font-size: 12.5px; color: var(--heading); }
.ha-afiche-rapport span { font-size: 12px; color: var(--text-muted); }
.ha-afiche-rapport p { margin: 6px 0 0; font-size: 13.5px; }
.ha-afiche-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ha-afiche-stat { border: 1px solid var(--border); border-radius: 14px; padding: 14px; background: var(--card); }
.ha-afiche-stat.is-vert { border-color: #9fd4b0; }
.ha-afiche-stat.is-orange { border-color: #f0c28a; }
.ha-afiche-stat.is-violet { border-color: #c9b6e8; }
.ha-afiche-stat.is-bleu { border-color: #9ec0e8; }
.ha-afiche-toggle {
  display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center;
  padding: 10px 0; border-bottom: 1px solid var(--border); cursor: pointer;
}
.ha-afiche-toggle.is-on { background: rgba(15, 92, 76, 0.06); margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 8px; }
.ha-afiche-toggle strong { display: block; font-size: 13.5px; color: var(--heading); }
.ha-afiche-toggle em { display: block; font-style: normal; font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.ha-afiche-toggle b { font-variant-numeric: tabular-nums; color: var(--text-muted); font-size: 12.5px; }
.ha-afiche-etat {
  flex: none;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}
.ha-afiche-etat.is-a_venir { background: #E6F1FB; color: #185FA5; }
.ha-afiche-etat.is-en_cours { background: #E7F6EE; color: #1E7A45; }
.ha-afiche-etat.is-terminee { background: var(--bg-alt); color: var(--text-muted); }
.ha-afiche-chiffres {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.ha-afiche-nb { font-size: 1.35rem; font-weight: 700; color: var(--heading); font-variant-numeric: tabular-nums; }
.ha-dps-temps { display: flex; gap: 8px; flex-wrap: wrap; }
.ha-dps-temps button {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid var(--border); background: var(--card); color: var(--text);
  border-radius: 999px; padding: 7px 12px; font: inherit; font-weight: 700; font-size: 13.5px; cursor: pointer;
}
.ha-dps-temps button span {
  width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
  background: var(--bg-alt); color: var(--heading); font-size: 12px;
}
.ha-dps-temps button.is-on { border-color: var(--accent); color: var(--heading); }
.ha-dps-temps button.is-on span { background: var(--accent); color: #fff; }
.ha-dps-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.ha-afiche-onglets { display: flex; gap: 6px; border-bottom: 1px solid var(--border); }
.ha-afiche-onglets button {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-weight: 700;
  font-size: 14px;
  padding: 8px 12px 10px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.ha-afiche-onglets button.is-on { color: var(--accent-blue); border-bottom-color: var(--accent); }
.ha-afiche-grille {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(220px, .8fr);
  gap: 12px;
  align-items: start;
}
.ha-afiche-carte h2 { margin: 0; font-size: 1rem; color: var(--heading); }
.ha-afiche-sec {
  margin: 14px 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.ha-afiche-kv { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
.ha-afiche-k { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
.ha-afiche-v { margin-top: 2px; font-size: 14px; font-weight: 650; color: var(--text); }
.ha-afiche-vide { margin: 0; color: var(--text-muted); font-size: 13px; }
.ha-afiche-lieu { margin: 8px 0; font-weight: 700; color: var(--heading); }
.ha-afiche-maps { color: var(--accent); font-weight: 700; font-size: 13px; }
.ha-afiche-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.ha-act-chip {
  display: inline-flex; align-items: center; gap: 4px;
  margin: 2px 4px 2px 0; padding: 2px 8px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700; border: 1px solid var(--border);
  background: var(--bg-alt); color: var(--text-2); white-space: nowrap;
}
.ha-act-chip.is-moi { color: #1E7A45; background: #E7F6EE; border-color: #B7E4C7; }
.ha-act-chip.is-autre { color: #C26A12; background: #FFF4E8; border-color: #F3D2A8; }
.ha-afiche-outils { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.ha-afiche-outils select, .ha-afiche-outils input {
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font: inherit; font-size: 13px; padding: 7px 10px;
}
.ha-afiche-outils input { margin-left: auto; min-width: min(240px, 70vw); }
.ha-afiche-table-wrap { overflow: auto; }
.ha-afiche-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 640px; }
.ha-afiche-table th {
  text-align: left; font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
  color: var(--text-muted); font-weight: 700; padding: 8px 10px; border-bottom: 1px solid var(--border);
}
.ha-afiche-table td { padding: 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.ha-afiche-table tr.is-manque td { background: #fff6f6; }
.ha-afiche-table td strong { display: block; color: var(--accent-blue); }
.ha-afiche-sous { display: block; color: var(--text-muted); font-size: 12px; font-weight: 500; }
.ha-afiche-photo {
  width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
  display: grid; place-items: center; background: var(--accent); color: #fff; font-weight: 700; font-size: 12px;
}
.ha-afiche-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ha-afiche-moi {
  border: 1px solid var(--border); background: var(--card); color: #A32D2D;
  border-radius: 8px; padding: 5px 8px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
}
[data-theme="dark"] .ha-afiche-etat.is-a_venir { background: rgba(24,95,165,.28); color: #8EBFEE; }
[data-theme="dark"] .ha-afiche-etat.is-en_cours { background: rgba(46,155,87,.22); color: #8ED7A8; }
[data-theme="dark"] .ha-act-chip.is-moi { color: #B7E08A; background: rgba(59,109,17,.22); border-color: rgba(59,109,17,.45); }
[data-theme="dark"] .ha-act-chip.is-autre { color: #F0C36A; background: rgba(186,117,23,.2); border-color: rgba(186,117,23,.45); }
[data-theme="dark"] .ha-afiche-table tr.is-manque td { background: rgba(163,45,45,.16); }
[data-theme="dark"] .ha-afiche-onglets button.is-on,
[data-theme="dark"] .ha-afiche-table td strong { color: var(--heading); }
[data-theme="dark"] .ha-afiche-moi { color: #F0A0A0; }
@media (max-width: 980px) {
  .ha-afiche-grille { grid-template-columns: 1fr; }
  .ha-afiche-chiffres { grid-template-columns: 1fr; }
  .ha-afiche-outils input { margin-left: 0; width: 100%; }
}
`
