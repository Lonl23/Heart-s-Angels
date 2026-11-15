import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Btn } from '@/components/ui'

export default function Scanner({ onCode, onClose, titre = 'Scanner un QR' }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const cb = useRef(onCode)
  cb.current = onCode
  const [err, setErr] = useState(null)
  const [manuel, setManuel] = useState('')
  const last = useRef('')

  useEffect(() => {
    let stop = false
    let timer
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }, audio: false,
        })
        if (stop) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const video = videoRef.current
        const Detector = window.BarcodeDetector
        const det = Detector ? new Detector({ formats: ['qr_code'] }) : null
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        const lire = async () => {
          if (!video || video.readyState < 2) return ''
          if (det) {
            const codes = await det.detect(video)
            return codes?.[0]?.rawValue?.trim() || ''
          }
          const w = video.videoWidth
          const h = video.videoHeight
          if (!w || !h || !ctx) return ''
          const scale = w > 720 ? 720 / w : 1
          const cw = Math.round(w * scale)
          const ch = Math.round(h * scale)
          canvas.width = cw
          canvas.height = ch
          ctx.drawImage(video, 0, 0, cw, ch)
          const image = ctx.getImageData(0, 0, cw, ch)
          return jsQR(image.data, cw, ch, { inversionAttempts: 'dontInvert' })?.data?.trim() || ''
        }
        const tick = async () => {
          if (stop) return
          try {
            const raw = await lire()
            if (raw && raw !== last.current) {
              last.current = raw
              cb.current(raw)
            }
          } catch { /* image pas encore prête */ }
          timer = setTimeout(tick, 220)
        }
        timer = setTimeout(tick, 220)
      } catch (e) {
        setErr(e.message || 'Caméra inaccessible. Autorisez-la, ou saisissez le code.')
      }
    }
    start()
    return () => {
      stop = true
      if (timer) clearTimeout(timer)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, background:'#111', color:'#fff', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px' }}>
        <div style={{ fontWeight:700 }}>{titre}</div>
        <Btn kind="soft" onClick={onClose}>Fermer</Btn>
      </div>
      <video ref={videoRef} playsInline muted style={{ flex:1, width:'100%', objectFit:'cover', background:'#000' }} />
      {err && <div style={{ padding:'8px 14px', color:'#F8C7C7', fontSize:13 }}>{err}</div>}
      <div style={{ padding:'12px 14px 20px', background:'#1a1a1a' }}>
        <div style={{ fontSize:12.5, color:'#bbb', marginBottom:8 }}>Ou coller / taper le code</div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={manuel} onChange={e=>setManuel(e.target.value)} placeholder="ha:u:… ou ha:l:…"
            style={{ flex:1, padding:'10px 12px', borderRadius:9, border:'1px solid #444', background:'#222', color:'#fff', fontSize:16 }} />
          <Btn onClick={() => manuel.trim() && cb.current(manuel.trim())}>OK</Btn>
        </div>
      </div>
    </div>
  )
}
