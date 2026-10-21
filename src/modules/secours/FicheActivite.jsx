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
} from './activitesSecours'

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
  const [temps, setTemps] = useState('dimensionner')
  const [loading, setLoading] = useState(true)
  const [absent, setAbsent] = useState(false)
  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filtreComp, setFiltreComp] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => { charger() }, [id, profile?.id])

  async function charger(silencieux = false) {
    if (!silencieux) setLoading(true)
    setErr(null)
    setAbsent(false)
    const a = await supabase
      .from('activites_secours')
      .select('id,numero,titre,type,dispositif,public_attendu,lieu,debut,fin,places,competences,created_by,created_at')
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
    const ids = [...new Set(lignes.map(x => x.user_id).filter(Boolean))]
    let profils = []
    if (ids.length) {
      const p = await supabase.from('profiles').select('id,prenom,nom,role,fiche').in('id', ids)
      if (p.error) setErr(p.error.message || 'Chargement du personnel impossible.')
      else profils = p.data || []
    }
    let qui = null
    if (a.data.created_by) {
      const c = await supabase.from('profiles').select('id,prenom,nom').eq('id', a.data.created_by).maybeSingle()
      if (!c.error) qui = c.data
    }
    setActivite(a.data)
    setInscriptions(lignes)
    setGens(profils)
    setAuteur(qui)
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

  const personnel = useMemo(() => {
    const parId = new Map(gens.map(g => [g.id, g]))
    const texte = q.trim().toLowerCase()
    return inscriptions
      .map(ins => {
        const g = parId.get(ins.user_id)
        const fiche = g?.fiche || {}
        const quals = Array.isArray(fiche.qualifications) ? fiche.qualifications : []
        const couvre = requises.some(c => quals.includes(c) || mesCorrespond(c, g))
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

  function aller(etape) {
    setTemps(etape)
    if (etape === 'dimensionner') setOnglet('info')
    if (etape === 'armer') setOnglet('personnel')
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
  const lieuUrl = activite?.lieu
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activite.lieu)}`
    : ''

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
              <Link to="/app/secours/activites" className="ha-afiche-retour">Activités</Link>
              <p className="ha-afiche-type">{libelleTypeActivite(activite.type)}</p>
              <h1>{activite.titre}</h1>
              <p className="ha-afiche-quand">
                {memeJour
                  ? fmtDate(activite.debut)
                  : `du ${fmtDate(activite.debut)} au ${fmtDate(activite.fin || activite.debut)}`}
                {' · '}
                {fmtHeure(activite.debut)}
                {activite.fin ? ` – ${fmtHeure(activite.fin)}` : ''}
                {duree ? ` (${duree})` : ''}
              </p>
            </div>
            <span className={'ha-afiche-etat is-' + statut}>{libelleStatutActivite(statut)}</span>
          </div>
          <div className="ha-afiche-chiffres">
            <Chiffre label="Personnel inscrit" valeur={n} />
            <Chiffre label="Places" valeur={`${n} / ${places}`} />
            <Chiffre label="Durée" valeur={duree || '—'} />
          </div>
        </header>

        <nav className="ha-dps-temps" aria-label="Déroulement du dispositif">
          <button type="button" className={temps === 'dimensionner' ? 'is-on' : ''} onClick={() => aller('dimensionner')}>
            <span>1</span> Dimensionner
          </button>
          <button type="button" className={temps === 'armer' ? 'is-on' : ''} onClick={() => aller('armer')}>
            <span>2</span> Armer
          </button>
          <button type="button" className={temps === 'rendre' ? 'is-on' : ''} onClick={() => aller('rendre')}>
            <span>3</span> Rendre
          </button>
        </nav>

        {temps !== 'rendre' && (
        <nav className="ha-afiche-onglets" aria-label="Fiche de l’activité">
          <button type="button" className={onglet === 'info' ? 'is-on' : ''} onClick={() => aller('dimensionner')}>Information</button>
          <button type="button" className={onglet === 'personnel' ? 'is-on' : ''} onClick={() => aller('armer')}>
            Personnel{n ? ` ${n}` : ''}
          </button>
        </nav>
        )}

        {temps === 'rendre' && (
          <section className="ha-afiche-carte">
            <h2>Bilan de fin</h2>
            <p className="ha-afiche-vide" style={{ marginTop: 8 }}>
              {statut === 'terminee'
                ? 'Le dispositif est terminé. Le bilan reprend l’équipe inscrite, la durée et le dimensionnement.'
                : 'Le dispositif n’est pas encore terminé. Le bilan reprend déjà ce qui est enregistré.'}
            </p>
            <div className="ha-afiche-kv" style={{ marginTop: 14 }}>
              <Champ k="Dispositif" v={libelleDispositif(activite.dispositif) || '—'} />
              <Champ k="Public attendu" v={activite.public_attendu == null ? '—' : String(activite.public_attendu)} />
              <Champ k="Équipe" v={`${n} / ${places}`} />
              <Champ k="Durée" v={duree || '—'} />
            </div>
            <div className="ha-dps-actions">
              <Btn onClick={recupererBilan}>Récupérer</Btn>
              <Btn kind="soft" onClick={imprimerBilan}>Imprimer</Btn>
            </div>
          </section>
        )}

        {temps !== 'rendre' && onglet === 'info' && (
          <div className="ha-afiche-grille">
            <section className="ha-afiche-carte">
              <h2>Détails de l’activité</h2>
              <p className="ha-afiche-sec">Identité</p>
              <div className="ha-afiche-kv">
                <Champ k="N°" v={activite.numero ?? '—'} />
                <Champ k="Statut" v={libelleStatutActivite(statut)} />
                <Champ k="Type" v={libelleTypeActivite(activite.type)} />
                <Champ k="Nom" v={activite.titre} />
                <Champ k="Dispositif" v={libelleDispositif(activite.dispositif) || '—'} />
                <Champ k="Public attendu" v={activite.public_attendu == null ? '—' : String(activite.public_attendu)} />
              </div>
              <p className="ha-afiche-vide">Le type de dispositif est choisi à la création. Il n’est pas déduit du public.</p>
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
              {activite.lieu
                ? (
                  <>
                    <p className="ha-afiche-lieu">{activite.lieu}</p>
                    <a className="ha-afiche-maps" href={lieuUrl} target="_blank" rel="noreferrer">Ouvrir dans Google Maps</a>
                  </>
                )
                : <p className="ha-afiche-vide">Aucun lieu renseigné.</p>}
            </section>
          </div>
        )}

        {temps !== 'rendre' && onglet === 'personnel' && (
          <section className="ha-afiche-carte">
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
.ha-afiche-retour { font-size: 12.5px; font-weight: 700; color: var(--accent); text-decoration: none; }
.ha-afiche-type { margin: 6px 0 0; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
.ha-afiche h1 { margin: 2px 0 0; font-size: 1.35rem; color: var(--heading); line-height: 1.2; }
.ha-afiche-quand { margin: 4px 0 0; color: var(--text-muted); font-size: 13px; }
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
