import { useState } from 'react'
import { Btn, F, TA, Modal, Flash, fmtAdresse } from '@/components/ui'
import SignaturePad from './SignaturePad'
import {
  AUTORISATION_PHOTOS, SUPPORTS_DIFFUSION_PHOTOS, SUPPORTS_DIFFUSION_DEFAUT,
  normaliserAutorisationPhotos, lblAutorisationPhotos, niveauPhotosPourStockage,
  medecinPluri, nomPluri,
} from './missionSchema'
import { formaterNiss } from '@/modules/annuaire/annuaireSchema'
import { telechargerBlob, telechargerFichier } from '@/lib/telechargerFichier'
import { genererPdfConsentement, genererPdfDroitImage } from './documentsRencontrePdf'
import { envoyerDocumentRencontre } from '@/lib/envoyerInvitation'
import { uploadDocSejour, signedDocSejour, TAILLE_MAX_DOC_SEJOUR } from './sejour'
import pdfConsentementUrl from '@/assets/papier/consentement-libre-eclaire.pdf?url'
import pdfDroitImageUrl from '@/assets/papier/autorisation-droit-image.pdf?url'

const PDF_CONSENTEMENT = pdfConsentementUrl
const PDF_DROIT_IMAGE = pdfDroitImageUrl
const NOM_PDF_CONSENTEMENT = 'Consentement_Libre_et_Eclaire_Hearts_Angels.pdf'
const NOM_PDF_DROIT_IMAGE = 'Autorisation_droit_a_l_image_Hearts_Angels.pdf'

function bytesToBase64(bytes) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function champsRemplis(mode, data) {
  if (!data?.nom?.trim() || !data?.date) return false
  if (mode === 'consentement') {
    return !!(data.souhait_texte?.trim() && data.risques?.trim())
  }
  return !!data.niveau
}

function BoutonModelePdf({ url, nom, label = 'Télécharger le modèle PDF' }) {
  const [busy, setBusy] = useState(false)
  async function go() {
    if (busy) return
    setBusy(true)
    try {
      await telechargerFichier(url, nom)
    } catch (e) {
      alert(e.message || 'Téléchargement impossible.')
    }
    setBusy(false)
  }
  return (
    <Btn kind="soft" onClick={go} disabled={busy}>
      {busy ? '…' : label}
    </Btn>
  )
}

function BoutonPdf({ mode, data, sansSignature, label = 'Voir le PDF', disabled }) {
  const [busy, setBusy] = useState(false)
  async function go() {
    if (busy || disabled) return
    if (!champsRemplis(mode, data)) {
      alert('Complétez d’abord les champs du document.')
      return
    }
    setBusy(true)
    try {
      const opts = sansSignature ? { sansSignature: true } : {}
      const bytes = mode === 'consentement'
        ? await genererPdfConsentement(data, opts)
        : await genererPdfDroitImage(data, opts)
      const nom = mode === 'consentement' ? NOM_PDF_CONSENTEMENT : NOM_PDF_DROIT_IMAGE
      const suffix = sansSignature ? nom.replace(/\.pdf$/i, '_a_signer.pdf') : nom
      telechargerBlob(bytes, suffix)
    } catch (e) {
      alert(e.message || 'Génération du PDF impossible.')
    }
    setBusy(false)
  }
  return (
    <Btn kind="soft" onClick={go} disabled={busy || disabled}>
      {busy ? '…' : label}
    </Btn>
  )
}

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
    document_signe: b.document_signe || null,
  }
}

/** Consentement libre & éclairé + droit à l’image (PDF officiels). */
export default function DocumentsRencontre({ m, setM, lecture, souhait }) {
  const [popup, setPopup] = useState(null)
  const [mail, setMail] = useState(null) // { mode, data }
  const [mailForm, setMailForm] = useState({ email: '', prenom: '', nom: '' })
  const [mailBusy, setMailBusy] = useState(false)
  const [mailMsg, setMailMsg] = useState(null)

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
  const dataCons = prefills(souhait, m, 'consentement')
  const dataPhotos = prefills(souhait, m, 'photos')
  const consPretPdf = champsRemplis('consentement', dataCons)
  const photosPretPdf = champsRemplis('photos', dataPhotos)

  async function envoyerMail() {
    if (!mail || !souhait?.id) return
    setMailBusy(true)
    setMailMsg(null)
    try {
      const opts = { sansSignature: true }
      const bytes = mail.mode === 'consentement'
        ? await genererPdfConsentement(mail.data, opts)
        : await genererPdfDroitImage(mail.data, opts)
      const nom = mail.mode === 'consentement'
        ? NOM_PDF_CONSENTEMENT.replace(/\.pdf$/i, '_a_signer.pdf')
        : NOM_PDF_DROIT_IMAGE.replace(/\.pdf$/i, '_a_signer.pdf')
      const res = await envoyerDocumentRencontre({
        souhaitId: souhait.id,
        email: mailForm.email,
        destinatairePrenom: mailForm.prenom,
        destinataireNom: mailForm.nom,
        mode: mail.mode,
        pdfBase64: bytesToBase64(bytes),
        nomFichier: nom,
      })
      if (!res.ok) { setMailMsg({ ok: false, t: res.error }); setMailBusy(false); return }
      setMailMsg({ ok: true, t: 'Document envoyé. Le destinataire peut le signer à la main puis vous le renvoyer.' })
      setMail(null)
    } catch (e) {
      setMailMsg({ ok: false, t: e.message || String(e) })
    }
    setMailBusy(false)
  }

  async function joindreSigne(cle, file) {
    if (!souhait?.id || !file) return
    if (file.size > TAILLE_MAX_DOC_SEJOUR) {
      alert('Fichier trop volumineux.')
      return
    }
    try {
      const doc = await uploadDocSejour(souhait.id, cle === 'consentement' ? 'consentement-signe' : 'droit-image-signe', file)
      const cur = prefills(souhait, m, cle)
      maj(cle, { ...cur, document_signe: doc })
    } catch (e) {
      alert(e.message || 'Envoi du fichier impossible.')
    }
  }

  async function ouvrirSigne(meta) {
    try {
      const url = await signedDocSejour(meta?.path)
      if (url) window.open(url, '_blank', 'noopener')
    } catch (e) {
      alert(e.message || 'Ouverture impossible.')
    }
  }

  function carte({ titre, ok, data, mode, pretPdf, cle }) {
    const signe = data.document_signe
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{titre}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          {ok
            ? `Signé tablette${data.nom ? ` · ${data.nom}` : ''}${data.date ? ` · ${String(data.date).slice(0, 10)}` : ''}`
            : 'Complétez les infos, visualisez le PDF sans signature, envoyez-le par mail pour une signature manuscrite, ou signez sur tablette.'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <BoutonPdf mode={mode} data={data} sansSignature label="PDF sans signature" disabled={!pretPdf} />
          {ok && <BoutonPdf mode={mode} data={data} label="PDF signé (tablette)" />}
          {!lecture && (
            <>
              <Btn kind={ok ? 'soft' : 'primary'} onClick={() => setPopup(mode)}>
                {ok ? 'Revoir / resignature' : 'Compléter / faire signer'}
              </Btn>
              <Btn
                kind="soft"
                disabled={!pretPdf}
                onClick={() => {
                  setMailMsg(null)
                  setMailForm({ email: '', prenom: '', nom: data.nom || '' })
                  setMail({ mode, data })
                }}
              >Envoyer par mail</Btn>
              <label className="ha-check-btn" style={{ display: 'inline-flex', cursor: 'pointer', margin: 0 }}>
                Joindre le PDF signé
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  hidden
                  onChange={e => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) joindreSigne(cle, f)
                  }}
                />
              </label>
            </>
          )}
          {signe?.path && (
            <Btn kind="soft" onClick={() => ouvrirSigne(signe)}>Voir la PJ signée</Btn>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      {mailMsg && <Flash kind={mailMsg.ok ? 'ok' : 'err'}>{mailMsg.t}</Flash>}
      {carte({
        titre: 'Consentement libre & éclairé',
        ok: consOk,
        data: dataCons,
        mode: 'consentement',
        pretPdf: consPretPdf,
        cle: 'consentement',
      })}
      {carte({
        titre: 'Autorisation du droit à l’image',
        ok: photosOk,
        data: dataPhotos,
        mode: 'photos',
        pretPdf: photosPretPdf,
        cle: 'photos',
      })}

      {popup === 'consentement' && (
        <PopupDocument
          mode="consentement"
          titre="Consentement libre & éclairé"
          initial={dataCons}
          onClose={() => setPopup(null)}
          onSave={next => { maj('consentement', { ...next, accepte: true }); setPopup(null) }}
        />
      )}
      {popup === 'photos' && (
        <PopupDocument
          mode="photos"
          titre="Autorisation du droit à l’image"
          initial={dataPhotos}
          onClose={() => setPopup(null)}
          onSave={next => { maj('photos', next); setPopup(null) }}
        />
      )}

      {mail && (
        <Modal
          title="Envoyer le PDF à signer"
          onClose={() => setMail(null)}
          footer={(
            <>
              <Btn kind="soft" onClick={() => setMail(null)}>Annuler</Btn>
              <Btn onClick={envoyerMail} disabled={mailBusy || !mailForm.email.includes('@')}>
                {mailBusy ? 'Envoi…' : 'Envoyer'}
              </Btn>
            </>
          )}
        >
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 0 }}>
            Le PDF part prérempli, sans signature numérique — pour une signature manuscrite.
          </p>
          <F label="E-mail" type="email" value={mailForm.email} set={v => setMailForm(s => ({ ...s, email: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <F label="Prénom (optionnel)" value={mailForm.prenom} set={v => setMailForm(s => ({ ...s, prenom: v }))} />
            <F label="Nom (optionnel)" value={mailForm.nom} set={v => setMailForm(s => ({ ...s, nom: v }))} />
          </div>
        </Modal>
      )}
    </div>
  )
}

function PopupDocument({ mode, titre, initial, onSave, onClose }) {
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
            Complétez le document, visualisez le PDF sans signature, ou proposez la signature tablette.
          </p>
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <BoutonModelePdf
              url={mode === 'consentement' ? PDF_CONSENTEMENT : PDF_DROIT_IMAGE}
              nom={mode === 'consentement' ? NOM_PDF_CONSENTEMENT : NOM_PDF_DROIT_IMAGE}
            />
            <BoutonPdf mode={mode} data={f} sansSignature label="Aperçu PDF sans signature" disabled={!champsRemplis(mode, f)} />
            {f.signature && (
              <BoutonPdf mode={mode} data={f} label="Aperçu PDF signé" />
            )}
          </div>

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
