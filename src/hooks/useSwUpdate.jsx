import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CapacitorHttp } from '@capacitor/core'
import { estNatif } from '@/lib/native'
import config from '@/app.config'

const SwUpdateContext = createContext(null)

const HOUR_MS = 60 * 60 * 1000
const FLASH_MS = 2800

function whenLoaded(fn) {
  if (document.readyState === 'complete') fn()
  else window.addEventListener('load', fn, { once: true })
}

function versionUrl() {
  const base = String(config.domaine || '').replace(/\/$/, '')
  return `${base}/native-version.json?t=${Date.now()}`
}

function apkDownloadUrl(remote) {
  if (remote?.apkUrl) return remote.apkUrl
  const base = String(config.domaine || '').replace(/\/$/, '')
  const file = remote?.apk || 'Heart-s-Angels.apk'
  return `${base}/${file}`
}

export function SwUpdateProvider({ children }) {
  const [updateReady, setUpdateReady] = useState(false)
  const [upToDateFlash, setUpToDateFlash] = useState(false)
  const [checking, setChecking] = useState(false)
  const [nativeUpdate, setNativeUpdate] = useState(false)
  const regRef = useRef(null)
  const applyingRef = useRef(false)
  const flashTimer = useRef(null)
  const apkUrlRef = useRef('')

  function markWaiting(worker) {
    if (!worker || !navigator.serviceWorker.controller) return
    setUpdateReady(true)
  }

  function watchWorker(worker) {
    if (!worker) return
    if (worker.state === 'installed') markWaiting(worker)
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') markWaiting(worker)
    })
  }

  async function checkNative(manual) {
    const base = String(config.domaine || '').replace(/\/$/, '')
    if (!base) {
      if (manual) flashUpToDate()
      return
    }
    try {
      const { App } = await import('@capacitor/app')
      const info = await App.getInfo()
      const local = Number(info.build) || 0
      const res = await CapacitorHttp.get({
        url: versionUrl(),
        headers: { Accept: 'application/json' },
      })
      if (res.status < 200 || res.status >= 300) throw new Error('version')
      const remote = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      if (Number(remote?.versionCode) > local) {
        apkUrlRef.current = apkDownloadUrl(remote)
        setNativeUpdate(true)
        setUpdateReady(true)
      } else if (manual) {
        flashUpToDate()
      }
    } catch {
      if (manual) flashUpToDate()
    }
  }

  useEffect(() => {
    if (estNatif()) {
      let cancelled = false
      let interval
      function onVisible() {
        if (document.visibilityState === 'visible') checkNative(false)
      }
      checkNative(false)
      interval = setInterval(() => { if (!cancelled) checkNative(false) }, HOUR_MS)
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        cancelled = true
        clearInterval(interval)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }

    if (!('serviceWorker' in navigator)) return
    let cancelled = false
    let interval

    function onControllerChange() {
      if (applyingRef.current) window.location.reload()
    }
    function onVisible() {
      if (document.visibilityState === 'visible') {
        regRef.current?.update().catch(() => {})
      }
    }
    function onFocus() {
      regRef.current?.update().catch(() => {})
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)

    whenLoaded(() => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        if (cancelled) return
        regRef.current = reg
        watchWorker(reg.installing)
        if (reg.waiting) markWaiting(reg.waiting)
        reg.addEventListener('updatefound', () => watchWorker(reg.installing))
        reg.update().catch(() => {})
        interval = setInterval(() => { reg.update().catch(() => {}) }, HOUR_MS)
      }).catch(() => {})
    })

    return () => {
      cancelled = true
      clearInterval(interval)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  function flashUpToDate() {
    setUpToDateFlash(true)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setUpToDateFlash(false), FLASH_MS)
  }

  async function applyUpdate() {
    if (estNatif()) {
      const url = apkUrlRef.current
      if (!url) return
      try {
        const { App } = await import('@capacitor/app')
        await App.openUrl({ url })
      } catch {
        window.open(url, '_blank')
      }
      return
    }
    const waiting = regRef.current?.waiting
    if (!waiting) {
      window.location.reload()
      return
    }
    applyingRef.current = true
    waiting.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(() => { if (applyingRef.current) window.location.reload() }, 1500)
  }

  async function checkForUpdate() {
    if (estNatif()) {
      setChecking(true)
      await checkNative(true)
      setChecking(false)
      return
    }
    const reg = regRef.current
    if (!reg) { flashUpToDate(); return }
    setChecking(true)
    try {
      await reg.update()
      if (reg.installing) {
        await new Promise(resolve => {
          const w = reg.installing
          const done = () => resolve()
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' || w.state === 'activated' || w.state === 'redundant') done()
          })
          setTimeout(done, 8000)
        })
      }
      if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true)
      else flashUpToDate()
    } catch {
      flashUpToDate()
    }
    setChecking(false)
  }

  const value = useMemo(
    () => ({ updateReady, checking, applyUpdate, checkForUpdate }),
    [updateReady, checking],
  )

  return (
    <SwUpdateContext.Provider value={value}>
      {children}
      {updateReady && (
        <div className="ha-update-banner" role="status" aria-live="polite">
          <span>{nativeUpdate ? "Une nouvelle version de l'application est disponible" : 'Une mise à jour est disponible'}</span>
          <button type="button" onClick={applyUpdate}>{nativeUpdate ? 'Installer' : 'Mettre à jour'}</button>
        </div>
      )}
      {!updateReady && upToDateFlash && (
        <div className="ha-update-flash" role="status" aria-live="polite">Vous êtes à jour</div>
      )}
    </SwUpdateContext.Provider>
  )
}

export function useSwUpdate() {
  const ctx = useContext(SwUpdateContext)
  if (!ctx) throw new Error('useSwUpdate doit être utilisé dans <SwUpdateProvider>')
  return ctx
}
