import { useState } from 'react'
import { Card, Btn, F, Sel, TA, Modal } from '@/components/ui'
import {
  VOIES_DETRESSE, lblVoieDetresse, protocoleDetresse, injectionsDetresse, maintenantIso,
} from './missionSchema'

function nid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ('d-' + Math.random().toString(36).slice(2, 10))
}

const optsVoie = [{ v: '', l: '—' }, ...VOIES_DETRESSE]

function ligneVide() {
  return { id: nid(), medicament: '', dosage: '', voie: '' }
}

export function ProtocoleDetresseForm({ m, setM }) {
  const proto = protocoleDetresse(m)
  const lignes = proto.lignes.length ? proto.lignes : [ligneVide()]

  function poser(next) {
    setM(o => ({ ...o, protocole_detresse: next }))
  }
  function majLigne(i, patch) {
    const rows = lignes.map((r, j) => (j === i ? { ...r, ...patch } : r))
    poser({ lignes: rows, notes: proto.notes })
  }
  function ajouter() {
    poser({ lignes: [...lignes, ligneVide()], notes: proto.notes })
  }
  function retirer(i) {
    const rows = lignes.filter((_, j) => j !== i)
    poser({ lignes: rows.length ? rows : [ligneVide()], notes: proto.notes })
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading)', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        Protocole de détresse
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Dosages et voies prévus en cas de détresse. L’équipage médical les verra sur le bouton rouge en mission, avant d’injecter.
      </p>
      {lignes.map((r, i) => (
        <div key={r.id || i} className="ha-detresse-row">
          <F label="Médicament" value={r.medicament} set={v => majLigne(i, { medicament: v })} placeholder="ex. Adrénaline" />
          <F label="Dosage" value={r.dosage} set={v => majLigne(i, { dosage: v })} placeholder="ex. 1 mg" />
          <Sel label="Voie" value={r.voie || ''} set={v => majLigne(i, { voie: v })} options={optsVoie} />
          {lignes.length > 1 && (
            <Btn kind="danger" onClick={() => retirer(i)} style={{ padding: '8px 10px', alignSelf: 'end', marginBottom: 10 }}>Retirer</Btn>
          )}
        </div>
      ))}
      <Btn kind="soft" onClick={ajouter}>+ Une ligne</Btn>
      <div style={{ marginTop: 12 }}>
        <TA label="Notes (facultatif)" value={proto.notes} set={v => poser({ lignes, notes: v })} rows={2} placeholder="Particularités, dilution, ordre d’administration…" />
      </div>
    </Card>
  )
}

function LignePrevue({ r }) {
  const bits = [r.medicament, r.dosage, lblVoieDetresse(r.voie)].filter(Boolean)
  if (!bits.length) return null
  return (
    <div className="ha-detresse-prevue">
      <div style={{ fontWeight: 700 }}>{r.medicament || '—'}</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
        {[r.dosage && `Dosage : ${r.dosage}`, r.voie && `Voie : ${lblVoieDetresse(r.voie)}`].filter(Boolean).join(' · ')}
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
