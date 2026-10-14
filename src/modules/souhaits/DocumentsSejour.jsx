import { useRef, useState } from 'react'
import { Card, Btn, F, Sel, TA, AddressFields, Flash, fmtAdresse } from '@/components/ui'
import { TYPES_LIEU_ANNEXE, lblTypeLieu, lieuxAnnexes } from './missionSchema'
import { uploadDocSejour, signedDocSejour, supprimerFichierSejour, TAILLE_MAX_DOC_SEJOUR } from './sejour'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'l' + Date.now() + Math.random().toString(16).slice(2))

function fmtTaille(n) {
  const x = Number(n) || 0
  if (x < 1024) return `${x} o`
  if (x < 1024 * 1024) return `${Math.round(x / 1024)} ko`
  return `${(x / (1024 * 1024)).toFixed(1)} Mo`
}

export default function DocumentsSejour({ souhaitId, m, setM, lecture = false }) {
  const lieux = lieuxAnnexes(m)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)

  function setLieux(next) {
    setM(o => ({ ...o, lieux_annexes: next }))
  }
  function patch(id, p) {
    setLieux(lieux.map(l => l.id === id ? { ...l, ...p } : l))
  }
  function ajouter(type) {
    setErr(null)
    setLieux([...lieux, {
      id: uid(),
      type,
      nom: '',
      adresse: {},
      notes: '',
      documents: [],
    }])
  }
  function retirer(l) {
    if (!confirm(`Retirer ${l.nom || lblTypeLieu(l.type).toLowerCase()} et ses documents ?`)) return
    ;(l.documents || []).forEach(d => { if (d?.path) supprimerFichierSejour(d.path) })
    setLieux(lieux.filter(x => x.id !== l.id))
  }

  async function ajouterFichier(l, file) {
    if (!file) return
    setErr(null)
    setBusy(l.id)
    try {
      const doc = await uploadDocSejour(souhaitId, l.id, file)
      patch(l.id, { documents: [...(l.documents || []), doc] })
    } catch (e) {
      setErr(e.message || 'Envoi impossible.')
    }
    setBusy(null)
  }

  async function ouvrir(d) {
    try {
      const url = await signedDocSejour(d.path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErr(e.message || 'Document inaccessible.')
    }
  }

  async function retirerFichier(l, d) {
    await supprimerFichierSejour(d.path)
    patch(l.id, { documents: (l.documents || []).filter(x => x.id !== d.id) })
  }

  return (
    <div>
      <Flash>
        Réservations d’hôtel, de parking, restaurant… Joignez les documents ici. Sur un séjour de plusieurs jours, l’équipage choisit ensuite le prochain transport (hôtel, destination, restaurant, retour patient) une fois sur place.
      </Flash>
      {err && <Flash kind="err">{err}</Flash>}
      {!lecture && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'12px 0 16px' }}>
          {TYPES_LIEU_ANNEXE.map(t => (
            <Btn key={t.v} kind="soft" onClick={() => ajouter(t.v)}>+ {t.l}</Btn>
          ))}
        </div>
      )}
      {lieux.length === 0 && (
        <Card>
          <div style={{ fontSize:14, color:'var(--text-muted)' }}>
            Aucun lieu ni document pour le moment. Ajoutez un hôtel ou un parking si le souhait s’étale sur plusieurs jours.
          </div>
        </Card>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {lieux.map(l => (
          <Card key={l.id}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ fontWeight:700, color:'var(--heading)' }}>{lblTypeLieu(l.type)}</div>
              {!lecture && <Btn kind="danger" onClick={() => retirer(l)}>Retirer</Btn>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'0 16px' }}>
              <Sel
                label="Type"
                value={l.type || 'autre'}
                set={v => patch(l.id, { type: v })}
                options={TYPES_LIEU_ANNEXE}
                disabled={lecture}
              />
              <F
                label="Nom"
                value={l.nom || ''}
                set={v => patch(l.id, { nom: v })}
                placeholder={l.type === 'hotel' ? 'Ibis Liège…' : l.type === 'parking' ? 'Parking P2…' : ''}
                readOnly={lecture}
              />
            </div>
            <div style={{ marginTop:4 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>Adresse</div>
              {lecture
                ? <div style={{ fontSize:14, color:'var(--text-2)', marginBottom:10 }}>{fmtAdresse(l.adresse) || '—'}</div>
                : <AddressFields value={l.adresse} set={v => patch(l.id, { adresse: v })} />}
            </div>
            <TA
              label="Notes (accès, créneau, n° de réservation…)"
              value={l.notes || ''}
              set={v => lecture ? null : patch(l.id, { notes: v })}
              rows={2}
            />
            <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', margin:'8px 0 8px' }}>Documents</div>
            {(l.documents || []).length === 0 && (
              <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8 }}>
                Confirmation, QR, plan d’accès… PDF ou photo, {Math.round(TAILLE_MAX_DOC_SEJOUR / (1024 * 1024))} Mo max.
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
              {(l.documents || []).map(d => (
                <div key={d.id} style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px' }}>
                  <button type="button" onClick={() => ouvrir(d)} style={{ background:'none', border:'none', textAlign:'left', padding:0, cursor:'pointer', color:'var(--accent)', fontWeight:600, fontSize:13.5 }}>
                    {d.nom || 'Document'}
                    <span style={{ color:'var(--text-muted)', fontWeight:400 }}> · {fmtTaille(d.size)}</span>
                  </button>
                  {!lecture && <Btn kind="soft" onClick={() => retirerFichier(l, d)}>Supprimer</Btn>}
                </div>
              ))}
            </div>
            {!lecture && <AjoutFichier busy={busy === l.id} onFile={f => ajouterFichier(l, f)} />}
          </Card>
        ))}
      </div>
    </div>
  )
}

function AjoutFichier({ busy, onFile }) {
  const ref = useRef(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        style={{ display:'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
      <Btn kind="soft" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Envoi…' : '+ Joindre un document'}
      </Btn>
    </>
  )
}
