import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, Logo } from '@/components/ui'
import { FondEcran } from '@/hooks/useFondPage'
import {
  chargerFacteurs, besoinDefi, verifierTotp, verifierEmail,
  demanderCodeEmail, desactiverEmail, enrolerTotp, retirerTotp, annulerEnrollement,
} from '@/lib/deuxFacteurs'
import {
  biométrieDispo, enrolerBiometrie, verifierBiometrie, retirerBiometrie, nomAppareil,
} from '@/lib/webauthn'
import {
  activiteFraiche, poserConfiance, doitDeverrouillerBio, estDeverrouilleMemoire,
  marquerDeverrouilleMemoire,
} from '@/lib/sessionApp'

function ChampCode({ value, set, autoFocus }) {
  return (
    <input
      value={value}
      onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      maxLength={6}
      aria-label="Code à 6 chiffres"
      style={{
        width:'100%', boxSizing:'border-box', padding:'12px 14px', borderRadius:10,
        border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)',
        fontSize:22, letterSpacing:'.35em', textAlign:'center', fontFamily:'inherit',
      }}
    />
  )
}

export function PorteDeuxFacteurs({ children }) {
  const { signOut, user } = useAuth()
  const [etat, setEtat] = useState('chargement')
  const [facteurs, setFacteurs] = useState(null)

  function entrer() {
    if (user?.id) poserConfiance(user.id)
    else marquerDeverrouilleMemoire()
    setEtat('ok')
  }

  async function evaluer() {
    const f = await chargerFacteurs()
    if (f.erreur) { setEtat('erreur'); setFacteurs(f); return }
    setFacteurs(f)
    if (!f.totp || !f.emailActif) { setEtat('configurer'); return }

    const bioDispo = biométrieDispo()
    const confiance = activiteFraiche(user?.id)

    // Reprise < 48 h + biométrie sur cet appareil → déverrouiller (pas de mot de passe).
    if (confiance && doitDeverrouillerBio({ webauthnActif: f.webauthnActif, bioDispo })) {
      setEtat('deverrouiller')
      return
    }

    // Reprise < 48 h sans biométrie (ou déjà déverrouillé) → entrer directement.
    if (confiance) {
      entrer()
      return
    }

    // Première connexion / après expiration : défi 2FA (app, e-mail ou bio).
    const defi = besoinDefi({
      totpActif: true,
      aal2: f.aal2,
      emailActif: true,
      emailOk: f.emailOk,
      webauthnActif: f.webauthnActif,
      webauthnOk: f.webauthnOk,
    })
    if (defi) {
      setEtat('defi')
      return
    }
    entrer()
  }

  useEffect(() => { evaluer() }, [])

  if (etat === 'ok') return children
  if (etat === 'chargement') {
    return <div className="ha-shell" style={{ display:'grid', placeItems:'center', color:'var(--text-muted)', fontFamily:'DM Sans,sans-serif' }}>Chargement…</div>
  }
  return (
    <FondEcran page="login" style={{ display:'grid', placeItems:'center', minHeight:'100vh', padding:20 }}>
      <div style={{ width:'100%', maxWidth: etat === 'configurer' ? 460 : 380, background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'30px 26px' }}>
        <Logo size={100} style={{ margin:'0 auto 8px' }} />
        <h1 style={{ textAlign:'center', fontSize:'1.35rem', color:'var(--heading)', margin:'8px 0 6px' }}>
          {etat === 'configurer' ? 'Connexion en deux étapes'
            : etat === 'deverrouiller' ? 'Déverrouiller'
              : 'Vérification'}
        </h1>
        {etat === 'configurer' ? (
          <>
            <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, margin:'0 0 14px' }}>
              Activez l’application d’authentification et le code par e-mail. Ensuite, pendant 48 h, la biométrie suffit pour rouvrir l’app (sinon la session reste ouverte). Après 48 h sans utilisation : mot de passe + code.
            </p>
            <ReglageDeuxFacteurs obligatoire onMaj={f => { if (f?.totp && f?.emailActif) evaluer() }} />
          </>
        ) : etat === 'erreur' ? (
          <>
            <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5 }}>{facteurs?.erreur || 'Vérification impossible.'}</p>
            <Btn onClick={evaluer} style={{ width:'100%', marginTop:8 }}>Réessayer</Btn>
          </>
        ) : etat === 'deverrouiller' ? (
          <DeverrouillageBio
            onOk={() => { if (user?.id) poserConfiance(user.id); setEtat('ok') }}
            onSecours={() => setEtat('defi')}
          />
        ) : (
          <Defi facteurs={facteurs} onOk={async () => { await evaluer() }} apresSucces={() => { if (user?.id) poserConfiance(user.id) }} />
        )}
        <button type="button" onClick={() => signOut()} style={{ display:'block', width:'100%', marginTop:14, padding:8, background:'none', border:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
          Se déconnecter
        </button>
      </div>
    </FondEcran>
  )
}

function DeverrouillageBio({ onOk, onSecours }) {
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function lancer() {
    setErr(null); setBusy(true)
    const res = await verifierBiometrie()
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    onOk()
  }

  useEffect(() => { lancer() }, [])

  return (
    <div>
      <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, margin:'12px 0' }}>
        Moins de 48 h depuis la dernière utilisation — confirmez avec Face ID, l’empreinte ou Windows Hello.
      </p>
      <Btn onClick={lancer} disabled={busy} style={{ width:'100%' }}>
        {busy ? 'Vérification…' : 'Déverrouiller'}
      </Btn>
      {err && <div className="ha-flash ha-flash-err" style={{ marginTop:12 }}>{err}</div>}
      <button type="button" onClick={onSecours}
        style={{ display:'block', width:'100%', marginTop:12, padding:8, background:'none', border:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
        Utiliser un code à la place
      </button>
    </div>
  )
}

function Defi({ facteurs, onOk, apresSucces }) {
  const bioOk = !!facteurs.webauthnActif && biométrieDispo()
  const methodeInit = bioOk && !estDeverrouilleMemoire() ? 'bio' : (facteurs.totp ? 'totp' : 'email')
  const [methode, setMethode] = useState(methodeInit)
  const [code, setCode] = useState('')
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const choix = [
    bioOk ? ['bio', 'Biométrie'] : null,
    facteurs.totp ? ['totp', 'Code de l’application'] : null,
    facteurs.emailActif ? ['email', 'Code par e-mail'] : null,
  ].filter(Boolean)

  async function reussi() {
    apresSucces?.()
    await onOk()
  }

  async function lancerBio() {
    setErr(null); setInfo(null); setBusy(true)
    const res = await verifierBiometrie()
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    await reussi()
  }

  useEffect(() => {
    if (methodeInit === 'bio') lancerBio()
    // Une seule tentative auto au montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function valider(e) {
    e?.preventDefault()
    if (methode === 'bio') { await lancerBio(); return }
    setErr(null); setBusy(true)
    const res = methode === 'email'
      ? await verifierEmail(code, false)
      : await verifierTotp(facteurs.totp.id, code)
    setBusy(false)
    if (!res.ok) { setErr(res.erreur); return }
    setCode('')
    await reussi()
  }

  async function envoyer() {
    setErr(null); setInfo(null); setBusy(true)
    const res = await demanderCodeEmail()
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    setInfo('Code envoyé. Il est valable 10 minutes.')
  }

  return (
    <form onSubmit={valider}>
      {choix.length > 1 && (
        <div style={{ display:'flex', gap:8, margin:'12px 0', flexWrap:'wrap' }}>
          {choix.map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setMethode(v); setErr(null); setCode(''); if (v === 'bio') lancerBio() }}
              style={{ flex:1, minWidth:110, padding:'8px 10px', borderRadius:9, cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit', border: methode === v ? 'none' : '1px solid var(--border)', background: methode === v ? 'var(--accent)' : 'var(--bg-alt)', color: methode === v ? '#fff' : 'var(--text-2)' }}>
              {l}
            </button>
          ))}
        </div>
      )}
      {methode === 'bio' ? (
        <>
          <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, margin:'12px 0' }}>
            Confirmez avec Face ID, l’empreinte ou Windows Hello.
          </p>
          <Btn onClick={lancerBio} disabled={busy} style={{ width:'100%' }}>
            {busy ? 'Vérification…' : 'Utiliser la biométrie'}
          </Btn>
        </>
      ) : (
        <>
          <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, margin:'12px 0' }}>
            {methode === 'email' ? 'Entrez le code reçu par e-mail.' : 'Entrez le code de l’application d’authentification.'}
          </p>
          {methode === 'email' && (
            <Btn kind="soft" onClick={envoyer} disabled={busy} style={{ width:'100%', marginBottom:12 }}>Recevoir un code par e-mail</Btn>
          )}
          <ChampCode value={code} set={setCode} autoFocus />
          <button type="submit" disabled={busy || code.length !== 6} style={{ width:'100%', marginTop:12, padding:12, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, opacity: code.length === 6 ? 1 : .6 }}>
            {busy ? 'Vérification…' : 'Vérifier'}
          </button>
        </>
      )}
      {info && <div className="ha-flash ha-flash-ok" style={{ marginTop:12 }}>{info}</div>}
      {err && <div className="ha-flash ha-flash-err" style={{ marginTop:12 }}>{err}</div>}
    </form>
  )
}

export function ReglageDeuxFacteurs({ obligatoire, onMaj }) {
  const [charge, setCharge] = useState(true)
  const [facteurs, setFacteurs] = useState(null)
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState(null)
  const [codeApp, setCodeApp] = useState('')
  const [codeEmail, setCodeEmail] = useState('')
  const [emailSaisi, setEmailSaisi] = useState(false)
  const [confirmerRetrait, setConfirmerRetrait] = useState(null)

  async function recharger() {
    const f = await chargerFacteurs()
    setFacteurs(f)
    setCharge(false)
    if (f.erreur) setErr(f.erreur)
    onMaj?.(f)
  }

  useEffect(() => { recharger() }, [])

  async function activerApp() {
    setErr(null); setInfo(null); setBusy(true)
    const res = await enrolerTotp()
    setBusy(false)
    if (!res.ok) { setErr(res.erreur); return }
    setQr(res)
    setCodeApp('')
  }

  async function confirmerApp(e) {
    e?.preventDefault()
    if (!qr) return
    setErr(null); setBusy(true)
    const res = await verifierTotp(qr.factorId, codeApp)
    setBusy(false)
    if (!res.ok) { setErr(res.erreur); return }
    setQr(null); setCodeApp(''); setInfo('Application d’authentification activée.')
    await recharger()
  }

  async function annulerApp() {
    setBusy(true)
    await annulerEnrollement(qr?.factorId)
    setQr(null); setCodeApp(''); setBusy(false)
  }

  async function retirerApp() {
    if (!facteurs?.totp) return
    setErr(null); setBusy(true)
    const res = await retirerTotp(facteurs.totp.id)
    setBusy(false)
    setConfirmerRetrait(null)
    if (!res.ok) { setErr(res.erreur); return }
    setInfo('Application retirée.')
    await recharger()
  }

  async function envoyerEmail() {
    setErr(null); setInfo(null); setBusy(true)
    const res = await demanderCodeEmail()
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    setEmailSaisi(true)
    setInfo('Code envoyé sur votre adresse de connexion.')
  }

  async function confirmerEmail(e) {
    e?.preventDefault()
    setErr(null); setBusy(true)
    const res = await verifierEmail(codeEmail, true)
    setBusy(false)
    if (!res.ok) { setErr(res.erreur); return }
    setEmailSaisi(false); setCodeEmail(''); setInfo('Code par e-mail activé.')
    await recharger()
  }

  async function retirerEmail() {
    setErr(null); setBusy(true)
    const res = await desactiverEmail()
    setBusy(false)
    setConfirmerRetrait(null)
    if (!res.ok) { setErr(res.erreur); return }
    setEmailSaisi(false); setInfo('Code par e-mail retiré.')
    await recharger()
  }

  async function activerBio() {
    setErr(null); setInfo(null); setBusy(true)
    const res = await enrolerBiometrie(nomAppareil())
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    setInfo('Biométrie activée sur cet appareil. Elle remplace le code à la connexion.')
    await recharger()
  }

  async function retirerBio(id) {
    setErr(null); setBusy(true)
    const res = await retirerBiometrie(id)
    setBusy(false)
    setConfirmerRetrait(null)
    if (!res.ok) { setErr(res.error); return }
    setInfo('Biométrie retirée.')
    await recharger()
  }

  const totpOn = !!facteurs?.totp
  const emailOn = !!facteurs?.emailActif
  const bioOn = !!facteurs?.webauthnActif
  const appareils = Array.isArray(facteurs?.appareils) ? facteurs.appareils : []
  const bioDispo = biométrieDispo()
  const basePret = totpOn && emailOn

  return (
    <Card style={{ marginBottom:14, breakInside:'avoid', WebkitColumnBreakInside:'avoid' }}>
      {!obligatoire && <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Connexion en deux étapes</div>}
      {charge ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Chargement…</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Bloc
            titre="Application d’authentification"
            etat={totpOn ? 'Activée' : 'Non activée'}
            on={totpOn}
          >
            {qr ? (
              <form onSubmit={confirmerApp} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {qr.qr && <img src={qr.qr} alt="QR code à scanner" style={{ width:180, height:180, alignSelf:'center', background:'#fff', borderRadius:8 }} />}
                {qr.secret && (
                  <div style={{ fontSize:12, color:'var(--text-2)', wordBreak:'break-all' }}>
                    Saisie manuelle : <strong>{qr.secret}</strong>
                  </div>
                )}
                <ChampCode value={codeApp} set={setCodeApp} />
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <Btn type="submit" disabled={busy || codeApp.length !== 6}>Confirmer</Btn>
                  <Btn kind="soft" onClick={annulerApp} disabled={busy}>Annuler</Btn>
                </div>
              </form>
            ) : confirmerRetrait === 'totp' ? (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Btn kind="danger" onClick={retirerApp} disabled={busy}>Confirmer le retrait</Btn>
                <Btn kind="soft" onClick={() => setConfirmerRetrait(null)}>Annuler</Btn>
              </div>
            ) : totpOn && obligatoire ? null : (
              <Btn kind={totpOn ? 'soft' : 'primary'} onClick={totpOn ? () => setConfirmerRetrait('totp') : activerApp} disabled={busy}>
                {totpOn ? 'Retirer' : 'Activer'}
              </Btn>
            )}
          </Bloc>

          <Bloc titre="Code par e-mail" etat={emailOn ? 'Activé' : 'Non activé'} on={emailOn}>
            {emailSaisi ? (
              <form onSubmit={confirmerEmail} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <ChampCode value={codeEmail} set={setCodeEmail} />
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <Btn type="submit" disabled={busy || codeEmail.length !== 6}>Confirmer</Btn>
                  <Btn kind="soft" onClick={() => { setEmailSaisi(false); setCodeEmail('') }} disabled={busy}>Annuler</Btn>
                </div>
              </form>
            ) : confirmerRetrait === 'email' ? (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Btn kind="danger" onClick={retirerEmail} disabled={busy}>Confirmer le retrait</Btn>
                <Btn kind="soft" onClick={() => setConfirmerRetrait(null)}>Annuler</Btn>
              </div>
            ) : emailOn && obligatoire ? null : (
              <Btn kind={emailOn ? 'soft' : 'primary'} onClick={emailOn ? () => setConfirmerRetrait('email') : envoyerEmail} disabled={busy}>
                {emailOn ? 'Retirer' : 'Activer'}
              </Btn>
            )}
          </Bloc>

          {!obligatoire && (
            <Bloc
              titre="Biométrie (Face ID, empreinte, Windows Hello)"
              etat={!bioDispo ? 'Indisponible ici' : bioOn ? 'Activée' : 'Non activée'}
              on={bioOn}
            >
              <p style={{ fontSize:12.5, color:'var(--text-muted)', margin:'0 0 8px' }}>
                Sur cet appareil, la biométrie remplace le code à chaque connexion. L’application et l’e-mail restent disponibles en secours.
              </p>
              {!bioDispo ? (
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Ce navigateur ne propose pas d’authentification biométrique.</div>
              ) : !basePret ? (
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Activez d’abord l’application et le code par e-mail.</div>
              ) : (
                <>
                  {appareils.length > 0 && (
                    <ul style={{ margin:'0 0 10px', padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
                      {appareils.map(a => (
                        <li key={a.id} style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', fontSize:13 }}>
                          <span>{a.device_name || 'Appareil'}</span>
                          {confirmerRetrait === `bio:${a.id}` ? (
                            <span style={{ display:'flex', gap:6 }}>
                              <Btn kind="danger" onClick={() => retirerBio(a.id)} disabled={busy}>Confirmer</Btn>
                              <Btn kind="soft" onClick={() => setConfirmerRetrait(null)}>Annuler</Btn>
                            </span>
                          ) : (
                            <Btn kind="soft" onClick={() => setConfirmerRetrait(`bio:${a.id}`)} disabled={busy}>Retirer</Btn>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Btn kind={bioOn ? 'soft' : 'primary'} onClick={activerBio} disabled={busy}>
                    {bioOn ? 'Ajouter cet appareil' : 'Activer sur cet appareil'}
                  </Btn>
                </>
              )}
            </Bloc>
          )}

          {info && <div className="ha-flash ha-flash-ok">{info}</div>}
          {err && <div className="ha-flash ha-flash-err">{err}</div>}
        </div>
      )}
    </Card>
  )
}

function Bloc({ titre, etat, on, children }) {
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'baseline', marginBottom:8 }}>
        <div style={{ fontSize:13.5, color:'var(--text)' }}>{titre}</div>
        <div style={{ fontSize:12, fontWeight:700, color: on ? '#3B6D11' : 'var(--text-muted)' }}>{etat}</div>
      </div>
      {children}
    </div>
  )
}
