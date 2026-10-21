import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Empty, Loading, Flash } from '@/components/ui'
import {
  COMPETENCES_ACTIVITE,
  libelleCompetence,
  libelleTypeActivite,
  TYPES_ACTIVITE,
  DISPOSITIFS,
  libelleDispositif,
  publicAttenduOuNull,
  selectionChauffeurEchue,
  competencesConnues,
  compterActivites,
  requiertMesCompetences,
  estAVenir,
  dansLes30Jours,
  peutCreerActiviteSecours,
} from './activitesSecours'

const VIDE = {
  id: null,
  titre: '',
  type: 'activite',
  lieu: '',
  debut: '',
  fin: '',
  places: '1',
  publicAttendu: '',
  dispositif: '',
  competences: [],
}

function pad(n) { return String(n).padStart(2, '0') }

function jourLocal(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

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

function fmtPlage(a) {
  const date = fmtDate(a.debut)
  const h = fmtHeure(a.debut)
  if (!a.fin) return { date, heures: h }
  const memeJour = jourLocal(a.debut) === jourLocal(a.fin)
  const fin = memeJour ? fmtHeure(a.fin) : `${fmtDate(a.fin)} ${fmtHeure(a.fin)}`
  return { date, heures: h && fin ? `${h}–${fin}` : h }
}

function versChamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function versIso(valeur) {
  if (!valeur) return null
  const d = new Date(valeur)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function IconePersonne() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19.2c1.2-3 3.4-4.4 6.5-4.4s5.3 1.4 6.5 4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function IconeCompetence() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.2 12.2l2.4 2.4 5.2-5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconeCalendrier() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <rect x="4" y="5.5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 10h16M8 3.8v3.2M16 3.8v3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function ActivitesSecours() {
  const { profile } = useAuth()
  const gerer = peutCreerActiviteSecours(profile)
  const [activites, setActivites] = useState([])
  const [inscriptions, setInscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)
  const [carte, setCarte] = useState(null)
  const [competence, setCompetence] = useState('')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [q, setQ] = useState('')
  const [tri, setTri] = useState('asc')
  const [busy, setBusy] = useState(null)
  const [form, setForm] = useState(null)
  const [sauve, setSauve] = useState(false)

  useEffect(() => { charger() }, [profile?.id])

  async function charger(silencieux = false) {
    if (!silencieux) setLoading(true)
    setErr(null)
    const [a, i] = await Promise.all([
      supabase.from('activites_secours').select('id,numero,titre,type,dispositif,public_attendu,lieu,debut,fin,places,competences,created_by').order('debut', { ascending: true }),
      supabase.from('activites_secours_inscrits').select('id,activite_id,user_id'),
    ])
    if (a.error || i.error) {
      setErr(a.error?.message || i.error?.message || 'Chargement impossible.')
      setActivites([])
      setInscriptions([])
    } else {
      setActivites(Array.isArray(a.data) ? a.data : [])
      setInscriptions(Array.isArray(i.data) ? i.data : [])
    }
    setLoading(false)
  }

  const stats = useMemo(
    () => compterActivites(activites, inscriptions, profile),
    [activites, inscriptions, profile],
  )

  const lignes = useMemo(() => {
    const texte = q.trim().toLowerCase()
    const rows = activites.filter(a => {
      const n = stats.nombres.get(a.id) || 0
      if (carte === 'possible' && !(estAVenir(a) && n < Number(a.places) && !stats.miennes.has(a.id))) return false
      if (carte === 'competence' && !(estAVenir(a) && requiertMesCompetences(a, stats.mes))) return false
      if (carte === 'bientot' && !dansLes30Jours(a.debut)) return false
      if (competence && !(a.competences || []).includes(competence)) return false
      const jour = jourLocal(a.debut)
      if (du && jour && jour < du) return false
      if (au && jour && jour > au) return false
      if (texte) {
        const blob = `${a.numero || ''} ${a.titre || ''} ${a.lieu || ''}`.toLowerCase()
        if (!blob.includes(texte)) return false
      }
      return true
    })
    rows.sort((a, b) => {
      const d = String(a.debut).localeCompare(String(b.debut))
      return tri === 'asc' ? d : -d
    })
    return rows
  }, [activites, stats, carte, competence, du, au, q, tri])

  function basculerCarte(id) {
    setCarte(c => (c === id ? null : id))
  }

  async function inscrire(a) {
    if (!profile?.id || busy) return
    setBusy(a.id)
    setFlash(null)
    const deja = stats.miennes.has(a.id)
    if (!deja && selectionChauffeurEchue(profile, a)) {
      setFlash('Votre sélection médicale est échue. L’inscription n’est pas possible : cette activité demande un chauffeur.')
      setBusy(null)
      return
    }
    const res = deja
      ? await supabase.from('activites_secours_inscrits').delete().eq('activite_id', a.id).eq('user_id', profile.id)
      : await supabase.from('activites_secours_inscrits').insert({ activite_id: a.id, user_id: profile.id })
    if (res.error) setFlash(res.error.message || 'Inscription impossible.')
    else await charger(true)
    setBusy(null)
  }

  function ouvrirCreation() {
    setErr(null)
    setForm({ ...VIDE, competences: [] })
  }

  function ouvrirEdition(a) {
    setForm({
      id: a.id,
      titre: a.titre || '',
      type: TYPES_ACTIVITE.some(t => t.v === a.type) ? a.type : 'activite',
      lieu: a.lieu || '',
      debut: versChamp(a.debut),
      fin: versChamp(a.fin),
      places: String(a.places ?? 1),
      publicAttendu: a.public_attendu == null ? '' : String(a.public_attendu),
      dispositif: DISPOSITIFS.some(d => d.v === a.dispositif) ? a.dispositif : '',
      competences: competencesConnues(a.competences),
    })
  }

  function majForm(patch) {
    setForm(f => ({ ...f, ...patch }))
  }

  function toggleCompetence(v) {
    setForm(f => {
      const a = f.competences.includes(v) ? f.competences.filter(x => x !== v) : [...f.competences, v]
      return { ...f, competences: a }
    })
  }

  async function enregistrer(e) {
    e.preventDefault()
    if (!form || sauve) return
    const titre = form.titre.trim()
    const debut = versIso(form.debut)
    const fin = versIso(form.fin)
    const places = Number(form.places)
    if (!titre) { setFlash('Indiquez le titre.'); return }
    if (!debut) { setFlash('Indiquez le début.'); return }
    if (form.fin && !fin) { setFlash('La fin est illisible.'); return }
    if (fin && fin < debut) { setFlash('La fin est avant le début.'); return }
    if (!Number.isInteger(places) || places < 1 || places > 500) { setFlash('Le nombre de places doit être entre 1 et 500.'); return }
    const publicAttendu = publicAttenduOuNull(form.publicAttendu)
    if (publicAttendu === undefined) { setFlash('Le public attendu doit être un nombre entre 0 et 500 000, ou rester vide.'); return }
    if (form.dispositif && !DISPOSITIFS.some(d => d.v === form.dispositif)) { setFlash('Le type de dispositif est inconnu.'); return }
    setSauve(true)
    setFlash(null)
    const payload = {
      titre,
      type: TYPES_ACTIVITE.some(t => t.v === form.type) ? form.type : 'activite',
      dispositif: form.dispositif || null,
      public_attendu: publicAttendu,
      lieu: form.lieu.trim() || null,
      debut,
      fin,
      places,
      competences: competencesConnues(form.competences),
    }
    const res = form.id
      ? await supabase.from('activites_secours').update(payload).eq('id', form.id)
      : await supabase.from('activites_secours').insert({ ...payload, created_by: profile?.id || null })
    if (res.error) setFlash(res.error.message || 'Enregistrement impossible.')
    else {
      setForm(null)
      await charger(true)
    }
    setSauve(false)
  }

  async function retirer(id) {
    if (!id || sauve) return
    if (!window.confirm('Retirer cette activité ? Les inscriptions partent avec elle.')) return
    setSauve(true)
    setFlash(null)
    const res = await supabase.from('activites_secours').delete().eq('id', id)
    if (res.error) setFlash(res.error.message || 'Suppression impossible.')
    else {
      setForm(null)
      await charger(true)
    }
    setSauve(false)
  }

  const aucune = !loading && activites.length === 0
  const filtreVide = !loading && activites.length > 0 && lignes.length === 0

  return (
    <Page
      title="Activités"
      subtitle="Département secours. Une activité se dimensionne, s’arme, puis se rend en bilan."
      action={gerer ? <Btn onClick={ouvrirCreation}>+ Activité</Btn> : null}
    >
      <style>{CSS}</style>
      {err && <Flash kind="err">{err}</Flash>}
      {flash && <Flash kind="err">{flash}</Flash>}

      <div className="ha-act-cartes">
        <Carte
          tone="possible"
          on={carte === 'possible'}
          n={loading ? '…' : stats.possible}
          label="Inscription possible"
          icone={<IconePersonne />}
          onClick={() => basculerCarte('possible')}
        />
        <Carte
          tone="competence"
          on={carte === 'competence'}
          n={loading ? '…' : stats.competence}
          label="Requiert ma compétence"
          icone={<IconeCompetence />}
          onClick={() => basculerCarte('competence')}
        />
        <Carte
          tone="bientot"
          on={carte === 'bientot'}
          n={loading ? '…' : stats.bientot}
          label="Sur les 30 prochains jours"
          icone={<IconeCalendrier />}
          onClick={() => basculerCarte('bientot')}
        />
      </div>

      <div className="ha-act-filtres">
        <select aria-label="Compétence" value={competence} onChange={e => setCompetence(e.target.value)}>
          <option value="">Toutes les activités</option>
          {COMPETENCES_ACTIVITE.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        <label className="ha-act-dates">
          <span className="ha-sr">Du</span>
          <input type="date" aria-label="Date de début, à partir du" value={du} onChange={e => setDu(e.target.value)} />
          <span>au</span>
          <span className="ha-sr">Au</span>
          <input type="date" aria-label="Date de début, jusqu’au" value={au} onChange={e => setAu(e.target.value)} />
        </label>
        <label className="ha-act-recherche">
          <span className="ha-sr">Rechercher</span>
          <input type="search" placeholder="Rechercher" value={q} onChange={e => setQ(e.target.value)} />
        </label>
      </div>

      {form && (
        <Card style={{ marginBottom: 14 }}>
          <form onSubmit={enregistrer}>
            <div className="ha-act-form">
              <F label="Titre" value={form.titre} set={v => majForm({ titre: v })} required />
              <label style={{ marginBottom: 10, display: 'block' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Type</span>
                <select value={form.type} onChange={e => majForm({ type: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13.5, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                  {TYPES_ACTIVITE.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </label>
              <F label="Lieu" value={form.lieu} set={v => majForm({ lieu: v })} />
              <F label="Début" type="datetime-local" value={form.debut} set={v => majForm({ debut: v })} required />
              <F label="Fin" type="datetime-local" value={form.fin} set={v => majForm({ fin: v })} />
              <F label="Places" type="number" value={form.places} set={v => majForm({ places: v })} required />
              <F label="Public attendu" type="number" value={form.publicAttendu} set={v => majForm({ publicAttendu: v })} />
              <label style={{ marginBottom: 10, display: 'block' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Dispositif</span>
                <select value={form.dispositif} onChange={e => majForm({ dispositif: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13.5, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                  <option value="">—</option>
                  {DISPOSITIFS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </label>
            </div>
            <p className="ha-act-note">Le type de dispositif se choisit. Il n’est pas calculé à partir du public.</p>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Compétences requises</span>
              <div className="ha-act-choix" role="group" aria-label="Compétences requises">
                {COMPETENCES_ACTIVITE.map(c => (
                  <button
                    key={c.v}
                    type="button"
                    className={'ha-act-choix-btn' + (form.competences.includes(c.v) ? ' is-on' : '')}
                    aria-pressed={form.competences.includes(c.v)}
                    onClick={() => toggleCompetence(c.v)}
                  >
                    {c.l}
                  </button>
                ))}
              </div>
              <p className="ha-act-note">La carte « Requiert ma compétence » compare ces valeurs à la fiche : qualifications, et type médical ou non médical.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn type="submit" disabled={sauve}>{form.id ? 'Enregistrer' : 'Créer l’activité'}</Btn>
              <Btn kind="soft" onClick={() => setForm(null)} disabled={sauve}>Annuler</Btn>
              {form.id && <Btn kind="danger" onClick={() => retirer(form.id)} disabled={sauve}>Retirer</Btn>}
            </div>
          </form>
        </Card>
      )}

      {loading ? <Loading /> : aucune ? (
        <Empty title="Aucune activité pour le moment" hint={gerer ? 'Ajoutez la première activité du département secours.' : 'Quand une activité sera publiée, elle apparaîtra ici.'} />
      ) : filtreVide ? (
        <Empty title="Aucune activité ne correspond" hint="Élargissez les filtres ou la recherche." />
      ) : (
        <div className="ha-act-table-wrap">
          <table className="ha-act-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Activité</th>
                <th>Lieu</th>
                <th>
                  <button type="button" className="ha-act-tri" onClick={() => setTri(t => t === 'asc' ? 'desc' : 'asc')}>
                    Date <span aria-hidden>{tri === 'asc' ? '↑' : '↓'}</span>
                  </button>
                </th>
                <th>Compétence</th>
                <th>Inscrit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(a => {
                const n = stats.nombres.get(a.id) || 0
                const places = Number(a.places) || 0
                const moi = stats.miennes.has(a.id)
                const aVenir = estAVenir(a)
                const complet = n >= places
                const plage = fmtPlage(a)
                let libelle = 'S’inscrire'
                let desactive = false
                if (moi) libelle = 'Se désinscrire'
                else if (!aVenir) { libelle = 'Terminée'; desactive = true }
                else if (complet) { libelle = 'Complet'; desactive = true }
                return (
                  <tr key={a.id}>
                    <td className="ha-act-id">{a.numero}</td>
                    <td>
                      <Link to={`/app/secours/activites/${a.id}`} className="ha-act-titre">{a.titre}</Link>
                      <div className="ha-act-type">
                        {libelleTypeActivite(a.type)}
                        {a.dispositif ? ` · ${libelleDispositif(a.dispositif, true)}` : ''}
                      </div>
                    </td>
                    <td className="ha-act-lieu">{a.lieu || '—'}</td>
                    <td>
                      <div className="ha-act-quand">
                        <strong>{plage.date}</strong>
                        {plage.heures && <span>{plage.heures}</span>}
                      </div>
                    </td>
                    <td>
                      {(a.competences || []).length === 0
                        ? <span className="ha-act-aucune">—</span>
                        : (a.competences || []).map(c => (
                          <span key={c} className={'ha-act-chip' + (stats.mes.has(c) ? ' is-moi' : ' is-autre')}>
                            {stats.mes.has(c) ? '✓' : '•'} {libelleCompetence(c)}
                          </span>
                        ))}
                    </td>
                    <td>
                      <Barre inscrits={n} places={places} />
                    </td>
                    <td>
                      <div className="ha-act-actions">
                        <button
                          type="button"
                          className={'ha-act-go' + (moi ? ' is-off' : '')}
                          disabled={desactive || busy === a.id}
                          onClick={() => inscrire(a)}
                        >
                          <IconePersonne />
                          {busy === a.id ? '…' : libelle}
                        </button>
                        {gerer && (
                          <button type="button" className="ha-act-mod" onClick={() => ouvrirEdition(a)}>Modifier</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  )
}

function Carte({ tone, on, n, label, icone, onClick }) {
  return (
    <button type="button" className={'ha-act-carte is-' + tone + (on ? ' is-on' : '')} aria-pressed={on} onClick={onClick}>
      <span className="ha-act-carte-n">{n}</span>
      <span className="ha-act-carte-l">{label}</span>
      <span className={'ha-act-carte-ico is-' + tone}>{icone}</span>
    </button>
  )
}

function Barre({ inscrits, places }) {
  const ratio = places > 0 ? Math.min(1, inscrits / places) : 0
  const plein = places > 0 && inscrits >= places
  const largeur = inscrits === 0 ? 0 : Math.max(ratio * 100, 18)
  return (
    <div className="ha-act-barre" role="img" aria-label={`${inscrits} inscrit${inscrits > 1 ? 's' : ''} sur ${places} place${places > 1 ? 's' : ''}`}>
      <span
        style={{
          width: `${largeur}%`,
          background: plein ? '#1F9D55' : 'linear-gradient(90deg, #185FA5, #7A5BD6)',
        }}
      />
      <em style={{ color: ratio >= 0.55 || plein ? '#fff' : 'var(--text)' }}>{inscrits}/{places}</em>
    </div>
  )
}

const CSS = `
.ha-act-cartes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.ha-act-carte {
  position: relative;
  text-align: center;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 46px 14px;
  box-shadow: 0 1px 2px rgba(20, 18, 16, .04);
  color: var(--text);
  overflow: hidden;
}
.ha-act-carte::before {
  content: '';
  position: absolute;
  left: 0; right: 0; top: 0;
  height: 3px;
}
.ha-act-carte.is-possible::before { background: #185FA5; }
.ha-act-carte.is-competence::before { background: #2E9B57; }
.ha-act-carte.is-bientot::before { background: #D4534A; }
.ha-act-carte.is-on {
  border-color: #185FA5;
  background: var(--blue-light);
  box-shadow: 0 0 0 1px #185FA5;
}
.ha-act-carte-n {
  display: block;
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--text);
}
.ha-act-carte-l {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.3;
}
.ha-act-carte-ico {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
}
.ha-act-carte-ico.is-possible { background: #E6F1FB; color: #185FA5; }
.ha-act-carte-ico.is-competence { background: #E5F6EC; color: #1E7A45; }
.ha-act-carte-ico.is-bientot { background: #FDECEA; color: #C8435A; }
.ha-act-filtres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 14px;
}
.ha-act-filtres select,
.ha-act-filtres input,
.ha-act-dates {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 13px;
}
.ha-act-filtres select,
.ha-act-filtres input { padding: 7px 10px; }
.ha-act-dates {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
}
.ha-act-dates input {
  border: none;
  background: transparent;
  padding: 5px 2px;
  color: inherit;
  font: inherit;
  font-size: 13px;
}
.ha-act-dates span { color: var(--text-muted); font-size: 12.5px; }
.ha-act-recherche { margin-left: auto; }
.ha-act-recherche input { min-width: min(240px, 70vw); }
.ha-act-table-wrap {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: auto;
}
.ha-act-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 860px; }
.ha-act-table th {
  text-align: left;
  font-size: 11px;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 700;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  white-space: nowrap;
}
.ha-act-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.ha-act-table tr:last-child td { border-bottom: none; }
.ha-act-id { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--text-2); width: 3.2rem; }
.ha-act-titre { color: var(--accent-blue); font-weight: 700; text-decoration: none; }
.ha-act-titre:hover { text-decoration: underline; }
.ha-act-type { margin-top: 2px; font-size: 12px; color: var(--text-muted); font-weight: 600; }
.ha-act-lieu { color: var(--text-2); max-width: 240px; }
.ha-act-quand { display: flex; flex-direction: column; gap: 2px; font-variant-numeric: tabular-nums; }
.ha-act-quand strong { font-weight: 700; color: var(--text); }
.ha-act-quand span { color: var(--text-muted); font-size: 12px; }
.ha-act-tri {
  border: none; background: transparent; padding: 0;
  font: inherit; font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
  font-weight: 700; color: var(--accent-blue); cursor: pointer;
}
.ha-act-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 2px 4px 2px 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  border: 1px solid transparent;
  white-space: nowrap;
}
.ha-act-chip.is-moi { color: #1E7A45; background: #E7F6EE; border-color: #B7E4C7; }
.ha-act-chip.is-autre { color: #C26A12; background: #FFF4E8; border-color: #F3D2A8; }
.ha-act-aucune { color: var(--text-faint); }
.ha-act-barre {
  position: relative;
  height: 22px;
  min-width: 96px;
  border-radius: 999px;
  background: var(--bg-alt);
  overflow: hidden;
}
.ha-act-barre > span { display: block; height: 100%; border-radius: inherit; }
.ha-act-barre em {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  font-style: normal; font-size: 12px; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ha-act-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.ha-act-go, .ha-act-mod {
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 700;
  cursor: pointer;
}
.ha-act-go {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  padding: 6px 10px;
}
.ha-act-go:hover:not(:disabled) { border-color: var(--accent); color: var(--heading); }
.ha-act-go.is-off { color: #A32D2D; }
.ha-act-go:disabled { opacity: .55; cursor: not-allowed; }
.ha-act-mod {
  border: none; background: transparent; color: var(--accent); padding: 0 2px; font-weight: 600;
}
.ha-act-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0 12px;
}
.ha-act-choix { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ha-act-choix-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 999px;
  padding: 4px 10px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
}
.ha-act-choix-btn.is-on { background: var(--accent); border-color: var(--accent); color: #fff; }
.ha-act-note { margin: 8px 0 12px; font-size: 12px; color: var(--text-muted); }
.ha-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
[data-theme="dark"] .ha-act-titre,
[data-theme="dark"] .ha-act-tri { color: var(--heading); }
[data-theme="dark"] .ha-act-carte-ico.is-possible { background: rgba(24,95,165,.28); color: #8EBFEE; }
[data-theme="dark"] .ha-act-carte-ico.is-competence { background: rgba(46,155,87,.22); color: #8ED7A8; }
[data-theme="dark"] .ha-act-carte-ico.is-bientot { background: rgba(200,67,90,.22); color: #F0A0A8; }
[data-theme="dark"] .ha-act-chip.is-moi { color: #B7E08A; background: rgba(59,109,17,.22); border-color: rgba(59,109,17,.45); }
[data-theme="dark"] .ha-act-chip.is-autre { color: #F0C36A; background: rgba(186,117,23,.2); border-color: rgba(186,117,23,.45); }
[data-theme="dark"] .ha-act-go.is-off { color: #F0A0A0; }
@media (max-width: 800px) {
  .ha-act-cartes { grid-template-columns: 1fr; }
  .ha-act-recherche { margin-left: 0; width: 100%; }
  .ha-act-recherche input { width: 100%; }
}
`
