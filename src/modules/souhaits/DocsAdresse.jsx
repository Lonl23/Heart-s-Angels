import { useRef, useState } from 'react'
import { Btn, Flash } from '@/components/ui'
import { uploadDocSejour, signedDocSejour, supprimerFichierSejour, TAILLE_MAX_DOC_SEJOUR } from './sejour'

function fmtTaille(n) {
  const x = Number(n) || 0
  if (x < 1024) return `${x} o`
  if (x < 1024 * 1024) return `${Math.round(x / 1024)} ko`
  return `${(x / (1024 * 1024)).toFixed(1)} Mo`
}

/** Joindre un document à une adresse de trajet (base, PEC, destination, activité). */
export default function DocsAdresse({ souhaitId, slotId, docs = [], onChange, lecture = false }) {
  const input = useRef(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const liste = Array.isArray(docs) ? docs : []

  async function ajouter(file) {
    if (!file || !souhaitId || !slotId) return
    setErr(null)
    setBusy(true)
    try {
      const doc = await uploadDocSejour(souhaitId, `trajet-${slotId}`, file)
      onChange([...liste, doc])
    } catch (e) {
      setErr(e.message || 'Envoi impossible.')
    }
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  async function ouvrir(d) {
    try {
      const url = await signedDocSejour(d.path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErr(e.message || 'Document inaccessible.')
    }
  }

  async function retirer(d) {
    await supprimerFichierSejour(d.path)
    onChange(liste.filter(x => x.id !== d.id))
  }

  return (
    <div style={{ margin: '8px 0 12px' }}>
      {err && <Flash kind="err">{err}</Flash>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: liste.length ? 8 : 0 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Documents liés à cette adresse</span>
        {!lecture && souhaitId && (
          <>
            <Btn kind="soft" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? '…' : '+ Document'}
            </Btn>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/*"
              hidden
              onChange={e => ajouter(e.target.files?.[0])}
            />
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>PDF ou image · {Math.round(TAILLE_MAX_DOC_SEJOUR / (1024 * 1024))} Mo max</span>
          </>
        )}
      </div>
      {liste.map(d => (
        <div key={d.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
          <button type="button" className="ha-gps-btn" onClick={() => ouvrir(d)}>{d.nom || 'Document'}</button>
          <span style={{ color: 'var(--text-muted)' }}>{fmtTaille(d.size)}</span>
          {!lecture && <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={() => retirer(d)}>Retirer</Btn>}
        </div>
      ))}
    </div>
  )
}
