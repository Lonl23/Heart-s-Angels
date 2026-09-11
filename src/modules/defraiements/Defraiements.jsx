import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, Empty, Loading, Flash, Pill, inp, lbl } from '@/components/ui'
import { imprimerHtml, telechargerHtml, imprimerApercuIframe } from '@/modules/souhaits/documentA4'
import {
  FORFAIT_JOUR, PLAFOND_AN, TAUX_KM, MAX_KM, MOTIFS_KM, stNote, fmtEuro, titrePeriode,
  normaliserIban, ibanValide, ligneVide, ligneKmVide, fusionnerJours, totalForfait,
  totalKm, totalKmParcourus, normaliserLignesKm, montantKm, activiteKmDefaut, joursDuMois,
  nomCompletNote,
} from './constantes'
import { htmlNoteFrais, nomFichierNote, chargerLogoNote } from './noteFraisHtml'
import SignaturePad from './SignaturePad'
import { ROLES_ASBL } from '@/modules/fiche/ficheSchema'

const now = new Date()
const MOIS = Array.from({ length: 12 }, (_, i) => {
  const t = new Date(2026, i, 1).toLocaleDateString('fr-BE', { month: 'long' })
  return { v: String(i + 1), l: t.charAt(0).toUpperCase() + t.slice(1) }
})
const ANNEES = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => ({ v: String(y), l: String(y) }))

function nomProfil(p) {
  return [p?.prenom, p?.nom].filter(Boolean).join(' ') || p?.email || 'Volontaire'
}

function fonctionDefaut(p) {
  const roles = p?.fiche?.roles_asbl || []
  const found = ROLES_ASBL.find(r => roles.includes(r.v) && r.v !== 'simple_volontaire')
  if (found) return found.l
  if (p?.role === 'tresorier') return 'Trésorier'
  if (p?.role === 'president') return 'Président'
  if (p?.role === 'admin') return 'Administrateur'
  return ''
}

export default function Defraiements() {
  const { profile, peutGererDefraiements } = useAuth()
  const tresorier = peutGererDefraiements()
  const [notes, setNotes] = useState([])
  const [profils, setProfils] = useState({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [filtre, setFiltre] = useState('miennes')
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
    if (filtre === 'a_valider') return n.statut === 'en_attente'
    if (filtre === 'payees') return n.statut === 'paye'
    if (filtre === 'miennes') return n.user_id === profile?.id
    return true
  })

  if (edition) {
    return (
      <EditeurNote
        initiale={edition}
        tresorier={tresorier}
        moi={profile}
        onClose={() => { setEdition(null); charger() }}
      />
    )
  }

  return (
    <Page
      title="Défraiements"
      subtitle="Forfait 44,02 € par jour d’activité. Kilomètres : 0,4326 €/km pour une récolte de souhaits, ou un souhait hors de la base de la semaine."
      action={<Btn onClick={() => setEdition({ nouveau: true })}>Nouvelle note</Btn>}
    >
      {err && <Flash kind="err">{err}</Flash>}
      {tresorier && (
        <div className="ha-tabs" style={{ marginBottom: 16 }}>
          {[
            { v: 'miennes', l: 'Mes notes' },
            { v: 'a_valider', l: 'À valider' },
            { v: 'toutes', l: 'Toutes' },
            { v: 'payees', l: 'Payées' },
          ].map(f => (
            <button key={f.v} type="button" className={'ha-tab' + (filtre === f.v ? ' is-on' : '')} onClick={() => setFiltre(f.v)}>
              {f.l}
            </button>
          ))}
        </div>
      )}

      {loading ? <Loading />
        : visibles.length === 0 ? (
          <Empty
            title="Aucune note pour le moment"
            hint="Créez une note pour le mois : les jours de mission se proposent tout seuls. Les km se déclarent à part (récolte ou souhait hors base)."
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

function EditeurNote({ initiale, tresorier, moi, onClose }) {
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
  const [sigVol, setSigVol] = useState(initiale.signature_volontaire || '')
  const [sigAsbl, setSigAsbl] = useState(initiale.signature_asbl || '')
  const [foncAsbl, setFoncAsbl] = useState(initiale.signature_asbl_fonction || '')
  const apercuRef = useRef(null)
  const verrouille = statut !== 'en_attente' && !tresorier
  const totF = totalForfait(lignes)
  const totK = totalKm(lignesKm)
  const tot = Math.round((totF + totK) * 100) / 100
  const kmParcourus = totalKmParcourus(lignesKm)
  const plafond = cumulAn + (statut === 'refuse' ? 0 : totF)
  const plafondKm = cumulKmAn + (statut === 'refuse' ? 0 : kmParcourus)

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
      setIdNote(exist.id)
      setIban(exist.iban || normaliserIban(p?.fiche?.iban || ''))
      setLignes(exist.lignes_forfait || [])
      setLignesKm(exist.lignes_km || [])
      setStatut(exist.statut || 'en_attente')
      setMotif(exist.motif_refus || '')
      setSigVol(exist.signature_volontaire || '')
      setSigAsbl(exist.signature_asbl || '')
      setFoncAsbl(exist.signature_asbl_fonction || fonctionDefaut(moi))
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
    if (!foncAsbl) setFoncAsbl(fonctionDefaut(moi))
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
      signature_volontaire: sigVol || null,
      signature_volontaire_at: sigVol ? (initiale.signature_volontaire_at || new Date().toISOString()) : null,
      signature_volontaire_nom: sigVol ? nomCompletNote(profilNote) : null,
      signature_asbl: sigAsbl || null,
      signature_asbl_at: sigAsbl ? (initiale.signature_asbl_at || new Date().toISOString()) : null,
      signature_asbl_nom: sigAsbl ? nomCompletNote(moi) : null,
      signature_asbl_fonction: sigAsbl ? (foncAsbl || fonctionDefaut(moi)) : null,
    }
  }

  async function enregistrer(extra = {}) {
    if (!ibanValide(iban)) { setMsg({ t: 'Indiquez un IBAN belge valide (BE + 14 chiffres).', ok: false }); return null }
    if (userId === moi.id && !sigVol) { setMsg({ t: 'Signez la note avant d’enregistrer.', ok: false }); return null }
    const body = { ...payload(), ...extra }
    if (!body.lignes_forfait.length && !body.lignes_km.length) {
      setMsg({ t: 'Ajoutez au moins un jour d’activité ou une ligne de kilomètres.', ok: false })
      return null
    }
    setSaving(true)
    let res
    if (idNote) res = await supabase.from('notes_frais').update(body).eq('id', idNote).select('*').maybeSingle()
    else res = await supabase.from('notes_frais').insert(body).select('*').maybeSingle()
    if (res.error && /duplicate|unique/i.test(res.error.message)) {
      const { data: exist } = await supabase.from('notes_frais')
        .select('*').eq('user_id', userId).eq('periode_mois', Number(mois)).eq('periode_annee', Number(annee)).maybeSingle()
      if (exist) {
        setIdNote(exist.id)
        setStatut(exist.statut)
        res = await supabase.from('notes_frais').update(body).eq('id', exist.id).select('*').maybeSingle()
      }
    }
    setSaving(false)
    if (res.error) { setMsg({ t: res.error.message, ok: false }); return null }
    const row = res.data
    if (row) {
      setIdNote(row.id)
      setStatut(row.statut)
      setLignes(row.lignes_forfait || [])
      setLignesKm(row.lignes_km || [])
      setSigVol(row.signature_volontaire || sigVol)
      setSigAsbl(row.signature_asbl || sigAsbl)
    }
    const fiche = { ...(profilNote?.fiche || {}), iban: normaliserIban(iban) }
    if (userId === moi.id || tresorier) {
      await supabase.from('profiles').update({ fiche }).eq('id', userId)
    }
    setMsg({ t: 'Note enregistrée.', ok: true })
    setTimeout(() => setMsg(null), 2500)
    return row
  }

  async function changerStatut(st, extra = {}) {
    if (st === 'approuve_n1' && !sigAsbl) {
      setMsg({ t: 'Signez d’abord pour l’ASBL (encadré plus bas).', ok: false })
      return
    }
    const saved = await enregistrer()
    const id = saved?.id || idNote
    if (!id) return
    const patch = { statut: st, ...extra }
    if (st === 'approuve_n1' || st === 'approuve_n2') {
      patch.valide_par = moi.id
      patch.valide_at = new Date().toISOString()
    }
    if (st === 'paye') patch.paye_at = new Date().toISOString()
    const { error } = await supabase.from('notes_frais').update(patch).eq('id', id)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setStatut(st)
    if (extra.motif_refus != null) setMotif(extra.motif_refus)
    setMsg({ t: 'Statut mis à jour.', ok: true })
  }

  function notePourDoc() {
    return {
      ...payload(),
      id: idNote,
      statut,
      signature_volontaire: sigVol,
      signature_volontaire_nom: nomCompletNote(profilNote),
      signature_asbl: sigAsbl,
      signature_asbl_nom: sigAsbl ? nomCompletNote(moi) : '',
      signature_asbl_fonction: foncAsbl || fonctionDefaut(moi),
    }
  }

  async function docHtml() {
    const logoDataUrl = await chargerLogoNote()
    return htmlNoteFrais({ note: notePourDoc(), profil: profilNote, logoDataUrl })
  }

  async function ouvrirA4() {
    imprimerHtml(await docHtml(), setApercu)
  }

  async function telecharger() {
    const note = notePourDoc()
    telechargerHtml(nomFichierNote(note, profilNote), await docHtml())
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
      subtitle="Forfait 44,02 € / jour. Km à 0,4326 € uniquement pour une récolte, ou un souhait hors de la base de la semaine."
      action={<Btn kind="soft" onClick={onClose}>← Retour</Btn>}
    >
      {msg && <Flash kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Flash>}
      <div style={{ marginBottom: 12 }}><Pill color={st.c} bg={st.bg}>{st.l}</Pill></div>

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

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Signatures</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Comme sur la note papier : le volontaire à droite, l’ASBL à gauche. Signez au doigt ou à la souris.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          <SignaturePad
            label="Le volontaire"
            value={sigVol}
            onChange={setSigVol}
            disabled={verrouille || userId !== moi.id}
          />
          {tresorier && (
            <div>
              <F label="Fonction (pour l’ASBL)" value={foncAsbl} set={setFoncAsbl} placeholder="Trésorier" />
              <SignaturePad
                label="Pour l’ASBL"
                value={sigAsbl}
                onChange={setSigAsbl}
                disabled={false}
              />
            </div>
          )}
        </div>
        {userId === moi.id && !sigVol && (
          <div style={{ fontSize: 12.5, color: '#BA7517', marginTop: 10 }}>Signez avant d’enregistrer la note.</div>
        )}
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!verrouille && (
          <Btn onClick={() => enregistrer()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Btn>
        )}
        <Btn kind="soft" onClick={ouvrirA4}>Ouvrir la note A4</Btn>
        <Btn kind="soft" onClick={telecharger}>Télécharger</Btn>
        {tresorier && statut === 'en_attente' && idNote && (
          <>
            <Btn kind="ok" onClick={() => changerStatut('approuve_n1')}>Approuver</Btn>
            <Btn kind="danger" onClick={() => {
              const t = window.prompt('Motif du refus ?') || ''
              if (!t.trim()) return
              changerStatut('refuse', { motif_refus: t.trim() })
            }}>Refuser</Btn>
          </>
        )}
        {tresorier && (statut === 'approuve_n1' || statut === 'approuve_n2') && (
          <Btn kind="ok" onClick={() => changerStatut('paye')}>Marquer payée</Btn>
        )}
      </div>

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
