import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, PhoneF, lbl } from '@/components/ui'
import config from '@/app.config'
import { QUALIFS, ROLES_COMPTE, SPECIALISATIONS_INF, lblRoleCompte, qualifsPourType, qualificationsAvecSelection, qualificationsCompatibles, EQUIPES_ASBL, aRoleAsblParticulier, equipeAsblOuverteParDefaut, libellesRolesAsblPropres, rangsDeLequipe, rolesAsblPourEnregistrement, rolesAsblSpecifiques } from './ficheSchema'
import {
  lignesCompetence, compterCompetences, manquesProfil, lignesActivites, lignesSouhaits,
  fusionParticipations, dansPeriode, compterParticipations, grilleAnnees, totalHeures,
  fmtDate, fmtHeures, ouvrirLivret, civiliteLibelle,
} from './bilanFiche'
import { TYPES_NOTIF, prefsDepuisFiche } from '@/lib/notifications'
import { FormPinFiche } from '@/components/PinArchive'
import { ReglageDeuxFacteurs } from '@/components/DeuxFacteurs'

const vide = {
  date_naissance:'', lieu_naissance:'', adresse:'', date_engagement:'', civilite:'',
  telephone:'', iban:'', type_benevole:'',
  qualifications:[], roles_asbl:[],
  permis:{ B:false, C:false, E:false, selection_medicale:false, selection_validite:'' },
  ambulancier:{ visa_atnup:'', badge_112:'' },
  infirmier:{ visa:'', specialisations:[] },
  contacts_urgence:[],
  notif_prefs: prefsDepuisFiche(null),
}

export default function FicheVolontaire({ userId, onBack }) {
  const { user, profile: moi, role: monRole, reload, peutGererFiches, peutOuvrirArchives, peutReglerNotifications } = useAuth()
  const uid = userId || user?.id
  const gestionQualif = peutGererFiches()   // type + qualifications
  const gestionRoles = peutGererFiches()    // rôles ASBL : accès total ou coord. bénévoles
  const peutChangerRoleCompte = ['admin', 'president'].includes(monRole)
  const maFiche = uid === user?.id
  // Sans accès aux autres fiches : seulement ses coordonnées. Le reste est au staff.
  const seulementCoordonnees = maFiche && !gestionQualif
  const pinEligible = maFiche && peutOuvrirArchives()
  const prefsNotif = maFiche && peutReglerNotifications()
  const [prof, setProf] = useState(null)
  const [f, setF] = useState(vide)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [aPin, setAPin] = useState(false)
  const [pinMsg, setPinMsg] = useState(null)
  const [savingPin, setSavingPin] = useState(false)
  const [roleParticulier, setRoleParticulier] = useState(false)
  const [equipeOuverte, setEquipeOuverte] = useState(null)
  const [onglet, setOnglet] = useState('info')
  const [panneau, setPanneau] = useState('profil')
  const [voirManques, setVoirManques] = useState(false)
  const [parts, setParts] = useState([])
  const [periode, setPeriode] = useState('toutes')
  const [qAct, setQAct] = useState('')
  const rolesAvantNon = useRef([])
  const fileRef = useRef()

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { setMsg({ t:'Photo trop lourde (max 5 Mo).', ok:false }); return }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${uid}.${ext}`
    const up = await supabase.storage.from('avatars').upload(path, file, { upsert:true, cacheControl:'3600' })
    if (up.error) { setMsg({ t:'Photo : ' + up.error.message, ok:false }); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl + '?t=' + Date.now()
    const nf = { ...f, photo_url:url }
    setF(nf)
    await supabase.from('profiles').update({ fiche: nf }).eq('id', uid)
    setMsg({ t:'Photo mise à jour.', ok:true }); setTimeout(()=>setMsg(null), 2500)
    if (!userId) reload()
  }

  useEffect(() => { (async () => {
    const { data } = await supabase.from('profiles').select('id,prenom,nom,email,role,fiche').eq('id', uid).single()
    setProf(data)
    const permisCharge = { ...vide.permis, ...((data?.fiche||{}).permis||{}) }
    setF({ ...vide, ...(data?.fiche || {}),
      permis: permisCharge,
      ambulancier:{ ...vide.ambulancier, ...((data?.fiche||{}).ambulancier||{}) },
      infirmier:{ ...vide.infirmier, ...((data?.fiche||{}).infirmier||{}) },
      documents: Array.isArray(data?.fiche?.documents) ? data.fiche.documents : [],
      qualifications: qualificationsAvecSelection((data?.fiche||{}).qualifications||[], permisCharge),
      roles_asbl:(data?.fiche||{}).roles_asbl||[],
      contacts_urgence:(data?.fiche||{}).contacts_urgence||[],
      notif_prefs: prefsDepuisFiche(data?.fiche),
    })
    setRoleParticulier(aRoleAsblParticulier((data?.fiche||{}).roles_asbl))
    setEquipeOuverte(equipeAsblOuverteParDefaut((data?.fiche||{}).roles_asbl))
    if (uid === user?.id) {
      const { data: pin } = await supabase.rpc('mon_pin_archive_defini')
      setAPin(!!pin)
    }
  })() }, [uid, user?.id])

  useEffect(() => {
    if (!uid) return
    let stop = false
    ;(async () => {
      const ins = await supabase.from('activites_secours_inscrits').select('activite_id').eq('user_id', uid)
      const ids = [...new Set((ins.data || []).map(x => x.activite_id).filter(Boolean))]
      const acts = ids.length
        ? await supabase.from('activites_secours').select('id,titre,type,lieu,debut,fin').in('id', ids)
        : { data: [] }
      const pers = await supabase.from('souhait_personnel').select('souhait_id,role_mission').eq('user_id', uid)
      const sids = [...new Set((pers.data || []).map(x => x.souhait_id).filter(Boolean))]
      const souh = sids.length
        ? await supabase.from('souhaits').select('id,beneficiaire_prenom,description,date_souhaitee,date_fin,statut,localisation,fictif').in('id', sids)
        : { data: [] }
      if (stop) return
      setParts(fusionParticipations(lignesActivites(acts.data, ins.data), lignesSouhaits(souh.data, pers.data)))
    })()
    return () => { stop = true }
  }, [uid])

  const set = (k,v) => setF(s => ({ ...s, [k]:v }))
  const setTypeBenevole = (v) => setF(s => ({
    ...s,
    type_benevole: v,
    qualifications: qualificationsCompatibles(v, s.qualifications),
  }))
  function setRoleCompte(v) {
    setProf(p => ({ ...p, role: v }))
    if (v === 'volontaire_medical') setTypeBenevole('medical')
    if (v === 'volontaire_non_medical') setTypeBenevole('non_medical')
  }
  const setIn = (grp,k,v) => setF(s => ({ ...s, [grp]:{ ...s[grp], [k]:v } }))
  const toggleArr = (k, val) => setF(s => {
    const has = (s[k] || []).includes(val)
    const next = has ? s[k].filter(x => x !== val) : [...(s[k] || []), val]
    if (k === 'qualifications' && val === 'chauffeur' && has) {
      return { ...s, qualifications: next, permis: { ...s.permis, selection_medicale: false } }
    }
    return { ...s, [k]: next }
  })
  function setSelectionMedicale(on) {
    setF(s => {
      const permis = { ...s.permis, selection_medicale: on }
      return { ...s, permis, qualifications: qualificationsAvecSelection(s.qualifications, permis, true) }
    })
  }
  const toggleSpec = (val) => setF(s => ({ ...s, infirmier:{ ...s.infirmier, specialisations: s.infirmier.specialisations.includes(val) ? s.infirmier.specialisations.filter(x=>x!==val) : [...s.infirmier.specialisations, val] } }))
  function togglePref(cle) {
    setF(s => ({ ...s, notif_prefs: { ...prefsDepuisFiche(s), [cle]: !prefsDepuisFiche(s)[cle] } }))
  }
  function fixerRoleParticulier(oui) {
    if (oui) {
      const spec = rolesAvantNon.current.length ? rolesAvantNon.current : rolesAsblSpecifiques(f.roles_asbl)
      setRoleParticulier(true)
      set('roles_asbl', spec)
      setEquipeOuverte(equipeAsblOuverteParDefaut(spec))
      return
    }
    rolesAvantNon.current = rolesAsblSpecifiques(f.roles_asbl)
    setRoleParticulier(false)
    set('roles_asbl', [])
    setEquipeOuverte(null)
  }
  function toggleRangAsbl(role) {
    const cur = rolesAsblSpecifiques(f.roles_asbl)
    const next = cur.includes(role) ? cur.filter(x => x !== role) : [...cur, role]
    set('roles_asbl', next)
  }

  const estAmbu = f.qualifications.includes('ambulancier')
  const estInfi = f.qualifications.includes('infirmier')
  const competences = useMemo(() => lignesCompetence(f), [f])
  const comptesComp = compterCompetences(competences)
  const manques = prof ? manquesProfil(prof, f) : []
  const complet = manques.length ? Math.round(((8 - manques.length) / 8) * 100) : 100
  const participations = useMemo(() => {
    const fonction = fonctionDe(f)
    return parts.map(p => (p.fonction ? p : { ...p, fonction }))
  }, [parts, f])
  const comptesAct = compterParticipations(participations)
  const listeAct = useMemo(() => {
    const texte = qAct.trim().toLowerCase()
    return participations.filter(p => {
      if (!dansPeriode(p, periode)) return false
      if (!texte) return true
      return `${p.famille} ${p.titre} ${p.lieu} ${p.fonction}`.toLowerCase().includes(texte)
    })
  }, [participations, periode, qAct])

  async function save() {
    if (!prof?.prenom || !prof?.nom) { setMsg({ t:'Prénom et nom requis.', ok:false }); return }
    if (!seulementCoordonnees && estAmbu && !f.ambulancier.visa_atnup.trim() && !f.compte_a_configurer) { setMsg({ t:'Le visa ATNUP est obligatoire pour un ambulancier(ère).', ok:false }); return }
    let rolesAsbl = f.roles_asbl
    if (gestionRoles) {
      rolesAsbl = rolesAsblPourEnregistrement(roleParticulier, f.roles_asbl)
      if (roleParticulier && !rolesAsbl.length) {
        setMsg({ t:'Choisissez un rôle dans une équipe, ou passez le curseur sur Non.', ok:false })
        return
      }
    }
    setSaving(true)
    const qualifications = qualificationsAvecSelection(
      qualificationsCompatibles(f.type_benevole, f.qualifications),
      f.permis,
    )
    const fiche = { ...f, qualifications, roles_asbl: rolesAsbl }
    const patch = { prenom:prof.prenom, nom:prof.nom, fiche }
    if (peutChangerRoleCompte && prof.role && prof.role !== 'partenaire') patch.role = prof.role
    const { data, error } = await supabase.from('profiles')
      .update(patch)
      .eq('id', uid)
      .select('id,prenom,nom,email,role,fiche')
    setSaving(false)
    if (error) { setMsg({ t:'Erreur : ' + error.message, ok:false }); return }
    if (!data || data.length === 0) { setMsg({ t:"Rien n'a été enregistré (droits ou champ « fiche » manquant — appliquez 07_fiche_volontaire.sql).", ok:false }); return }
    setProf(data[0])
    setF({ ...vide, ...(data[0].fiche || {}),
      permis:{ ...vide.permis, ...((data[0].fiche||{}).permis||{}) },
      ambulancier:{ ...vide.ambulancier, ...((data[0].fiche||{}).ambulancier||{}) },
      infirmier:{ ...vide.infirmier, ...((data[0].fiche||{}).infirmier||{}) },
      documents: Array.isArray(data[0].fiche?.documents) ? data[0].fiche.documents : [],
      qualifications: qualificationsAvecSelection((data[0].fiche||{}).qualifications||[], (data[0].fiche||{}).permis || {}),
      roles_asbl:(data[0].fiche||{}).roles_asbl||[],
      contacts_urgence:(data[0].fiche||{}).contacts_urgence||[],
      notif_prefs: prefsDepuisFiche(data[0].fiche),
    })
    setRoleParticulier(aRoleAsblParticulier((data[0].fiche||{}).roles_asbl))
    setMsg({ t:'Fiche enregistrée.', ok:true }); setTimeout(()=>setMsg(null), 3000)
    if (!userId) reload()
  }

  async function sauverPin({ pin, ancien }) {
    setSavingPin(true)
    setPinMsg(null)
    const { data, error } = await supabase.rpc('definir_pin_archive', { p_pin: pin, p_ancien: ancien || null })
    setSavingPin(false)
    if (error) { setPinMsg({ t: error.message, ok: false }); return false }
    if (data?.ok === false) { setPinMsg({ t: data.error || 'Impossible d’enregistrer le code.', ok: false }); return false }
    setAPin(true)
    setPinMsg({ t: 'Code enregistré. Il n’est pas affiché ensuite, seul vous le connaissez.', ok: true })
    return true
  }

  if (!prof) return <Page title="Fiche volontaire"><p style={{ color:'var(--text-muted)' }}>Chargement…</p></Page>

  const onglets = [
    { v: 'info', l: 'Information' },
    { v: 'activite', l: 'Activité' },
    { v: 'competence', l: 'Compétence' },
    ...(!seulementCoordonnees ? [{ v: 'document', l: 'Document' }] : []),
    { v: 'compte', l: 'Compte' },
  ]
  const rolePill = aRoleAsblParticulier(f.roles_asbl)
    ? (libellesRolesAsblPropres(f.roles_asbl)[0] || 'Rôle dans l’ASBL')
    : lblRoleCompte(prof.role)

  function imprimer() {
    const a = config.bases?.[0]?.adresse || {}
    const adresse = [[a.rue, a.numero].filter(Boolean).join(' '), [a.cp, a.localite].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const ok = ouvrirLivret({
      organisation: config.organisation?.nom || 'Heart’s Angels ASBL',
      adresse,
      logo: `${window.location.origin}${config.organisation?.logoUrl || '/icons/ha-logo-512-v4.png'}`,
      imprimePar: `${(moi?.nom || '').toUpperCase()} ${moi?.prenom || ''}`.trim(),
      civilite: civiliteLibelle(f.civilite),
      nom: prof.nom,
      prenom: prof.prenom,
      photo: f.photo_url || '',
      dateNaissance: f.date_naissance,
      lieuNaissance: f.lieu_naissance,
      adressePerso: f.adresse,
      telephone: f.telephone,
      email: prof.email,
      dateEngagement: f.date_engagement,
      competences,
      operations: participations,
      grille: grilleAnnees(participations),
      heures: totalHeures(participations),
    })
    if (!ok) setMsg({ t: 'Le navigateur a bloqué la fenêtre du bilan.', ok: false })
  }

  return (
    <Page>
      <style>{CSS_FICHE}</style>
      {msg && <Card style={{ marginBottom:12, padding:'10px 14px', background: msg.ok?'#F0FAF0':'#FEF2F2', border:`1px solid ${msg.ok?'#C3E6C3':'#FCD5D5'}`, color: msg.ok?'#1E5C1E':'#991B1B' }}>{msg.t}</Card>}
      {(f.compte_a_configurer || !(prof.email || '').trim()) && (
        <Card style={{ marginBottom:12, padding:'10px 14px', background:'#FAEEDA', border:'1px solid #E8C98A', color:'#7A4E0B' }}>
          Cette personne est dans les volontaires mais n’a pas encore de compte. Dans Volontaires, utilisez « Configurer le compte » pour encoder son e-mail et lui envoyer le lien d’invitation.
        </Card>
      )}

      <header className="ha-fiche-head">
        <div className="ha-fiche-ident">
          <span className="ha-fiche-avatar">
            {f.photo_url ? <img src={f.photo_url} alt="" /> : `${(prof.prenom || '').charAt(0)}${(prof.nom || '').charAt(0)}`.toUpperCase()}
          </span>
          <div>
            {onBack && <button type="button" className="ha-fiche-retour" onClick={onBack}>Fiches</button>}
            <h1><span>{(prof.nom || '').toUpperCase()}</span> {prof.prenom}</h1>
            <div className="ha-fiche-pills">
              <span className={'ha-fiche-pill' + ((f.compte_a_configurer || !(prof.email || '').trim()) ? ' is-attente' : ' is-ok')}>
                {(f.compte_a_configurer || !(prof.email || '').trim()) ? 'Compte à configurer' : 'Actif'}
              </span>
              {f.type_benevole === 'medical' && <span className="ha-fiche-pill">Médical</span>}
              {f.type_benevole === 'non_medical' && <span className="ha-fiche-pill">Non médical</span>}
              {rolePill && <span className="ha-fiche-pill is-muted">{rolePill}</span>}
            </div>
            <button type="button" className="ha-fiche-complet" onClick={() => { setOnglet('info'); setVoirManques(v => !v) }}>
              <span className="ha-fiche-barre"><i style={{ width: `${complet}%` }} /></span>
              {complet} % du profil complété
            </button>
            {voirManques && (
              manques.length
                ? <ul className="ha-fiche-manques">{manques.map(m => <li key={m}>{m}</li>)}</ul>
                : <p className="ha-fiche-vide">Les informations du bilan sont remplies.</p>
            )}
          </div>
        </div>
        <div className="ha-fiche-actions">
          <button type="button" className="ha-fiche-livret" onClick={imprimer}>Bilan d’activité</button>
          {(prof.email || '').trim() && <a className="ha-fiche-contact" href={`mailto:${prof.email}`}>Contacter</a>}
        </div>
      </header>

      <nav className="ha-fiche-onglets" aria-label="Fiche">
        {onglets.map(o => (
          <button key={o.v} type="button" className={onglet === o.v ? 'is-on' : ''} onClick={() => setOnglet(o.v)}>{o.l}</button>
        ))}
      </nav>

      <div>
      {onglet === 'info' && (
      <div className="ha-fiche-info">
        <aside className="ha-fiche-nav">
          <span className="ha-fiche-avatar is-lg">
            {f.photo_url ? <img src={f.photo_url} alt="" /> : `${(prof.prenom || '').charAt(0)}${(prof.nom || '').charAt(0)}`.toUpperCase()}
          </span>
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} style={{ display:'none' }} />
          <button type="button" className="ha-fiche-photo" onClick={() => fileRef.current?.click()}>{f.photo_url ? 'Changer la photo' : 'Ajouter une photo'}</button>
          <button type="button" className={panneau === 'profil' ? 'is-on' : ''} onClick={() => setPanneau('profil')}>Profil</button>
          <button type="button" className={panneau === 'prevenir' ? 'is-on' : ''} onClick={() => setPanneau('prevenir')}>Personne à prévenir</button>
        </aside>
        {panneau === 'profil' && (
      <Card style={{ marginBottom:0 }}>
        <Sec>Profil</Sec>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'0 20px' }}>
          <Sel label="Civilité" value={f.civilite || ''} set={v => set('civilite', v)} options={[{ v:'', l:'—' }, { v:'madame', l:'Madame' }, { v:'monsieur', l:'Monsieur' }]} />
          <F label="Prénom" value={prof.prenom||''} set={v=>setProf(p=>({...p,prenom:v}))} required />
          <F label="Nom" value={prof.nom||''} set={v=>setProf(p=>({...p,nom:v}))} required />
          <F label="Date de naissance" type="date" value={f.date_naissance} set={v=>set('date_naissance',v)} />
          <F label="Lieu de naissance" value={f.lieu_naissance || ''} set={v=>set('lieu_naissance', v)} />
          <F label="Date d’engagement" type="date" value={f.date_engagement || ''} set={v=>set('date_engagement', v)} />
          <PhoneF label="Téléphone" value={f.telephone} set={v=>set('telephone',v)} />
          <F label="IBAN (défraiements)" value={f.iban||''} set={v=>set('iban', v.toUpperCase())} placeholder="BE00 0000 0000 0000" />
          <F label="Adresse" value={f.adresse || ''} set={v=>set('adresse', v)} placeholder="Rue, code postal, ville" />
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
          E-mail (connexion) : {(prof.email || '').trim() || 'pas encore de compte'} — l’IBAN sert aux notes de frais forfaitaires.
        </div>
      </Card>
      )}
        {panneau === 'prevenir' && (
      <Card style={{ marginBottom:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <Sec noMargin>Personne à prévenir</Sec>
          <Btn kind="soft" onClick={()=>set('contacts_urgence',[...f.contacts_urgence,{ prenom:'', nom:'', affiliation:'', telephone:'' }])}>+ Ajouter</Btn>
        </div>
        {f.contacts_urgence.length===0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucun contact.</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {f.contacts_urgence.map((c,i)=>(
            <div key={i} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0 12px' }}>
                <F label="Prénom" value={c.prenom} set={v=>set('contacts_urgence',f.contacts_urgence.map((x,j)=>j===i?{...x,prenom:v}:x))} />
                <F label="Nom" value={c.nom} set={v=>set('contacts_urgence',f.contacts_urgence.map((x,j)=>j===i?{...x,nom:v}:x))} />
                <F label="Affiliation (lien)" value={c.affiliation} set={v=>set('contacts_urgence',f.contacts_urgence.map((x,j)=>j===i?{...x,affiliation:v}:x))} />
                <PhoneF label="Téléphone" value={c.telephone} set={v=>set('contacts_urgence',f.contacts_urgence.map((x,j)=>j===i?{...x,telephone:v}:x))} />
              </div>
              <Btn kind="danger" onClick={()=>set('contacts_urgence',f.contacts_urgence.filter((_,j)=>j!==i))} style={{ padding:'4px 10px', marginTop:6 }}>Retirer</Btn>
            </div>
          ))}
        </div>
      </Card>
        )}
      </div>
      )}

      {onglet === 'activite' && (
        <section className="ha-fiche-bloc">
          <div className="ha-fiche-stats">
            <Stat label="Total" valeur={comptesAct.total} />
            <Stat label="À venir" valeur={comptesAct.aVenir} />
            <Stat label="Ce mois" valeur={comptesAct.mois} />
            <Stat label="Cette année" valeur={comptesAct.annee} />
          </div>
          <div className="ha-fiche-outils">
            <select aria-label="Période" value={periode} onChange={e => setPeriode(e.target.value)}>
              <option value="toutes">Toutes les participations</option>
              <option value="a_venir">À venir</option>
              <option value="mois">Ce mois</option>
              <option value="annee">Cette année</option>
            </select>
            <input type="search" placeholder="Rechercher" aria-label="Rechercher une participation" value={qAct} onChange={e => setQAct(e.target.value)} />
          </div>
          {listeAct.length === 0 ? (
            <div className="ha-fiche-vide-carte">
              <strong>Aucune participation</strong>
              <p>{participations.length === 0 ? 'Aucune activité ni souhait n’est encore lié à cette fiche.' : 'Rien sur cette période.'}</p>
              {periode !== 'toutes' && <button type="button" onClick={() => setPeriode('toutes')}>Tout afficher</button>}
            </div>
          ) : (
            <div className="ha-fiche-table-wrap">
              <table className="ha-fiche-table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Description</th><th>Heures</th><th>Fonction</th></tr>
                </thead>
                <tbody>
                  {listeAct.map(p => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.date) || '—'}</td>
                      <td>{p.famille}</td>
                      <td>
                        {p.lien ? <Link to={p.lien}>{p.titre}</Link> : p.titre}
                        {p.lieu ? <span className="ha-fiche-lieu">{p.lieu}</span> : null}
                      </td>
                      <td>{fmtHeures(p.heures)}</td>
                      <td>{p.fonction || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {onglet === 'competence' && (
        <section className="ha-fiche-bloc">
          <div className="ha-fiche-stats">
            <Stat label="Compétences détenues" valeur={comptesComp.detenues} />
            <Stat label="Bientôt expirées" valeur={comptesComp.bientot} />
            <Stat label="Expirées" valeur={comptesComp.expirees} />
          </div>
          {competences.length === 0 ? (
            <p className="ha-fiche-vide">Aucune compétence enregistrée.</p>
          ) : (
            <div className="ha-fiche-table-wrap">
              <table className="ha-fiche-table">
                <thead>
                  <tr><th>Catégorie</th><th>Compétence</th><th>Statut</th><th>Expiration</th></tr>
                </thead>
                <tbody>
                  {competences.map((c, i) => (
                    <tr key={i}>
                      <td>{c.categorie}</td>
                      <td>{c.description}</td>
                      <td><span className={'ha-fiche-statut is-' + c.statut}>{c.statut === 'expiree' ? 'Expirée' : c.statut === 'bientot' ? 'Bientôt expirée' : c.statut === 'secondaire' ? 'Secondaire' : 'Principale'}</span></td>
                      <td>{c.expiration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {onglet === 'compte' && (
      <Card style={{ marginBottom:14 }}>
        <Sec>Rôle de compte</Sec>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
          Accès à l’application (administrateur, président, volontaire…). Infirmier(ère), médecin, ambulancier(ère) se choisissent dans les qualifications, pas ici.
        </div>
        {peutChangerRoleCompte ? (
          <div style={{ maxWidth:280 }}>
            <Sel label="Rôle de compte" value={prof.role || ''} set={setRoleCompte} options={ROLES_COMPTE} />
          </div>
        ) : (
          <div style={{ fontSize:13.5 }}>{lblRoleCompte(prof.role)}</div>
        )}
      </Card>
      )}

      {onglet === 'competence' && gestionQualif && (
      <Card style={{ marginBottom:14 }}>
        <Sec>Type de bénévole & qualifications</Sec>
        {gestionQualif ? (
          <>
            <div style={{ maxWidth:280 }}>
              <Sel label="Type de bénévole" value={f.type_benevole} set={setTypeBenevole} options={[{v:'',l:'—'},{v:'medical',l:'Médical'},{v:'non_medical',l:'Non médical'}]} />
            </div>
            <label style={lbl}>Qualifications</label>
            <Chips options={qualifsPourType(f.type_benevole)} selected={f.qualifications} onToggle={v=>toggleArr('qualifications',v)} />
          </>
        ) : (
          <>
            <div style={{ fontSize:13.5, marginBottom:10 }}><span style={{ color:'var(--text-muted)' }}>Type : </span>{f.type_benevole==='medical'?'Médical':f.type_benevole==='non_medical'?'Non médical':'—'}</div>
            <label style={lbl}>Qualifications</label>
            <ReadPills options={QUALIFS} selected={f.qualifications} vide="Aucune qualification attribuée par un coordinateur." />
          </>
        )}
      </Card>
      )}

      {/* Ambulancier */}
      {onglet === 'competence' && gestionQualif && estAmbu && (
        <Card style={{ marginBottom:14 }}>
          <Sec>Ambulancier(ère)</Sec>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'0 20px' }}>
            <F label="N° visa ATNUP (obligatoire)" value={f.ambulancier.visa_atnup} set={v=>setIn('ambulancier','visa_atnup',v)} required />
            <F label="N° badge 112 (optionnel)" value={f.ambulancier.badge_112} set={v=>setIn('ambulancier','badge_112',v)} />
          </div>
        </Card>
      )}

      {/* Infirmier */}
      {onglet === 'competence' && gestionQualif && estInfi && (
        <Card style={{ marginBottom:14 }}>
          <Sec>Infirmier(ère)</Sec>
          <div style={{ maxWidth:280 }}>
            <F label="N° visa infirmier" value={f.infirmier.visa} set={v=>setIn('infirmier','visa',v)} />
          </div>
          <label style={lbl}>Spécialisation(s)</label>
          <Chips options={SPECIALISATIONS_INF} selected={f.infirmier.specialisations} onToggle={toggleSpec} />
        </Card>
      )}

      {/* Rôles ASBL : éditeur pour coord./accès total ; le simple volontaire ne voit rien. */}
      {onglet === 'compte' && gestionRoles ? (
        <Card style={{ marginBottom:14 }}>
          <Sec>Rôle dans l'ASBL</Sec>
          <EditeurRolesAsbl
            particulier={roleParticulier}
            onParticulier={fixerRoleParticulier}
            roles={f.roles_asbl}
            onToggleRang={toggleRangAsbl}
            equipeOuverte={equipeOuverte}
            setEquipeOuverte={setEquipeOuverte}
          />
        </Card>
      ) : onglet === 'compte' && aRoleAsblParticulier(f.roles_asbl) ? (
        <Card style={{ marginBottom:14 }}>
          <RolesAsblLecture roles={f.roles_asbl} />
        </Card>
      ) : null}

      {onglet === 'compte' && maFiche && <ReglageDeuxFacteurs />}

      {onglet === 'compte' && pinEligible && (
        <Card style={{ marginBottom:14 }}>
          <Sec>Code d’ouverture des dossiers verrouillés</Sec>
          <FormPinFiche aPin={aPin} onSauver={sauverPin} saving={savingPin} msg={pinMsg} />
        </Card>
      )}

      {onglet === 'compte' && prefsNotif && (
        <Card style={{ marginBottom:14 }}>
          <Sec>Notifications reçues</Sec>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
            Décochez les alertes que vous ne voulez plus recevoir. Une alerte d’équipe disparaît pour toute l’équipe dès qu’une personne la marque traitée. Le rappel de mission arrive sur le téléphone et la montre, la veille au matin et au soir, sans rester dans la cloche.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {TYPES_NOTIF.map(t => (
              <Toggle
                key={t.v}
                label={`${t.icon} ${t.l}`}
                on={!!(f.notif_prefs || {})[t.v]}
                onClick={() => togglePref(t.v)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Permis */}
      {onglet === 'competence' && gestionQualif && (
      <Card style={{ marginBottom:14 }}>
        <Sec>Permis de conduire</Sec>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:10 }}>
          {['B','C','E'].map(c => <Toggle key={c} label={`Permis ${c}`} on={f.permis[c]} onClick={()=>setIn('permis',c,!f.permis[c])} />)}
          <Toggle label="Sélection médicale" on={!!f.permis.selection_medicale} onClick={() => setSelectionMedicale(!f.permis.selection_medicale)} />
        </div>
        <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
          Dès que la sélection médicale est cochée, la qualification Chauffeur l’est aussi. La décocher retire Chauffeur.
        </div>
        {f.permis.selection_medicale && (
          <div style={{ maxWidth:240 }}>
            <F label="Sélection médicale — valide jusqu'au" type="date" value={f.permis.selection_validite} set={v=>setIn('permis','selection_validite',v)} />
          </div>
        )}
      </Card>
      )}

      {onglet === 'document' && (
        <DocumentsRh
          uid={uid}
          fiche={f}
          peutEcrire={gestionQualif}
          onFiche={nf => setF(nf)}
          onMsg={setMsg}
        />
      )}

      </div>
      {(onglet === 'info' || onglet === 'compte' || (onglet === 'competence' && gestionQualif)) && (
        <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:14 }}>{saving?'Enregistrement…':(seulementCoordonnees ? '✓ Enregistrer mes coordonnées' : '✓ Enregistrer la fiche')}</Btn>
      )}
    </Page>
  )
}

const DOCS_RH = [
  { v: 'carte_identite', l: 'Carte d’identité' },
  { v: 'permis', l: 'Permis de conduire' },
  { v: 'visa_atnup', l: 'Visa ATNUP' },
  { v: 'visa_infirmier', l: 'Visa infirmier' },
  { v: 'autre', l: 'Autre document' },
]
const BUCKET_RH = 'rh-documents'
const MIME_RH = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

function DocumentsRh({ uid, fiche, peutEcrire, onFiche, onMsg }) {
  const [busy, setBusy] = useState(false)
  const [nomAutre, setNomAutre] = useState('')
  const docs = Array.isArray(fiche.documents) ? fiche.documents : []

  async function persister(liste, texte) {
    const nf = { ...fiche, documents: liste }
    onFiche(nf)
    const { error } = await supabase.from('profiles').update({ fiche: nf }).eq('id', uid)
    if (error) { onMsg({ t: error.message, ok: false }); return false }
    onMsg({ t: texte, ok: true })
    setTimeout(() => onMsg(null), 2500)
    return true
  }

  async function ajouter(type, file) {
    if (!file || !peutEcrire) return
    if (file.size > 15 * 1024 * 1024) { onMsg({ t: 'Document trop lourd (max 15 Mo).', ok: false }); return }
    if (file.type && !MIME_RH.includes(file.type)) { onMsg({ t: 'Format accepté : PDF, JPG ou PNG.', ok: false }); return }
    const nom = type === 'autre' ? (nomAutre.trim() || file.name) : (DOCS_RH.find(d => d.v === type)?.l || file.name)
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    setBusy(true)
    const up = await supabase.storage.from(BUCKET_RH).upload(`${uid}/${id}.${ext}`, file, {
      upsert: false,
      contentType: file.type || undefined,
    })
    if (up.error) { setBusy(false); onMsg({ t: up.error.message, ok: false }); return }
    const doc = { id, type, nom, path: `${uid}/${id}.${ext}`, mime: file.type || '', taille: file.size, ajoute_le: new Date().toISOString() }
    const ok = await persister([...docs, doc], 'Document enregistré.')
    setBusy(false)
    if (ok && type === 'autre') setNomAutre('')
  }

  async function ouvrir(doc) {
    const { data, error } = await supabase.storage.from(BUCKET_RH).createSignedUrl(doc.path, 3600)
    if (error || !data?.signedUrl) { onMsg({ t: error?.message || 'Ouverture impossible.', ok: false }); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function retirer(doc) {
    if (!peutEcrire || !confirm(`Retirer ${doc.nom || 'ce document'} ?`)) return
    setBusy(true)
    await supabase.storage.from(BUCKET_RH).remove([doc.path])
    await persister(docs.filter(d => d.id !== doc.id), 'Document retiré.')
    setBusy(false)
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <Sec>Documents du volontaire</Sec>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Carte d’identité, permis, visas, et tout autre document. PDF ou photo, 15 Mo maximum. Ces pièces sont encodées par la gestion des fiches.
      </p>
      {!peutEcrire && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Consultation seule.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {DOCS_RH.map(type => {
          const lignes = docs.filter(d => d.type === type.v)
          return (
            <div key={type.v} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--heading)', marginBottom: 8 }}>{type.l}</div>
              {lignes.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Aucun fichier.</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {lignes.map(d => (
                <div key={d.id} style={{ width: 160, border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--bg-alt)' }}>
                  <button type="button" onClick={() => ouvrir(d)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-blue)', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                    {d.nom || type.l}
                  </button>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{type.l}</div>
                  {peutEcrire && <Btn kind="danger" onClick={() => retirer(d)} disabled={busy} style={{ padding: '4px 10px', marginTop: 8 }}>Retirer</Btn>}
                </div>
              ))}
              </div>
              {peutEcrire && type.v === 'autre' && (
                <F label="Nom du document" value={nomAutre} set={setNomAutre} placeholder="Attestation, diplôme…" />
              )}
              {peutEcrire && (
                <label className="ha-stock-photo-btn">
                  {busy ? 'Envoi…' : 'Téléverser'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf" disabled={busy}
                    onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) ajouter(type.v, file) }} />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function RolesAsblLecture({ roles }) {
  const labels = libellesRolesAsblPropres(roles)
  if (!labels.length) return null
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {labels.map((l, i) => (
        <span key={i} style={{ padding:'6px 12px', borderRadius:99, background:'var(--bg-alt)', border:'1px solid var(--border)', fontSize:13, color:'var(--text-2)' }}>{l}</span>
      ))}
    </div>
  )
}

function CurseurOuiNon({ on, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
      <span style={{ fontSize:13, fontWeight: on ? 400 : 700, color: on ? 'var(--text-muted)' : 'var(--text)' }}>Non</span>
      <button type="button" role="switch" aria-checked={on} aria-label={on ? 'Oui' : 'Non'} onClick={() => onChange(!on)}
        style={{ width:42, height:24, borderRadius:99, border:'none', cursor:'pointer', background:on?'#3B6D11':'var(--border)', position:'relative' }}>
        <span style={{ position:'absolute', top:2, left:on?20:2, width:20, height:20, borderRadius:99, background:'#fff', transition:'left .15s' }} />
      </button>
      <span style={{ fontSize:13, fontWeight: on ? 700 : 400, color: on ? 'var(--text)' : 'var(--text-muted)' }}>Oui</span>
    </div>
  )
}

function EditeurRolesAsbl({ particulier, onParticulier, roles, onToggleRang, equipeOuverte, setEquipeOuverte }) {
  const selection = rolesAsblSpecifiques(roles)
  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom: particulier ? 14 : 0, flexWrap:'wrap' }}>
        <div style={{ fontSize:13.5, color:'var(--text)', flex:1, minWidth:180 }}>
          Est-ce que le volontaire a un rôle dans l’ASBL ?
        </div>
        <CurseurOuiNon on={particulier} onChange={onParticulier} />
      </div>
      {particulier && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            Cliquez une équipe, puis le rang. Plusieurs équipes possibles.
          </div>
          {EQUIPES_ASBL.map(eq => {
            const rangs = rangsDeLequipe(eq)
            const choisis = rangs.filter(r => selection.includes(r.v))
            const ouverte = equipeOuverte === eq.v
            return (
              <div key={eq.v} style={{ border:`1.5px solid ${choisis.length ? 'var(--accent)' : 'var(--border)'}`, borderRadius:10, overflow:'hidden', background:'var(--card)' }}>
                <button type="button" onClick={() => setEquipeOuverte(ouverte ? null : eq.v)}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 12px', border:'none', background: choisis.length ? 'var(--bg-alt)' : 'transparent', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                  <span style={{ fontSize:13.5, fontWeight:700, color:'var(--heading)' }}>{eq.l}</span>
                  <span style={{ fontSize:12, color: choisis.length ? 'var(--accent)' : 'var(--text-faint)', fontWeight:600 }}>
                    {choisis.length ? '✓ ' + choisis.map(r => r.l).join(' · ') : (ouverte ? '▴' : '▾')}
                  </span>
                </button>
                {ouverte && (
                  <div style={{ padding:'10px 12px 12px', borderTop:'1px solid var(--border)', display:'flex', flexWrap:'wrap', gap:8 }}>
                    {rangs.map(r => {
                      const on = selection.includes(r.v)
                      return (
                        <button key={r.v} type="button" onClick={() => onToggleRang(r.v)}
                          style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'var(--card)', color:on?'#fff':'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                          {on ? '✓ ' : ''}{r.l}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function ReadPills({ options, selected, vide }) {
  const sel = (selected||[]).map(v => options.find(o=>o.v===v)?.l || v)
  if (sel.length===0) return <div style={{ fontSize:13, color:'var(--text-muted)' }}>{vide}</div>
  return <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{sel.map((l,i)=><span key={i} style={{ padding:'6px 12px', borderRadius:99, background:'var(--bg-alt)', border:'1px solid var(--border)', fontSize:13, color:'var(--text-2)' }}>{l}</span>)}</div>
}
function Chips({ options, selected, onToggle }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {options.map(o => {
        const on = selected.includes(o.v)
        return (
          <button key={o.v} type="button" onClick={()=>onToggle(o.v)} style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'var(--card)', color:on?'#fff':'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>{on?'✓ ':''}{o.l}</button>
        )
      })}
    </div>
  )
}
function Toggle({ label, on, onClick }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button type="button" onClick={onClick} style={{ width:42, height:24, borderRadius:99, border:'none', cursor:'pointer', background:on?'#3B6D11':'var(--border)', position:'relative' }}>
        <span style={{ position:'absolute', top:2, left:on?20:2, width:20, height:20, borderRadius:99, background:'#fff', transition:'left .15s' }} />
      </button>
      <span style={{ fontSize:13.5, color:'var(--text)' }}>{label}</span>
    </div>
  )
}
function Sec({ children, noMargin }) { return <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom: noMargin?0:10 }}>{children}</div> }

function fonctionDe(f) {
  const q = (f?.qualifications || []).find(c => c !== 'autre') || f?.qualifications?.[0]
  return QUALIFS.find(x => x.v === q)?.l || ''
}

function Stat({ label, valeur }) {
  return (
    <div className="ha-fiche-stat">
      <strong>{valeur}</strong>
      <span>{label}</span>
    </div>
  )
}

const CSS_FICHE = `
.ha-fiche-head, .ha-fiche-bloc, .ha-fiche-nav {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
}
.ha-fiche-head { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; margin-bottom: 12px; align-items: flex-start; }
.ha-fiche-ident { display: flex; gap: 14px; min-width: 0; }
.ha-fiche-avatar {
  width: 52px; height: 52px; border-radius: 50%; overflow: hidden; flex: none;
  display: grid; place-items: center; background: var(--accent); color: #fff; font-weight: 700;
}
.ha-fiche-avatar.is-lg { width: 112px; height: 112px; font-size: 28px; margin: 0 auto 8px; }
.ha-fiche-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ha-fiche-retour { border: none; background: none; padding: 0; color: var(--accent); font-weight: 700; cursor: pointer; font: inherit; font-size: 12.5px; }
.ha-fiche-head h1 { margin: 2px 0 6px; font-size: 1.35rem; color: var(--heading); line-height: 1.15; }
.ha-fiche-head h1 span { font-weight: 800; }
.ha-fiche-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.ha-fiche-pill { border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; background: #E6F1FB; color: #185FA5; }
.ha-fiche-pill.is-ok { background: #E7F6EE; color: #1E7A45; }
.ha-fiche-pill.is-attente { background: #FFF4E8; color: #C26A12; }
.ha-fiche-pill.is-muted { background: var(--bg-alt); color: var(--text-muted); }
.ha-fiche-complet { display: flex; align-items: center; gap: 8px; margin-top: 8px; border: none; background: none; padding: 0; color: var(--text-muted); font: inherit; font-size: 12.5px; cursor: pointer; }
.ha-fiche-barre { width: 120px; height: 6px; border-radius: 99px; background: var(--bg-alt); overflow: hidden; display: inline-block; }
.ha-fiche-barre i { display: block; height: 100%; background: var(--accent); }
.ha-fiche-manques { margin: 6px 0 0; padding-left: 18px; color: var(--text-2); font-size: 12.5px; }
.ha-fiche-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ha-fiche-livret, .ha-fiche-contact, .ha-fiche-vide-carte button {
  border-radius: 10px; padding: 8px 12px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none;
}
.ha-fiche-livret, .ha-fiche-vide-carte button { border: 1px solid var(--border); background: var(--card); color: var(--heading); }
.ha-fiche-contact { background: var(--accent); color: #fff; border: none; }
.ha-fiche-onglets { display: flex; gap: 4px; overflow: auto; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
.ha-fiche-onglets button { border: none; background: transparent; color: var(--text-muted); font: inherit; font-weight: 700; font-size: 14px; padding: 8px 12px 10px; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; }
.ha-fiche-onglets button.is-on { color: var(--accent-blue); border-bottom-color: var(--accent); }
.ha-fiche-info { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 12px; align-items: start; }
.ha-fiche-nav { padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.ha-fiche-nav button, .ha-fiche-photo { border: none; background: transparent; text-align: left; font: inherit; font-size: 13.5px; font-weight: 650; color: var(--text-2); padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.ha-fiche-nav button.is-on { background: #E6F1FB; color: #185FA5; }
.ha-fiche-photo { text-align: center; color: var(--accent); margin-bottom: 6px; }
.ha-fiche-bloc { padding: 14px; }
.ha-fiche-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.ha-fiche-stat { background: var(--bg-alt); border-radius: 12px; padding: 12px 14px; }
.ha-fiche-stat strong { display: block; font-size: 1.6rem; color: var(--heading); font-variant-numeric: tabular-nums; }
.ha-fiche-stat span { color: var(--text-muted); font-size: 12.5px; }
.ha-fiche-outils { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.ha-fiche-outils select, .ha-fiche-outils input { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font: inherit; font-size: 13px; padding: 7px 10px; }
.ha-fiche-outils input { margin-left: auto; min-width: min(220px, 70vw); }
.ha-fiche-table-wrap { overflow: auto; }
.ha-fiche-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 560px; }
.ha-fiche-table th { text-align: left; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--text-muted); padding: 8px 10px; border-bottom: 1px solid var(--border); }
.ha-fiche-table td { padding: 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.ha-fiche-table a { color: var(--accent-blue); font-weight: 700; text-decoration: none; }
.ha-fiche-lieu { display: block; color: var(--text-muted); font-size: 12px; font-weight: 500; }
.ha-fiche-statut { border-radius: 999px; padding: 2px 8px; font-size: 11.5px; font-weight: 700; }
.ha-fiche-statut.is-principale { background: #E7F6EE; color: #1E7A45; }
.ha-fiche-statut.is-secondaire { background: #F3E8FF; color: #6D28D9; }
.ha-fiche-statut.is-bientot { background: #FFF4E8; color: #C26A12; }
.ha-fiche-statut.is-expiree { background: #FDECEC; color: #A32D2D; }
.ha-fiche-vide { margin: 0; color: var(--text-muted); font-size: 13px; }
.ha-fiche-vide-carte { margin: 8px auto; max-width: 360px; text-align: center; padding: 28px 16px; }
.ha-fiche-vide-carte strong { display: block; color: var(--heading); margin-bottom: 4px; }
.ha-fiche-vide-carte p { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; }
[data-theme="dark"] .ha-fiche-pill, [data-theme="dark"] .ha-fiche-nav button.is-on { background: rgba(24,95,165,.28); color: #8EBFEE; }
[data-theme="dark"] .ha-fiche-pill.is-ok, [data-theme="dark"] .ha-fiche-statut.is-principale { background: rgba(46,155,87,.22); color: #8ED7A8; }
[data-theme="dark"] .ha-fiche-pill.is-attente, [data-theme="dark"] .ha-fiche-statut.is-bientot { background: rgba(186,117,23,.2); color: #F0C36A; }
[data-theme="dark"] .ha-fiche-statut.is-secondaire { background: rgba(109,40,217,.22); color: #D6BCFA; }
[data-theme="dark"] .ha-fiche-statut.is-expiree { background: rgba(163,45,45,.2); color: #F0A0A0; }
[data-theme="dark"] .ha-fiche-onglets button.is-on, [data-theme="dark"] .ha-fiche-table a { color: var(--heading); }
@media (max-width: 800px) {
  .ha-fiche-head, .ha-fiche-info { display: block; }
  .ha-fiche-stats { grid-template-columns: 1fr 1fr; }
  .ha-fiche-actions { margin-top: 10px; }
  .ha-fiche-nav { margin-bottom: 12px; }
  .ha-fiche-outils input { margin-left: 0; width: 100%; }
}
`
