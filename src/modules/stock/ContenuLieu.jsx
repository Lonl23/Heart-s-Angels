import { useState } from 'react'
import { Btn, inp } from '@/components/ui'
import { lblLieu } from './stockSchema'
import { bornerQte, lignesUsage } from './usageLieu'

export default function ContenuLieu({ lieu, items, busy, onValider, onAnnuler }) {
  const [coches, setCoches] = useState({})
  const lignes = items || []
  const choisis = lignesUsage(coches)

  function basculer(it) {
    setCoches(s => {
      if (s[it.id] != null) {
        const next = { ...s }
        delete next[it.id]
        return next
      }
      return { ...s, [it.id]: bornerQte(1, it.qte_restante) }
    })
  }

  function quantite(it, valeur) {
    setCoches(s => ({ ...s, [it.id]: bornerQte(valeur, it.qte_restante) }))
  }

  const intro = lieu?.type === 'sac'
    ? 'Seulement le matériel en vrac dans ce sac. Cochez ce qui a été utilisé. Les dates restent à la logistique.'
    : 'Cochez ce qui a été utilisé. La logistique refera ensuite cette ' + (lieu?.type === 'kit' ? 'kit' : 'pochette') + '.'

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>
        {lieu?.nom} · {lblLieu(lieu?.type)}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>{intro}</div>
      {lignes.length === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 10 }}>
          Rien de rangé directement ici.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {lignes.map(it => {
            const on = coches[it.id] != null
            return (
              <div key={it.id}>
                <button
                  type="button"
                  disabled={busy}
                  className={'ha-check-btn' + (on ? ' is-on' : '')}
                  onClick={() => basculer(it)}
                >
                  <span className="ha-check-mark">{on ? '✓' : ''}</span>
                  <span>
                    <span style={{ display: 'block' }}>{it.nom}</span>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)' }}>
                      {Number(it.qte_restante)} {it.unite || 'en place'}
                    </span>
                  </span>
                </button>
                {on && it.mode !== 'durable' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 0 36px', fontSize: 13 }}>
                    Quantité utilisée
                    <input
                      type="number"
                      min="1"
                      max={Number(it.qte_restante)}
                      step="1"
                      value={coches[it.id]}
                      disabled={busy}
                      onChange={e => quantite(it, e.target.value)}
                      style={{ ...inp, width: 88, margin: 0 }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>sur {Number(it.qte_restante)}</span>
                  </label>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={() => onValider(choisis)} disabled={busy || choisis.length === 0}>
          {busy ? '…' : 'Enregistrer l’utilisation'}
        </Btn>
        <Btn kind="soft" onClick={onAnnuler}>Fermer</Btn>
      </div>
    </div>
  )
}
