import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, Empty, Loading, Flash, Pill, inp, lbl } from '@/components/ui'
import { imprimerHtml, telechargerHtml, imprimerApercuIframe } from '@/modules/souhaits/documentA4'
import {
  FORFAIT_JOUR, PLAFOND_AN, TAUX_KM, MAX_KM, MOTIFS_KM, stNote, fmtEuro, titrePeriode,
  normaliserIban, ibanValide, ligneVide, ligneKmVide, fusionnerJours, totalForfait,
  totalKm, totalKmParcourus, normaliserLignesKm, montantKm, activiteKmDefaut, joursDuMois,
  etapesCircuit, fmtDateHeure, ogmChiffres,
} from './constantes'
import { htmlNoteFrais, nomFichierNote, chargerLogoNote } from './noteFraisHtml'

const now = new Date()
const MOIS = Array.from({ length: 12 }, (_, i) => {
  const t = new Date(2026, i, 1).toLocaleDateString('fr-BE', { month: 'long' })
  return { v: String(i + 1), l: t.charAt(0).toUpperCase() + t.slice(1) }
})
const ANNEES = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => ({ v: String(y), l: String(y) }))

function nomProfil(p) {
  return [p?.prenom, p?.nom].filter(Boolean).join(' ') || p?.email || 'Volontaire'
}

function msgRpc(error, fallback) {
  return error?.message || fallback || 'Erreur'
}

export default function Defraiements() {
  const { profile, peutGererDefraiements, peutSupprimerNoteFrais } = useAuth()
  const tresorier = peutGererDefraiements()
  const peutSupprimer = peutSupprimerNoteFrais()
  const [notes, setNotes] = useState([])
  const [profils, setProfils] = useState({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [filtre, setFiltre] = useState('miennes')
  const [recherche, setRecherche] = useState('')
  const [edition, setEdition] = useState(null)

  useEffect(() => { charger() }, [profile?.id, tresorier])

  async function charger() {
    if (!profile?.id) return
    setLoading(true)
    setErr(null)
    let q = supabase.from('notes_frais').select('*').order('periode_annee', { ascending: false }).order('periode_mois', { ascending: false })
    if (!tresorier) q = q.eq('user_id', profile.id)
    const { data, error } = await q
    if (error) setErr(error.message)
    const rows = data || []
    setNotes(rows)
    const ids = [...new Set(rows.map(n => n.user_id).filter(Boolean))]
    if (tresorier && ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id,prenom,nom,email,fiche').in('id', ids)
      setProfils(Object.fromEntries((ps || []).map(p => [p.id, p])))
    } else {
      setProfils({ [profile.id]: profile })
    }
    setLoading(false)
  }

  const visibles = notes.filter(n => {
    if (filtre === 'a_verifier') return n.statut === 'soumise'
    if (filtre === 'a_autoriser') return n.statut === 'verifiee'
    if (filtre === 'a_virer') return n.statut === 'approuve_n1' || n.statut === 'approuve_n2'
    if (filtre === 'payees') return n.statut === 'paye'
    if (filtre === 'miennes') return n.user_id === profile?.id
    return true
  }).filter(n => {
    const q = recherche.trim().toLowerCase()
    if (!q) return true
    const p = profils[n.user_id]
    const hay = [n.communication, ogmChiffres(n.communication), nomProfil(p), titrePeriode(n.periode_mois, n.periode_annee)].join(' ').toLowerCase()
    return hay.includes(q) || ogmChiffres(n.communication).includes(ogmChiffres(q))
  })

  if (edition) {
    return (
      <EditeurNote
        initiale={edition}
        tresorier={tresorier}
        peutSupprimer={peutSupprimer}
        moi={profile}
        onClose={() => { setEdition(null); charger() }}
      />
    )
  }

  return (
    <Page
      title="Défraiements"
      subtitle="Valider dans l’app vaut signature. Chaque note a une communication structurée pour le virement et la comptabilité."
      action={<Btn onClick={() => setEdition({ nouveau: true })}>Nouvelle note</Btn>}
    >
      {err && <Flash kind="err">{err}</Flash>}
      {tresorier && (
        <div className="ha-tabs" style={{ marginBottom: 12 }}>
          {[
            { v: 'miennes', l: 'Mes notes' },
            { v: 'a_verifier', l: 'À vérifier' },
            { v: 'a_autoriser', l: 'À autoriser' },
            { v: 'a_virer', l: 'À virer' },
            { v: 'toutes', l: 'Toutes' },
            { v: 'payees', l: 'Payées' },
          ].map(f => (
            <button key={f.v} type="button" className={'ha-tab' + (filtre === f.v ? ' is-on' : '')} onClick={() => setFiltre(f.v)}>
              {f.l}
            </button>
          ))}
        </div>
      )}
      {tresorier && (
        <div style={{ marginBottom: 14 }}>
          <input
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="N° de communication ou nom…"
            style={inp}
          />
        </div>
      )}

      {loading ? <Loading />
        : visibles.length === 0 ? (
          <Empty
            title="Aucune note pour le moment"
            hint="Créez une note, puis validez-la : cela signe la demande et attribue le numéro de communication."
            action={<Btn onClick={() => setEdition({ nouveau: true })}>Créer une note</Btn>}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibles.map(n => {
              const st = stNote(n.statut)
              const p = profils[n.user_id] || (n.user_id === profile?.id ? profile : null)
              return (
                <Card key={n.id} clickable onClick={() => setEdition(n)} style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{titrePeriode(n.periode_mois, n.periode_annee)}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                        {nomProfil(p)}
                        {n.iban ? ` · ${n.iban}` : ''}
                      </div>
                      {n.communication && (
                        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: 'var(--heading)', marginTop: 4 }}>
                          {n.communication}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, color: 'var(--heading)' }}>{fmtEuro(n.total)}</span>
                      <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
    </Page>
  )
}

function EditeurNote({ initiale, tresorier, peutSupprimer, moi, onClose }) {
  const [userId, setUserId] = useState(initiale.user_id || moi.id)
  const [mois, setMois] = useState(String(initiale.periode_mois || (now.getMonth() + 1)))
  const [annee, setAnnee] = useState(String(initiale.periode_annee || now.getFullYear()))
  const [iban, setIban] = useState(initiale.iban || '')
  const [lignes, setLignes] = useState(initiale.lignes_forfait || [])
  const [lignesKm, setLignesKm] = useState(initiale.lignes_km || [])
  const [statut, setStatut] = useState(initiale.statut || 'en_attente')
  const [motif, setMotif] = useState(initiale.motif_refus || '')
  const [volontaires, setVolontaires] = useState([])
  const [profilNote, setProfilNote] = useState(moi)
  const [cumulAn, setCumulAn] = useState(0)
  const [cumulKmAn, setCumulKmAn] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [apercu, setApercu] = useState(null)
  const [idNote, setIdNote] = useState(initiale.id || null)
  const [note, setNote] = useState(initiale.nouveau ? null : initiale)
  const apercuRef = useRef(null)
  const brouillon = statut === 'en_attente' || statut === 'refuse'
  const verrouille = !brouillon
  const totF = totalForfait(lignes)
  const totK = totalKm(lignesKm)
  const tot = Math.round((totF + totK) * 100) / 100
  const kmParcourus = totalKmParcourus(lignesKm)
  const plafond = cumulAn + (statut === 'refuse' ? 0 : totF)
  const plafondKm = cumulKmAn + (statut === 'refuse' ? 0 : kmParcourus)
  const estVolontaire = userId === moi.id

  useEffect(() => {
    document.body.classList.toggle('ha-fiche-ouverte', !!apercu)
    return () => document.body.classList.remove('ha-fiche-ouverte')
  }, [apercu])

  useEffect(() => {
    if (!tresorier) return
    supabase.from('profiles').select('id,prenom,nom,email,fiche').neq('role', 'partenaire').eq('actif', true).order('nom')
      .then(({ data }) => setVolontaires(data || []))
  }, [tresorier])

  useEffect(() => { preparer() }, [userId, mois, annee])

  async function chargerProfil(uid) {
    if (uid === moi.id) return moi
    const { data } = await supabase.from('profiles').select('id,prenom,nom,email,fiche').eq('id', uid).maybeSingle()
    return data || { id: uid }
  }

  async function cumulAnnuel(uid, y, saufId) {
    const { data } = await supabase.from('notes_frais')
      .select('id,total_forfait,total,lignes_km,statut')
      .eq('user_id', uid)
      .eq('periode_annee', Number(y))
      .neq('statut', 'refuse')
    const autres = (data || []).filter(n => n.id !== saufId)
    const forfait = autres.reduce((a, n) => a + Number(n.total_forfait != null ? n.total_forfait : n.total || 0), 0)
    const km = autres.reduce((a, n) => a + totalKmParcourus(n.lignes_km), 0)
    return { forfait, km }
  }

  function poserNote(row) {
    if (!row) return
    setNote(row)
    setIdNote(row.id)
    setStatut(row.statut)
    setMotif(row.motif_refus || '')
    setIban(row.iban || '')
    setLignes(row.lignes_forfait || [])
    setLignesKm(row.lignes_km || [])
  }

  async function preparer() {
    const p = await chargerProfil(userId)
    setProfilNote(p)
    const { data: exist } = await supabase.from('notes_frais')
      .select('*')
      .eq('user_id', userId)
      .eq('periode_mois', Number(mois))
      .eq('periode_annee', Number(annee))
      .maybeSingle()
    if (exist && exist.id !== idNote) {
      poserNote(exist)
      const c = await cumulAnnuel(userId, annee, exist.id)
      setCumulAn(c.forfait)
      setCumulKmAn(c.km)
      return
    }
    const c = await cumulAnnuel(userId, annee, idNote)
    setCumulAn(c.forfait)
    setCumulKmAn(c.km)
    if (idNote) return
    setIban(cur => cur || normaliserIban(p?.fiche?.iban || moi?.fiche?.iban || ''))
    const { data } = await supabase.rpc('missions_pour_note_frais', {
      p_user: userId,
      p_mois: Number(mois),
      p_annee: Number(annee),
    })
    setLignes(fusionnerJours(Array.isArray(data) ? data : []))
    setLignesKm([])
  }

  async function reprendreMissions() {
    const { data, error } = await supabase.rpc('missions_pour_note_frais', {
      p_user: userId,
      p_mois: Number(mois),
      p_annee: Number(annee),
    })
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setLignes(fusionnerJours(Array.isArray(data) ? data : []))
  }

  function payload() {
    const lf = fusionnerJours(lignes).map(l => ({
      date: l.date,
      activite: l.activite || 'Souhait',
      lieu: l.lieu || '',
      souhait_id: l.souhait_id || null,
      montant: FORFAIT_JOUR,
    }))
    const lk = normaliserLignesKm(lignesKm)
    const tf = totalForfait(lf)
    const tk = totalKm(lk)
    return {
      user_id: userId,
      periode_mois: Number(mois),
      periode_annee: Number(annee),
      iban: normaliserIban(iban),
      lignes_forfait: lf,
      lignes_km: lk,
      total_forfait: tf,
      total_km: tk,
      total: Math.round((tf + tk) * 100) / 100,
    }
  }

  async function enregistrer() {
    if (!ibanValide(iban)) { setMsg({ t: 'Indiquez un IBAN belge valide (BE + 14 chiffres).', ok: false }); return null }
    const body = payload()
    if (!body.lignes_forfait.length && !body.lignes_km.length) {
      setMsg({ t: 'Ajoutez au moins un jour d’activité ou une ligne de kilomètres.', ok: false })
      return null
    }
    const contenu = {
      iban: body.iban,
      lignes_forfait: body.lignes_forfait,
      lignes_km: body.lignes_km,
      total_forfait: body.total_forfait,
      total_km: body.total_km,
      total: body.total,
    }
    setSaving(true)
    let res
    if (idNote) {
      res = await supabase.from('notes_frais').update(contenu).eq('id', idNote).select('*').maybeSingle()
    } else {
      res = await supabase.from('notes_frais').insert({ ...body, statut: 'en_attente' }).select('*').maybeSingle()
    }
    if (res.error && /duplicate|unique/i.test(res.error.message)) {
      const { data: exist } = await supabase.from('notes_frais')
        .select('*').eq('user_id', userId).eq('periode_mois', Number(mois)).eq('periode_annee', Number(annee)).maybeSingle()
      if (exist) {
        setIdNote(exist.id)
        res = await supabase.from('notes_frais').update(contenu).eq('id', exist.id).select('*').maybeSingle()
      }
    }
    setSaving(false)
    if (res.error) { setMsg({ t: res.error.message, ok: false }); return null }
    const row = res.data
    poserNote(row)
    const fiche = { ...(profilNote?.fiche || {}), iban: normaliserIban(iban) }
    if (userId === moi.id || tresorier) {
      await supabase.from('profiles').update({ fiche }).eq('id', userId)
    }
    setMsg({ t: 'Note enregistrée.', ok: true })
    setTimeout(() => setMsg(null), 2500)
    return row
  }

  async function actionRpc(nom, args = {}) {
    setSaving(true)
    const { data, error } = await supabase.rpc(nom, args)
    setSaving(false)
    if (error) { setMsg({ t: msgRpc(error), ok: false }); return }
    const row = Array.isArray(data) ? data[0] : data
    poserNote(row)
    setMsg({ t: 'Enregistré.', ok: true })
    setTimeout(() => setMsg(null), 2500)
  }

  async function soumettre() {
    const saved = await enregistrer()
    const id = saved?.id || idNote
    if (!id) return
    await actionRpc('soumettre_note_frais', { p_id: id })
  }

  function notePourDoc() {
    return { ...payload(), ...(note || {}), id: idNote, statut, iban: normaliserIban(iban), lignes_forfait: fusionnerJours(lignes), lignes_km: normaliserLignesKm(lignesKm) }
  }

  async function docHtml() {
    const logoDataUrl = await chargerLogoNote()
    return htmlNoteFrais({ note: notePourDoc(), profil: profilNote, logoDataUrl })
  }

  async function ouvrirA4() {
    imprimerHtml(await docHtml(), setApercu)
  }

  async function telecharger() {
    const n = notePourDoc()
    telechargerHtml(nomFichierNote(n, profilNote), await docHtml())
  }

  async function copierOgm() {
    const t = note?.communication
    if (!t) return
    try {
      await navigator.clipboard.writeText(t)
      setMsg({ t: 'Communication copiée.', ok: true })
      setTimeout(() => setMsg(null), 2000)
    } catch {
      setMsg({ t: t, ok: true })
    }
  }

  function setLigne(i, k, v) {
    setLignes(ls => ls.map((l, j) => j === i ? { ...l, [k]: k === 'montant' ? FORFAIT_JOUR : v } : l))
  }

  function setKmLigne(i, k, v) {
    setLignesKm(ls => ls.map((l, j) => {
      if (j !== i) return l
      const next = { ...l, [k]: v }
      if (k === 'motif') {
        const def = activiteKmDefaut(v)
        if (!l.activite || l.activite === activiteKmDefaut(l.motif)) next.activite = def
      }
      if (k === 'km') next.montant = montantKm(v)
      return next
    }))
  }

  const st = stNote(statut)
  const jours = joursDuMois(Number(mois), Number(annee))

  return (
    <Page
      title={idNote ? `Note — ${titrePeriode(Number(mois), Number(annee))}` : 'Nouvelle note de frais'}
      subtitle="Valider la demande vaut signature. Le numéro de communication sert au virement et à la comptabilité."
      action={<Btn kind="soft" onClick={onClose}>← Retour</Btn>}
    >
      {msg && <Flash kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Flash>}
      <div style={{ marginBottom: 12 }}><Pill color={st.c} bg={st.bg}>{st.l}</Pill></div>

      <Card style={{ marginBottom: 14, background: 'var(--bg-alt)' }}>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 6 }}>Communication structurée</div>
        {note?.communication ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 20, fontWeight: 700, letterSpacing: 0.6, color: 'var(--heading)' }}>
              {note.communication}
            </div>
            <Btn kind="soft" onClick={copierOgm}>Copier</Btn>
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            Attribuée automatiquement quand le volontaire valide sa demande.
          </div>
        )}
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
          À coller comme communication du virement (format belge +++XXX/XXXX/XXXXX+++).
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Circuit de validation</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
          Pas de signature dessinée : chaque validation est horodatée au nom de la personne connectée.
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {etapesCircuit(note).map(e => (
            <div key={e.k} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) minmax(140px,1.4fr) minmax(120px,1fr)', gap: 8, alignItems: 'baseline', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{e.l}</div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                {e.nom || '—' }
                {e.fonc ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {e.fonc}</span> : null}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'right' }}>{e.at ? fmtDateHeure(e.at) : '—'}</div>
            </div>
          ))}
        </div>
        {note?.refuse_nom && (
          <div style={{ fontSize: 13, color: '#A32D2D', marginTop: 10 }}>
            Refusée par {note.refuse_nom}{note.refuse_at ? ` le ${fmtDateHeure(note.refuse_at)}` : ''}.
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0 16px' }}>
          {tresorier && initiale.nouveau && !idNote && (
            <Sel
              label="Volontaire"
              value={userId}
              set={setUserId}
              options={[{ v: moi.id, l: nomProfil(moi) + ' (moi)' }, ...volontaires.filter(v => v.id !== moi.id).map(v => ({ v: v.id, l: nomProfil(v) }))]}
            />
          )}
          <Sel label="Mois" value={mois} set={setMois} options={MOIS} disabled={!!idNote} />
          <Sel label="Année" value={annee} set={setAnnee} options={ANNEES} disabled={!!idNote} />
          <F label="IBAN (compte du volontaire)" value={iban} set={v => setIban(normaliserIban(v))} placeholder="BE00 0000 0000 0000" required disabled={verrouille} />
        </div>
        {tresorier && !initiale.nouveau && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{nomProfil(profilNote)}</div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: 'var(--heading)' }}>Jours d’activité (forfait)</div>
          {!verrouille && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn kind="soft" onClick={reprendreMissions}>Reprendre les missions du mois</Btn>
              <Btn kind="soft" onClick={() => setLignes(ls => [...ls, ligneVide(`${annee}-${String(mois).padStart(2, '0')}-01`)])}>+ Jour</Btn>
            </div>
          )}
        </div>
        {lignes.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Aucun jour. Les missions où vous étiez d’équipage se proposent automatiquement.
          </div>
        )}
        {lignes.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '0 10px', alignItems: 'end', marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
            <div>
              <label style={lbl}>Date</label>
              <select value={l.date || ''} onChange={e => setLigne(i, 'date', e.target.value)} disabled={verrouille} style={{ ...inp, opacity: verrouille ? .65 : 1 }}>
                <option value="">—</option>
                {jours.map(j => <option key={j} value={j}>{fmtDateLocale(j)}</option>)}
              </select>
            </div>
            <F label="Activité" value={l.activite || 'Souhait'} set={v => setLigne(i, 'activite', v)} disabled={verrouille} />
            <F label="Lieu" value={l.lieu || ''} set={v => setLigne(i, 'lieu', v)} disabled={verrouille} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--heading)' }}>{fmtEuro(FORFAIT_JOUR)}</span>
              {!verrouille && (
                <Btn kind="danger" onClick={() => setLignes(ls => ls.filter((_, j) => j !== i))} style={{ padding: '6px 10px' }}>Retirer</Btn>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {lignes.length} jour{lignes.length > 1 ? 's' : ''} × {fmtEuro(FORFAIT_JOUR)}
            {plafond > PLAFOND_AN && (
              <span style={{ color: '#A32D2D', display: 'block', marginTop: 4 }}>
                Attention : le plafond annuel ({fmtEuro(PLAFOND_AN)}) serait dépassé ({fmtEuro(plafond)}).
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--heading)' }}>{fmtEuro(totF)}</div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: 'var(--heading)' }}>Frais de déplacement</div>
          {!verrouille && (
            <Btn kind="soft" onClick={() => setLignesKm(ls => [...ls, ligneKmVide(`${annee}-${String(mois).padStart(2, '0')}-01`)])}>+ Trajet</Btn>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.45 }}>
          Indemnité de {String(TAUX_KM).replace('.', ',')} €/km (A/R). Pas pour un souhait qui part de la base de la semaine
          (aujourd’hui Solumob Jemeppe-sur-Meuse ; plus tard, la base personnelle). Oui pour une récolte de souhaits,
          ou pour un souhait dont la base n’était pas celle de la semaine. Les km du véhicule de mission ne se reprennent pas.
        </div>
        {lignesKm.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Aucun trajet. Ajoutez une ligne seulement si le motif le permet.
          </div>
        )}
        {lignesKm.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '0 10px', alignItems: 'end', marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
            <div>
              <label style={lbl}>Date</label>
              <select value={l.date || ''} onChange={e => setKmLigne(i, 'date', e.target.value)} disabled={verrouille} style={{ ...inp, opacity: verrouille ? .65 : 1 }}>
                <option value="">—</option>
                {jours.map(j => <option key={j} value={j}>{fmtDateLocale(j)}</option>)}
              </select>
            </div>
            <Sel
              label="Motif"
              value={l.motif || 'recolte'}
              set={v => setKmLigne(i, 'motif', v)}
              options={MOTIFS_KM}
              disabled={verrouille}
            />
            <F label="Activité" value={l.activite || ''} set={v => setKmLigne(i, 'activite', v)} disabled={verrouille} />
            <F label="Lieux (départ → arrivée)" value={l.lieux || ''} set={v => setKmLigne(i, 'lieux', v)} disabled={verrouille} />
            <F label="Km A/R" value={l.km === 0 || l.km ? String(l.km) : ''} set={v => setKmLigne(i, 'km', v)} disabled={verrouille} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--heading)' }}>{fmtEuro(montantKm(l.km))}</span>
              {!verrouille && (
                <Btn kind="danger" onClick={() => setLignesKm(ls => ls.filter((_, j) => j !== i))} style={{ padding: '6px 10px' }}>Retirer</Btn>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {kmParcourus || 0} km × {String(TAUX_KM).replace('.', ',')} €
            {plafondKm > MAX_KM && (
              <span style={{ color: '#A32D2D', display: 'block', marginTop: 4 }}>
                Attention : le plafond annuel ({MAX_KM} km) serait dépassé ({plafondKm} km).
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--heading)' }}>{fmtEuro(totK)}</div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14, background: 'var(--bg-alt)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, color: 'var(--heading)' }}>Total de la note</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--heading)' }}>{fmtEuro(tot)}</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Forfait {fmtEuro(totF)} + déplacements {fmtEuro(totK)}
        </div>
      </Card>

      {statut === 'refuse' && motif && (
        <Flash kind="err">Motif du refus : {motif}</Flash>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!verrouille && (
          <Btn onClick={() => enregistrer()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</Btn>
        )}
        {!verrouille && estVolontaire && (
          <Btn kind="ok" onClick={soumettre} disabled={saving}>Valider ma demande</Btn>
        )}
        {!verrouille && !estVolontaire && (
          <div style={{ fontSize: 13, color: '#BA7517', alignSelf: 'center' }}>
            Le volontaire doit ouvrir sa note et toucher « Valider ma demande » (cela signe).
          </div>
        )}
        {estVolontaire && statut === 'soumise' && (
          <Btn kind="soft" onClick={() => actionRpc('retirer_note_frais', { p_id: idNote })} disabled={saving}>Retirer la demande</Btn>
        )}
        <Btn kind="soft" onClick={ouvrirA4}>Ouvrir la note A4</Btn>
        <Btn kind="soft" onClick={telecharger}>Télécharger</Btn>
        {tresorier && statut === 'soumise' && idNote && (
          <>
            <Btn kind="ok" onClick={() => actionRpc('verifier_note_frais', { p_id: idNote })} disabled={saving}>Vérifier la demande</Btn>
            <Btn kind="danger" onClick={() => {
              const t = window.prompt('Motif du refus ?') || ''
              if (!t.trim()) return
              actionRpc('refuser_note_frais', { p_id: idNote, p_motif: t.trim() })
            }}>Refuser</Btn>
          </>
        )}
        {tresorier && statut === 'verifiee' && idNote && (
          <>
            <Btn kind="ok" onClick={() => actionRpc('autoriser_note_frais', { p_id: idNote })} disabled={saving}>Autoriser le paiement</Btn>
            <Btn kind="danger" onClick={() => {
              const t = window.prompt('Motif du refus ?') || ''
              if (!t.trim()) return
              actionRpc('refuser_note_frais', { p_id: idNote, p_motif: t.trim() })
            }}>Refuser</Btn>
          </>
        )}
        {tresorier && (statut === 'approuve_n1' || statut === 'approuve_n2') && idNote && (
          <Btn kind="ok" onClick={() => actionRpc('virer_note_frais', { p_id: idNote })} disabled={saving}>Virement effectué</Btn>
        )}
      </div>

      {peutSupprimer && idNote && (
        <Card style={{ marginTop: 18, borderColor: '#E8B4B4', background: '#FDF6F6' }}>
          <div style={{ fontWeight: 700, color: '#A32D2D', marginBottom: 6 }}>Suppression complète</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
            Réservé au responsable informatique. La demande disparaît définitivement, quel que soit son statut
            (brouillon, soumise, payée…). Le mois redevient libre pour une nouvelle note.
          </div>
          <Btn
            kind="danger"
            disabled={saving}
            onClick={async () => {
              const ok = window.confirm(
                'Supprimer définitivement cette demande de défraiement ?\n\n'
                + 'La note disparaîtra complètement, y compris si elle a déjà été validée ou payée. '
                + 'Le volontaire pourra recréer une note pour le même mois.\n\n'
                + 'Cette action est irréversible.'
              )
              if (!ok) return
              setSaving(true)
              const { error } = await supabase.rpc('supprimer_note_frais', { p_id: idNote })
              setSaving(false)
              if (error) { setMsg({ t: msgRpc(error, 'Impossible de supprimer la demande.'), ok: false }); return }
              onClose()
            }}
            style={{ background: '#A32D2D', color: '#fff' }}
          >
            {saving ? 'Suppression…' : 'Supprimer complètement'}
          </Btn>
        </Card>
      )}

      {apercu && (
        <div className="ha-fiche-apercu">
          <div className="ha-fiche-apercu-bar no-print">
            <Btn onClick={() => imprimerApercuIframe(apercuRef.current)}>🖨 Imprimer / PDF</Btn>
            <Btn kind="soft" onClick={telecharger}>Télécharger</Btn>
            <Btn kind="soft" onClick={() => setApercu(null)}>Fermer</Btn>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', alignSelf: 'center' }}>
              C’est la note A4 générée. Si l’app capture l’écran, utilisez Télécharger puis imprimez le fichier.
            </span>
          </div>
          <iframe ref={apercuRef} title="Note de frais" srcDoc={apercu} />
        </div>
      )}
    </Page>
  )
}

function fmtDateLocale(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
}
