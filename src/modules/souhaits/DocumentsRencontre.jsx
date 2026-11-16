import { useState } from 'react'
import { Btn, F, TA, Modal, Flash, fmtAdresse } from '@/components/ui'
import SignaturePad from './SignaturePad'
import {
  AUTORISATION_PHOTOS, SUPPORTS_DIFFUSION_PHOTOS, SUPPORTS_DIFFUSION_DEFAUT,
  normaliserAutorisationPhotos, lblAutorisationPhotos, niveauPhotosPourStockage,
  medecinPluri, nomPluri,
} from './missionSchema'
import { formaterNiss } from '@/modules/annuaire/annuaireSchema'

const PDF_CONSENTEMENT = '/papier/consentement-libre-eclaire.pdf'
const PDF_DROIT_IMAGE = '/papier/autorisation-droit-image.pdf'

function bloc(m, cle) {
  const src = m?.rencontre?.[cle]
  return src && typeof src === 'object' ? src : {}
}

function prefills(souhait, m, cle) {
  const b = bloc(m, cle)
  const med = medecinPluri(m)
  const adr = fmtAdresse(m?.patient_adresse || souhait?.beneficiaire_adresse) || ''
  const nom = [souhait?.beneficiaire_prenom, souhait?.beneficiaire_nom].filter(Boolean).join(' ')
  return {
    nom: b.nom || nom,
    ddn: b.ddn || (souhait?.beneficiaire_ddn || '').slice(0, 10),
    adresse: b.adresse || adr,
    niss: b.niss || formaterNiss(souhait?.beneficiaire_niss || m?.registre_national || ''),
    souhait_texte: b.souhait_texte || souhait?.description || '',
    medecin: b.medecin || nomPluri(med) || '',
    risques: b.risques || '',
    risques_expliques_le: b.risques_expliques_le || '',
    frais_externes: b.frais_externes || '',
    lieu: b.lieu || 'Awirs',
    date: (b.date || new Date().toISOString()).slice(0, 10),
    qualite: b.qualite || 'Patient',
    signature: b.signature || '',
    accepte: b.accepte !== false,
    niveau: normaliserAutorisationPhotos(b.niveau || m?.autorisation_photos) || 'oui',
    supports: Array.isArray(b.supports) && b.supports.length
      ? b.supports
      : (m?.autorisation_photos === 'oui_sauf_presse'
        ? SUPPORTS_DIFFUSION_DEFAUT.filter(s => s !== 'presse')
        : [...SUPPORTS_DIFFUSION_DEFAUT]),
  }
}

/** Consentement libre & éclairé + droit à l’image (PDF officiels). */
export default function DocumentsRencontre({ m, setM, lecture, souhait }) {
  const [popup, setPopup] = useState(null)

  function maj(cle, next) {
    if (lecture) return
    const stock = cle === 'photos'
      ? niveauPhotosPourStockage(next.niveau, next.supports)
      : null
    setM(o => ({
      ...o,
      rencontre: { ...(o.rencontre || {}), [cle]: next },
      ...(cle === 'consentement' ? { consentement: !!(next.signature && next.accepte) } : {}),
      ...(cle === 'photos' ? { autorisation_photos: next.signature ? stock : o.autorisation_photos } : {}),
    }))
  }

  const cons = bloc(m, 'consentement')
  const photos = bloc(m, 'photos')
  const consOk = !!(cons.signature && cons.accepte)
  const photosOk = !!(photos.signature && (photos.niveau || photos.accepte !== undefined))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Consentement libre & éclairé</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          {consOk
            ? `Signé${cons.nom ? ` · ${cons.nom}` : ''}${cons.date ? ` · ${String(cons.date).slice(0, 10)}` : ''}`
            : 'Document officiel à compléter en présence du patient, puis signature tablette.'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="ha-gps-btn" href={PDF_CONSENTEMENT} target="_blank" rel="noopener noreferrer">Voir le PDF</a>
          {!lecture && (
            <Btn kind={consOk ? 'soft' : 'primary'} onClick={() => setPopup('consentement')}>
              {consOk ? 'Revoir / resignature' : 'Compléter et faire signer'}
            </Btn>
          )}
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Autorisation du droit à l’image</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          {photosOk
            ? `${lblAutorisationPhotos(niveauPhotosPourStockage(photos.niveau, photos.supports) || m.autorisation_photos)}${photos.nom ? ` · ${photos.nom}` : ''}`
            : 'Document officiel — cases du PDF, supports de diffusion, puis signature.'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="ha-gps-btn" href={PDF_DROIT_IMAGE} target="_blank" rel="noopener noreferrer">Voir le PDF</a>
          {!lecture && (
            <Btn kind={photosOk ? 'soft' : 'primary'} onClick={() => setPopup('photos')}>
              {photosOk ? 'Revoir / resignature' : 'Compléter et faire signer'}
            </Btn>
          )}
        </div>
      </div>

      {popup === 'consentement' && (
        <PopupDocument
          mode="consentement"
          titre="Consentement libre & éclairé"
          pdf={PDF_CONSENTEMENT}
          initial={prefills(souhait, m, 'consentement')}
          onClose={() => setPopup(null)}
          onSave={next => { maj('consentement', { ...next, accepte: true }); setPopup(null) }}
        />
      )}
      {popup === 'photos' && (
        <PopupDocument
          mode="photos"
          titre="Autorisation du droit à l’image"
          pdf={PDF_DROIT_IMAGE}
          initial={prefills(souhait, m, 'photos')}
          onClose={() => setPopup(null)}
          onSave={next => { maj('photos', next); setPopup(null) }}
        />
      )}
    </div>
  )
}

function PopupDocument({ mode, titre, pdf, initial, onSave, onClose }) {
  const [etape, setEtape] = useState(initial?.signature ? 2 : 1)
  const [f, setF] = useState(initial)
  const [err, setErr] = useState(null)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  function allerSignature() {
    setErr(null)
    if (!f.nom?.trim()) { setErr('Indiquez le nom du signataire.'); return }
    if (!f.date) { setErr('Indiquez la date.'); return }
    if (mode === 'consentement') {
      if (!f.souhait_texte?.trim()) { setErr('Décrivez le souhait.'); return }
      if (!f.risques?.trim()) { setErr('Indiquez les risques expliqués.'); return }
    }
    if (mode === 'photos' && !f.niveau) { setErr('Choisissez une case d’autorisation.'); return }
    setEtape(2)
  }

  function valider() {
    setErr(null)
    if (!f.signature) { setErr('Faites signer sur la tablette.'); return }
    onSave({
      ...f,
      accepte: mode === 'photos' ? f.niveau !== 'refus' : true,
    })
  }

  function toggleSupport(v) {
    setF(s => {
      const cur = Array.isArray(s.supports) ? s.supports : []
      return { ...s, supports: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] }
    })
  }

  return (
    <Modal
      title={titre}
      onClose={onClose}
      wide
      footer={(
        <>
          <Btn kind="soft" onClick={onClose}>Annuler</Btn>
          {etape === 1
            ? <Btn onClick={allerSignature}>Proposer la signature ›</Btn>
            : (
              <>
                <Btn kind="soft" onClick={() => setEtape(1)}>‹ Document</Btn>
                <Btn onClick={valider}>Enregistrer la signature</Btn>
              </>
            )}
        </>
      )}
    >
      {err && <Flash kind="err">{err}</Flash>}
      {etape === 1 ? (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
            Complétez le document en présence du patient (comme sur le PDF), puis proposez la signature sur la tablette.
            {' '}<a href={pdf} target="_blank" rel="noopener noreferrer">Ouvrir le modèle PDF</a>
          </p>

          <div style={{ fontWeight: 700, margin: '8px 0 4px', color: 'var(--heading)' }}>Je soussigné(e)</div>
          <F label="Nom et prénom" value={f.nom || ''} set={v => set('nom', v)} />
          <F label="Né(e) le" type="date" value={f.ddn || ''} set={v => set('ddn', v)} />
          <TA label="Résidant à" value={f.adresse || ''} set={v => set('adresse', v)} rows={2} />
          <F label="Registre national" value={f.niss || ''} set={v => set('niss', v)} />

          {mode === 'consentement' && (
            <>
              <div style={{ fontWeight: 700, margin: '12px 0 4px', color: 'var(--heading)' }}>Déclarations</div>
              <TA label="Souhait sollicité auprès de Heart’s Angels" value={f.souhait_texte || ''} set={v => set('souhait_texte', v)} rows={2} />
              <F label="Médecin référent (Dr)" value={f.medecin || ''} set={v => set('medecin', v)} />
              <TA
                label="Risques, conséquences et contre-indications compris"
                value={f.risques || ''}
                set={v => set('risques', v)}
                rows={3}
              />
              <F label="Risques expliqués le" type="date" value={f.risques_expliques_le || ''} set={v => set('risques_expliques_le', v)} />
              <TA
                label="Frais externes à charge du patient (restauration, activités…)"
                value={f.frais_externes || ''}
                set={v => set('frais_externes', v)}
                rows={2}
              />
              <Flash kind="ok">
                Le patient confirme le consentement libre et éclairé (loi du 22/08/2002, art. 8),
                l’échange d’informations médicales nécessaires, et dégage l’ASBL dans le cadre du programme.
              </Flash>
            </>
          )}

          {mode === 'photos' && (
            <>
              <div style={{ fontWeight: 700, margin: '12px 0 6px', color: 'var(--heading)' }}>Autorisation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {AUTORISATION_PHOTOS.map(o => (
                  <button
                    key={o.v}
                    type="button"
                    className={'ha-check-btn' + (f.niveau === o.v ? ' is-on' : '')}
                    onClick={() => set('niveau', o.v)}
                  >{o.l}</button>
                ))}
              </div>
              {f.niveau && f.niveau !== 'refus' && (
                <>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Supports de diffusion (décochez les mentions refusées)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {SUPPORTS_DIFFUSION_PHOTOS.map(s => {
                      const on = (f.supports || []).includes(s.v)
                      return (
                        <label key={s.v} className="ha-check" style={{ margin: 0 }}>
                          <input type="checkbox" checked={on} onChange={() => toggleSupport(s.v)} />
                          <span>{s.l}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
              <Flash>
                Autorisation à durée non limitée, valable après décès, sans contrepartie — promotion des missions de l’ASBL uniquement.
              </Flash>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <F label="Fait à" value={f.lieu || ''} set={v => set('lieu', v)} />
            <F label="Le" type="date" value={f.date || ''} set={v => set('date', v)} />
          </div>
          <F label="Qualité du signataire" value={f.qualite || ''} set={v => set('qualite', v)} placeholder="Patient, tuteur légal…" />
        </div>
      ) : (
        <div>
          <Flash kind="ok">Faites signer sur la tablette, puis enregistrez.</Flash>
          <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>
            {f.nom}{f.qualite ? ` · ${f.qualite}` : ''} · {f.lieu || '—'}, le {f.date}
            {mode === 'photos' ? ` · ${lblAutorisationPhotos(niveauPhotosPourStockage(f.niveau, f.supports))}` : ' · Consentement libre & éclairé'}
          </div>
          <SignaturePad value={f.signature || ''} onChange={v => set('signature', v)} />
        </div>
      )}
    </Modal>
  )
}
