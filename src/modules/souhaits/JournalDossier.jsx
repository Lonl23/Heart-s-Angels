import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui'

const LIB = { entree: 'Entrée', sortie: 'Sortie', modification: 'Modification' }

function heure(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function JournalDossier({ souhaitId }) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (!souhaitId) return
    supabase.from('souhait_journal').select('id,personne,action,detail,created_at')
      .eq('souhait_id', souhaitId).order('created_at', { ascending: false }).limit(80)
      .then(({ data }) => setRows(data || []))
  }, [souhaitId])
  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 10 }}>Journal</div>
      {rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune trace.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
            <div>
              <strong>{LIB[r.action] || r.action}</strong>
              {r.personne ? ` · ${r.personne}` : ''}
              {r.action === 'modification' && Array.isArray(r.detail?.cles) && r.detail.cles.length
                ? <span style={{ color: 'var(--text-muted)' }}> — {r.detail.cles.join(', ')}</span>
                : null}
            </div>
            <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{heure(r.created_at)}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
