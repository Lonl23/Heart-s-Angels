import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Loading, Flash } from '@/components/ui'
import { lieuxAnnexes, lblTypeLieu } from './missionSchema'
import { signedDocSejour } from './sejour'

function fmtTaille(n) {
  const x = Number(n) || 0
  if (x < 1024) return `${x} o`
  if (x < 1024 * 1024) return `${Math.round(x / 1024)} ko`
  return `${(x / (1024 * 1024)).toFixed(1)} Mo`
}

function collecterDocs(mission) {
  const m = mission || {}
  const out = []
  const push = (docs, lieu) => {
    for (const d of (Array.isArray(docs) ? docs : [])) {
      if (!d?.path) continue
      out.push({ ...d, lieu })
    }
  }
  push(m.base_docs, 'Base de départ')
  push(m.pec_docs, 'Prise en charge')
  push(m.dest_docs, m.dest_nom ? `Destination · ${m.dest_nom}` : 'Destination')
  push(m.ne_pas_reanimer_docs, 'Ne pas réanimer')
  for (const a of (Array.isArray(m.activites_sur_place) ? m.activites_sur_place : [])) {
    push(a.documents, a.nom ? `Activité · ${a.nom}` : 'Activité sur place')
  }
  for (const l of lieuxAnnexes(m)) {
    const nom = (l.nom || '').trim() || lblTypeLieu(l.type)
    push(l.documents, `Séjour · ${nom}`)
  }
  return out
}

export default function DocumentsMission({ souhaitId, onBack }) {
  const [docs, setDocs] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const { data, error } = await supabase.from('souhaits')
        .select('mission')
        .eq('id', souhaitId)
        .maybeSingle()
      if (cancel) return
      if (error || !data) { setErr(error?.message || 'Documents inaccessibles.'); setDocs([]); return }
      setDocs(collecterDocs(data.mission))
    })()
    return () => { cancel = true }
  }, [souhaitId])

  async function ouvrir(d) {
    try {
      const url = await signedDocSejour(d.path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErr(e.message || 'Document inaccessible.')
    }
  }

  if (docs == null) return <div style={{ padding: 16 }}><Loading /></div>

  return (
    <div style={{ padding: '12px 14px 40px' }}>
      {onBack && <Btn kind="soft" onClick={onBack}>← Menu de la mission</Btn>}
      <h1 style={{ fontSize: '1.45rem', color: 'var(--heading)', margin: '12px 0 4px' }}>Tous les documents</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        Plans, confirmations, documents médicaux liés à cette mission.
      </p>
      {err && <Flash kind="err">{err}</Flash>}
      {docs.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Aucun document joint pour le moment.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map((d, i) => (
          <div
            key={(d.id || d.path) + i}
            style={{
              display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center',
              border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', background: 'var(--card)',
            }}
          >
            <button
              type="button"
              onClick={() => ouvrir(d)}
              style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 600 }}
            >
              {d.nom || 'Document'}
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 400 }}>
                {d.lieu}{d.size ? ` · ${fmtTaille(d.size)}` : ''}
              </div>
            </button>
            <Btn kind="soft" onClick={() => ouvrir(d)}>Ouvrir</Btn>
          </div>
        ))}
      </div>
    </div>
  )
}
