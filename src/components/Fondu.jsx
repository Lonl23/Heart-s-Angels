import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useOutlet, Routes } from 'react-router-dom'
import { DUREE_FONDU_MS, motionReduite, mondeEcran, cleCouche } from '@/lib/transitionEcran'

function FondVide() {
  return <div style={{ minHeight: '100%', flex: 1, background: 'var(--bg)' }} aria-hidden />
}

function finFondu(onFin) {
  return e => {
    if (e.target !== e.currentTarget) return
    if (e.animationName && e.animationName !== 'ha-fondu-in') return
    onFin()
  }
}

function liberer(setSortant, prevKey) {
  setSortant(s => (s && s.key === prevKey ? null : s))
}

/**
 * Fondu enchaîné login ↔ app (et tout changement hors menu interne).
 * L’écran sortant reste monté en dessous ; le nouveau fond de 0 à 1 par-dessus.
 * Pas de frame vide : on ne passe jamais par opacity 0 sans contenu dessous.
 */
export function RoutesAvecFondu({ children }) {
  const location = useLocation()
  const live = useRef(location)
  const [sortant, setSortant] = useState(null)
  const [, bump] = useState(0)

  useLayoutEffect(() => {
    if (location.key === live.current.key) return

    const skip = motionReduite()
      || (mondeEcran(location.pathname) === 'app' && mondeEcran(live.current.pathname) === 'app')

    const prev = live.current
    live.current = location

    if (skip) {
      setSortant(null)
      bump(n => n + 1)
      return
    }

    setSortant(prev)
    bump(n => n + 1)
    const t = setTimeout(() => liberer(setSortant, prev.key), DUREE_FONDU_MS + 80)
    return () => clearTimeout(t)
  }, [location.key])

  const enCours = !!(sortant && sortant.key !== live.current.key)

  return (
    <div className={'ha-fondu-pile' + (enCours ? ' is-cross' : '')}>
      {enCours && (
        <div key={cleCouche(sortant)} className="ha-fondu-calque is-under" aria-hidden>
          <Suspense fallback={null}>
            <Routes location={sortant}>{children}</Routes>
          </Suspense>
        </div>
      )}
      <div
        key={cleCouche(live.current)}
        className={'ha-fondu-calque' + (enCours ? ' is-in' : '')}
        onAnimationEnd={enCours ? finFondu(() => liberer(setSortant, sortant.key)) : undefined}
      >
        <Suspense fallback={enCours ? null : <FondVide />}>
          <Routes location={live.current}>{children}</Routes>
        </Suspense>
      </div>
    </div>
  )
}

/** Fondu du contenu (menu latéral inchangé) entre les pages de l’espace interne. */
export function SortieFondu() {
  const location = useLocation()
  const outlet = useOutlet()
  const live = useRef({ key: location.key, node: outlet })
  const [sortant, setSortant] = useState(null)
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
      bump(n => n + 1)
      return
    }

    setSortant(prev)
    bump(n => n + 1)
    const t = setTimeout(() => liberer(setSortant, prev.key), DUREE_FONDU_MS + 80)
    return () => clearTimeout(t)
  }, [location.key])

  const enCours = !!(sortant && sortant.key !== live.current.key)

  return (
    <div className={'ha-fondu-pile ha-fondu-page' + (enCours ? ' is-cross' : '')}>
      {enCours && (
        <div key={sortant.key} className="ha-fondu-calque is-under" aria-hidden>
          <Suspense fallback={null}>{sortant.node}</Suspense>
        </div>
      )}
      <div
        key={live.current.key}
        className={'ha-fondu-calque' + (enCours ? ' is-in' : '')}
        onAnimationEnd={enCours ? finFondu(() => liberer(setSortant, sortant.key)) : undefined}
      >
        <Suspense fallback={enCours ? null : <FondVide />}>
          {live.current.node}
        </Suspense>
      </div>
    </div>
  )
}
