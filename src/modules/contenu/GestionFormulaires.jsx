// src/modules/contenu/GestionFormulaires.jsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FORMULAIRES, TYPES_CHAMP_LIBRE, configEffective } from '@/lib/formulaires'
import { FONCTIONS_LABELS } from '@/hooks/useAuth'

export default function GestionFormulaires() {
  const [cle, setCle] = useState('contact')
  const [configs, setConfigs] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('formulaires_config').select('*')
    const map = {}
    ;(data || []).forEach(r => { map[r.cle] = r })
    setConfigs(map)
    setLoading(false)
  }

  const cat = FORMULAIRES[cle]
  const eff = configEffective(cle, configs[cle])

  function majChamp(nom, prop, val) {
    setConfigs(prev => {
      const cfg = { ...(prev[cle] || {}) }
      const champs = { ...(cfg.champs || {}) }
      const actuel = eff.champs.find(c => c.nom === nom)
      champs[nom] = {
        actif:  prop === 'actif'  ? val : (champs[nom]?.actif  ?? actuel.actif),
        requis: prop === 'requis' ? val : (champs[nom]?.requis ?? actuel.requis),
      }
      return { ...prev, [cle]: { ...cfg, champs } }
    })
  }

  function setLibres(libres) {
    setConfigs(prev => ({ ...prev, [cle]: { ...(prev[cle] || {}), champs_libres: libres } }))
  }
  function setDestinataires(dest) {
    setConfigs(prev => ({ ...prev, [cle]: { ...(prev[cle] || {}), destinataires: dest } }))
  }

  function ajouterLibre() {
    const libres = [...(eff.champsLibres || [])]
    libres.push({ id: 'q' + Date.now(), label: '', type: 'text', requis: false, options: [] })
    setLibres(libres)
  }
  function majLibre(id, prop, val) {
    setLibres(eff.champsLibres.map(q => q.id === id ? { ...q, [prop]: val } : q))
  }
  function suppLibre(id) { setLibres(eff.champsLibres.filter(q => q.id !== id)) }

  function toggleDest(fonction) {
    const dest = eff.destinataires.includes(fonction)
      ? eff.destinataires.filter(d => d !== fonction)
      : [...eff.destinataires, fonction]
    setDestinataires(dest)
  }

  async function sauver() {
    const cfg = configs[cle] || {}
    const payload = {
      cle,
      titre: cfg.titre || cat.titre,
      champs: cfg.champs || {},
      champs_libres: cfg.champs_libres || [],
      destinataires: cfg.destinataires || eff.destinataires,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('formulaires_config').upsert(payload, { onConflict: 'cle' })
    if (error) { setMsg({ type: 'error', text: 'Erreur d\'enregistrement.' }); return }
    setMsg({ type: 'success', text: 'Formulaire enregistré.' })
    setTimeout(() => setMsg(null), 2500)
    load()
  }

  if (loading) return <div style={{ padding: 28, color: '#7A7470' }}>Chargement…</div>

  return (
    <div style={{ padding: '28px 24px', fontFamily: "'DM Sans',sans-serif", maxWidth: 880 }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '1.8rem', fontWeight: 500, color: '#1A1514', marginBottom: 4 }}>Formulaires publics</h1>
      <p style={{ fontSize: 13, color: '#7A7470', marginBottom: 20 }}>Choisissez les champs demandés et les fonctions notifiées à chaque soumission.</p>

      {/* Onglets formulaires */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22, borderBottom: '1px solid rgba(27,176,206,.12)' }}>
        {Object.entries(FORMULAIRES).map(([k, f]) => (
          <button key={k} onClick={() => setCle(k)} style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cle === k ? '#1BB0CE' : 'transparent'}`, color: cle === k ? '#1BB0CE' : '#7A7470', fontWeight: cle === k ? 600 : 400, fontSize: 13.5, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{f.titre}</button>
        ))}
      </div>

      {msg && <div style={{ background: msg.type === 'success' ? '#F0FAF0' : '#FEF2F2', border: `1px solid ${msg.type === 'success' ? '#C3E6C3' : '#FCD5D5'}`, borderRadius: 9, padding: '10px 14px', fontSize: 13.5, color: msg.type === 'success' ? '#1E5C1E' : '#991B1B', marginBottom: 16 }}>{msg.text}</div>}

      {/* Champs prédéfinis */}
      <Section titre="Champs du formulaire">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {eff.champs.map(ch => (
            <div key={ch.nom} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: ch.actif ? 'white' : '#FAFAF8', border: '1px solid rgba(27,176,206,.1)', borderRadius: 10, opacity: ch.actif ? 1 : 0.6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1514' }}>{ch.label}</div>
                <div style={{ fontSize: 11.5, color: '#A8A39D' }}>{ch.type}</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#4A4340', cursor: 'pointer' }}>
                <input type="checkbox" checked={ch.actif} onChange={e => majChamp(ch.nom, 'actif', e.target.checked)} style={{ accentColor: '#1BB0CE' }} /> Affiché
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: ch.actif ? '#4A4340' : '#C8C4BF', cursor: ch.actif ? 'pointer' : 'not-allowed' }}>
                <input type="checkbox" checked={ch.requis} disabled={!ch.actif} onChange={e => majChamp(ch.nom, 'requis', e.target.checked)} style={{ accentColor: '#BA7517' }} /> Obligatoire
              </label>
            </div>
          ))}
        </div>
      </Section>

      {/* Questions libres */}
      <Section titre="Questions personnalisées" action={<button onClick={ajouterLibre} style={btnSm}>+ Ajouter une question</button>}>
        {(!eff.champsLibres || eff.champsLibres.length === 0) ? (
          <p style={{ fontSize: 13, color: '#A8A39D', fontStyle: 'italic' }}>Aucune question personnalisée. Ajoutez-en pour demander des informations supplémentaires.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {eff.champsLibres.map(q => (
              <div key={q.id} style={{ background: '#F0F9FB', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <input value={q.label} onChange={e => majLibre(q.id, 'label', e.target.value)} placeholder="Intitulé de la question"
                    style={{ flex: 2, minWidth: 180, padding: '8px 11px', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif" }} />
                  <select value={q.type} onChange={e => majLibre(q.id, 'type', e.target.value)} style={{ padding: '8px 11px', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif" }}>
                    {TYPES_CHAMP_LIBRE.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#4A4340', cursor: 'pointer' }}>
                    <input type="checkbox" checked={q.requis} onChange={e => majLibre(q.id, 'requis', e.target.checked)} style={{ accentColor: '#BA7517' }} /> Obligatoire
                  </label>
                  <button onClick={() => suppLibre(q.id)} style={{ padding: '7px 10px', background: '#FCEBEB', color: '#C8435A', border: 'none', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>✕</button>
                </div>
                {q.type === 'select' && (
                  <input value={(q.options || []).join(', ')} onChange={e => majLibre(q.id, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Choix séparés par des virgules : Option A, Option B, Option C"
                    style={{ width: '100%', marginTop: 8, padding: '8px 11px', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }} />
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Destinataires (fonctions notifiées) */}
      <Section titre="Qui est notifié ?" sousTitre="Les personnes occupant ces fonctions (et leurs adjoints) recevront une notification à chaque soumission.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(FONCTIONS_LABELS).map(([f, label]) => {
            const actif = eff.destinataires.includes(f)
            return (
              <button key={f} onClick={() => toggleDest(f)} style={{ padding: '7px 14px', borderRadius: 99, border: '1px solid', borderColor: actif ? '#1BB0CE' : 'rgba(0,0,0,.12)', background: actif ? '#1BB0CE' : 'white', color: actif ? 'white' : '#7A7470', fontSize: 12.5, fontWeight: actif ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                {actif ? '✓ ' : ''}{label}
              </button>
            )
          })}
        </div>
      </Section>

      <button onClick={sauver} style={{ padding: '11px 24px', background: '#1BB0CE', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginTop: 8 }}>
        Enregistrer le formulaire
      </button>
    </div>
  )
}

function Section({ titre, sousTitre, action, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sousTitre ? 4 : 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0E4A5A' }}>{titre}</h3>
        {action}
      </div>
      {sousTitre && <p style={{ fontSize: 12.5, color: '#7A7470', marginBottom: 12 }}>{sousTitre}</p>}
      {children}
    </div>
  )
}

const btnSm = { padding: '7px 13px', background: '#E6F7FA', color: '#0E7A93', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }