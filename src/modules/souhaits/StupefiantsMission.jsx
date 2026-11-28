import { useState } from 'react'
import { Card, Btn, F, Flash, Modal } from '@/components/ui'
import SignaturePad from './SignaturePad'
import { telechargerBlob } from '@/lib/telechargerFichier'
import {
  STUPS_COURANTS, stupefiantsMission, nouvelleLigneStup, nouvelUsageStup,
  bilanLigne, qteUtiliseeLigne,
} from './stupefiantsSchema'
import { genererPdfStupefiants, NOM_PDF_STUPEFIANTS } from './stupefiantsPdf'

/**
 * Registre stupéfiants terrain :
 * - mode "remise" : départ base (quantités + double signature)
 * - mode "usages" : durant la mission (administrations)
 * - mode "retour" : fin de mission (quantités rendues + double signature)
 */
export default function StupefiantsMission({
  value,
  onSave,
  mode = 'usages',
  locked,
  optionnel,
  souhait,
}) {
  const stups = stupefiantsMission(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [pick, setPick] = useState(false)
  const [custom, setCustom] = useState({ produit: '', dosage: '' })
  const [sigOpen, setSigOpen] = useState(null) // remise | retour
  const [sigForm, setSigForm] = useState({ remettant_nom: '', receveur_nom: '', signature_remettant: '', signature_receveur: '' })

  async function voirPdf() {
    setBusy(true)
    setErr(null)
    try {
      const bytes = await genererPdfStupefiants({ souhait, stups })
      telechargerBlob(new Blob([bytes], { type: 'application/pdf' }), NOM_PDF_STUPEFIANTS)
    } catch (e) {
      setErr(e.message || String(e))
    }
    setBusy(false)
  }

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
    const lignes = [...stups.lignes, nouvelleLigneStup({
      produit: item.produit,
      dosage: item.dosage || '',
      qte_remise: 1,
    })]
    setPick(false)
    majLignes(lignes)
  }

  function ajouterCustom() {
    const produit = custom.produit.trim()
    if (!produit) { setErr('Indiquez le nom du médicament.'); return }
    ajouterDepuisListe({ produit, dosage: custom.dosage.trim() })
    setCustom({ produit: '', dosage: '' })
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
    const next = {
      ...stups,
      [sigOpen]: bloc,
    }
    // À la validation retour : préremplir qte_retour si vide
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

  const titre = mode === 'remise'
    ? 'Stupéfiants — remise départ'
    : mode === 'retour'
      ? 'Stupéfiants — retour base'
      : 'Stupéfiants — administrations'

  const hint = mode === 'remise'
    ? 'Encodez les quantités remises au départ, puis faites signer remettant et receveur.'
    : mode === 'retour'
      ? 'Indiquez les quantités rendues et faites signer remettant (équipage) et receveur (base).'
      : 'Notez chaque administration durant le souhait (dose et heure).'

  return (
    <Card>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--heading)', marginBottom: 6 }}>{titre}</div>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 0 }}>{hint}{optionnel ? ' (facultatif en formation)' : ''}</p>
      {err && <Flash kind="err">{err}</Flash>}

      <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(mode === 'remise' || mode === 'usages') && !locked && (
          <Btn kind="soft" onClick={() => setPick(true)} disabled={busy}>+ Ajouter un stupéfiant</Btn>
        )}
        {stups.lignes.length > 0 && (
          <Btn kind="soft" onClick={voirPdf} disabled={busy}>Voir le PDF</Btn>
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
                      Remis {b.remise} · Utilisé {b.utilisee} · Retour {b.retour}
                      {b.ecart !== 0 ? ` · écart ${b.ecart}` : ''}
                    </div>
                  </div>
                  {mode === 'remise' && !locked && (
                    <Btn kind="soft" onClick={() => retirerLigne(l.id)}>Retirer</Btn>
                  )}
                </div>

                {mode === 'remise' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
                    <F label="Qté remise" type="number" value={l.qte_remise ?? ''} set={v => majLigne(l.id, { qte_remise: Number(v) || 0 })} disabled={locked} />
                    <F label="Lot" value={l.lot || ''} set={v => majLigne(l.id, { lot: v })} disabled={locked} />
                    <F label="DLC" type="date" value={l.dlc || ''} set={v => majLigne(l.id, { dlc: v })} disabled={locked} />
                  </div>
                )}

                {mode === 'usages' && (
                  <div>
                    {(l.usages || []).map(u => (
                      <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: 8, marginBottom: 6, alignItems: 'end' }}>
                        <F label="Dose administrée" value={u.dose || ''} set={v => majUsage(l.id, u.id, { dose: v })} disabled={locked} />
                        <F label="Heure" value={u.heure || ''} set={v => majUsage(l.id, u.id, { heure: v })} disabled={locked} />
                        {!locked && <Btn kind="soft" onClick={() => retirerUsage(l.id, u.id)}>✕</Btn>}
                      </div>
                    ))}
                    {!locked && (
                      <Btn kind="soft" onClick={() => ajouterUsage(l.id)}>+ Administration</Btn>
                    )}
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
                      {qteUtiliseeLigne(l)} administration(s) · remis {b.remise}
                    </div>
                  </div>
                )}

                {mode === 'retour' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
                    <div style={{ fontSize: 13 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Remis</div>
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

      {(mode === 'remise' || mode === 'retour') && (
        <div style={{ marginTop: 14 }}>
          {(() => {
            const bloc = mode === 'remise' ? stups.remise : stups.retour
            const ok = !!(bloc?.signature_remettant && bloc?.signature_receveur)
            return (
              <>
                {ok ? (
                  <Flash kind="ok">
                    Signé le {String(bloc.date || '').slice(0, 10)}
                    {bloc.remettant_nom ? ` · remettant ${bloc.remettant_nom}` : ''}
                    {bloc.receveur_nom ? ` · receveur ${bloc.receveur_nom}` : ''}
                  </Flash>
                ) : (
                  <Flash kind="warn">Signatures de remise / retour encore manquantes.</Flash>
                )}
                {!locked && (
                  <Btn onClick={() => ouvrirSignatures(mode)} disabled={busy || (mode === 'remise' && !stups.lignes.length)}>
                    {ok ? 'Revoir / resignature' : 'Faire signer la remise / le retour'}
                  </Btn>
                )}
              </>
            )
          })()}
        </div>
      )}

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
          title={sigOpen === 'remise' ? 'Signatures — remise départ' : 'Signatures — retour base'}
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
          <F label="Date" type="date" value={sigForm.date || ''} set={v => setSigForm(s => ({ ...s, date: v }))} />
          <F label="Nom du remettant" value={sigForm.remettant_nom} set={v => setSigForm(s => ({ ...s, remettant_nom: v }))} />
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 8px' }}>Signature remettant</div>
          <SignaturePad value={sigForm.signature_remettant} onChange={v => setSigForm(s => ({ ...s, signature_remettant: v }))} />
          <F label="Nom du receveur" value={sigForm.receveur_nom} set={v => setSigForm(s => ({ ...s, receveur_nom: v }))} />
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 8px' }}>Signature receveur</div>
          <SignaturePad value={sigForm.signature_receveur} onChange={v => setSigForm(s => ({ ...s, signature_receveur: v }))} />
        </Modal>
      )}
    </Card>
  )
}
