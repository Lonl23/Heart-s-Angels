import { useEffect, useState } from 'react'
import { Card, Btn, F, Sel, PhoneF, TA, Modal, digitsPhoneBE, phoneValide } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import {
  ROLES_PLURI, lblRolePluri, equipePluri, personnePluriRemplie, nomPluri, telephonesPluri,
} from './missionSchema'
import { TYPES_MEDECIN, libelleMedecin } from './listesCliniques'
import {
  chercherContactsPluri, ficheVersPluri, upsertContactMedical,
  correspondancePluriForte, telFicheAnnuaire,
} from '@/modules/annuaire/annuaireApi'

function nid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ('p-' + Math.random().toString(36).slice(2, 10))
}

function vide(role) {
  return {
    id: nid(), role: role || 'medecin', prenom: '', nom: '', tel: '', tel2: '', tel3: '',
    tel_priorite: 1, tel2_priorite: 2, tel3_priorite: 3,
    type_medecin: '', specialite: '', organisme: '', notes: '', annuaire_id: null,
  }
}

function nomNorm(prenom, nom) {
  return [prenom, nom].filter(Boolean).join(' ').trim().toLowerCase().replace(/\s+/g, ' ')
}

function dejaDansEquipe(rows, cand, exceptId) {
  if (cand.annuaire_id && rows.some(r => r.id !== exceptId && r.annuaire_id === cand.annuaire_id)) {
    return 'Ce contact est déjà dans l’équipe.'
  }
  const d = digitsPhoneBE(cand.tel)
  if (d.length >= 8 && rows.some(r => r.id !== exceptId && digitsPhoneBE(r.tel) === d)) {
    return 'Un membre de l’équipe a déjà ce numéro.'
  }
  const n = nomNorm(cand.prenom, cand.nom)
  if (n && rows.some(r => r.id !== exceptId && nomNorm(r.prenom, r.nom) === n)) {
    return 'Cette personne est déjà dans l’équipe.'
  }
  return null
}

export default function EquipePluriForm({ m, setM }) {
  const { profile } = useAuth()
  const lignes = equipePluri(m).filter(r => personnePluriRemplie(r) || (r.notes || '').trim())
  const medSansTel = lignes.some(r => r.role === 'medecin' && personnePluriRemplie(r) && !telephonesPluri(r).length)
  const [popup, setPopup] = useState(null)
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')

  function poser(rows) {
    setM(o => ({
      ...o,
      equipe_pluri: rows.filter(r => personnePluriRemplie(r) || (r.notes || '').trim()),
    }))
    setErr('')
  }
  function maj(id, patch) {
    poser(lignes.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }
  function retirer(id) {
    poser(lignes.filter(r => r.id !== id))
  }
  function ouvrirNouveau() {
    setErr('')
    setEdit(vide('medecin'))
    setPopup('edit')
  }
  function ouvrirExistant() {
    setErr('')
    setPopup('pick')
  }
  function ouvrirModifier(r) {
    setErr('')
    setEdit({ ...vide(r.role), ...r })
    setPopup('edit')
  }

  async function enregistrerPersonne(g) {
    if (!g.prenom && !g.nom && !g.tel) {
      setErr('Nom, prénom ou téléphone requis.')
      return
    }
    const tels = [g.tel, g.tel2, g.tel3].filter(Boolean)
    if (tels.some(t => !phoneValide(t))) {
      setErr('Formats téléphone : +32 xxx.xx.xx.xx ou +32 xx.xx.xx.xx')
      return
    }
    const bloq = dejaDansEquipe(lignes, g, g.id)
    if (bloq) { setErr(bloq); return }
    if (!g.annuaire_id) {
      const q = digitsPhoneBE(g.tel).length >= 8 ? g.tel : `${g.prenom || ''} ${g.nom || ''}`.trim()
      if (q) {
        const found = (await chercherContactsPluri(q)).filter(r => correspondancePluriForte(r, g))
        if (found.length) {
          setErr('Un contact existe déjà avec ces informations. Récupérez-le plutôt que d’en créer un second.')
          return
        }
      }
    }
    try {
      const annuaireId = await upsertContactMedical({
        id: g.annuaire_id || undefined,
        prenom: g.prenom,
        nom: g.nom,
        tel: g.tel,
        organisme: g.organisme,
        role: g.role,
      }, { created_by: profile?.id })
      const row = {
        id: lignes.some(r => r.id === g.id) ? g.id : nid(),
        annuaire_id: annuaireId,
        role: g.role || 'medecin',
        prenom: g.prenom || '',
        nom: g.nom || '',
        tel: g.tel || '',
        tel2: g.tel2 || '',
        tel3: g.tel3 || '',
        tel_priorite: Number(g.tel_priorite) || 1,
        tel2_priorite: Number(g.tel2_priorite) || 2,
        tel3_priorite: Number(g.tel3_priorite) || 3,
        type_medecin: g.role === 'medecin' ? (g.type_medecin || '') : '',
        specialite: g.specialite || '',
        organisme: g.organisme || '',
        notes: g.notes || '',
      }
      const bloq2 = dejaDansEquipe(lignes, row, g.id)
      if (bloq2) { setErr(bloq2); return }
      if (lignes.some(r => r.id === g.id)) poser(lignes.map(r => (r.id === g.id ? row : r)))
      else poser([...lignes, row])
      setPopup(null)
      setEdit(null)
    } catch (e) {
      setErr(e.message || String(e))
    }
  }

  function prendreExistant(fiche) {
    const patch = ficheVersPluri(fiche)
    const row = { id: nid(), notes: '', ...patch }
    const bloq = dejaDansEquipe(lignes, row, null)
    if (bloq) { setErr(bloq); return }
    poser([...lignes, row])
    setPopup(null)
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading)', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        Équipe pluridisciplinaire
      </div>
      {err && !popup && <div className="ha-pluri-warn" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lignes.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Personne n’est encore encodée.</div>
        )}
        {lignes.map(r => (
          <div key={r.id} className="ha-pluri-card">
            <div className="ha-pluri-card-top">
              <Sel label="Rôle" value={r.role || 'medecin'} set={v => maj(r.id, { role: v })} options={ROLES_PLURI} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'end', marginBottom: 10 }}>
                <Btn kind="soft" onClick={() => ouvrirModifier(r)} style={{ padding: '8px 10px' }}>Modifier</Btn>
                <Btn kind="danger" onClick={() => retirer(r.id)} style={{ padding: '8px 10px' }}>Retirer</Btn>
              </div>
            </div>
            <div className="ha-chip-sum" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{nomPluri(r) || 'Sans nom'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {[telephonesPluri(r).map(t => t.n).join(' · '), libelleMedecin(r.type_medecin), r.specialite, r.organisme].filter(Boolean).join(' · ') || 'Pas de numéro'}
                {r.annuaire_id ? ' · Annuaire' : ''}
              </div>
            </div>
            <TA label="Notes (cette mission)" value={r.notes || ''} set={v => maj(r.id, { notes: v })} rows={2} placeholder="Consignes, horaires, particularités…" />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Btn kind="soft" onClick={ouvrirExistant}>Contact existant</Btn>
        <Btn onClick={ouvrirNouveau}>Nouveau contact</Btn>
      </div>
      {medSansTel && (
        <p style={{ fontSize: 13, color: '#A32D2D', fontWeight: 600, margin: '10px 0 0' }}>
          Indiquez le n° du médecin : il restera affiché pendant toute la mission.
        </p>
      )}

      {popup === 'pick' && (
        <PickerPluri
          deja={lignes}
          onPick={prendreExistant}
          onClose={() => { setPopup(null); setErr('') }}
          err={err}
        />
      )}
      {popup === 'edit' && edit && (
        <PopupPersonnePluri
          initial={edit}
          lignes={lignes}
          err={err}
          setErr={setErr}
          onClose={() => { setPopup(null); setEdit(null); setErr('') }}
          onSave={enregistrerPersonne}
        />
      )}
    </Card>
  )
}

function PickerPluri({ deja, onPick, onClose, err }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loadErr, setLoadErr] = useState(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let stop = false
    setBusy(true)
    const t = setTimeout(() => {
      chercherContactsPluri(q).then(r => {
        if (!stop) { setRows(r); setLoadErr(null); setBusy(false) }
      }).catch(e => {
        if (!stop) { setLoadErr(e.message || String(e)); setBusy(false) }
      })
    }, q ? 280 : 0)
    return () => { stop = true; clearTimeout(t) }
  }, [q])

  return (
    <Modal title="Contact existant" onClose={onClose} wide>
      <input
        className="ha-search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Nom, prénom ou numéro…"
        style={{ width: '100%', marginBottom: 10 }}
        autoFocus
      />
      {err && <div className="ha-pluri-warn" style={{ marginBottom: 8 }}>{err}</div>}
      {loadErr && <div style={{ color: '#C8435A', fontSize: 13, marginBottom: 8 }}>{loadErr}</div>}
      {busy && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Recherche…</p>}
      {!busy && rows.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {q ? 'Aucun contact médical pour cette recherche.' : 'Aucun contact médical dans l’annuaire pour l’instant.'}
        </p>
      )}
      {rows.map(r => {
        const cand = ficheVersPluri(r)
        const bloq = dejaDansEquipe(deja, cand, null)
        return (
          <button
            key={r.id}
            type="button"
            className={'ha-pick-row' + (bloq ? ' is-off' : '')}
            disabled={!!bloq}
            onClick={() => onPick(r)}
          >
            <div style={{ fontWeight: 600 }}>{[r.prenom, r.nom].filter(Boolean).join(' ') || '(sans nom)'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {[r.type_lib, telFicheAnnuaire(r), r.organisme].filter(Boolean).join(' · ')}
              {bloq ? ` · ${bloq}` : ''}
            </div>
          </button>
        )
      })}
    </Modal>
  )
}

function PopupPersonnePluri({ initial, lignes, err, setErr, onClose, onSave }) {
  const [g, setG] = useState({ prenom: '', nom: '', tel: '', organisme: '', notes: '', role: 'medecin', annuaire_id: null, ...initial })
  const [hits, setHits] = useState([])
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setG(s => ({ ...s, [k]: v }))

  useEffect(() => {
    const d = digitsPhoneBE(g.tel)
    const nomOk = (g.prenom || '').trim().length >= 2 && (g.nom || '').trim().length >= 2
    const q = d.length >= 8 ? g.tel : (nomOk ? `${g.prenom} ${g.nom}` : '')
    if (!q) { setHits([]); return }
    let stop = false
    const t = setTimeout(async () => {
      try {
        const rows = await chercherContactsPluri(q)
        if (stop) return
        setHits(rows.filter(r => r.id !== g.annuaire_id && correspondancePluriForte(r, g)))
      } catch {
        if (!stop) setHits([])
      }
    }, 350)
    return () => { stop = true; clearTimeout(t) }
  }, [g.prenom, g.nom, g.tel, g.annuaire_id])

  async function go() {
    setBusy(true)
    setErr('')
    try { await onSave(g) } finally { setBusy(false) }
  }

  function recuperer(fiche) {
    const patch = ficheVersPluri(fiche, g.role)
    const bloq = dejaDansEquipe(lignes, { ...patch, id: 'tmp' }, g.id)
    if (bloq) { setErr(bloq); return }
    setG(s => ({ ...s, ...patch, notes: s.notes || '' }))
    setHits([])
    setErr('')
  }

  const titre = g.annuaire_id ? 'Fiche du contact' : 'Nouveau contact'

  return (
    <Modal title={titre} onClose={onClose} footer={
      <>
        <Btn onClick={go} disabled={busy}>{busy ? '…' : (g.annuaire_id ? 'Enregistrer' : 'Enregistrer dans l’annuaire')}</Btn>
        <Btn kind="soft" onClick={onClose}>Annuler</Btn>
      </>
    }>
      <Sel label="Rôle" value={g.role || 'medecin'} set={v => set('role', v)} options={ROLES_PLURI} />
      {g.role === 'medecin' && (
        <>
          <Sel label="Médecin" value={g.type_medecin || ''} set={v => set('type_medecin', v)} options={[{ v: '', l: '—' }, ...TYPES_MEDECIN]} />
          {g.type_medecin === 'specialiste' && <F label="Spécialité" value={g.specialite || ''} set={v => set('specialite', v)} />}
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <F label="Prénom" value={g.prenom} set={v => set('prenom', v)} />
        <F label="Nom" value={g.nom} set={v => set('nom', v)} />
      </div>
      <TelephonePriorite g={g} set={set} />
      <F label="Service / organisme" value={g.organisme} set={v => set('organisme', v)} placeholder="ex. maison de repos, cabinet…" />
      <TA label="Notes (cette mission)" value={g.notes || ''} set={v => set('notes', v)} rows={3} placeholder="Consignes, horaires, particularités…" />
      {hits.length > 0 && (
        <div className="ha-pluri-dup">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Un contact existe déjà avec ces informations</div>
          {hits.map(h => {
            const bloq = dejaDansEquipe(lignes, ficheVersPluri(h), g.id)
            return (
              <div key={h.id} className="ha-pluri-dup-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{[h.prenom, h.nom].filter(Boolean).join(' ') || '(sans nom)'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {[h.type_lib, telFicheAnnuaire(h), h.organisme].filter(Boolean).join(' · ')}
                    {bloq ? ` · ${bloq}` : ''}
                  </div>
                </div>
                {bloq
                  ? <span style={{ fontSize: 12.5, color: '#A32D2D', fontWeight: 600 }}>Déjà pris</span>
                  : <Btn kind="soft" onClick={() => recuperer(h)}>Récupérer</Btn>}
              </div>
            )
          })}
        </div>
      )}
      {err && <div className="ha-pluri-warn" style={{ marginTop: 8 }}>{err}</div>}
    </Modal>
  )
}

function TelephonePriorite({ g, set }) {
  const lignes = [
    ['tel', 'tel_priorite', 'Téléphone 1'],
    ['tel2', 'tel2_priorite', 'Téléphone 2'],
    ['tel3', 'tel3_priorite', 'Téléphone 3'],
  ]
  return lignes.map(([k, pk, label]) => (
    <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
      <PhoneF label={label} value={g[k] || ''} set={v => set(k, v)} />
      <Sel label="Priorité" value={String(g[pk] || (k === 'tel' ? 1 : k === 'tel2' ? 2 : 3))} set={v => set(pk, Number(v))} options={[1, 2, 3].map(n => ({ v: String(n), l: String(n) }))} />
    </div>
  ))
}

export function BandeauMedecin({ tel, nom, garde }) {
  if (!tel) return null
  return (
    <div className="ha-medecin-sticky">
      <div className="ha-medecin-k">{garde ? 'Médecin de garde' : 'Médecin'}</div>
      <a href={`tel:${String(tel).replace(/\s/g, '')}`} className="ha-medecin-tel">📞 {tel}</a>
      {nom ? <span className="ha-medecin-nom">{nom}</span> : null}
    </div>
  )
}

export function LignesPluri({ rows }) {
  const list = (rows || []).filter(r => personnePluriRemplie(r) || (r.notes || '').trim())
  if (!list.length) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune personne encodée.</div>
  return (
    <div>
      {list.map((r, i) => (
        <div key={r.id || i} style={{ fontSize: 13.5, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600 }}>{lblRolePluri(r.role)}</div>
          <div>{[r.prenom, r.nom].filter(Boolean).join(' ') || '—'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            {[telephonesPluri(r).map(t => t.n).join(' · '), libelleMedecin(r.type_medecin), r.specialite, r.organisme].filter(Boolean).join(' · ') || 'Pas de numéro'}
          </div>
          {r.notes ? <div style={{ fontSize: 12.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.notes}</div> : null}
        </div>
      ))}
    </div>
  )
}
