// src/modules/acces/GestionAcces.jsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth, FONCTIONS_LABELS, NAV_PAGES } from '@/hooks/useAuth'

export default function GestionAcces() {
  const { accesConfig, rechargerAcces, simulerFonctions, simulerVolontaire, simProfil, arreterSimulation } = useAuth()
  const [config, setConfig] = useState({})       // { fonction: [pages] }
  const [volontaires, setVolontaires] = useState([])
  const [msg, setMsg] = useState(null)
  const [onglet, setOnglet] = useState('fonctions')
  // Accès par utilisateur
  const [userSel, setUserSel] = useState(null)        // volontaire sélectionné
  const [userPerso, setUserPerso] = useState(false)   // accès personnalisé activé ?
  const [userPages, setUserPages] = useState([])      // pages personnalisées

  useEffect(() => {
    // Initialiser depuis la config chargée + les défauts
    const init = {}
    Object.keys(FONCTIONS_LABELS).forEach(f => {
      init[f] = accesConfig[f] || pagesDefaut(f)
    })
    setConfig(init)
    supabase.from('profiles').select('id,prenom,nom,email,fonctions,fonctions_adjoint,pages_perso').order('nom').then(({ data }) => setVolontaires(data || []))
  }, [accesConfig])

  function pagesDefaut(f) {
    return NAV_PAGES.map(p => p.key)
  }

  // Pages déduites des fonctions d'un volontaire (pour initialiser un accès perso)
  function pagesDesFonctions(v) {
    const fns = [...(v.fonctions || []), ...(v.fonctions_adjoint || [])]
    const set = new Set()
    fns.forEach(f => (accesConfig[f] || pagesDefaut(f)).forEach(k => set.add(k)))
    // toujours inclure les universelles
    ;['nav.dashboard','nav.disponibilites','nav.defraiements','nav.organigramme'].forEach(k => set.add(k))
    return [...set]
  }

  function choisirUser(v) {
    setUserSel(v)
    const perso = Array.isArray(v.pages_perso)
    setUserPerso(perso)
    setUserPages(perso ? v.pages_perso : pagesDesFonctions(v))
  }
  function toggleUserPage(key) {
    setUserPages(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  async function sauverUser() {
    const valeur = userPerso ? userPages : null   // null = suit les fonctions
    const { error } = await supabase.from('profiles').update({ pages_perso: valeur }).eq('id', userSel.id)
    if (error) { setMsg({ type: 'error', text: 'Erreur d\'enregistrement.' }); return }
    setVolontaires(prev => prev.map(v => v.id === userSel.id ? { ...v, pages_perso: valeur } : v))
    setUserSel(s => ({ ...s, pages_perso: valeur }))
    setMsg({ type: 'success', text: `Accès de ${userSel.prenom} enregistrés.` })
    setTimeout(() => setMsg(null), 2500)
  }

  function toggle(fonction, pageKey) {
    setConfig(prev => {
      const cur = prev[fonction] || []
      const next = cur.includes(pageKey) ? cur.filter(k => k !== pageKey) : [...cur, pageKey]
      return { ...prev, [fonction]: next }
    })
  }

  async function sauver(fonction) {
    const { error } = await supabase.from('acces_pages').upsert(
      { fonction, pages: config[fonction] || [], updated_at: new Date().toISOString() },
      { onConflict: 'fonction' }
    )
    if (error) { setMsg({ type: 'error', text: 'Erreur d\'enregistrement.' }); return }
    await rechargerAcces()
    setMsg({ type: 'success', text: `Accès de « ${FONCTIONS_LABELS[fonction]} » enregistrés.` })
    setTimeout(() => setMsg(null), 2500)
  }

  return (
    <div style={{ padding: '28px 24px', fontFamily: "'DM Sans',sans-serif", maxWidth: 1000 }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '1.8rem', fontWeight: 500, color: '#1A1514', marginBottom: 4 }}>Gestion des accès</h1>
      <p style={{ fontSize: 13, color: '#7A7470', marginBottom: 20 }}>Choisissez les pages visibles pour chaque fonction, et simulez la vue d'un volontaire.</p>

      {/* Bannière simulation active */}
      {simProfil && (
        <div style={{ background: '#FAEEDA', border: '1px solid #E5C98A', borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13.5, color: '#7A5512' }}>👁️ Simulation active : <strong>{simProfil._label}</strong> — naviguez dans l'app pour voir sa vue.</span>
          <button onClick={arreterSimulation} style={{ padding: '6px 14px', background: '#BA7517', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Arrêter</button>
        </div>
      )}

      {msg && <div style={{ background: msg.type === 'success' ? '#F0FAF0' : '#FEF2F2', border: `1px solid ${msg.type === 'success' ? '#C3E6C3' : '#FCD5D5'}`, borderRadius: 9, padding: '10px 14px', fontSize: 13.5, color: msg.type === 'success' ? '#1E5C1E' : '#991B1B', marginBottom: 16 }}>{msg.text}</div>}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid rgba(27,176,206,.12)' }}>
        {[['fonctions', 'Accès par fonction'], ['utilisateurs', 'Accès par utilisateur'], ['simulation', 'Simuler une vue']].map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)} style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${onglet === k ? '#1BB0CE' : 'transparent'}`, color: onglet === k ? '#1BB0CE' : '#7A7470', fontWeight: onglet === k ? 600 : 400, fontSize: 13.5, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{l}</button>
        ))}
      </div>

      {onglet === 'fonctions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(FONCTIONS_LABELS).map(([f, label]) => (
            <div key={f} style={{ background: 'white', border: '1px solid rgba(27,176,206,.12)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0E4A5A' }}>{label}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => simulerFonctions([f])} style={{ padding: '5px 12px', background: '#E6F7FA', color: '#0E7A93', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>👁️ Simuler</button>
                  <button onClick={() => sauver(f)} style={{ padding: '5px 14px', background: '#1BB0CE', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Enregistrer</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {NAV_PAGES.map(p => {
                  const actif = (config[f] || []).includes(p.key)
                  return (
                    <button key={p.key} onClick={() => toggle(f, p.key)} style={{ padding: '6px 12px', borderRadius: 99, border: '1px solid', borderColor: actif ? '#1BB0CE' : 'rgba(0,0,0,.12)', background: actif ? '#1BB0CE' : 'white', color: actif ? 'white' : '#7A7470', fontSize: 12, fontWeight: actif ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                      {actif ? '✓ ' : ''}{p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {onglet === 'utilisateurs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18 }}>
          {/* Liste des volontaires */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflow: 'auto' }}>
            {volontaires.map(v => (
              <button key={v.id} onClick={() => choisirUser(v)} style={{ textAlign: 'left', padding: '9px 12px', background: userSel?.id === v.id ? '#E6F7FA' : 'white', border: `1px solid ${userSel?.id === v.id ? '#1BB0CE' : 'rgba(0,0,0,.08)'}`, borderRadius: 9, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1A1514' }}>{v.prenom} {v.nom}</div>
                <div style={{ fontSize: 11, color: Array.isArray(v.pages_perso) ? '#BA7517' : '#A8A39D' }}>
                  {Array.isArray(v.pages_perso) ? '⚙️ Accès personnalisé' : 'Suit ses fonctions'}
                </div>
              </button>
            ))}
          </div>

          {/* Détail */}
          {!userSel ? (
            <div style={{ color: '#7A7470', fontSize: 14, padding: 24 }}>← Sélectionnez un volontaire pour gérer ses accès.</div>
          ) : (
            <div style={{ background: 'white', border: '1px solid rgba(27,176,206,.12)', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#0E4A5A' }}>{userSel.prenom} {userSel.nom}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => simulerVolontaire(userSel)} style={{ padding: '5px 12px', background: '#E6F7FA', color: '#0E7A93', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>👁️ Simuler</button>
                  <button onClick={sauverUser} style={{ padding: '5px 14px', background: '#1BB0CE', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Enregistrer</button>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#4A4340', cursor: 'pointer', marginBottom: 14, background: '#F0F9FB', borderRadius: 9, padding: '10px 12px' }}>
                <input type="checkbox" checked={userPerso} onChange={e => { setUserPerso(e.target.checked); if (e.target.checked && userPages.length === 0) setUserPages(pagesDesFonctions(userSel)) }} style={{ accentColor: '#1BB0CE', width: 16, height: 16 }} />
                Accès personnalisé (sinon, suit automatiquement ses fonctions)
              </label>

              {userPerso ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {NAV_PAGES.map(p => {
                    const actif = userPages.includes(p.key)
                    return (
                      <button key={p.key} onClick={() => toggleUserPage(p.key)} style={{ padding: '6px 12px', borderRadius: 99, border: '1px solid', borderColor: actif ? '#1BB0CE' : 'rgba(0,0,0,.12)', background: actif ? '#1BB0CE' : 'white', color: actif ? 'white' : '#7A7470', fontSize: 12, fontWeight: actif ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                        {actif ? '✓ ' : ''}{p.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#7A7470' }}>
                  Cette personne voit les pages de ses fonctions : <strong>{(userSel.fonctions || []).map(f => FONCTIONS_LABELS[f] || f).join(', ') || 'aucune fonction'}</strong>.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {onglet === 'simulation' && (
        <div>
          <div style={{ background: '#E6F7FA', borderRadius: 12, padding: '14px 16px', marginBottom: 18, fontSize: 13, color: '#0E4A5A' }}>
            Sélectionnez un volontaire pour voir l'application <strong>exactement comme il la voit</strong> (menu et pages). Une bannière vous permettra de revenir à votre vue.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {volontaires.map(v => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid rgba(27,176,206,.1)', borderRadius: 10, padding: '10px 14px', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1514' }}>{v.prenom} {v.nom}</div>
                  <div style={{ fontSize: 12, color: '#7A7470' }}>{(v.fonctions || []).map(f => FONCTIONS_LABELS[f] || f).join(', ') || 'Aucune fonction'}{v.pages_perso ? ' · accès personnalisé' : ''}</div>
                </div>
                <button onClick={() => simulerVolontaire(v)} style={{ padding: '6px 14px', background: '#1BB0CE', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>👁️ Voir comme {v.prenom}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}