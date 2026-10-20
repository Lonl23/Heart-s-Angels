import { useState, useEffect, useRef, useMemo } from 'react'
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSwUpdate } from '@/hooks/useSwUpdate'
import { useNotifications } from '@/hooks/useNotifications'
import { iconTypeNotif } from '@/lib/notifications'
import { Logo } from '@/components/ui'
import { COPYRIGHT } from '@/copyright'
import { syncNativeTheme } from '@/lib/native'
import { useFondPage } from '@/hooks/useFondPage'
import { SortieFondu } from '@/components/Fondu'
import BadgeBeta from '@/components/BadgeBeta'
import { DEPARTEMENTS, filtrerDepartements, moduleAutorise, cheminActif, cheminDepartement, departementActif, titrePage } from '@/navigation'

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light'
  const next = cur === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
}

export default function Layout() {
  const auth = useAuth()
  const { profile, signOut } = auth
  const { checkForUpdate, checking } = useSwUpdate()
  const nav = useNavigate()
  const loc = useLocation()
  const fond = useFondPage(loc.pathname)
  const [collapsed, setCollapsed] = useState(localStorage.getItem('nav_collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width:900px)').matches)
  const [dark, setDark] = useState(() => (document.documentElement.getAttribute('data-theme') || 'light') === 'dark')
  const departements = useMemo(() => filtrerDepartements(DEPARTEMENTS, key => moduleAutorise(key, auth)), [auth])
  const courant = departementActif(loc.pathname, departements)
  const { nonLues, nbNonLues, marquerLues, traiter } = useNotifications()
  const [cloche, setCloche] = useState(false)
  const clocheRef = useRef(null)

  useEffect(() => {
    const m = window.matchMedia('(min-width:900px)')
    const h = e => { setIsDesktop(e.matches); if (e.matches) setMobileOpen(false) }
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  useEffect(() => { setMobileOpen(false); setCloche(false) }, [loc.pathname])
  useEffect(() => {
    function onDoc(e) {
      if (clocheRef.current && !clocheRef.current.contains(e.target)) setCloche(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function toggleCollapse() { const v = !collapsed; setCollapsed(v); localStorage.setItem('nav_collapsed', v ? '1' : '0') }
  function onTheme() { toggleTheme(); setDark(d => !d); syncNativeTheme() }
  async function handleLogout() { await signOut(); nav('/login') }

  const collapsedEff = isDesktop && collapsed
  const W = collapsedEff ? 66 : 292

  return (
    <div className="ha-shell" style={{ display:'flex', overflow:'hidden', background:'var(--bg)' }}>
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
              <div key={d.id}>
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

      <div className="ha-shell-main" style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', minHeight:0 }}>
        <header style={{ position:'sticky', top:0, zIndex:30, display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
          <button onClick={()=>setMobileOpen(o=>!o)} className="ha-burger" aria-label="Menu" style={iconBtn}>☰</button>
          <Logo size={40} className="ha-header-logo" />
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.2rem', color:'var(--heading)', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, display:'flex', alignItems:'center', gap:8 }}>
            {titrePage(loc.pathname)}
            <BadgeBeta />
          </div>
          <div ref={clocheRef} style={{ position:'relative', marginLeft:'auto' }}>
            <button type="button" onClick={() => setCloche(o => !o)} aria-label="Alertes" title="Alertes" style={{ ...iconBtn, position:'relative' }}>
              🔔
              {nbNonLues > 0 && <span className="ha-notif-badge">{nbNonLues > 9 ? '9+' : nbNonLues}</span>}
            </button>
            {cloche && (
              <div className="ha-notif-panel">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
                  <strong style={{ fontSize:13, color:'var(--heading)' }}>Alertes</strong>
                  {nbNonLues > 0 && (
                    <button type="button" onClick={() => marquerLues()} style={{ background:'none', border:'none', color:'var(--accent)', fontSize:12, fontWeight:600, cursor:'pointer' }}>Tout lu</button>
                  )}
                </div>
                {nonLues.length === 0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucune alerte non lue.</div>}
                {nonLues.slice(0, 8).map(n => (
                  <div key={n.id} className="ha-notif-item">
                    <Link to={n.lien || '/app'} onClick={() => { if (!n.groupe_id) marquerLues([n.id]); setCloche(false) }} style={{ display:'flex', gap:10, flex:1, minWidth:0, textDecoration:'none', color:'inherit' }}>
                      <span>{iconTypeNotif(n.type)}</span>
                      <span style={{ minWidth:0 }}>
                        <span style={{ display:'block', fontWeight:600, color:'var(--text)' }}>{n.titre}</span>
                        {n.message && <span style={{ display:'block', fontSize:12, color:'var(--text-muted)' }}>{String(n.message).split('\n')[0]}</span>}
                      </span>
                    </Link>
                    {n.groupe_id && (
                      <button type="button" onClick={() => traiter(n.id)} style={{ flex:'none', border:'1px solid var(--border)', background:'var(--card)', color:'var(--accent)', borderRadius:8, padding:'4px 8px', fontSize:12, fontWeight:600, cursor:'pointer' }}>Traitée</button>
                    )}
                  </div>
                ))}
                <Link to="/app" onClick={() => setCloche(false)} style={{ display:'block', textAlign:'center', fontSize:12.5, fontWeight:600, color:'var(--accent)', marginTop:8 }}>Accueil ›</Link>
              </div>
            )}
          </div>
        </header>
        <main
          className={fond.actif ? 'ha-main-fond' : undefined}
          style={{ flex:1, minWidth:0, width:'100%', overflow:'hidden', minHeight:0, display:'flex', flexDirection:'column', ...fond.style }}
        ><SortieFondu /></main>
      </div>

      <style>{`
        @media (max-width: 899px) {
          .ha-sidebar {
            position: fixed; top:0; left:0; height:100%; width: min(300px, 88vw) !important;
            transform: translateX(-100%);
          }
          .ha-collapse-btn { display:none !important; }
          .ha-header-logo { display:block; }
        }
        @media (min-width: 900px) {
          .ha-sidebar { position: relative; height:100%; transform:none !important; }
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
