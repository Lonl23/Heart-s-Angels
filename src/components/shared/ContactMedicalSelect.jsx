// src/components/shared/ContactMedicalSelect.jsx
// Sélection d'un contact médical depuis l'annuaire, avec ajout d'un nouveau contact
// (nom, prénom, téléphone) enregistré pour réutilisation.
// onChange(displayString, contact|null)
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function ContactMedicalSelect({ value, onChange, type = 'medecin', label, placeholder = 'Rechercher ou ajouter…' }) {
  const [contacts, setContacts] = useState([])
  const [q, setQ]       = useState(value || '')
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [neo, setNeo]   = useState({ prenom: '', nom: '', telephone: '' })
  const [saving, setSaving] = useState(false)
  const box = useRef(null)

  useEffect(() => { setQ(value || '') }, [value])
  useEffect(() => { charger() }, [type])
  useEffect(() => {
    function onDoc(e) { if (box.current && !box.current.contains(e.target)) { setOpen(false); setAdding(false) } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function charger() {
    const { data } = await supabase.from('contacts_medicaux').select('*').eq('type', type).order('nom')
    setContacts(data || [])
  }

  const display = (c) => [c.prenom, c.nom].filter(Boolean).join(' ')
  const filtres = contacts.filter(c => {
    const t = (display(c) + ' ' + (c.telephone || '')).toLowerCase()
    return !q || t.includes(q.toLowerCase())
  })

  function choisir(c) {
    onChange(display(c), c)
    setQ(display(c)); setOpen(false); setAdding(false)
  }

  async function ajouter() {
    if (!neo.nom && !neo.prenom) return
    setSaving(true)
    const { data, error } = await supabase.from('contacts_medicaux')
      .insert({ type, prenom: neo.prenom || null, nom: neo.nom || null, telephone: neo.telephone || null })
      .select().single()
    setSaving(false)
    if (error) { alert('Enregistrement impossible : ' + error.message); return }
    setContacts(cs => [...cs, data])
    choisir(data)
    setNeo({ prenom: '', nom: '', telephone: '' })
  }

  const IN = { width: '100%', padding: '8px 10px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 7, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none' }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      {label && <label style={{ fontSize: 12.5, fontWeight: 500, color: '#7A7470', display: 'block', marginBottom: 4 }}>{label}</label>}
      <input value={q} placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setQ(e.target.value); onChange(e.target.value, null); setOpen(true) }}
        style={{ ...IN, padding: '9px 12px' }} />

      {open && (
        <div style={{ position: 'absolute', zIndex: 60, top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 300, overflowY: 'auto' }}>
          {!adding && filtres.map(c => (
            <button key={c.id} type="button" onClick={() => choisir(c)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(0,0,0,.05)', cursor: 'pointer', fontSize: 13, color: '#1A1514', fontFamily: "'DM Sans',sans-serif" }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0F9FB'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <span>👤 {display(c) || '(sans nom)'}</span>
              {c.telephone && <span style={{ color: '#7A7470', fontSize: 12 }}>{c.telephone}</span>}
            </button>
          ))}
          {!adding && filtres.length === 0 && <div style={{ padding: '9px 12px', fontSize: 12.5, color: '#A8A39D', fontStyle: 'italic' }}>Aucun contact connu.</div>}

          {!adding ? (
            <button type="button" onClick={() => { setAdding(true); setNeo(n => ({ ...n, nom: q && !contacts.some(c => display(c) === q) ? q : '' })) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: '#F0F9FB', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0E7A93', fontFamily: "'DM Sans',sans-serif" }}>
              ➕ Nouveau contact
            </button>
          ) : (
            <div style={{ padding: '12px', background: '#F0F9FB' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0E4A5A', marginBottom: 8 }}>Nouveau contact</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input style={IN} placeholder="Prénom" value={neo.prenom} onChange={e => setNeo({ ...neo, prenom: e.target.value })} />
                <input style={IN} placeholder="Nom" value={neo.nom} onChange={e => setNeo({ ...neo, nom: e.target.value })} />
              </div>
              <input style={{ ...IN, marginBottom: 8 }} placeholder="Téléphone" value={neo.telephone} onChange={e => setNeo({ ...neo, telephone: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setAdding(false)} style={{ padding: '7px 12px', background: 'white', border: '1px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Annuler</button>
                <button type="button" onClick={ajouter} disabled={saving} style={{ padding: '7px 14px', background: '#0E7A93', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{saving ? '…' : 'Enregistrer'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}