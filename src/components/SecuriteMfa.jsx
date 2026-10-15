import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Card, inp, lbl } from '@/components/ui'

function facteurVerifie(liste) {
  return (liste?.totp || []).find(f => f.status === 'verified') || null
}

async function nettoyerNonVerifies() {
  const { data } = await supabase.auth.mfa.listFactors()
  const tous = [...(data?.all || []), ...(data?.totp || [])]
  const vus = new Set()
  for (const f of tous) {
    if (!f?.id || vus.has(f.id)) continue
    vus.add(f.id)
    if (f.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
  }
}

export function EnrollTotp({ onAnnuler, onActive, obligatoire }) {
  const [factorId, setFactorId] = useState('')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stop = false
    ;(async () => {
      await nettoyerNonVerifies()
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Heart’s Angels',
      })
      if (stop) return
      if (error) { setErr(error.message); return }
      setFactorId(data.id)
      const raw = data.totp?.qr_code || ''
      setQr(raw.startsWith('data:') ? raw : (raw ? `data:image/svg+xml;utf-8,${encodeURIComponent(raw)}` : ''))
      setSecret(data.totp?.secret || '')
    })()
    return () => { stop = true }
  }, [])

  async function valider(e) {
    e.preventDefault()
    setErr(null)
    const digits = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(digits)) { setErr('Entrez le code à 6 chiffres.'); return }
    if (!factorId) { setErr('QR code encore en cours de génération.'); return }
    setBusy(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: digits })
    setBusy(false)
    if (error) { setErr('Code incorrect ou expiré. Réessayez avec un nouveau code.'); return }
    onActive?.()
  }

  async function annuler() {
    if (factorId) {
      try { await supabase.auth.mfa.unenroll({ factorId }) } catch { /* ignore */ }
    }
    onAnnuler?.()
  }

  return (
    <div>
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.45, margin: '0 0 12px' }}>
        Scannez ce QR code avec Google Authenticator, Aegis ou une autre application TOTP, puis entrez le code à 6 chiffres.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        {qr
          ? <img src={qr} alt="QR code double authentification" style={{ width: 180, height: 180, background: '#fff', borderRadius: 12, padding: 8 }} />
          : <div style={{ width: 180, height: 180, borderRadius: 12, background: 'var(--bg-alt)' }} />}
      </div>
      {secret && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', margin: '0 0 12px' }}>
          Clé manuelle : <span style={{ fontFamily: 'ui-monospace, monospace' }}>{secret}</span>
        </p>
      )}
      <form onSubmit={valider} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={lbl}>Code à 6 chiffres</label>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
            style={{ ...inp, letterSpacing: 4, fontSize: 18, textAlign: 'center', fontFamily: 'ui-monospace, monospace' }}
          />
        </div>
        {err && <div className="ha-flash ha-flash-err" style={{ marginBottom: 0 }}>{err}</div>}
        <Btn type="submit" disabled={busy || !factorId} style={{ width: '100%' }}>{busy ? 'Vérification…' : 'Activer la double authentification'}</Btn>
        {!obligatoire && (
          <Btn kind="soft" onClick={annuler} style={{ width: '100%' }}>Annuler</Btn>
        )}
      </form>
    </div>
  )
}

export default function SecuriteMfa({ onChange }) {
  const [facteur, setFacteur] = useState(null)
  const [enroll, setEnroll] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)
  const [busy, setBusy] = useState(false)

  async function charger() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) { setErr(error.message); return }
    setFacteur(facteurVerifie(data))
  }

  useEffect(() => { charger() }, [])

  async function desactiver() {
    if (!facteur) return
    if (!confirm('Désactiver la double authentification ? Vous n’aurez plus besoin du code à la connexion.')) return
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: facteur.id })
    if (error) {
      setBusy(false)
      setErr(error.message.includes('aal')
        ? 'Reconnectez-vous avec le code 2FA pour pouvoir la désactiver.'
        : error.message)
      return
    }
    try { await supabase.auth.refreshSession() } catch { /* ignore */ }
    setBusy(false)
    setFacteur(null)
    setOk('Double authentification désactivée.')
    onChange?.()
  }

  return (
    <Card style={{ marginBottom: 14, breakInside: 'avoid', WebkitColumnBreakInside: 'avoid' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--heading)', marginBottom: 10 }}>Sécurité du compte</div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, margin: '0 0 12px' }}>
        Double authentification (2FA) : un code à 6 chiffres généré par Google Authenticator, Aegis ou une autre application. Optionnel, recommandé pour les administrateurs.
      </p>
      {ok && <div className="ha-flash ha-flash-ok" style={{ marginBottom: 10 }}>{ok}</div>}
      {err && <div className="ha-flash ha-flash-err" style={{ marginBottom: 10 }}>{err}</div>}
      {enroll ? (
        <EnrollTotp
          onAnnuler={() => setEnroll(false)}
          onActive={() => { setEnroll(false); setOk('Double authentification activée.'); charger(); onChange?.() }}
        />
      ) : facteur ? (
        <div>
          <div style={{ fontSize: 13.5, color: 'var(--text)', marginBottom: 10 }}>
            Activée sur cet appareil d’authentification{facteur.friendly_name ? ` (${facteur.friendly_name})` : ''}.
          </div>
          <Btn kind="danger" onClick={desactiver} disabled={busy}>{busy ? '…' : 'Désactiver la 2FA'}</Btn>
        </div>
      ) : (
        <Btn kind="soft" onClick={() => { setOk(null); setErr(null); setEnroll(true) }}>Activer la double authentification</Btn>
      )}
    </Card>
  )
}
