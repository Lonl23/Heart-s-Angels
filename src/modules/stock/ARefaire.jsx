import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Card } from '@/components/ui'
import { lblLieu } from './stockSchema'
import { jourFr } from './usageLieu'

export default function ARefaire({ onOk, onErr }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { charger() }, [])

  async function charger() {
    const { data, error } = await supabase.rpc('stock_a_refaire')
    if (error || data?.ok === false) return
    setItems(data?.items || [])
  }

  async function refait(lieuId, nom) {
    if (busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('stock_marquer_refait', { p_lieu: lieuId })
    setBusy(false)
    if (error || data?.ok === false) {
      onErr?.(error?.message || data?.error || 'Enregistrement refusé')
      return
    }
    onOk?.(nom + ' est marqué refait.')
    charger()
  }

  if (!items.length) return null

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Pochettes et kits à refaire</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
        L’équipage a noté l’utilisation, sans les dates. Remettez le contenu, avec les lots et les péremptions, puis marquez l’emplacement comme refait.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(it => (
          <div key={it.lieu_id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-alt)' }}>
            <div style={{ fontWeight: 700 }}>
              {it.nom} · {lblLieu(it.type)}
              {it.parent_nom ? ` · dans ${it.parent_nom}` : ''}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 6px' }}>
              {it.depuis ? `Utilisé depuis le ${jourFr(it.depuis)}` : 'À refaire'}
            </div>
            <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 14 }}>
              {(it.lignes || []).map((l, i) => (
                <li key={i}>{l.nom} −{Number(l.quantite)}</li>
              ))}
            </ul>
            <Btn onClick={() => refait(it.lieu_id, it.nom)} disabled={busy}>C’est refait</Btn>
          </div>
        ))}
      </div>
    </Card>
  )
}
