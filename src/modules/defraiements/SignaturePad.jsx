import { useEffect, useRef } from 'react'
import { Btn } from '@/components/ui'

export default function SignaturePad({ value, onChange, disabled, label = 'Signature' }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const dessin = useRef(false)
  const vide = useRef(true)
  const interne = useRef(false)

  useEffect(() => {
    if (interne.current) { interne.current = false; return }
    preparer()
  }, [value, disabled])

  function sizeCanvas() {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return null
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(280, wrap.clientWidth)
    const h = 140
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    return { ctx, w, h }
  }

  function blanc(ctx, w, h) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    vide.current = true
  }

  function preparer() {
    const s = sizeCanvas()
    if (!s) return
    blanc(s.ctx, s.w, s.h)
    if (!value) return
    const img = new Image()
    img.onload = () => {
      const now = sizeCanvas()
      if (!now) return
      blanc(now.ctx, now.w, now.h)
      const ratio = Math.min(now.w / img.width, now.h / img.height, 1)
      const dw = img.width * ratio
      const dh = img.height * ratio
      now.ctx.drawImage(img, (now.w - dw) / 2, (now.h - dh) / 2, dw, dh)
      vide.current = false
    }
    img.src = value
  }

  function pos(e) {
    const canvas = canvasRef.current
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: src.clientX - r.left, y: src.clientY - r.top }
  }

  function start(e) {
    if (disabled) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* */ }
    const s = sizeCanvas()
    if (!s) return
    const p = pos(e)
    dessin.current = true
    s.ctx.beginPath()
    s.ctx.moveTo(p.x, p.y)
  }

  function move(e) {
    if (!dessin.current || disabled) return
    e.preventDefault()
    const s = sizeCanvas()
    if (!s) return
    const p = pos(e)
    s.ctx.lineTo(p.x, p.y)
    s.ctx.stroke()
    vide.current = false
  }

  function end(e) {
    if (!dessin.current) return
    e.preventDefault()
    dessin.current = false
    if (!vide.current) {
      interne.current = true
      onChange?.(canvasRef.current.toDataURL('image/png'))
    }
  }

  function effacer() {
    interne.current = true
    const s = sizeCanvas()
    if (s) blanc(s.ctx, s.w, s.h)
    onChange?.('')
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div ref={wrapRef} style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          style={{ display: 'block', width: '100%', height: 140, touchAction: 'none', cursor: disabled ? 'default' : 'crosshair', borderRadius: 8 }}
        />
      </div>
      {!disabled && (
        <Btn kind="soft" onClick={effacer} style={{ marginTop: 8, padding: '5px 10px' }}>Effacer</Btn>
      )}
    </div>
  )
}
