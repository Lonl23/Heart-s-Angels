import { useState } from 'react'
import { Btn, F, Modal, Flash } from '@/components/ui'
import SignaturePad from './SignaturePad'
import { AUTORISATION_PHOTOS, normaliserAutorisationPhotos, lblAutorisationPhotos } from './missionSchema'

function bloc(m, cle) {
  const src = m?.rencontre?.[cle]
  return src && typeof src === 'object' ? src : { nom: '', date: '', signature: '', accepte: false, niveau: '' }
}

/** Consentement et autorisation photos : fiche en présence du patient, puis signature tablette. */
export default function DocumentsRencontre({ m, setM, lecture, souhait }) {
  const [popup, setPopup] = useState(null) // 'consentement' | 'photos'
  const nomDefaut = [souhait?.beneficiaire_prenom, souhait?.beneficiaire_nom].filter(Boolean).join(' ')

  function maj(cle, next) {
    if (lecture) return
    setM(o => ({
      ...o,
      rencontre: { ...(o.rencontre || {}), [cle]: next },
      ...(cle === 'consentement' ? { consentement: !!(next.signature && next.accepte) } : {}),
      ...(cle === 'photos' ? {
        autorisation_photos: next.signature
          ? (next.accepte === false || next.niveau === 'refus' ? 'refus' : (next.niveau || 'oui'))
          : o.autorisation_photos,
      } : {}),
    }))
  }

  const cons = bloc(m, 'consentement')
  const photos = bloc(m, 'photos')
  const photosOk = !!(photos.signature && (photos.niveau || photos.accepte !== undefined))
  const consOk = !!(cons.signature && cons.accepte)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Consentement</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          {consOk ? `Signé${cons.nom ? ` · ${cons.nom}` : ''}${cons.date ? ` · ${String(cons.date).slice(0, 10)}` : ''}` : 'À compléter en présence du patient, puis signature sur tablette.'}
        </div>
        {!lecture && (
          <Btn kind={consOk ? 'soft' : 'primary'} onClick={() => setPopup('consentement')}>
            {consOk ? 'Revoir / resignature' : 'Compléter et faire signer'}
          </Btn>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Autorisation photos</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          {photosOk
            ? `${lblAutorisationPhotos(photos.niveau || m.autorisation_photos)}${photos.nom ? ` · ${photos.nom}` : ''}`
            : 'Choisir le niveau d’autorisation, puis signature sur tablette.'}
        </div>
        {!lecture && (
          <Btn kind={photosOk ? 'soft' : 'primary'} onClick={() => setPopup('photos')}>
            {photosOk ? 'Revoir / resignature' : 'Compléter et faire signer'}
          </Btn>
        )}
        {m.autorisation_photos && !photosOk && (
          <div style={{ fontSize: 12.5, marginTop: 6 }}>Niveau actuel : {lblAutorisationPhotos(m.autorisation_photos)}</div>
        )}
      </div>

      {popup === 'consentement' && (
        <PopupSignature
          titre="Consentement du patient"
          mode="consentement"
          initial={{ ...cons, nom: cons.nom || nomDefaut, date: cons.date || new Date().toISOString().slice(0, 10) }}
          onClose={() => setPopup(null)}
          onSave={next => { maj('consentement', next); setPopup(null) }}
        />
      )}
      {popup === 'photos' && (
        <PopupSignature
          titre="Autorisation photos"
          mode="photos"
          initial={{
            ...photos,
            nom: photos.nom || nomDefaut,
            date: photos.date || new Date().toISOString().slice(0, 10),
            niveau: normaliserAutorisationPhotos(photos.niveau || m.autorisation_photos) || 'oui',
          }}
          onClose={() => setPopup(null)}
          onSave={next => { maj('photos', next); setPopup(null) }}
        />
      )}
    </div>
  )
}

function PopupSignature({ titre, mode, initial, onSave, onClose }) {
  const [etape, setEtape] = useState(initial?.signature ? 2 : 1)
  const [nom, setNom] = useState(initial?.nom || '')
  const [date, setDate] = useState(String(initial?.date || '').slice(0, 10))
  const [accepte, setAccepte] = useState(initial?.accepte !== false)
  const [niveau, setNiveau] = useState(initial?.niveau || 'oui')
  const [signature, setSignature] = useState(initial?.signature || '')
  const [err, setErr] = useState(null)

  function allerSignature() {
    setErr(null)
    if (!nom.trim()) { setErr('Indiquez le nom du signataire.'); return }
    if (!date) { setErr('Indiquez la date.'); return }
    if (mode === 'photos' && !niveau) { setErr('Choisissez le niveau d’autorisation.'); return }
    if (mode === 'consentement' && !accepte) { setErr('Le consentement doit être accepté pour signer, ou annulez.'); return }
    setEtape(2)
  }

  function valider() {
    setErr(null)
    if (!signature) { setErr('Faites signer sur la tablette.'); return }
    const next = {
      nom: nom.trim(),
      date,
      signature,
      accepte: mode === 'photos' ? niveau !== 'refus' : !!accepte,
      ...(mode === 'photos' ? { niveau } : {}),
    }
    onSave(next)
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
                <Btn kind="soft" onClick={() => setEtape(1)}>‹ Fiche</Btn>
                <Btn onClick={valider}>Enregistrer la signature</Btn>
              </>
            )}
        </>
      )}
    >
      {err && <Flash kind="err">{err}</Flash>}
      {etape === 1 ? (
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 0 }}>
            Complétez la fiche en présence du patient, puis proposez la signature sur la tablette.
          </p>
          <F label="Nom du signataire" value={nom} set={setNom} />
          <F label="Date" type="date" value={date} set={setDate} />
          {mode === 'consentement' && (
            <label className="ha-check" style={{ margin: '10px 0' }}>
              <input type="checkbox" checked={accepte} onChange={e => setAccepte(e.target.checked)} />
              <span>Le patient consent aux soins / à la mission</span>
            </label>
          )}
          {mode === 'photos' && (
            <div style={{ margin: '10px 0' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>Niveau d’autorisation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {AUTORISATION_PHOTOS.map(o => (
                  <button
                    key={o.v}
                    type="button"
                    className={'ha-check-btn' + (niveau === o.v ? ' is-on' : '')}
                    onClick={() => { setNiveau(o.v); setAccepte(o.v !== 'refus') }}
                  >{o.l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <Flash kind="ok">Faites signer le patient sur la tablette, puis enregistrez.</Flash>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {nom} · {date}
            {mode === 'photos' ? ` · ${lblAutorisationPhotos(niveau)}` : ''}
          </div>
          <SignaturePad value={signature} onChange={setSignature} />
        </div>
      )}
    </Modal>
  )
}
