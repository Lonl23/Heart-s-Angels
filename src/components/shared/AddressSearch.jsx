// src/components/shared/AddressSearch.jsx
// Recherche d'adresse via OpenStreetMap (Nominatim) — sans clé API.
// onChange reçoit { adresse, lat, lon }
import { useState, useEffect, useRef } from 'react'

export default function AddressSearch({ value, onChange, placeholder = 'Rechercher une adresse…', label }) {
  const [q, setQ]         = useState(value || '')
  const [results, setRes] = useState([])
  const [open, setOpen]   = useState(false)
  const [loading, setLd]  = useState(false)
  const timer = useRef(null)
  const box   = useRef(null)

  useEffect(() => { setQ(value || '') }, [value])

  useEffect(() => {
    function onDoc(e) { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function handleType(v) {
    setQ(v)
    onChange({ adresse: v, nom: null, lat: null, lon: null })   // saisie libre conservée
    clearTimeout(timer.current)
    if (v.trim().length < 4) { setRes([]); setOpen(false); return }
    timer.current = setTimeout(() => rechercher(v), 450)
  }

  async function rechercher(v) {
    setLd(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&limit=6&countrycodes=be,fr,nl,lu,de&q=${encodeURIComponent(v)}`
      const r = await fetch(url, { headers: { 'Accept-Language': 'fr' } })
      const data = await r.json()
      setRes(data || [])
      setOpen(true)
    } catch { setRes([]) }
    setLd(false)
  }

  function choisir(item) {
    const adresse = item.display_name
    const nom = item.namedetails?.name || item.name || adresse.split(',')[0]
    setQ(adresse); setOpen(false)
    onChange({ adresse, nom, lat: parseFloat(item.lat), lon: parseFloat(item.lon) })
  }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      {label && <label style={{ fontSize: 12.5, fontWeight: 500, color: '#7A7470', display: 'block', marginBottom: 4 }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#1BB0CE' }}>📍</span>
        <input value={q} onChange={e => handleType(e.target.value)} placeholder={placeholder}
          onFocus={() => results.length && setOpen(true)}
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif", outline: 'none' }} />
        {loading && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#A8A39D' }}>…</span>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 60, top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 260, overflowY: 'auto' }}>
          {results.map((r, i) => (
            <button key={i} type="button" onClick={() => choisir(r)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: i < results.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none', cursor: 'pointer', fontSize: 12.5, color: '#1A1514', fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4 }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0F9FB'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              📍 {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}