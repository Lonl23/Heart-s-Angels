import { useEffect, useRef, useState } from 'react'
import { Btn } from '@/components/ui'

function estMobile() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
    || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
}

function extraireToken(s) {
  const t = String(s || '').trim()
  const m = t.match(/ha:[ul]:[0-9a-f-]{8,}/i)
  return m ? m[0] : ''
}

function tokenComplet(s) {
  return /^ha:[ul]:[0-9a-f]{32}$/i.test(s) || /^ha:[ul]:[0-9a-f-]{36}$/i.test(s)
}

export default function Scanner({ onCode, onClose, titre = 'Scanner un QR' }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const inputRef = useRef(null)
  const cb = useRef(onCode)
  cb.current = onCode
  const last = useRef('')
  const lastAt = useRef(0)
  const [err, setErr] = useState(null)
  const [manuel, setManuel] = useState('')
  const [mobile] = useState(() => estMobile())
  const [cam, setCam] = useState(() => estMobile())

  function emit(raw) {
    const code = extraireToken(raw)
    if (!code) return false
    const now = Date.now()
    if (code === last.current && now - lastAt.current < 900) return true
    last.current = code
    lastAt.current = now
    cb.current(code)
    return true
  }

  useEffect(() => {
    let buf = ''
    let t = 0
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const now = Date.now()
      const rapide = now - t < 75
      t = now
      const scanInput = e.target?.dataset?.haScan === '1'

      if (e.key === 'Enter' || e.key === 'Tab') {
        const brut = scanInput ? e.target.value : buf
        buf = ''
        if (extraireToken(brut)) {
          e.preventDefault()
          e.stopPropagation()
          emit(brut)
          if (scanInput) {
            e.target.value = ''
            setManuel('')
          }
        }
        return
      }
      if (e.key.length !== 1) {
        if (e.key === 'Escape') onClose?.()
        return
      }
      if (!rapide) {
        buf = e.key
        return
      }
      buf += e.key
      if (!scanInput) {
        e.preventDefault()
        e.stopPropagation()
      }
      const tok = extraireToken(buf)
      if (tokenComplet(tok)) {
        emit(tok)
        buf = ''
        if (scanInput) {
          e.target.value = ''
          setManuel('')
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    document.body.classList.add('ha-scan-open')
    return () => document.body.classList.remove('ha-scan-open')
  }, [])

  useEffect(() => {
    if (!mobile && inputRef.current) {
      const id = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [mobile, cam])

  useEffect(() => {
    if (!cam) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      return
    }
    let stop = false
    let timer
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: mobile
            ? { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
            : { facingMode: 'user' },
          audio: false,
        })
        if (stop) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const Detector = window.BarcodeDetector
        if (!Detector) {
          setErr('Ce navigateur ne lit pas les QR en caméra. Utilisez la douchette ou saisissez le code.')
          return
        }
        setErr(null)
        const det = new Detector({ formats: ['qr_code'] })
        const tick = async () => {
          if (stop || !videoRef.current) return
          try {
            const codes = await det.detect(videoRef.current)
            const raw = codes?.[0]?.rawValue?.trim()
            if (raw) emit(raw)
          } catch { /* frame ignorée */ }
          timer = requestAnimationFrame(tick)
        }
        timer = requestAnimationFrame(tick)
      } catch (e) {
        setErr(e.message || 'Caméra inaccessible. Autorisez-la, ou utilisez la douchette.')
        setCam(false)
      }
    }
    start()
    return () => {
      stop = true
      if (timer) cancelAnimationFrame(timer)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [cam, mobile])

  function validerManuel() {
    const v = manuel.trim()
    if (!v) return
    if (!emit(v)) setErr('Code non reconnu (attendu ha:u:… ou ha:l:…).')
    else { setManuel(''); setErr(null) }
  }

  return (
    <div className="ha-scan-dock" role="dialog" aria-label={titre}>
      <div className="ha-scan-dock-bar">
        <div>
          <div className="ha-scan-dock-titre">{titre}</div>
          <div className="ha-scan-dock-hint">
            {mobile
              ? 'Cadrez le QR dans le cadre — l’écran reste visible en dessous.'
              : 'Douchette USB : scannez comme avec un clavier (le code + Entrée).'}
          </div>
        </div>
        <Btn kind="soft" onClick={onClose}>Fermer</Btn>
      </div>
      {cam && (
        <div className="ha-scan-dock-cam">
          <video ref={videoRef} playsInline muted autoPlay className="ha-scan-dock-video" />
          <div className="ha-scan-dock-cadre" aria-hidden />
        </div>
      )}
      {err && <div className="ha-scan-dock-err">{err}</div>}
      <div className="ha-scan-dock-form">
        <input
          ref={inputRef}
          data-ha-scan="1"
          value={manuel}
          onChange={e => setManuel(e.target.value)}
          onPaste={e => {
            const t = extraireToken(e.clipboardData.getData('text'))
            if (t) {
              e.preventDefault()
              emit(t)
              setManuel('')
            }
          }}
          placeholder="ha:u:… ou ha:l:…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
        />
        <Btn onClick={validerManuel}>OK</Btn>
        <Btn kind="soft" onClick={() => setCam(c => !c)}>{cam ? 'Masquer caméra' : 'Caméra'}</Btn>
      </div>
    </div>
  )
}
