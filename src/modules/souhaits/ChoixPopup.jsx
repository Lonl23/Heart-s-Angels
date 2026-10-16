import { useState } from 'react'
import { Btn, F, Modal } from '@/components/ui'
import { commeListe } from './listesCliniques'

export function ChoixMultiple({ label, value, options, onChange, lecture, allowCustom = true }) {
  const [open, setOpen] = useState(false)
  const selected = commeListe(value)
  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <button
        type="button"
        disabled={lecture}
        onClick={() => setOpen(true)}
        style={{
          width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', cursor: lecture ? 'default' : 'pointer',
          fontFamily: 'inherit', color: 'var(--text)',
        }}
      >
        {selected.length ? selected.join(' · ') : '—'}
      </button>
      {open && (
        <PopupChoix
          title={label}
          options={options}
          selected={selected}
          allowCustom={allowCustom}
          onClose={() => setOpen(false)}
          onSave={next => { onChange(next); setOpen(false) }}
        />
      )}
    </div>
  )
}

function PopupChoix({ title, options, selected, allowCustom, onClose, onSave }) {
  const [cur, setCur] = useState(selected)
  const [libre, setLibre] = useState('')
  const connus = [...new Set([...(options || []), ...cur])]
  function toggle(opt) {
    setCur(list => list.includes(opt) ? list.filter(x => x !== opt) : [...list, opt])
  }
  function ajouterLibre() {
    const t = libre.trim()
    if (!t) return
    setCur(list => list.includes(t) ? list : [...list, t])
    setLibre('')
  }
  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={(
        <>
          <Btn kind="soft" onClick={onClose}>Annuler</Btn>
          <Btn onClick={() => onSave(cur)}>Valider</Btn>
        </>
      )}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {connus.map(opt => {
          const on = cur.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              style={{
                padding: '8px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 600, fontSize: 13.5,
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent)' : 'var(--card)',
                color: on ? '#fff' : 'var(--text)',
              }}
            >{on ? '✓ ' : ''}{opt}</button>
          )
        })}
      </div>
      {allowCustom && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <F label="Autre" value={libre} set={setLibre} />
          </div>
          <Btn kind="soft" onClick={ajouterLibre} style={{ marginBottom: 10 }}>Ajouter</Btn>
        </div>
      )}
    </Modal>
  )
}
