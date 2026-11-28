import { useState } from 'react'
import { Card, Btn, F, Flash, Modal } from '@/components/ui'
import SignaturePad from './SignaturePad'
import { telechargerBlob } from '@/lib/telechargerFichier'
import {
  STUPS_COURANTS, stupefiantsMission, nouvelleLigneStup, nouvelUsageStup,
  bilanLigne, qteUtiliseeLigne,
} from './stupefiantsSchema'
import {
  genererPdfStupefiantsInstitutions, NOM_PDF_STUPS_INSTITUTIONS,
} from './stupefiantsInstitutionsPdf'
import { analyserDocumentMedical, stupefiantsDepuisAnalyse } from './analyserDocumentMedical'

/**
 * Registre stupéfiants (feuille institutions) — onglet Rapport médical.
 * mode "all" (défaut) : remise PEC + administrations + retour.
 * modes "remise" | "usages" | "retour" : vues partielles (compat).
 */
export default function StupefiantsMission({
  value,
  onSave,
  mode = 'all',
  locked,
  optionnel,
  souhait,
  /**
   * Signatures : false | true | 'remise' | 'retour'
   * (true = les deux ; 'remise'/'retour' = une seule, selon l’étape terrain).
   */
  signaturesActives = false,
}) {
  const stups = stupefiantsMission(value)
  const all = mode === 'all'
  const showRemise = all || mode === 'remise'
  const showUsages = all || mode === 'usages'
  const showRetour = all || mode === 'retour'
  const peutSignerRemise = !locked && (signaturesActives === true || signaturesActives === 'remise')
  const peutSignerRetour = !locked && (signaturesActives === true || signaturesActives === 'retour')

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [okMsg, setOkMsg] = useState(null)
  const [pick, setPick] = useState(false)
  const [custom, setCustom] = useState({ produit: '', dosage: '' })
  const [sigOpen, setSigOpen] = useState(null)
  const [sigForm, setSigForm] = useState({
    remettant_nom: '', receveur_nom: '', signature_remettant: '', signature_receveur: '', date: '',
  })

  async function sauver(next) {
    if (locked) return
    setBusy(true)
    setErr(null)
    try {
      await onSave(next)
    } catch (e) {
      setErr(e.message || String(e))
    }
    setBusy(false)
  }

  function majLignes(lignes) {
    sauver({ ...stups, lignes })
  }

  function ajouterDepuisListe(item) {
    majLignes([...stups.lignes, nouvelleLigneStup({
      produit: item.produit,
      dosage: item.dosage || '',
      qte_remise: 1,
    })])
    setPick(false)
  }

  function ajouterCustom() {
    const produit = custom.produit.trim()
    if (!produit) { setErr('Indiquez le nom du médicament.'); return }
    ajouterDepuisListe({ produit, dosage: custom.dosage.trim() })
    setCustom({ produit: '', dosage: '' })
  }

  async function voirPdf() {
    setBusy(true)
    setErr(null)
    try {
      const bytes = await genererPdfStupefiantsInstitutions({ souhait, stups })
      telechargerBlob(new Blob([bytes], { type: 'application/pdf' }), NOM_PDF_STUPS_INSTITUTIONS)
    } catch (e) {
      setErr(e.message || String(e))
    }
    setBusy(false)
  }

  async function importerScan(file) {
    if (!file || locked) return
    setBusy(true)
    setErr(null)
    setOkMsg(null)
    try {
      const data = await analyserDocumentMedical(file, 'stupefiants')
      const rows = stupefiantsDepuisAnalyse(data)
      if (!rows.length) {
        setErr('Aucun stupéfiant détecté. Ajoutez-les depuis la liste ou à la main.')
        setBusy(false)
        return
      }
      await onSave({
        ...stups,
        lignes: [...stups.lignes, ...rows.map(r => nouvelleLigneStup(r))],
      })
      setPick(false)
      setOkMsg(`${rows.length} ligne(s) proposées par l’IA — vérifiez quantités, lots et DLC.`)
    } catch (e) {
      setErr(e.message || 'Analyse impossible.')
    }
    setBusy(false)
  }

  function majLigne(id, patch) {
    majLignes(stups.lignes.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  function retirerLigne(id) {
    if (!confirm('Retirer cette ligne du registre ?')) return
    majLignes(stups.lignes.filter(l => l.id !== id))
  }

  function ajouterUsage(ligneId) {
    majLignes(stups.lignes.map(l => {
      if (l.id !== ligneId) return l
      return { ...l, usages: [...(l.usages || []), nouvelUsageStup()] }
    }))
  }

  function majUsage(ligneId, usageId, patch) {
    majLignes(stups.lignes.map(l => {
      if (l.id !== ligneId) return l
      return {
        ...l,
        usages: (l.usages || []).map(u => u.id === usageId ? { ...u, ...patch } : u),
      }
    }))
  }

  function retirerUsage(ligneId, usageId) {
    majLignes(stups.lignes.map(l => {
      if (l.id !== ligneId) return l
      return { ...l, usages: (l.usages || []).filter(u => u.id !== usageId) }
    }))
  }

  function ouvrirSignatures(kind) {
    const cur = kind === 'remise' ? stups.remise : stups.retour
    setSigForm({
      remettant_nom: cur?.remettant_nom || '',
      receveur_nom: cur?.receveur_nom || '',
      signature_remettant: cur?.signature_remettant || '',
      signature_receveur: cur?.signature_receveur || '',
      date: cur?.date || new Date().toISOString().slice(0, 10),
    })
    setSigOpen(kind)
    setErr(null)
  }

  async function validerSignatures() {
    if (!sigForm.remettant_nom.trim() || !sigForm.receveur_nom.trim()) {
      setErr('Indiquez les deux noms (remettant et receveur).')
      return
    }
    if (!sigForm.signature_remettant || !sigForm.signature_receveur) {
      setErr('Les deux signatures sont requises.')
      return
    }
    const bloc = {
      ...sigForm,
      date: sigForm.date || new Date().toISOString().slice(0, 10),
      signe_le: new Date().toISOString(),
    }
    const next = { ...stups, [sigOpen]: bloc }
    if (sigOpen === 'retour') {
      next.lignes = stups.lignes.map(l => {
        if (l.qte_retour != null && l.qte_retour !== '') return l
        const b = bilanLigne(l)
        return { ...l, qte_retour: Math.max(0, b.remise - b.utilisee) }
      })
    }
    setSigOpen(null)
    await sauver(next)
  }

  function blocSignatures(kind) {
    const bloc = kind === 'remise' ? stups.remise : stups.retour
    const ok = !!(bloc?.signature_remettant && bloc?.signature_receveur)
    const peut = kind === 'remise' ? peutSignerRemise : peutSignerRetour
    return (
      <div style={{ marginTop: 12 }}>
        {ok ? (
          <Flash kind="ok">
            Signé le {String(bloc.date || '').slice(0, 10)}
            {kind === 'remise'
              ? ` · institution ${bloc.remettant_nom || ''} · HA ${bloc.receveur_nom || ''}`
              : ` · HA ${bloc.remettant_nom || ''} · institution ${bloc.receveur_nom || ''}`}
          </Flash>
        ) : (
          <Flash kind="warn">
            {kind === 'remise'
              ? (peut
                ? 'Signatures départ manquantes (infirmier institution + Heart’s Angels).'
                : 'Signatures départ : à faire sur place prise en charge (Statuts).')
              : (peut
                ? 'Signatures retour manquantes (Heart’s Angels + infirmier institution).'
                : 'Signatures retour : à faire sur place retour (Statuts).')}
          </Flash>
        )}
        {peut && (
          <Btn onClick={() => ouvrirSignatures(kind)} disabled={busy || (kind === 'remise' && !stups.lignes.length)}>
            {ok
              ? 'Revoir / resignature'
              : (kind === 'remise' ? 'Faire signer le départ (PEC)' : 'Faire signer le retour')}
          </Btn>
        )}
      </div>
    )
  }

  return (
    <Card>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--heading)', marginBottom: 6 }}>
        Stupéfiants — feuille institutions
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 0 }}>
        {peutSignerRemise
          ? 'Sur place prise en charge : encodez (y compris sacs), administrez si besoin, et faites signer le départ.'
          : peutSignerRetour
            ? 'Sur place retour : quantités rendues, administrations éventuelles, et signatures de retour.'
            : 'Encodage et administrations (avec justification) ici ou dans Rapport médical. Signatures : sur place PEC / sur place retour.'}
        {optionnel ? ' (facultatif en formation)' : ''}
      </p>
      {err && <Flash kind="err">{err}</Flash>}
      {okMsg && <Flash kind="ok">{okMsg}</Flash>}

      <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {showRemise && !locked && (
          <>
            <Btn kind="soft" onClick={() => setPick(true)} disabled={busy}>+ Ajouter un stupéfiant</Btn>
            <label className="ha-check-btn" style={{ display: 'inline-flex', cursor: busy ? 'wait' : 'pointer', margin: 0, opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Analyse IA…' : 'Photo / PDF → IA'}
              <input
                type="file"
                accept="application/pdf,image/*"
                disabled={busy}
                hidden
                onChange={e => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) importerScan(f)
                }}
              />
            </label>
          </>
        )}
        {stups.lignes.length > 0 && (
          <Btn kind="soft" onClick={voirPdf} disabled={busy}>Feuille institutions (PDF)</Btn>
        )}
      </div>

      {stups.lignes.length === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Aucun stupéfiant encodé.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {stups.lignes.map(l => {
            const b = bilanLigne(l)
            return (
              <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{l.produit}{l.dosage ? ` · ${l.dosage}` : ''}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      Départ {b.remise} · Utilisé {b.utilisee} · Retour {b.retour}
                      {b.ecart !== 0 ? ` · écart ${b.ecart}` : ''}
                    </div>
                  </div>
                  {showRemise && !locked && (
                    <Btn kind="soft" onClick={() => retirerLigne(l.id)}>Retirer</Btn>
                  )}
                </div>

                {showRemise && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: showUsages || showRetour ? 10 : 0 }}>
                    <F label="Qté départ" type="number" value={l.qte_remise ?? ''} set={v => majLigne(l.id, { qte_remise: Number(v) || 0 })} disabled={locked} />
                    <F label="Lot" value={l.lot || ''} set={v => majLigne(l.id, { lot: v })} disabled={locked} />
                    <F label="DLC" type="date" value={l.dlc || ''} set={v => majLigne(l.id, { dlc: v })} disabled={locked} />
                    <F label="Justification" value={l.justification || ''} set={v => majLigne(l.id, { justification: v })} disabled={locked} />
                  </div>
                )}

                {showUsages && (
                  <div style={{ marginBottom: showRetour ? 10 : 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Administrations</div>
                    {(l.usages || []).map(u => (
                      <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: 8, marginBottom: 6, alignItems: 'end' }}>
                        <F label="Dose administrée" value={u.dose || ''} set={v => majUsage(l.id, u.id, { dose: v })} disabled={locked} />
                        <F label="Heure" value={u.heure || ''} set={v => majUsage(l.id, u.id, { heure: v })} disabled={locked} />
                        {!locked && <Btn kind="soft" onClick={() => retirerUsage(l.id, u.id)}>✕</Btn>}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <F
                            label="Justification / indication"
                            value={u.notes || ''}
                            set={v => majUsage(l.id, u.id, { notes: v })}
                            disabled={locked}
                          />
                        </div>
                      </div>
                    ))}
                    {!locked && (
                      <Btn kind="soft" onClick={() => ajouterUsage(l.id)}>+ Administration</Btn>
                    )}
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
                      {qteUtiliseeLigne(l)} administration(s) · départ {b.remise}
                    </div>
                  </div>
                )}

                {showRetour && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
                    <div style={{ fontSize: 13 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Départ</div>
                      <strong>{b.remise}</strong>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Utilisé</div>
                      <strong>{b.utilisee}</strong>
                    </div>
                    <F
                      label="Qté retour"
                      type="number"
                      value={l.qte_retour ?? b.retour}
                      set={v => majLigne(l.id, { qte_retour: Number(v) || 0 })}
                      disabled={locked}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showRemise && blocSignatures('remise')}
      {showRetour && blocSignatures('retour')}

      {pick && (
        <Modal title="Choisir un stupéfiant" onClose={() => setPick(false)} footer={<Btn kind="soft" onClick={() => setPick(false)}>Fermer</Btn>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {STUPS_COURANTS.map(item => (
              <button
                key={item.produit + item.dosage}
                type="button"
                className="ha-check-btn"
                onClick={() => ajouterDepuisListe(item)}
              >
                <span>{item.produit}{item.dosage ? ` · ${item.dosage}` : ''}</span>
              </button>
            ))}
          </div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Autre (ajout libre)</div>
          <F label="Médicament" value={custom.produit} set={v => setCustom(s => ({ ...s, produit: v }))} />
          <F label="Dosage" value={custom.dosage} set={v => setCustom(s => ({ ...s, dosage: v }))} placeholder="ex. 10 mg / 1 ml" />
          <Btn onClick={ajouterCustom}>Ajouter</Btn>
        </Modal>
      )}

      {sigOpen && (
        <Modal
          title={sigOpen === 'remise' ? 'Signatures — départ (PEC)' : 'Signatures — retour patient'}
          onClose={() => setSigOpen(null)}
          wide
          footer={(
            <>
              <Btn kind="soft" onClick={() => setSigOpen(null)}>Annuler</Btn>
              <Btn onClick={validerSignatures}>Enregistrer les signatures</Btn>
            </>
          )}
        >
          {err && <Flash kind="err">{err}</Flash>}
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
            {sigOpen === 'remise'
              ? 'Départ : l’infirmier institution remet, Heart’s Angels reçoit (feuille officielle).'
              : 'Retour : Heart’s Angels remet le non utilisé, l’infirmier institution reçoit.'}
          </p>
          <F label="Date" type="date" value={sigForm.date || ''} set={v => setSigForm(s => ({ ...s, date: v }))} />
          <F
            label={sigOpen === 'remise' ? 'Infirmier institution (remettant)' : 'Infirmier Heart’s Angels (remettant)'}
            value={sigForm.remettant_nom}
            set={v => setSigForm(s => ({ ...s, remettant_nom: v }))}
          />
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 8px' }}>Signature remettant</div>
          <SignaturePad value={sigForm.signature_remettant} onChange={v => setSigForm(s => ({ ...s, signature_remettant: v }))} />
          <F
            label={sigOpen === 'remise' ? 'Infirmier Heart’s Angels (receveur)' : 'Infirmier institution (receveur)'}
            value={sigForm.receveur_nom}
            set={v => setSigForm(s => ({ ...s, receveur_nom: v }))}
          />
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 8px' }}>Signature receveur</div>
          <SignaturePad value={sigForm.signature_receveur} onChange={v => setSigForm(s => ({ ...s, signature_receveur: v }))} />
        </Modal>
      )}
    </Card>
  )
}
