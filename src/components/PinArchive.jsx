import { useState } from 'react'
import { Btn, lbl, inp } from '@/components/ui'
import { PIN_REGLES, chiffresPin, validerPinArchive } from '@/lib/pinArchive'

export function ChampPin({ label, value, set }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={lbl}>{label} *</label>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        value={value}
        onChange={e => set(chiffresPin(e.target.value))}
        placeholder="•••••"
        style={{ ...inp, letterSpacing: 6, fontFamily: 'ui-monospace, monospace' }}
      />
    </div>
  )
}

export function FormPinFiche({ aPin, onSauver, saving, msg }) {
  const [ancien, setAncien] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const err = validerPinArchive(pin)
  const mismatch = pin.length === 5 && confirm.length === 5 && pin !== confirm
  const disabled = saving || !!err || pin !== confirm || pin.length !== 5 || (aPin && ancien.length !== 5)

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.45 }}>
        {aPin
          ? 'Vous avez déjà un code. Pour le changer, indiquez l’ancien puis le nouveau.'
          : 'Créez un code personnel à 5 chiffres. Il servira à ouvrir un souhait réalisé verrouillé (un mois calendrier après sa réalisation).'}
        {' '}{PIN_REGLES}
      </div>
      {aPin && <ChampPin label="Ancien code" value={ancien} set={setAncien} />}
      <ChampPin label={aPin ? 'Nouveau code' : 'Code PIN'} value={pin} set={setPin} />
      <ChampPin label="Confirmer le code" value={confirm} set={setConfirm} />
      {pin.length === 5 && err && <div style={{ fontSize: 12.5, color: '#A32D2D', marginBottom: 8 }}>{err}</div>}
      {mismatch && <div style={{ fontSize: 12.5, color: '#A32D2D', marginBottom: 8 }}>Les deux codes ne correspondent pas.</div>}
      {msg && <div style={{ fontSize: 12.5, color: msg.ok ? '#3B6D11' : '#A32D2D', marginBottom: 8 }}>{msg.t}</div>}
      <Btn
        disabled={disabled}
        onClick={async () => {
          const ok = await onSauver({ pin, ancien: aPin ? ancien : null })
          if (ok) { setAncien(''); setPin(''); setConfirm('') }
        }}
      >
        {saving ? 'Enregistrement…' : (aPin ? 'Changer le code' : 'Enregistrer le code')}
      </Btn>
    </div>
  )
}

export function FormPinOuverture({ onOuvrir, saving, msg, aPin }) {
  const [pin, setPin] = useState('')
  return (
    <div>
      {!aPin && (
        <div style={{ fontSize: 13.5, color: '#A32D2D', marginBottom: 10 }}>
          Créez d’abord votre code PIN dans votre fiche volontaire.
        </div>
      )}
      <ChampPin label="Code PIN (5 chiffres)" value={pin} set={setPin} />
      {msg && <div style={{ fontSize: 12.5, color: msg.ok ? '#3B6D11' : '#A32D2D', marginBottom: 8 }}>{msg.t}</div>}
      <Btn disabled={saving || pin.length !== 5 || !aPin} onClick={() => onOuvrir(pin)}>
        {saving ? 'Vérification…' : 'Ouvrir le dossier'}
      </Btn>
    </div>
  )
}
