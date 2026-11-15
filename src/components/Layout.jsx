import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSwUpdate } from '@/hooks/useSwUpdate'
import { Logo } from '@/components/ui'
import { COPYRIGHT } from '@/copyright'

const NAV = [
  { to:'/app',               label:'Tableau de bord', short:'Accueil', icon:'🏠', end:true, key:'dashboard' },
  { to:'/app/souhaits',      label:'Souhaits',        short:'Souhaits', icon:'⭐', key:'souhaits' },
  { to:'/app/missions',      label:'Mes missions',    short:'Missions', icon:'🚑', key:'missions' },
  { to:'/app/defraiements',  label:'Défraiements',    short:'Frais', icon:'🧾', key:'defraiements' },
  { to:'/app/disponibilites',label:'Disponibilités',  short:'Agenda', icon:'📅', key:'disponibilites' },
  { to:'/app/stock',         label:'Stock',           short:'Stock', icon:'📦', key:'stock' },
  { to:'/app/annuaire',      label:'Annuaire',        short:'Annuaire', icon:'📇', key:'annuaire' },
]

const PRIMARY_KEYS = ['dashboard', 'souhaits', 'missions', 'disponibilites']

const PAGE_TITLE = [
  ['/app/souhaits', 'Souhaits'],
  ['/app/missions', 'Mes missions'],
  ['/app/defraiements', 'Défraiements'],
  ['/app/disponibilites', 'Disponibilités'],
  ['/app/stock', 'Stock'],
  ['/app/annuaire', 'Annuaire'],
  ['/app/admin', 'Administration'],
  ['/app/profil', 'Ma fiche'],
  ['/app', 'Tableau de bord'],
]

const SECTIONS = [
  '/app/souhaits',
  '/app/missions',
  '/app/defraiements',
  '/app/disponibilites',
  '/app/stock',
  '/app/annuaire',
  '/app/admin',
  '/app/profil',
]

function pageTitle(path) {
  return (PAGE_TITLE.find(([p]) => path === p || (p !== '/app' && path.startsWith(p))) || [])[1] || 'Espace interne'
}

function sectionHome(path) {
  return SECTIONS.find(p => path === p || path.startsWith(p + '/')) || '/app'
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light'
  const next = cur === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
}

export default function Layout() {
  const { profile, signOut, can, canAccess, peutGererStock } = useAuth()
  const { checkForUpdate, checking } = useSwUpdate()
  const nav = useNavigate()
  const loc = useLocation()
  const [collapsed, setCollapsed] = useState(localStorage.getItem('nav_collapsed') === '1')
  const [sheet, setSheet] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width:900px)').matches)
  const [dark, setDark] = useState(() => (document.documentElement.getAttribute('data-theme') || 'light') === 'dark')

  useEffect(() => {
    const m = window.matchMedia('(min-width:900px)')
    const h = e => { setIsDesktop(e.matches); if (e.matches) setSheet(false) }
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  useEffect(() => { setSheet(false) }, [loc.pathname])
  useEffect(() => {
    if (!sheet) return
    function onKey(e) { if (e.key === 'Escape') setSheet(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet])

  function toggleCollapse() { const v = !collapsed; setCollapsed(v); localStorage.setItem('nav_collapsed', v ? '1' : '0') }
  function onTheme() { toggleTheme(); setDark(d => !d) }
  async function handleLogout() { await signOut(); nav('/login') }

  const items = [...NAV.filter(n => {
    if (n.key === 'missions') return true
    if (n.key === 'stock') return canAccess(n.key) && peutGererStock()
    return canAccess(n.key)
  }), ...(can('admin') ? [{ to:'/app/admin', label:'Administration', short:'Admin', icon:'⚙️', key:'admin' }] : [])]

  const primary = items.filter(n => PRIMARY_KEYS.includes(n.key))
  const home = sectionHome(loc.pathname)
  const atRoot = loc.pathname === home
  const tabBar = !isDesktop && atRoot
  const primaryOn = primary.some(n => n.end ? loc.pathname === n.to : (loc.pathname === n.to || loc.pathname.startsWith(n.to + '/')))
  const collapsedEff = isDesktop && collapsed
  const W = collapsedEff ? 66 : 250

  return (
    <div className={'ha-shell' + (tabBar ? ' has-tabs' : '')}>
      {isDesktop && (
        <aside className="ha-sidebar" style={{
          width: W, flexShrink:0, zIndex:60, background:'var(--surface)',
          borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column',
          padding:'14px 10px', overflow:'hidden', transition:'width .18s',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent: collapsedEff ? 'center' : 'space-between', flexDirection: collapsedEff ? 'column' : 'row', gap:8, padding:'2px 6px 14px' }}>
            <Logo size={collapsedEff ? 36 : 56} />
            <button onClick={toggleCollapse} title={collapsed?'Déplier le menu':'Replier le menu'} className="ha-collapse-btn" style={iconBtn}>{collapsedEff ? '»' : '«'}</button>
          </div>

          <nav style={{ display:'flex', flexDirection:'column', gap:4, flex:1, overflowY:'auto', minHeight:0 }} aria-label="Sections">
            {items.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
                className={({isActive}) => 'ha-nav-item' + (isActive ? ' is-active' : '')}
                style={({isActive}) => ({ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:10, textDecoration:'none', fontSize:14, fontWeight:isActive?600:500, color:isActive?'#fff':'var(--text-2)', background:isActive?'var(--accent)':'transparent', whiteSpace:'nowrap', justifyContent: collapsedEff?'center':'flex-start' })}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{!collapsedEff && n.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:8 }}>
            <NavLink to="/app/profil" title="Ma fiche"
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
      )}

      <div className="ha-maincol">
        <header className="ha-topbar">
          {!isDesktop && !atRoot && (
            <button type="button" className="ha-icon-btn" aria-label="Retour" onClick={() => nav(home)}>←</button>
          )}
          {!isDesktop && <Logo size={32} className="ha-header-logo" />}
          <div className="ha-topbar-title">{pageTitle(loc.pathname)}</div>
          {!isDesktop && tabBar && (
            <NavLink to="/app/profil" className="ha-head-avatar" aria-label="Ma fiche">
              <Avatar url={profile?.fiche?.photo_url} prenom={profile?.prenom} nom={profile?.nom} />
            </NavLink>
          )}
          {!isDesktop && !tabBar && (
            <button type="button" className="ha-icon-btn" aria-label="Ouvrir les sections" onClick={() => setSheet(true)}>☰</button>
          )}
        </header>
        <main><Outlet /></main>
        {tabBar && (
          <nav className="ha-tabbar" aria-label="Navigation principale">
            {primary.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({isActive}) => isActive ? 'is-active' : undefined}>
                <span className="ha-tab-ico" aria-hidden="true">{n.icon}</span>
                {n.short}
              </NavLink>
            ))}
            <button type="button" className={!primaryOn ? 'is-on' : undefined} aria-expanded={sheet} aria-label="Plus de sections" onClick={() => setSheet(true)}>
              <span className="ha-tab-ico" aria-hidden="true">☰</span>
              Plus
            </button>
          </nav>
        )}
      </div>

      {!isDesktop && sheet && (
        <div className="ha-sheet-scrim" onClick={() => setSheet(false)}>
          <div className="ha-sheet" role="dialog" aria-modal="true" aria-label="Sections" onClick={e => e.stopPropagation()}>
            <div className="ha-sheet-handle" />
            <div className="ha-sheet-head">
              <div>
                <div className="ha-sheet-who">{profile?.prenom} {profile?.nom}</div>
                <div className="ha-sheet-sub">Mêmes espaces que sur ordinateur</div>
              </div>
              <button type="button" className="ha-icon-btn" aria-label="Fermer" onClick={() => setSheet(false)}>✕</button>
            </div>
            <nav className="ha-sheet-nav" aria-label="Toutes les sections">
              {items.map(n => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setSheet(false)}>
                  <span aria-hidden="true">{n.icon}</span>{n.label}
                </NavLink>
              ))}
              <NavLink to="/app/profil" onClick={() => setSheet(false)}><span aria-hidden="true">👤</span>Ma fiche</NavLink>
            </nav>
            <div className="ha-sheet-account">
              <button type="button" className="ha-sheet-row" onClick={onTheme}>{dark ? '☀︎ Thème clair' : '☾ Thème sombre'}</button>
              <button type="button" className="ha-sheet-row" onClick={checkForUpdate} disabled={checking}>{checking ? 'Recherche…' : '↻ Rechercher des mises à jour'}</button>
              <button type="button" className="ha-sheet-row ha-sheet-out" onClick={handleLogout}>↩︎ Déconnexion</button>
            </div>
            <div className="ha-sheet-copy">{COPYRIGHT}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function Avatar({ url, prenom, nom }) {
  const initiales = `${(prenom||'').charAt(0)}${(nom||'').charAt(0)}`.toUpperCase()
  return (
    <div className="ha-avatar">
      {url ? <img src={url} alt="" /> : (initiales || '?')}
    </div>
  )
}

const iconBtn = { background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', fontSize:15, color:'var(--text-2)', cursor:'pointer', lineHeight:1 }
const rowBtn = (collapsed) => ({ width:'100%', textAlign: collapsed?'center':'left', padding:'9px 10px', background:'transparent', border:'none', borderRadius:8, fontSize:13.5, color:'var(--text-2)', cursor:'pointer' })
