import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useOutlet, Routes } from 'react-router-dom'
import { DUREE_FONDU_MS, motionReduite, mondeEcran, cleCouche } from '@/lib/transitionEcran'

function FondVide() {
  return <div style={{ minHeight: '100%', flex: 1, background: 'var(--bg)' }} aria-hidden />
}

function SignalPret({ onPret, children }) {
  const cb = useRef(onPret)
  cb.current = onPret
  useLayoutEffect(() => { cb.current() }, [])
  return children
}

function finFondu(onFin) {
  return e => {
    if (e.target !== e.currentTarget) return
    if (e.animationName && e.animationName !== 'ha-fondu-out') return
    onFin()
  }
}

function liberer(setSortant, prevKey) {
  setSortant(s => (s && s.key === prevKey ? null : s))
}

/**
 * Pile : la nouvelle page est déjà peinte en dessous (opacity 1).
 * L’ancienne reste au-dessus et fond de 1 à 0 — on voit l’écran actuel
 * se dissoudre, jamais les deux UIs l’un sur l’autre.
 */
function Pile({ className, enCours, revele, sortantKey, sortantChildren, liveKey, liveChildren, onPret, onFin }) {
  return (
    <div className={'ha-fondu-pile' + (className ? ' ' + className : '') + (enCours ? ' is-cross' : '')}>
      <div key={liveKey} className="ha-fondu-calque">
        <Suspense fallback={enCours ? null : <FondVide />}>
          {enCours
            ? <SignalPret onPret={onPret}>{liveChildren}</SignalPret>
            : liveChildren}
        </Suspense>
      </div>
      {enCours && (
        <div
          key={sortantKey}
          className={'ha-fondu-calque ' + (revele ? 'is-out' : 'is-cover')}
          aria-hidden
          onAnimationEnd={revele ? finFondu(onFin) : undefined}
        >
          <Suspense fallback={null}>{sortantChildren}</Suspense>
        </div>
      )}
    </div>
  )
}

/** Fondu login ↔ app (et tout changement hors menu interne). */
export function RoutesAvecFondu({ children }) {
  const location = useLocation()
  const live = useRef(location)
  const [sortant, setSortant] = useState(null)
  const [revele, setRevele] = useState(false)
  const [, bump] = useState(0)

  useLayoutEffect(() => {
    if (location.key === live.current.key) return

    const skip = motionReduite()
      || (mondeEcran(location.pathname) === 'app' && mondeEcran(live.current.pathname) === 'app')

    const prev = live.current
    live.current = location

    if (skip) {
      setSortant(null)
      setRevele(false)
      bump(n => n + 1)
      return
    }

    setSortant(prev)
    setRevele(false)
    bump(n => n + 1)
    const t = setTimeout(() => liberer(setSortant, prev.key), DUREE_FONDU_MS + 200)
    return () => clearTimeout(t)
  }, [location.key])

  const enCours = !!(sortant && sortant.key !== live.current.key)

  return (
    <Pile
      enCours={enCours}
      revele={revele}
      sortantKey={enCours ? cleCouche(sortant) : undefined}
      sortantChildren={enCours ? <Routes location={sortant}>{children}</Routes> : null}
      liveKey={cleCouche(live.current)}
      liveChildren={<Routes location={live.current}>{children}</Routes>}
      onPret={() => setRevele(true)}
      onFin={() => sortant && liberer(setSortant, sortant.key)}
    />
  )
}

/** Fondu du contenu (menu latéral inchangé) entre les pages de l’espace interne. */
export function SortieFondu() {
  const location = useLocation()
  const outlet = useOutlet()
  const live = useRef({ key: location.key, node: outlet })
  const [sortant, setSortant] = useState(null)
  const [revele, setRevele] = useState(false)
  const [, bump] = useState(0)

  if (live.current.key === location.key) {
    live.current.node = outlet
  }

  useLayoutEffect(() => {
    if (location.key === live.current.key) return

    const prev = live.current
    live.current = { key: location.key, node: outlet }

    if (motionReduite()) {
      setSortant(null)
      setRevele(false)
      bump(n => n + 1)
      return
    }

    setSortant(prev)
    setRevele(false)
    bump(n => n + 1)
    const t = setTimeout(() => liberer(setSortant, prev.key), DUREE_FONDU_MS + 200)
    return () => clearTimeout(t)
  }, [location.key])

  const enCours = !!(sortant && sortant.key !== live.current.key)

  return (
    <Pile
      className="ha-fondu-page"
      enCours={enCours}
      revele={revele}
      sortantKey={enCours ? sortant.key : undefined}
      sortantChildren={enCours ? sortant.node : null}
      liveKey={live.current.key}
      liveChildren={live.current.node}
      onPret={() => setRevele(true)}
      onFin={() => sortant && liberer(setSortant, sortant.key)}
    />
  )
}
