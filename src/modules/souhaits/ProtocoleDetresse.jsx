import { useEffect, useState } from 'react'
import { Card, Btn, F, Sel, TA, Modal } from '@/components/ui'
import {
  VOIES_DETRESSE, lblVoieDetresse, protocoleDetresse, dosesLigne, injectionsDetresse, maintenantIso,
} from './missionSchema'
import { uploadDocSejour, signedDocSejour } from './sejour'

function nid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ('d-' + Math.random().toString(36).slice(2, 10))
}

const optsVoie = [{ v: '', l: '—' }, ...VOIES_DETRESSE]

function ligneVide() {
  return { id: nid(), medicament: '', contexte: '', dosage: '', dosage_max: '', voie: '', doses: [{ ordre: 1, dosage: '' }] }
}

export function ProtocoleDetresseForm({ souhaitId, m, setM }) {
  const proto = protocoleDetresse(m)
  const lignes = proto.lignes.length ? proto.lignes : [ligneVide()]

  function poser(next) {
    setM(o => ({ ...o, protocole_detresse: { document: proto.document, ...next } }))
  }
  function majLigne(i, patch) {
    const rows = lignes.map((r, j) => (j === i ? { ...r, ...patch } : r))
    poser({ lignes: rows, notes: proto.notes, document: proto.document })
  }
  function ajouter() {
    poser({ lignes: [...lignes, ligneVide()], notes: proto.notes, document: proto.document })
  }
  function retirer(i) {
    const rows = lignes.filter((_, j) => j !== i)
    poser({ lignes: rows.length ? rows : [ligneVide()], notes: proto.notes, document: proto.document })
  }
  async function joindre(file) {
    if (!file || !souhaitId) return
    const doc = await uploadDocSejour(souhaitId, 'protocole-detresse', file)
    poser({ lignes, notes: proto.notes, document: doc })
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading)', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        Protocole de détresse
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Document</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept="application/pdf,image/*" onChange={e => joindre(e.target.files?.[0])} />
          {proto.document?.nom && <DocLien doc={proto.document} />}
        </div>
      </div>
      {lignes.map((r, i) => (
        <LigneEdition key={r.id || i} r={r} onChange={patch => majLigne(i, patch)} onRetirer={lignes.length > 1 ? () => retirer(i) : null} />
      ))}
      <Btn kind="soft" onClick={ajouter}>+ Un médicament</Btn>
      <div style={{ marginTop: 12 }}>
        <TA label="Notes (facultatif)" value={proto.notes} set={v => poser({ lignes, notes: v })} rows={2} placeholder="Particularités, dilution, ordre d’administration…" />
      </div>
    </Card>
  )
}

function LigneEdition({ r, onChange, onRetirer }) {
  const doses = dosesLigne(r)
  function majDose(i, dosage) {
    const next = doses.map((d, j) => j === i ? { ...d, dosage } : d)
    onChange({ doses: next, dosage: next[0]?.dosage || '' })
  }
  return (
    <div className="ha-detresse-row" style={{ display: 'block', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
        <F label="Médicament" value={r.medicament || ''} set={v => onChange({ medicament: v })} />
        <F label="Si" value={r.contexte || ''} set={v => onChange({ contexte: v })} placeholder="douleur, dyspnée…" />
        <Sel label="Voie" value={r.voie || ''} set={v => onChange({ voie: v })} options={optsVoie} />
        <F label="Dosage maximum" value={r.dosage_max || ''} set={v => onChange({ dosage_max: v })} />
      </div>
      {doses.map((d, i) => (
        <F key={i} label={`${i + 1}${i === 0 ? 're' : 'e'} dose`} value={d.dosage || ''} set={v => majDose(i, v)} />
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn kind="soft" onClick={() => onChange({ doses: [...doses, { ordre: doses.length + 1, dosage: '' }] })}>+ Dose</Btn>
        {onRetirer && <Btn kind="danger" onClick={onRetirer}>Retirer</Btn>}
      </div>
    </div>
  )
}

function DocLien({ doc }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let stop = false
    signedDocSejour(doc.path).then(u => { if (!stop) setUrl(u || '') }).catch(() => {})
    return () => { stop = true }
  }, [doc.path])
  if (!url) return <span>{doc.nom}</span>
  return <a href={url} target="_blank" rel="noopener noreferrer">{doc.nom}</a>
}

function LignePrevue({ r }) {
  const doses = dosesLigne(r).filter(d => (d.dosage || '').trim())
  if (!(r.medicament || '').trim() && !doses.length) return null
  return (
    <div className="ha-detresse-prevue">
      <div style={{ fontWeight: 700 }}>{r.medicament || '—'}</div>
      {r.contexte ? <div style={{ fontSize: 13 }}>{r.contexte}</div> : null}
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
        {doses.map((d, i) => `${i + 1}${i === 0 ? 're' : 'e'} : ${d.dosage}`).join(' · ')}
        {r.voie ? ` · ${lblVoieDetresse(r.voie)}` : ''}
        {r.dosage_max ? ` · max ${r.dosage_max}` : ''}
      </div>
    </div>
  )
}

export function PopupDetresse({ m, locked, profile, onInjecter, onClose }) {
  const proto = protocoleDetresse(m)
  const lignes = proto.lignes.filter(r => (r.medicament || '').trim() || (r.dosage || '').trim())
  const deja = injectionsDetresse(m)
  const [checks, setChecks] = useState({
    medecin_coordinateur_prevenu: false,
    coordinateur_medical_prevenu: false,
    traitements_revus: false,
  })
  const [etape, setEtape] = useState('form')
  const [busy, setBusy] = useState(false)
  const tous = checks.medecin_coordinateur_prevenu && checks.coordinateur_medical_prevenu && checks.traitements_revus

  function toggle(k) {
    setChecks(c => ({ ...c, [k]: !c[k] }))
  }

  async function confirmer() {
    setBusy(true)
    const ok = await onInjecter({
      id: nid(),
      injecte_le: maintenantIso(),
      par: profile?.id || null,
      par_nom: `${profile?.prenom || ''} ${profile?.nom || ''}`.trim(),
      medecin_coordinateur_prevenu: true,
      coordinateur_medical_prevenu: true,
      traitements_revus: true,
      lignes,
    })
    setBusy(false)
    if (ok !== false) onClose()
  }

  if (etape === 'confirm') {
    return (
      <Modal
        title="Confirmer l’injection"
        onClose={onClose}
        footer={
          <>
            <Btn kind="soft" onClick={() => setEtape('form')} disabled={busy}>Retour</Btn>
            <Btn kind="danger" onClick={confirmer} disabled={busy} style={{ background: '#A32D2D', color: '#fff', flex: 1 }}>
              {busy ? '…' : 'Oui, injecter'}
            </Btn>
          </>
        }
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--heading)', margin: '8px 0 10px' }}>
          Êtes-vous sûr de vouloir injecter ?
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.45 }}>
          L’heure d’injection sera enregistrée sur le rapport. Cette action est tracée.
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      title="Protocole de détresse"
      onClose={onClose}
      footer={
        locked
          ? <Btn kind="soft" onClick={onClose}>Fermer</Btn>
          : (
            <>
              <Btn kind="soft" onClick={onClose}>Annuler</Btn>
              <Btn
                kind="danger"
                disabled={!tous || !lignes.length}
                onClick={() => setEtape('confirm')}
                style={{ background: '#A32D2D', color: '#fff', flex: 1 }}
              >
                Injecter
              </Btn>
            </>
          )
      }
    >
      {lignes.length === 0 ? (
        <p style={{ fontSize: 14, color: '#A32D2D', margin: '0 0 12px' }}>
          Aucun protocole encodé sur ce souhait. Encodez-le dans Préparer le dossier → Médical.
        </p>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>
            Dosages prévus
          </div>
          {lignes.map((r, i) => <LignePrevue key={r.id || i} r={r} />)}
          {proto.notes ? <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{proto.notes}</p> : null}
        </div>
      )}

      {!locked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          <CheckDetresse on={checks.medecin_coordinateur_prevenu} onToggle={() => toggle('medecin_coordinateur_prevenu')} label="Médecin coordinateur prévenu" />
          <CheckDetresse on={checks.coordinateur_medical_prevenu} onToggle={() => toggle('coordinateur_medical_prevenu')} label="Coordinateur médical prévenu (le président)" />
          <CheckDetresse on={checks.traitements_revus} onToggle={() => toggle('traitements_revus')} label="Traitements revus" />
        </div>
      )}

      {deja.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Déjà injecté</div>
          {deja.map(inj => (
            <div key={inj.id} style={{ fontSize: 13.5, marginBottom: 4 }}>
              {fmtHeure(inj.injecte_le)}{inj.par_nom ? ` · ${inj.par_nom}` : ''}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function CheckDetresse({ on, onToggle, label }) {
  return (
    <button type="button" className={'ha-check-btn' + (on ? ' is-on' : '')} onClick={onToggle}>
      <span className="ha-check-mark">{on ? '✓' : ''}</span>
      <span>{label}</span>
    </button>
  )
}

function fmtHeure(v) {
  if (!v) return ''
  return new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }).replace(' ', ' · ')
}
