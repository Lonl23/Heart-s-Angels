import { useState, useEffect, useMemo } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSwUpdate } from '@/hooks/useSwUpdate'
import { Logo } from '@/components/ui'
import { COPYRIGHT } from '@/copyright'
import { DEPARTEMENTS, filtrerDepartements, cheminActif, cheminDepartement, departementActif, titrePage } from '@/navigation'

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light'
  const next = cur === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
}

export default function Layout() {
  const { profile, signOut, peutOuvrir } = useAuth()
  const { checkForUpdate, checking } = useSwUpdate()
  const nav = useNavigate()
  const loc = useLocation()
  const [collapsed, setCollapsed] = useState(localStorage.getItem('nav_collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width:900px)').matches)
  const [dark, setDark] = useState(() => (document.documentElement.getAttribute('data-theme') || 'light') === 'dark')
  const departements = useMemo(() => filtrerDepartements(DEPARTEMENTS, peutOuvrir), [peutOuvrir])
  const courant = departementActif(loc.pathname, departements)

  useEffect(() => {
    const m = window.matchMedia('(min-width:900px)')
    const h = e => { setIsDesktop(e.matches); if (e.matches) setMobileOpen(false) }
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  useEffect(() => { setMobileOpen(false) }, [loc.pathname])

  function toggleCollapse() { const v = !collapsed; setCollapsed(v); localStorage.setItem('nav_collapsed', v ? '1' : '0') }
  function onTheme() { toggleTheme(); setDark(d => !d) }
  async function handleLogout() { await signOut(); nav('/login') }

  const collapsedEff = isDesktop && collapsed
  const W = collapsedEff ? 66 : 318

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      <aside className="ha-sidebar" style={{
        width: W, flexShrink:0, zIndex:60, background:'var(--surface)',
        borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column',
        padding:'14px 10px', overflow:'hidden', transition:'width .18s, transform .2s',
        transform: mobileOpen ? 'translateX(0)' : undefined,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent: collapsedEff ? 'center' : 'space-between', flexDirection: collapsedEff ? 'column' : 'row', gap:8, padding:'2px 6px 14px' }}>
          <Logo size={collapsedEff ? 36 : 56} />
          <button onClick={toggleCollapse} title={collapsed?'Déplier le menu':'Replier le menu'} className="ha-collapse-btn" style={iconBtn}>{collapsedEff ? '»' : '«'}</button>
        </div>

        <nav style={{ display:'flex', flexDirection:'column', gap:4, flex:1, overflowY:'auto', minHeight:0 }}>
          <NavLink to="/app" end onClick={()=>setMobileOpen(false)} title="Accueil"
            className={({isActive}) => 'ha-nav-item' + (isActive ? ' is-active' : '')}
            style={({isActive}) => itemStyle(isActive, collapsedEff)}>
            <span style={{ fontSize:16 }}>🏠</span>{!collapsedEff && <span className="ha-nav-label">Accueil</span>}
          </NavLink>
          {departements.map(d => {
            const actif = courant?.id === d.id
            const surLaPage = cheminActif(loc.pathname, cheminDepartement(d))
            return (
              <div key={d.id} className="ha-nav-group">
                <NavLink to={cheminDepartement(d)} end onClick={()=>setMobileOpen(false)} title={d.label}
                  className={'ha-nav-dept' + (actif ? ' has-active' : '') + (surLaPage ? ' is-current' : '')}
                  style={{ justifyContent: collapsedEff ? 'center' : 'flex-start' }}>
                  <span style={{ fontSize:16 }}>{d.icon}</span>
                  {!collapsedEff && <span className="ha-nav-label">{d.label}</span>}
                </NavLink>
                {actif && !collapsedEff && d.modules.length > 0 && (
                  <div className="ha-nav-sub">
                    {d.modules.map(m => (
                      <NavLink key={m.key} to={m.to} onClick={()=>setMobileOpen(false)} title={m.label}
                        className={({isActive}) => 'ha-nav-item' + (isActive ? ' is-active' : '')}
                        style={({isActive}) => itemStyle(isActive, false)}>
                        <span style={{ fontSize:15 }}>{m.icon}</span>
                        <span className="ha-nav-label">{m.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:8 }}>
          <NavLink to="/app/profil" onClick={()=>setMobileOpen(false)} title="Ma fiche"
            style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 8px 10px', textDecoration:'none', justifyContent: collapsedEff?'center':'flex-start' }}>
            <Avatar url={profile?.fiche?.photo_url} prenom={profile?.prenom} nom={profile?.nom} />
            {!collapsedEff && (
              <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>{profile?.prenom} {profile?.nom}<br/><span style={{ color:'var(--accent)', fontWeight:600 }}>Ma fiche ›</span></span>
            )}
          </NavLink>
          <button type="button" onClick={onTheme} title={dark ? 'Passer au thème clair' : 'Passer au thème sombre'} style={rowBtn(collapsedEff)}>{dark ? '☀︎' : '☾'}{!collapsedEff && (dark ? ' Thème clair' : ' Thème sombre')}</button>
          <button type="button" onClick={checkForUpdate} disabled={checking} title="Rechercher des mises à jour" style={rowBtn(collapsedEff)}>↻{!collapsedEff && (checking ? ' Recherche…' : ' Rechercher des mises à jour')}</button>
          <button type="button" onClick={handleLogout} title="Déconnexion" style={{ ...rowBtn(collapsedEff), color:'#C8435A' }}>↩︎{!collapsedEff && ' Déconnexion'}</button>
          {!collapsedEff && <div style={{ fontSize:10, color:'var(--text-faint)', padding:'10px 8px 0', lineHeight:1.4 }}>{COPYRIGHT}</div>}
        </div>
      </aside>

      {mobileOpen && <div onClick={()=>setMobileOpen(false)} className="ha-scrim" style={{ position:'fixed', inset:0, background:'var(--overlay)', zIndex:55 }} />}

      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', height:'100vh', minHeight:0 }}>
        <header style={{ position:'sticky', top:0, zIndex:30, display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
          <button onClick={()=>setMobileOpen(o=>!o)} className="ha-burger" aria-label="Menu" style={iconBtn}>☰</button>
          <Logo size={40} className="ha-header-logo" />
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.2rem', color:'var(--heading)', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{titrePage(loc.pathname)}</div>
        </header>
        <main style={{ flex:1, minWidth:0, width:'100%', overflowX:'hidden', overflowY:'auto', minHeight:0 }}><Outlet /></main>
      </div>

      <style>{`
        @media (max-width: 899px) {
          .ha-sidebar {
            position: fixed; top:0; left:0; height:100vh; width: min(318px, 88vw) !important;
            transform: translateX(-100%);
          }
          .ha-collapse-btn { display:none !important; }
          .ha-header-logo { display:block; }
        }
        @media (min-width: 900px) {
          .ha-sidebar { position: relative; height:100vh; transform:none !important; }
          .ha-burger, .ha-scrim, .ha-header-logo { display:none !important; }
        }
      `}</style>
    </div>
  )
}

function Avatar({ url, prenom, nom }) {
  const initiales = `${(prenom||'').charAt(0)}${(nom||'').charAt(0)}`.toUpperCase()
  return (
    <div style={{ width:34, height:34, borderRadius:99, overflow:'hidden', flexShrink:0, background:'var(--accent)', color:'#fff', display:'grid', placeItems:'center', fontSize:13, fontWeight:700 }}>
      {url ? <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (initiales || '?')}
    </div>
  )
}

const itemStyle = (isActive, collapsed) => ({
  display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, textDecoration:'none',
  fontSize:14, fontWeight:isActive?600:500, color:isActive?'#fff':'var(--text-2)',
  background:isActive?'var(--accent)':'transparent', justifyContent: collapsed?'center':'flex-start', minWidth:0,
})
const iconBtn = { background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', fontSize:15, color:'var(--text-2)', cursor:'pointer', lineHeight:1 }
const rowBtn = (collapsed) => ({ width:'100%', textAlign: collapsed?'center':'left', padding:'9px 10px', background:'transparent', border:'none', borderRadius:8, fontSize:13.5, color:'var(--text-2)', cursor:'pointer' })
