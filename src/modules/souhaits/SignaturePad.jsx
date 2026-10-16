import { useEffect, useRef } from 'react'
import { Btn } from '@/components/ui'

export default function SignaturePad({ value, onChange, lecture }) {
  const ref = useRef(null)
  const dessin = useRef(false)
  const local = useRef(false)

  useEffect(() => {
    if (local.current) { local.current = false; return }
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    const w = c.clientWidth || 320
    const h = 140
    c.width = w * ratio
    c.height = h * ratio
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, w, h)
      img.src = value
    }
  }, [value])

  function pos(e) {
    const c = ref.current
    const r = c.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: src.clientX - r.left, y: src.clientY - r.top }
  }
  function start(e) {
    if (lecture) return
    e.preventDefault()
    dessin.current = true
    const ctx = ref.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }
  function move(e) {
    if (!dessin.current) return
    e.preventDefault()
    const ctx = ref.current.getContext('2d')
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
  function stop() {
    if (!dessin.current) return
    dessin.current = false
    local.current = true
    onChange?.(ref.current.toDataURL('image/png'))
  }
  function effacer() {
    onChange?.('')
  }

  return (
    <div>
      <canvas
        ref={ref}
        style={{ width: '100%', height: 140, border: '1px solid var(--border)', borderRadius: 10, touchAction: 'none', background: '#fff' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerLeave={stop}
      />
      {!lecture && <Btn kind="soft" onClick={effacer} style={{ marginTop: 8 }}>Effacer</Btn>}
    </div>
  )
}
