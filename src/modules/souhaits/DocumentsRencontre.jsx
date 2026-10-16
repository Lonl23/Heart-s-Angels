import { F } from '@/components/ui'
import SignaturePad from './SignaturePad'

function bloc(m, cle) {
  const src = m?.rencontre?.[cle]
  return src && typeof src === 'object' ? src : { nom: '', date: '', signature: '', accepte: false }
}

export default function DocumentsRencontre({ m, set, setM, lecture, souhait }) {
  function maj(cle, patch) {
    if (lecture) return
    const cur = bloc(m, cle)
    const next = { ...cur, ...patch }
    setM(o => ({
      ...o,
      rencontre: { ...(o.rencontre || {}), [cle]: next },
      ...(cle === 'consentement' ? { consentement: !!(next.signature && next.accepte) } : {}),
      ...(cle === 'photos' ? { autorisation_photos: next.accepte && next.signature ? 'oui' : (next.accepte === false && next.signature ? 'refus' : o.autorisation_photos) } : {}),
    }))
  }
  const nomDefaut = [souhait?.beneficiaire_prenom, souhait?.beneficiaire_nom].filter(Boolean).join(' ')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 8 }}>
      <Doc
        titre="Consentement"
        doc={{ ...bloc(m, 'consentement'), nom: bloc(m, 'consentement').nom || nomDefaut }}
        lecture={lecture}
        onChange={patch => maj('consentement', patch)}
      />
      <Doc
        titre="Autorisation photos"
        doc={{ ...bloc(m, 'photos'), nom: bloc(m, 'photos').nom || nomDefaut }}
        lecture={lecture}
        onChange={patch => maj('photos', patch)}
      />
    </div>
  )
}

function Doc({ titre, doc, lecture, onChange }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{titre}</div>
      <F label="Nom" value={doc.nom || ''} set={v => onChange({ nom: v })} readOnly={lecture} />
      <F label="Date" type="date" value={(doc.date || '').slice(0, 10)} set={v => onChange({ date: v })} readOnly={lecture} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 10px', fontSize: 14 }}>
        <input type="checkbox" checked={!!doc.accepte} disabled={lecture} onChange={e => onChange({ accepte: e.target.checked })} />
        Accord
      </label>
      <SignaturePad value={doc.signature || ''} onChange={v => onChange({ signature: v })} lecture={lecture} />
    </div>
  )
}
