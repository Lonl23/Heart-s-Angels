import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useOutlet, Routes } from 'react-router-dom'
import { DUREE_FONDU_MS, motionReduite, mondeEcran } from '@/lib/transitionEcran'

function FondVide() {
  return <div style={{ minHeight: '100%', flex: 1, background: 'var(--bg)' }} aria-hidden />
}

/** Garde l’écran précédent le temps du fondu sortant, puis affiche le nouveau. */
export function RoutesAvecFondu({ children }) {
  const location = useLocation()
  const hold = useRef(location)
  const latest = useRef(location)
  latest.current = location
  const [, setTick] = useState(0)

  const appInterne = mondeEcran(location.pathname) === 'app'
    && mondeEcran(hold.current.pathname) === 'app'

  if ((appInterne || motionReduite()) && hold.current.key !== location.key) {
    hold.current = location
  }

  useLayoutEffect(() => {
    if (location.key === hold.current.key) return
    const t = setTimeout(() => {
      hold.current = latest.current
      setTick(n => n + 1)
    }, DUREE_FONDU_MS)
    setTick(n => n + 1)
    return () => clearTimeout(t)
  }, [location.key])

  const stale = hold.current.key !== location.key
  return (
    <div className={'ha-fondu' + (stale ? ' is-out' : '')}>
      <Suspense fallback={<FondVide />}>
        <Routes location={hold.current}>{children}</Routes>
      </Suspense>
    </div>
  )
}

/** Fondu du contenu (menu latéral inchangé) entre les pages de l’espace interne. */
export function SortieFondu() {
  const location = useLocation()
  const outlet = useOutlet()
  const hold = useRef({ key: location.key, node: outlet })
  const latest = useRef({ key: location.key, node: outlet })
  latest.current = { key: location.key, node: outlet }
  const [, setTick] = useState(0)

  useLayoutEffect(() => {
    if (location.key === hold.current.key) {
      hold.current.node = outlet
      return
    }
    if (motionReduite()) {
      hold.current = { key: location.key, node: outlet }
      setTick(n => n + 1)
      return
    }
    const t = setTimeout(() => {
      hold.current = { key: latest.current.key, node: latest.current.node }
      setTick(n => n + 1)
    }, DUREE_FONDU_MS)
    setTick(n => n + 1)
    return () => clearTimeout(t)
  }, [location.key, outlet])

  const stale = hold.current.key !== location.key
  return (
    <div className={'ha-fondu ha-fondu-page' + (stale ? ' is-out' : '')}>
      <Suspense fallback={<FondVide />}>
        {stale ? hold.current.node : outlet}
      </Suspense>
    </div>
  )
}
