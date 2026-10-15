import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { COPYRIGHT } from '@/copyright'
import { lbl, inp, Logo } from '@/components/ui'
import { FondEcran } from '@/hooks/useFondPage'
import { EnrollTotp } from '@/components/SecuriteMfa'

export default function ChallengeMfa({ enrollRequired }) {
  const { signOut, rafraichirMfa } = useAuth()
  const [code, setCode] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function verifier(e) {
    e.preventDefault()
    setErr(null)
    const digits = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(digits)) { setErr('Entrez le code à 6 chiffres.'); return }
    setBusy(true)
    const { data: factors, error: e1 } = await supabase.auth.mfa.listFactors()
    if (e1) { setBusy(false); setErr(e1.message); return }
    const totp = (factors?.totp || []).find(f => f.status === 'verified')
    if (!totp) { setBusy(false); setErr('Aucun appareil 2FA trouvé. Reconnectez-vous.'); return }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: digits })
    setBusy(false)
    if (error) { setErr('Code incorrect ou expiré. Réessayez avec un nouveau code.'); return }
    await rafraichirMfa?.()
  }

  return (
    <FondEcran page="login" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 26px' }}>
        <Logo size={120} style={{ margin: '0 auto 12px' }} />
        {enrollRequired ? (
          <>
            <h1 style={{ fontSize: '1.25rem', color: 'var(--heading)', margin: '0 0 8px', textAlign: 'center' }}>Double authentification obligatoire</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5, margin: '0 0 14px', textAlign: 'center', lineHeight: 1.45 }}>
              L’ASBL exige un code 2FA pour le personnel. Scannez le QR code, puis entrez le code à 6 chiffres.
            </p>
            <EnrollTotp obligatoire onActive={() => rafraichirMfa?.()} />
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '1.25rem', color: 'var(--heading)', margin: '0 0 8px', textAlign: 'center' }}>Code de vérification</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5, margin: '0 0 14px', textAlign: 'center', lineHeight: 1.45 }}>
              Entrez le code à 6 chiffres de votre application d’authentification (Google Authenticator, Aegis…).
            </p>
            <form onSubmit={verifier} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              <button type="submit" disabled={busy} style={{ padding: 12, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
                {busy ? 'Vérification…' : 'Valider'}
              </button>
            </form>
          </>
        )}
        <button type="button" onClick={signOut} style={{ display: 'block', width: '100%', marginTop: 12, padding: 8, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
          Se déconnecter
        </button>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--text-faint)', marginTop: 10 }}>{COPYRIGHT}</div>
      </div>
    </FondEcran>
  )
}
